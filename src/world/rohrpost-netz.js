import * as THREE from 'three'
import { CAMERA } from '../config.js'

// Die Rohrpost ist ein Netz unter dem Schnee. Nach einer Sendung (das
// Upload-Fenster geht zu) fallen die Kapseln in den Trichter, das Rohr
// schluckt (props/upload-pipe.js), und dann laeuft eine Beule wie ein
// Maulwurf unter der Schneedecke zum Funkmast hinter der gefrorenen Quelle,
// der kurz funkt: angekommen. Zum Einwerfen zoomt die Kamera ans Rohr –
// dieselbe Kamerafahrt wie beim Heranzoomen an eine Station. War ein Bild
// oder Text dabei, folgt sie dem Maulwurf weit draussen bis zum Mast, ohne
// sich zu drehen, und weiter zur Quelle, wo es 30 s im Eis steht – aus
// dem Browser, also nur fuer den, der es eingeworfen hat. Sonst ist sie
// zurueck beim Fahrer, sobald der Maulwurf loslaeuft.
//
// Die Spur ist nicht in die Schneetextur gestempelt: die haelt fuer immer
// (Max-Blending, siehe snow-trail.js), eine Maulwurfspur soll aber wieder
// zutauen. Deshalb eigene Huegelchen, die wachsen und wieder einsinken.
//
// Der Weg ist verlegt wie ein Rohr: zwei Geraden und ein gerundeter Knick.
// Vorher lief er durch zehn Punkte und schlingerte – niemand verlegt so
// ein krummes Rohr (Julian, 30.09.). Die erste Gerade geht vom Rohr
// nordlich am Tunnel der Abkuerzung und an der Bank vorbei, oberhalb des
// Seeufers (ueberall mehr als 19 m vom Seemittelpunkt, das Ufer liegt bei
// 17) bis hinter den Felsrahmen der Quelle; die zweite biegt zum Mast ab.
// Gegen die ausgelesenen Hindernisse geprueft: mindestens 0,6 m bis zum
// Rand von Fels, Baum oder Tunnel. Gut 45 m.
const WEG = [[-21.6, 19.8], [-61.2, 23.4], [-61.3, 29.0]]
const KNICK = 1.6         // m Radius der Rundung am Knick
// Erst 11 m/s: gut vier Sekunden, das wirkte wie ein Spaziergang. Mit 26
// ist sie in knapp zwei Sekunden am Mast – das ist Rohrpost (30.09.).
const TEMPO = 26          // m/s unter dem Schnee
const HUEGEL_ALLE = 0.3   // m zwischen zwei Huegelchen – dicht, sonst eine Perlenkette
const KLUMPEN = 0.45      // Anteil der Schritte, die einen Klumpen zur Seite werfen
const STEHEN = 3.2        // s, bis ein Huegelchen einsinkt
const TAUEN = 2.4         // s bis es ganz weg ist
const FUNKEN = 2.2        // s Funkspruch am Mast
// Was hochgeladen wurde, bleibt 30 s im Eis der Quelle; die Kamera steht
// davor nur die ersten 3,5 s. Erst verschwand es mit ihr, und wer danach
// selbst hinfuhr, fand nichts mehr (Julian, 30.09.).
const VORSCHAU = 3.5      // s Kamera vor der Quelle, ganz aufgetaut
const IM_EIS = 30         // s steht es insgesamt im Eis

