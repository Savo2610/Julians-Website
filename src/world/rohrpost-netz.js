import * as THREE from 'three'

// Die Rohrpost ist ein Netz unter dem Schnee. Nach einer Sendung (das
// Upload-Fenster geht zu) fallen die Kapseln in den Trichter, das Rohr
// schluckt (props/upload-pipe.js), und dann laeuft eine Beule wie ein
// Maulwurf unter der Schneedecke zum Funkmast hinter der gefrorenen Quelle,
// der kurz funkt: angekommen. Zum Einwerfen zoomt die Kamera ans Rohr –
// dieselbe Kamerafahrt wie beim Heranzoomen an eine Station –, sobald der
// Maulwurf loslaeuft, ist sie wieder beim Fahrer.
//
// Die Spur ist nicht in die Schneetextur gestempelt: die haelt fuer immer
// (Max-Blending, siehe snow-trail.js), eine Maulwurfspur soll aber wieder
// zutauen. Deshalb eigene Huegelchen, die wachsen und wieder einsinken.
//
// Der Weg ist handgelegt und gegen die ausgelesenen Hindernisse geprueft
// (30.09.): nordlich am Tunnel der Abkuerzung vorbei, zwischen Bank und
// Tunnel hindurch, oberhalb des Seeufers (jeder Punkt > 17 m vom
// Seemittelpunkt) an den Tannen vorbei und hinter dem Felsrahmen der
// Quelle herum zum Mast. Gut 47 m.
const WEG = [
  [-21.6, 19.8], [-27, 21.5], [-34, 21.7], [-40, 22.4], [-46, 23.0],
  [-52, 23.2], [-56.5, 22.9], [-61, 23.6], [-61.4, 27.5], [-60.9, 29.1],
]
const TEMPO = 11          // m/s unter dem Schnee
const HUEGEL_ALLE = 0.3   // m zwischen zwei Huegelchen – dicht, sonst eine Perlenkette
const STEHEN = 3.2        // s, bis ein Huegelchen einsinkt
const TAUEN = 2.4         // s bis es ganz weg ist
const FUNKEN = 2.2        // s Funkspruch am Mast

export class RohrpostNetz {
  constructor({ pipe, tower, world, camera, input }) {
    this.pipe = pipe
    this.tower = tower
    this.world = world
    this.camera = camera
    this.input = input
    this.aktiv = false
    this._uhr = 0
    this._plan = null
    this._kamera = false

    const punkte = WEG.map(([x, z]) => new THREE.Vector3(x, 0, z))
    this._kurve = new THREE.CatmullRomCurve3(punkte, false, 'centripetal')
    this._laenge = this._kurve.getLength()

    // Huegelchen als ein InstancedMesh: bis zu 170 auf einmal, ein Draw Call.
    const n = Math.ceil(this._laenge / HUEGEL_ALLE) + 4
    const geo = new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2)
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f6fa, roughness: 0.95, flatShading: true })
    this._huegel = new THREE.InstancedMesh(geo, mat, n)
    this._huegel.count = 0
    this._huegel.castShadow = true
    this._huegel.receiveShadow = true
    this._huegel.frustumCulled = false
    world.scene.add(this._huegel)
    this._geboren = []   // { x, y, z, t, r, richtung }

    // Der Kopf: ein groesserer Buckel, der wackelt, und Kruemel davor.
    this._kopf = new THREE.Mesh(geo, mat)
    this._kopf.castShadow = true
    this._kopf.visible = false
    world.scene.add(this._kopf)
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
  versenden({ angekommen = 0, gescheitert = 0 } = {}) {
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
    this._plan = {
      // Laeuft nichts durch, bleibt es beim Husten am Rohr.
      start: unten,
      ende: unten === null ? 3.2 : unten + this._laenge / TEMPO,
      fertig: unten === null ? 3.4 : unten + this._laenge / TEMPO + FUNKEN,
      gefunkt: false,
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
        // Huegelchen nachziehen, bis der Kopf da ist, wo er jetzt ist.
        while (this._geboren.length * HUEGEL_ALLE < s) {
          const w = (this._geboren.length * HUEGEL_ALLE) / this._laenge
          const q = this._kurve.getPointAt(w)
          const quer = this._kurve.getTangentAt(w)
          // Nicht schnurgerade: ein Maulwurf schlingert.
          const seit = Math.sin(this._geboren.length * 0.9) * 0.16
          q.x += -quer.z * seit
          q.z += quer.x * seit
          this._geboren.push({
            x: q.x, z: q.z, y: this.world.heightAt(q.x, q.z), t,
            richtung: Math.atan2(quer.x, quer.z) + (Math.random() - 0.5) * 0.4,
            r: 0.42 + Math.random() * 0.12,
          })
        }
        this._kopf.visible = true
        const wackel = Math.sin(t * 26) * 0.06
        this._kopf.position.set(this._p.x, y - 0.08, this._p.z)
        this._kopf.scale.set(0.55 + wackel, 0.36 - wackel, 0.55 + wackel)
        if (Math.random() < dt * 30) this._kruemelWerfen(this._p.x, y + 0.2, this._p.z)
      } else {
        this._kopf.visible = false
        if (!plan.gefunkt) {
          plan.gefunkt = true
          this.tower.userData.funken?.(FUNKEN)
          for (let i = 0; i < 6; i++) this._kruemelWerfen(this._p.x, y + 0.2, this._p.z)
        }
      }
      // Die Kamera bleibt nur fuers Einwerfen am Rohr. Dem Maulwurf fuhr
      // sie erst bis zum Mast hinterher; Julian wollte danach wieder die
      // normale Kamera (30.09.). Wer hinsieht, sieht die Spur loslaufen.
      this._kameraZurueck()
    }

    if (t >= plan.fertig) {
      this.aktiv = false
      this._kameraZurueck()
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
      let hoch
      if (a < 0.15) hoch = a / 0.15
      else if (a < STEHEN) hoch = 1
      else hoch = Math.max(0, 1 - (a - STEHEN) / TAUEN)
      if (hoch <= 0) continue
      this._dummy.position.set(h.x, h.y - 0.05, h.z)
      // Laengs zur Spur gestreckt, damit die Huegel zu einem Wall verschmelzen.
      this._dummy.rotation.set(0, h.richtung, 0)
      this._dummy.scale.set(h.r * (0.8 + 0.2 * hoch), h.r * 0.42 * hoch, h.r * 1.25 * (0.8 + 0.2 * hoch))
      this._dummy.updateMatrix()
      this._huegel.setMatrixAt(n++, this._dummy.matrix)
    }
    if (!this.aktiv && n === 0) this._geboren.length = 0
    this._huegel.count = n
    this._huegel.instanceMatrix.needsUpdate = true
  }
}
