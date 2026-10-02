import { terrainHeight, playAreaDistance } from '../heightfield.js'
import { isSnowSurface } from '../surfaces.js'
import { createHase } from './modelle.js'
import { abdruck, amHang, buckel, glatt, imBild, stauben, winkelDiff } from './werkzeug.js'

// Der Schneehase. Er kommt aus dem Wald, hoppelt ein paar Meter ins Offene,
// setzt sich und mümmelt. Wer auf ihn zufaehrt, sieht ihn erst Maennchen
// machen und dann davonjagen – mit Haken, wenn man zu nah kommt – und er
// laesst seine Spur im Schnee zurueck. Laesst man ihn in Ruhe, hoppelt er
// nach einer Weile von selbst zurueck in den Bestand.
//
// Wie schuechtern er ist, haengt am Tempo: im Stand kommt man bis auf
// knapp fuenf Meter heran, gekantet (6,5 m/s) auf zehn, im Grundtempo
// (13 m/s) flieht er schon bei fuenfzehn. Anschleichen geht also, aber nur
// langsam – genau wie bei einem echten.

const RUHE = 4.5          // m, so nah darf man im Stand heran
const JE_TEMPO = 0.8      // m Fluchtabstand je m/s
const WACHSAM = 5.5       // m vor der Fluchtdistanz macht er Maennchen
const HAKEN_AB = 5.5      // m, ab hier schlaegt er Haken
const BLEIBT = [100, 180] // s, so lange sitzt er, wenn niemand kommt –
                          // lang genug, dass man zufaellig vorbeikommt

const zufall = (a, b) => a + Math.random() * (b - a)

export class Hase {
  constructor({ scene, trail, spray, camera, world, wald }, { von, ziel, ausgang }) {
    this.scene = scene
    this.trail = trail
    this.spray = spray
    this.camera = camera
    this.world = world
    this.wald = wald

    this.m = createHase()
    scene.add(this.m.root)

    this.x = von.x
    this.z = von.z
    this.gier = Math.atan2(ziel.x - von.x, ziel.z - von.z)
    this.ziel = ziel
    // Sein Platz am Waldrand: weiter als ein paar Meter entfernt er sich nicht.
    this.heim = ziel
    this.gesessen = 0
    this.umzug = zufall(15, 30)
    this.ausgang = ausgang
    this.zustand = 'kommen'
    this.zeit = 0
    this.bleibt = zufall(...BLEIBT)
    this.sprung = null
    this.pause = 0
    this.tun = null          // Beschaeftigung im Sitzen
    this.tunZeit = 0
    this.hakenSperre = 0
    this.fluchtRichtung = null
    this.ausserBild = 0
    this.spurWeg = 2
    this.lebt = true
    this.uhr = Math.random() * 10

    // Aktuelle und Ziel-Gelenkwinkel. Alles laeuft ueber diese Zahlen, damit
    // jeder Wechsel weich ist – ein Hase springt nicht von Pose zu Pose.
    this.pose = { rumpf: 0, kopfX: 0, kopfY: 0, kopfZ: 0, ohrX: [-0.2, -0.2], ohrZ: [0, 0], hinten: 0, vorn: 0, hub: 0, streck: 1 }
    this.soll = { ...this.pose, ohrX: [...this.pose.ohrX], ohrZ: [...this.pose.ohrZ] }
    this._setzen(0)
  }

  // Ab hier sieht man ihn (fuer den Pistenpass oder Neugierige).
  get gesehen() { return this._gesehen === true }