export class RohrpostNetz {
  // quelle: die Station der gefrorenen Quelle (Position, Boden, Fokus),
  // feed: ihre Anzeige (stations/broadcast.js) – dort steht nach der
  // Ankunft kurz das hochgeladene Bild.
  constructor({ pipe, tower, world, camera, input, quelle = null, feed = null }) {
    this.pipe = pipe
    this.tower = tower
    this.quelle = quelle
    this.feed = feed
    this._lauf = 0
    this._folie = null
    this.world = world
    this.camera = camera
    this.input = input
    this.aktiv = false
    this._uhr = 0
    this._plan = null
    this._kamera = false

    this._kurve = rohrweg(WEG, KNICK)
    this._laenge = this._kurve.getLength()

    // Huegelchen als ein InstancedMesh, ein Draw Call. Platz fuer einen
    // Huegel je Schritt und einen Klumpen daneben.
    const n = Math.ceil(this._laenge / HUEGEL_ALLE) * 2 + 8
    const geo = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.95, flatShading: true })
    this._huegel = new THREE.InstancedMesh(geo, mat, n)
    this._huegel.count = 0
    this._huegel.castShadow = true
    this._huegel.receiveShadow = true
    this._huegel.frustumCulled = false
    world.scene.add(this._huegel)
    this._geboren = []   // { x, y, z, t, breit, hoch, lang, richtung, stehen, tauen }
    this._gelegt = 0     // m Spur, die schon aufgeworfen ist

    // Vorn fliegen nur Kruemel. Einen eigenen, wackelnden Buckel als Kopf
    // gab es: am Rohr sah er aus wie ein Schneeball, der losrollt, und nahm
    // die Vorstellung, dass sich etwas *unter* dem Schnee bewegt.
    this._kruemel = []
    const kGeo = new THREE.IcosahedronGeometry(0.07, 0)
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(kGeo, mat)
      m.visible = false
      world.scene.add(m)
      this._kruemel.push({ m, v: new THREE.Vector3(), alter: -1 })
    }

    this._p = new THREE.Vector3()
    this._dummy = new THREE.Object3D()
    this._ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  // { angekommen, gescheitert } aus dem Upload-Fenster.
  versenden({ angekommen = 0, gescheitert = 0, bild = null, text = '' } = {}) {
    if (this.aktiv) return
    const fehler = gescheitert > 0
    if (!angekommen && !fehler) {
      this.pipe.userData.hmpf?.()
      return
    }
    const { unten } = this.pipe.userData.versenden({ n: angekommen, fehler })
    this.aktiv = true
    this._uhr = 0
    this._geboren.length = 0
    this._gelegt = 0
    this._plan = {
      // Laeuft nichts durch, bleibt es beim Husten am Rohr.
      start: unten,
      ende: unten === null ? 3.2 : unten + this._laenge / TEMPO,
      fertig: unten === null ? 3.4 : unten + this._laenge / TEMPO + FUNKEN,
      gefunkt: false,
      zurQuelle: false,
      gestartet: false,
    }
    // Bild oder Text dabei: schon jetzt zeichnen, damit es fertig ist, wenn
    // der Maulwurf loslaeuft. Kommt es erst spaeter, faellt die Vorschau aus.
    const lauf = ++this._lauf
    this._folieWeg()
    if ((bild || text.trim()) && this.feed && this.quelle && !this._ruhig) {
      this.feed.vorbereiten({ bild, text }).then((f) => {
        if (lauf === this._lauf && this.aktiv && !this._plan.gestartet) this._folie = f
        else f?.texture.dispose()
      })
    }
    // Erst ans Rohr heran. Wer Bewegung abgeschaltet hat, bekommt keine
    // Kamerafahrt, nur was am Rohr passiert.
    if (!this._ruhig) {
      this._kamera = true
      this.input.locked = true
      const p = this.pipe.position
      this.camera.fokus({ x: p.x, y: p.y + 1.4, z: p.z, abstand: 11 })
    }
  }

  // Esc, Enter oder Tippen: die Kamera kommt zurueck, der Maulwurf laeuft
  // allein weiter.
  ueberspringen() {
    this._kameraZurueck()
  }

  _folieWeg() {
    this._folie?.texture.dispose()
    this._folie = null
  }

  _kameraZurueck() {
    if (!this._kamera) return
    this._kamera = false
    this.input.locked = false
    this.camera.fokus(null)
  }

  update(dt) {
    // Die Uhr laeuft nach dem Ende weiter, damit die Spur fertig zutaut.
    if (!this.aktiv && this._geboren.length) this._uhr += dt
    this._kruemelLaufen(dt)
    this._huegelZeichnen()
    if (!this.aktiv) return
    this._uhr += dt
    const plan = this._plan
    const t = this._uhr

    if (plan.start !== null && t >= plan.start) {
      const s = Math.min(this._laenge, (t - plan.start) * TEMPO)
      const u = s / this._laenge
      this._kurve.getPointAt(u, this._p)
      const y = this.world.heightAt(this._p.x, this._p.z)

      if (t < plan.ende) {
        // Huegelchen nachziehen bis dahin, wo der Maulwurf jetzt ist.
        while (this._gelegt < s) {
          this._aufwerfen(this._gelegt / this._laenge, t)
          this._gelegt += HUEGEL_ALLE * (0.8 + Math.random() * 0.4)
        }
        if (Math.random() < dt * 30) this._kruemelWerfen(this._p.x, y + 0.2, this._p.z)
      } else {
        if (!plan.gefunkt) {
          plan.gefunkt = true
          this.tower.userData.funken?.(FUNKEN)
          for (let i = 0; i < 6; i++) this._kruemelWerfen(this._p.x, y + 0.2, this._p.z)
        }
      }
      // Die Kamera folgt dem Maulwurf nur, wenn am Ende etwas im Eis der
      // Quelle steht – ein Bild oder der Text. Dann weit draussen (28 m),
      // damit man die Spur als Linie durchs Tal sieht, und weiter zur
      // Quelle. Ohne etwas zu zeigen ist sie zurueck beim
      // Fahrer, sobald der Maulwurf loslaeuft: nur fuer einen Funkspruch
      // quer durchs Tal zu fahren war zu viel (Julian, 30.09.).
      if (!plan.gestartet) {
        plan.gestartet = true
        if (this._folie && this._kamera) {
          plan.zurQuelle = true
          plan.fertig = Math.max(plan.fertig, plan.ende + VORSCHAU + 0.3)
        } else {
          this._folieWeg()
          this._kameraZurueck()
        }
      }
      if (this._kamera) {
        if (plan.zurQuelle && plan.gefunkt) {
          const q = this.quelle
          const f = q.focus
          const az = CAMERA.azimuth
          this.camera.fokus({
            x: q.position.x + Math.sin(az) * f.vor,
            y: q.groundY + f.hoehe,
            z: q.position.z + Math.cos(az) * f.vor,
            abstand: f.abstand,
          })
        } else {
          // Der Mast steht gleich neben der Quelle; wer dort ankommt, sieht
          // ihn im Bild funken, ein eigener Halt am Mast braucht es nicht.
          this.camera.fokus({ x: this._p.x, y: y + 0.4, z: this._p.z, abstand: 28 })
        }
      }
      if (plan.zurQuelle && plan.gefunkt && this._folie) {
        this.feed.vorschau(this._folie, IM_EIS, VORSCHAU)
        this._folie = null
      }
    }

    if (t >= plan.fertig) {
      this.aktiv = false
      this._kameraZurueck()
    }
  }

  // Ein Schritt Spur: der Wall selbst folgt dem Rohr fast genau, der
  // Schnee darauf ist ungleich – verschieden breit, hoch und gedreht, dazu
  // hier und da ein Klumpen, der zur Seite geworfen wurde. Vorher war jeder
  // Huegel gleich gross und die Spur sah gegossen aus. Getaut wird auch
  // ungleich, sonst verschwaende sie wie ein Strich.
  _aufwerfen(w, t) {
    const q = this._kurve.getPointAt(Math.min(1, w))
    const tan = this._kurve.getTangentAt(Math.min(1, w))
    const richtung = Math.atan2(tan.x, tan.z)
    const zufall = Math.random
    const neu = (seit, vor, groesse, flach, verzug) => {
      const x = q.x - tan.z * seit + tan.x * vor
      const z = q.z + tan.x * seit + tan.z * vor
      this._geboren.push({
        x, z, y: this.world.heightAt(x, z), t: t + verzug,
        breit: groesse * (0.75 + zufall() * 0.5), lang: groesse * (0.9 + zufall() * 0.9), hoch: groesse * flach,
        richtung: richtung + (zufall() - 0.5) * 1.1,
        stehen: STEHEN * (0.7 + zufall() * 0.6), tauen: TAUEN * (0.7 + zufall() * 0.6),
      })
    }
    neu((zufall() - 0.5) * 0.14, 0, 0.36 + zufall() * 0.26, 0.3 + zufall() * 0.22, 0)
    if (zufall() < KLUMPEN) {
      const seite = zufall() < 0.5 ? -1 : 1
      neu(seite * (0.45 + zufall() * 0.5), (zufall() - 0.5) * 0.3, 0.1 + zufall() * 0.16, 0.55 + zufall() * 0.4, 0.04 + zufall() * 0.08)
    }
  }

  _kruemelWerfen(x, y, z) {
    const k = this._kruemel.find((c) => c.alter < 0)
    if (!k) return
    k.alter = 0
    k.m.position.set(x, y, z)
    k.v.set((Math.random() - 0.5) * 2.2, 2 + Math.random() * 1.5, (Math.random() - 0.5) * 2.2)
    k.m.visible = true
  }

  _kruemelLaufen(dt) {
    for (const k of this._kruemel) {
      if (k.alter < 0) continue
      k.alter += dt
      k.v.y -= 9 * dt
      k.m.position.addScaledVector(k.v, dt)
      if (k.alter > 0.7) { k.alter = -1; k.m.visible = false }
    }
  }

  // Jedes Huegelchen: schnell aufwerfen, stehen, langsam einsinken.
  _huegelZeichnen() {
    const jetzt = this._uhr
    let n = 0
    for (const h of this._geboren) {
      const a = jetzt - h.t
      if (a < 0) continue
      let hoch
      if (a < 0.15) hoch = a / 0.15
      else if (a < h.stehen) hoch = 1
      else hoch = Math.max(0, 1 - (a - h.stehen) / h.tauen)
      if (hoch <= 0) continue
      this._dummy.position.set(h.x, h.y - 0.05, h.z)
      // Laengs zur Spur gestreckt, damit die Huegel zu einem Wall verschmelzen.
      this._dummy.rotation.set(0, h.richtung, 0)
      const k = 0.8 + 0.2 * hoch
      this._dummy.scale.set(h.breit * k, h.hoch * hoch, h.lang * k)
      this._dummy.updateMatrix()
      this._huegel.setMatrixAt(n++, this._dummy.matrix)
    }
    if (!this.aktiv && n === 0) this._geboren.length = 0
    this._huegel.count = n
    this._huegel.instanceMatrix.needsUpdate = true
  }
}

// Geraden zwischen den Punkten, an jedem inneren Punkt eine Rundung mit
// dem Radius r – wie ein Rohr mit Bogenstueck.
function rohrweg(punkte, r) {
  const v = punkte.map(([x, z]) => new THREE.Vector3(x, 0, z))
  const weg = new THREE.CurvePath()
  let von = v[0]
  for (let i = 1; i < v.length - 1; i++) {
    const rein = v[i].clone().sub(v[i - 1]).normalize()
    const raus = v[i + 1].clone().sub(v[i]).normalize()
    const a = v[i].clone().addScaledVector(rein, -r)
    const b = v[i].clone().addScaledVector(raus, r)
    weg.add(new THREE.LineCurve3(von, a))
    weg.add(new THREE.QuadraticBezierCurve3(a, v[i], b))
    von = b
  }
  weg.add(new THREE.LineCurve3(von, v.at(-1)))
  return weg
}