  update(dt, skier) {
    if (!this.lebt) return false
    this.zeit += dt
    this.uhr += dt
    this.hakenSperre -= dt

    const dx = this.x - skier.position.x
    const dz = this.z - skier.position.z
    const d = Math.hypot(dx, dz)
    // Kommt er naeher? Nur dann zaehlt das Tempo voll; wer quer vorbeifaehrt,
    // erschreckt ihn weniger als wer direkt auf ihn zuhaelt.
    const naht = d > 0.01 ? (skier.forward.x * dx + skier.forward.z * dz) / d : 0
    const tempo = skier.speed * (0.45 + 0.55 * Math.max(0, naht))
    const flucht = RUHE + tempo * JE_TEMPO

    const sichtbar = imBild(this.camera, this.x, terrainHeight(this.x, this.z) + 0.3, this.z, 1.08)
    if (sichtbar) this._gesehen = true

    switch (this.zustand) {
      case 'kommen':
      case 'sitzen':
      case 'gehen':
        if (d < flucht) this._fliehen(skier)
        else if (d < flucht + WACHSAM && naht > 0.3 && skier.speed > 1.5) this._wechsel('wachsam')
        break
      case 'wachsam':
        if (d < flucht) this._fliehen(skier)
        // Erst wenn man eine Weile weit genug weg bleibt, beruhigt er sich.
        else if (d > flucht + WACHSAM + 2) {
          if (this.zeit > 2.5) this._wechsel('sitzen')
        } else this.zeit = Math.min(this.zeit, 1)
        break
    }

    if (this.zustand === 'sitzen') {
      this.gesessen += dt
      this.umzug -= dt
    }

    this._bewegen(dt, skier, d)
    this._posieren(dt, skier)

    // Gegangen wird nur, wo niemand hinschaut.
    if (this.zustand === 'flucht' || this.zustand === 'gehen') {
      this.ausserBild = sichtbar ? 0 : this.ausserBild + dt
      if (this.ausserBild > 0.6) this.entfernen()
    }
    if (d > 90 || this.zeit > 240) this.entfernen()
    return this.lebt
  }

  entfernen() {
    if (!this.lebt) return
    this.lebt = false
    this.scene.remove(this.m.root)
    this.m.root.traverse((o) => o.geometry?.dispose())
  }

  _wechsel(z) {
    this.zustand = z
    this.zeit = 0
    if (z === 'sitzen') this.tun = null
  }

  _fliehen(skier) {
    if (this.zustand !== 'flucht') {
      this._wechsel('flucht')
      // Ein Augenblick Schreckstarre, dann geht es los.
      if (!this.sprung) this.pause = 0.12
    }
  }

  // --- Fortbewegung ----------------------------------------------------------
  _bewegen(dt, skier, d) {
    if (this.sprung) {
      const s = this.sprung
      s.t += dt / s.dauer
      // In der ersten Haelfte dreht er sich in die neue Richtung.
      this.gier += winkelDiff(this.gier, s.gier) * Math.min(1, glatt(18, dt) * (s.t < 0.45 ? 1 : 0.4))
      if (s.t >= 1) {
        this.x = s.nach.x
        this.z = s.nach.z
        this.sprung = null
        // Beim ruhigen Hoppeln ueberlappen sich die Abdruecke (0,7 m Sprung,
        // 1,2 m Stempel) – dann nur jeden, der wieder Platz hat.
        this.spurWeg += Math.hypot(s.nach.x - s.von.x, s.nach.z - s.von.z)
        if (this.spurWeg > 1.1) {
          this.spurWeg = 0
          abdruck(this.trail, 'hase', this.x, this.z, s.gier, s.ruhig ? 0.45 : 0.6)
        }
        if (!s.ruhig) stauben(this.spray, this.x, terrainHeight(this.x, this.z), this.z, 4, 0.9)
      } else {
        const p = s.t
        this.x = s.von.x + (s.nach.x - s.von.x) * p
        this.z = s.von.z + (s.nach.z - s.von.z) * p
      }
      return
    }

    if (this.pause > 0) {
      this.pause -= dt
      return
    }

    switch (this.zustand) {
      case 'kommen': {
        const rest = Math.hypot(this.ziel.x - this.x, this.ziel.z - this.z)
        if (rest < 0.6) { this._wechsel('sitzen'); return }
        this._hopsZu(this.ziel, true)
        // Unterwegs ab und zu stehen bleiben und sichern.
        this.pause = Math.random() < 0.18 ? zufall(0.8, 2) : zufall(0.08, 0.5)
        break
      }
      case 'gehen': {
        // Steht der Ausgang inzwischen im Bild (die Kamera ist mitgezogen),
        // geht es tiefer in den Wald.
        if (Math.hypot(this.ausgang.x - this.x, this.ausgang.z - this.z) < 0.8) {
          const r = this.wald.richtung(this.x, this.z, 14) || { x: Math.sin(this.gier), z: Math.cos(this.gier) }
          this.ausgang = { x: this.x + r.x * 6, z: this.z + r.z * 6 }
        }
        this._hopsZu(this.ausgang, true)
        this.pause = zufall(0.05, 0.35)
        break
      }
      case 'sitzen': {
        if (this.gesessen > this.bleibt) { this._wechsel('gehen'); return }
        // Ab und zu ein paar Meter weiter, mit Sichern unterwegs – so sieht
        // man ihn auch aus der Ferne einmal hoppeln, nicht nur still sitzen.
        // Nicht oefter: ein Hase, der dauernd unterwegs ist, wirkt aufgezogen.
        if (this.umzug <= 0 && this.tun !== 'maennchen' && this.tun !== 'putzen') {
          const platz = this._neuerPlatz()
          this.umzug = platz ? zufall(15, 30) : 5
          if (platz) {
            this.ziel = platz
            this._wechsel('kommen')
            return
          }
        }
        // Gelegentlich ein, zwei Hopser weiter – nie weit vom Platz.
        if (this.tun === 'hopsen') {
          const a = this.gier + zufall(-1.4, 1.4)
          let tx = this.x + Math.sin(a) * 0.7
          let tz = this.z + Math.cos(a) * 0.7
          if (Math.hypot(tx - this.ziel.x, tz - this.ziel.z) > 2.5) { tx = this.ziel.x; tz = this.ziel.z }
          this._hopsZu({ x: tx, z: tz }, true)
          this.tun = Math.random() < 0.5 ? 'hopsen' : null
          this.tunZeit = 0
          this.pause = zufall(0.2, 0.6)
        }
        break
      }
      case 'flucht': {
        const weg = { x: this.x - skier.position.x, z: this.z - skier.position.z }
        const l = Math.hypot(weg.x, weg.z) || 1
        weg.x /= l
        weg.z /= l
        let r = this.fluchtRichtung
        if (!r) {
          // Weg vom Fahrer, aber in Deckung: am liebsten dorthin, woher er
          // kam – den Wald kennt er. Liegt der hinter dem Fahrer, zum
          // naechsten dichten Bestand. Nur nach dem Schwerpunkt der Baeume
          // rannte er einmal quer ueber die offene Piste zur Talstation.
          const hx = this.ausgang.x - this.x
          const hz = this.ausgang.z - this.z
          const hl = Math.hypot(hx, hz) || 1
          let w = { x: hx / hl, z: hz / hl }
          if (w.x * weg.x + w.z * weg.z < -0.2) w = this.wald.richtung(this.x, this.z, 26) || weg
          r = { x: weg.x + w.x * 1.2, z: weg.z + w.z * 1.2 }
          if (r.x * weg.x + r.z * weg.z < 0.25) r = weg
        } else {
          // Laufend nachfuehren, sonst rennt er im Bogen auf den Fahrer zu.
          r = { x: r.x * 0.75 + weg.x * 0.25, z: r.z * 0.75 + weg.z * 0.25 }
        }
        // Haken: ist man ihm dicht auf den Fersen, springt er quer zur
        // Fahrtlinie weg und sogar ein Stueck zurueck. Mit dreizehn Metern
        // je Sekunde und 3,1 rad/s Lenkung schiesst man daran vorbei –
        // nur quer (ohne zurueck) holte ein Autopilot ihn auf 0,5 m ein.
        const naht = skier.forward.x * weg.x + skier.forward.z * weg.z
        if (d < HAKEN_AB && this.hakenSperre <= 0 && skier.speed > 4 && naht > 0.4) {
          const lx = this.x - skier.position.x
          const lz = this.z - skier.position.z
          const vor = lx * skier.forward.x + lz * skier.forward.z
          let px = lx - skier.forward.x * vor
          let pz = lz - skier.forward.z * vor
          const pl = Math.hypot(px, pz)
          if (pl < 0.2) { px = skier.forward.z; pz = -skier.forward.x } else { px /= pl; pz /= pl }
          r = { x: px - skier.forward.x * 0.45, z: pz - skier.forward.z * 0.45 }
          this.hakenSperre = 0.6
        }
        const rl = Math.hypot(r.x, r.z) || 1
        r.x /= rl
        r.z /= rl
        // Nicht ueber den Kartenrand hinaus: dort steigt der Gebirgsrand an.
        if (playAreaDistance(this.x + r.x * 3, this.z + r.z * 3) > 9) {
          const t = r.x
          r.x = r.z
          r.z = -t
          if (playAreaDistance(this.x + r.x * 3, this.z + r.z * 3) > 9) { r.x = -r.x; r.z = -r.z }
        }
        this.fluchtRichtung = r
        // Die ersten Spruenge kuerzer: er muss erst auf Tempo kommen.
        // Voll ausgreifend 2,6 m in 0,25 s: gut zehn Meter je Sekunde.
        const laenge = Math.min(2.6, 1.3 + this.zeit * 1.8)
        this._hops(r.x, r.z, laenge, 0.25, 0.36, false)
        break
      }
    }
  }

  // 2,5–5 m weiter, hoechstens 7 m vom Heimplatz, frei und auf Schnee.
  _neuerPlatz() {
    for (let i = 0; i < 20; i++) {
      const a = Math.random() * Math.PI * 2
      const r = zufall(2.5, 5)
      const x = this.x + Math.sin(a) * r
      const z = this.z + Math.cos(a) * r
      if (Math.hypot(x - this.heim.x, z - this.heim.z) > 7) continue
      if (playAreaDistance(x, z) > -2 || !isSnowSurface(x, z, 1)) continue
      if (this.wald.naechster(x, z, 1.2) < 1.2) continue
      if (this.world.nearby(x, z).some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.8)) continue
      return { x, z }
    }
    return null
  }

  _hopsZu(p, ruhig) {
    const dx = p.x - this.x
    const dz = p.z - this.z
    const l = Math.hypot(dx, dz)
    if (l < 0.05) return
    const laenge = Math.min(l, zufall(0.55, 0.85))
    this._hops(dx / l, dz / l, laenge, 0.38, 0.12, ruhig)
  }

  _hops(rx, rz, laenge, dauer, hoehe, ruhig) {
    let nx = this.x + rx * laenge
    let nz = this.z + rz * laenge
    // An Baeumen und Steinen vorbeigleiten wie der Fahrer.
    const r = this.world.resolve(nx, nz, 0.3, 0, 0, 0)
    nx = r.x
    nz = r.z
    // Abgeprallt: beim naechsten Mal entlang des Hindernisses.
    if (r.hit && this.fluchtRichtung) {
      const l = Math.hypot(r.pushX, r.pushZ) || 1
      this.fluchtRichtung = { x: rx + (r.pushX / l) * 0.9, z: rz + (r.pushZ / l) * 0.9 }
    }
    const gier = Math.atan2(nx - this.x, nz - this.z)
    this.sprung = { von: { x: this.x, z: this.z }, nach: { x: nx, z: nz }, t: 0, dauer, hoehe, ruhig, gier }
    if (!ruhig) stauben(this.spray, this.x, terrainHeight(this.x, this.z), this.z, 2, 0.7)
  }

  // --- Haltung -----------------------------------------------------------------
  _posieren(dt, skier) {
    const s = this.soll
    const t = this.uhr
    // Ruhelage: hockt, Ohren leicht nach hinten und gespreizt.
    s.rumpf = 0
    s.kopfX = 0
    s.kopfY = 0
    s.kopfZ = 0
    s.hinten = 0
    s.vorn = 0
    s.hub = 0
    s.streck = 1
    for (const i of [0, 1]) {
      s.ohrX[i] = -0.25
      s.ohrZ[i] = -this.m.ohren[i].userData.seite * 0.14
    }

    // Blick zum Fahrer, relativ zum Koerper.
    const zumFahrer = winkelDiff(this.gier, Math.atan2(skier.position.x - this.x, skier.position.z - this.z))

    if (this.zustand === 'sitzen' && !this.sprung) {
      this.tunZeit -= dt
      if (!this.tun || this.tunZeit <= 0) {
        const w = Math.random()
        this.tun = w < 0.4 ? 'muemmeln' : w < 0.62 ? 'umschauen' : w < 0.75 ? 'maennchen' : w < 0.87 ? 'putzen' : 'hopsen'
        this.tunZeit = { muemmeln: zufall(2.5, 5), umschauen: zufall(1.8, 3.5), maennchen: zufall(1.4, 2.6), putzen: zufall(1.6, 2.4), hopsen: 0.5 }[this.tun]
        this.blick = zufall(-0.8, 0.8)
      }
      switch (this.tun) {
        case 'muemmeln':
          s.rumpf = 0.12
          s.kopfX = 0.72 + Math.sin(t * 19) * 0.035
          s.ohrX[0] = s.ohrX[1] = -0.55
          break
        case 'umschauen':
          s.kopfY = this.blick + Math.sin(t * 0.9) * 0.15
          s.kopfX = -0.1
          // Die Ohren spielen unabhaengig – das ist das Lebendigste an ihm.
          s.ohrX[0] = -0.05 + Math.sin(t * 3.1) * 0.2
          s.ohrX[1] = -0.05 + Math.sin(t * 2.3 + 1) * 0.2
          if (Math.sin(t * 1.7) > 0.9) this.blick = zufall(-0.8, 0.8)
          break
        case 'maennchen':
          this._maennchen(s, 0)
          break
        case 'putzen':
          s.rumpf = -0.62
          s.hinten = 0.62
          s.kopfX = 0.75
          s.vorn = -1.6 + Math.sin(t * 15) * 0.25
          s.ohrX[0] = s.ohrX[1] = -0.7
          break
      }
    } else if (this.zustand === 'wachsam') {
      this._maennchen(s, zumFahrer)
    } else if (this.zustand === 'kommen' && !this.sprung && this.pause > 0.7) {
      // Unterwegs sichern: Kopf hoch, Ohren auf.
      s.kopfX = -0.15
      s.ohrX[0] = s.ohrX[1] = 0.05
    }

    // Im Sprung ueberschreibt der Bewegungsablauf die Lage.
    if (this.sprung) {
      const p = this.sprung.t
      const k = this.sprung.ruhig ? 0.6 : 1
      s.hub = this.sprung.hoehe * Math.sin(Math.PI * p)
      s.rumpf = (-0.3 * buckel(p, 0, 0.5) + 0.3 * buckel(p, 0.5, 1)) * k
      s.hinten = (1.25 * buckel(p, 0, 0.55) - 0.35 * buckel(p, 0.6, 1)) * k
      s.vorn = (0.6 * buckel(p, 0, 0.35) - 1.0 * buckel(p, 0.35, 0.95)) * k
      s.kopfX = -s.rumpf * 0.5
      // In der Luft lang, beim Aufsetzen gestaucht – so wird aus dem Ball
      // ein Hase im Lauf.
      s.streck = 1 + 0.14 * buckel(p, 0.1, 0.7) * k
      if (!this.sprung.ruhig) {
        // Auf der Flucht liegen die Ohren flach am Ruecken.
        s.ohrX[0] = s.ohrX[1] = -1.15
        s.ohrZ[0] = s.ohrZ[1] = 0
      }
    } else if (this.zustand === 'flucht') {
      s.ohrX[0] = s.ohrX[1] = -1.15
      s.ohrZ[0] = s.ohrZ[1] = 0
    }

    this._setzen(glatt(this.sprung ? 30 : 7, dt))
  }

  _maennchen(s, blick) {
    // Aufrecht auf den Hinterlaeufen: der Rumpf kippt um die Huefte, die
    // Keulen gleichen aus, damit die Fuesse flach bleiben. Kopf waagerecht.
    s.rumpf = -0.95
    s.hinten = 0.95
    s.kopfX = 0.8
    s.kopfY = Math.max(-1, Math.min(1, blick))
    s.vorn = 0.45
    s.ohrX[0] = s.ohrX[1] = 0.3
    s.ohrZ[0] = s.ohrZ[1] = 0
  }

  _setzen(k) {
    const p = this.pose
    const s = this.soll
    for (const key of ['rumpf', 'kopfX', 'kopfY', 'kopfZ', 'hinten', 'vorn', 'hub', 'streck']) p[key] += (s[key] - p[key]) * k
    for (const i of [0, 1]) {
      p.ohrX[i] += (s.ohrX[i] - p.ohrX[i]) * k
      p.ohrZ[i] += (s.ohrZ[i] - p.ohrZ[i]) * k
    }

    const m = this.m
    m.root.position.set(this.x, terrainHeight(this.x, this.z) + p.hub, this.z)
    amHang(m.root, this.x, this.z, this.gier, this.sprung ? 0.4 : 0.75)
    m.rumpf.rotation.x = p.rumpf
    m.rumpf.scale.set(1, 2 - p.streck, p.streck)
    m.kopf.rotation.set(p.kopfX, p.kopfY, p.kopfZ, 'YXZ')
    m.ohren.forEach((o, i) => o.rotation.set(p.ohrX[i], 0, p.ohrZ[i]))
    for (const h of m.hinten) h.rotation.x = p.hinten
    for (const v of m.vorn) v.rotation.x = p.vorn
  }
}
