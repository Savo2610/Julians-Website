import * as THREE from 'three'
import { terrainHeight } from '../heightfield.js'
import { createEichhoernchen } from './modelle.js'
import { abdruck, amHang, glatt, imBild, stauben, winkelDiff } from './werkzeug.js'

// Das Eichhoernchen sitzt auf dem First der Apres-Ski-Huette. Es knabbert
// an einem Zapfen, schaut sich um, zuckt mit dem Schwanz und flitzt ab und
// zu ein Stueck den First entlang. Wer naeher kommt, sieht es erst aufrecht
// sitzen und mit dem Schwanz schlagen – das ist sein Warnen –, dann ist es
// weg: den First entlang zum hinteren Giebel, hinunter in den Schnee und in
// Spruengen zum naechsten Baum, an dem es hinaufjagt, bis es in den Zweigen
// verschwindet.
//
// Auf dem Dach rechnet es in Koordinaten der Huette (x quer, z laengs des
// Firsts, y aus `dach.hoehe`); erst am Boden in Weltkoordinaten.

const zufall = (a, b) => a + Math.random() * (b - a)
const RUHE = 4.5          // m im Stand – es sitzt oben, da fuehlt es sich sicher
const JE_TEMPO = 0.6
const WACHSAM = 4
const BLEIBT = [100, 180]
const FLITZEN = 2.6       // m/s auf dem First
const RENNEN = 5.5        // m/s im Schnee
const KLETTERN = 2.2      // m/s am Stamm

const v = new THREE.Vector3()
const oben = new THREE.Vector3(0, 1, 0)
const qGier = new THREE.Quaternion()
const qNeig = new THREE.Quaternion()

export class Eichhoernchen {
  constructor({ scene, trail, spray, camera, world, wald, huette }) {
    this.scene = scene
    this.trail = trail
    this.spray = spray
    this.camera = camera
    this.world = world
    this.wald = wald
    this.huette = huette
    this.dach = huette.userData.dach
    this.dreh = huette.rotation.y

    this.m = createEichhoernchen()
    scene.add(this.m.root)

    // Auf dem Dach: Lage in Huettenkoordinaten und Blick laengs des Firsts.
    this.ort = 'dach'
    this.hx = 0
    this.hz = zufall(-0.6, 0.6) * this.dach.halb
    this.lgier = Math.random() < 0.5 ? 0 : Math.PI
    // Am Boden: Weltlage.
    this.x = 0
    this.y = 0
    this.z = 0
    this.gier = 0
    this.baum = null

    this.zustand = 'sitzen'
    this.zeit = 0
    this.alter = 0
    this.uhr = Math.random() * 10
    this.bleibt = zufall(...BLEIBT)
    this.tun = null
    this.tunZeit = 0
    this.flitz = null
    this.sprung = null
    this.phase = 0
    this.lebt = true
    this.ausserBild = 0
    this._gesehen = false
    this.spurWeg = 0

    this.pose = { rumpf: 0, kopfX: 0, kopfY: 0, schwanz: 0, spitze: 0, hinten: 0, vorn: 0, hub: 0 }
    this.soll = { ...this.pose }
    this._setzen(1)
  }

  get gesehen() { return this._gesehen }

  // Weltlage, gleich wo es gerade ist.
  _welt() {
    if (this.ort === 'dach') {
      v.set(this.hx, this.dach.hoehe(this.hx), this.hz)
      this.huette.localToWorld(v)
      return v
    }
    return v.set(this.x, this.y, this.z)
  }

  update(dt, skier) {
    if (!this.lebt) return false
    this.zeit += dt
    this.alter += dt
    this.uhr += dt

    const p = this._welt()
    const wx = p.x
    const wy = p.y
    const wz = p.z
    const dx = wx - skier.position.x
    const dz = wz - skier.position.z
    const d = Math.hypot(dx, dz)
    const naht = d > 0.01 ? Math.max(0, (skier.forward.x * dx + skier.forward.z * dz) / d) : 0
    const flucht = RUHE + skier.speed * (0.45 + 0.55 * naht) * JE_TEMPO

    const sichtbar = imBild(this.camera, wx, wy + 0.2, wz, 1.08)
    if (sichtbar) this._gesehen = true

    if (this.zustand === 'sitzen' || this.zustand === 'wachsam') {
      if (d < flucht) this._weg(skier, true)
      else if (d < flucht + WACHSAM) { if (this.zustand !== 'wachsam') this._wechsel('wachsam') }
      else if (this.zustand === 'wachsam' && this.zeit > 2.5) this._wechsel('sitzen')
      else if (this.zustand === 'sitzen' && this.alter > this.bleibt) this._weg(skier, false)
    }

    this._ablauf(dt, skier)
    this._setzen(glatt(this.sprung ? 30 : 10, dt))

    // Gegangen wird nur, wo niemand hinschaut – oder oben in den Zweigen,
    // wo es ohnehin verschwunden ist.
    if (this.zustand === 'weg') {
      this.ausserBild = sichtbar ? 0 : this.ausserBild + dt
      if (this.ausserBild > 0.6) this.entfernen()
      if (this.ort === 'baum' && this.y - this.baum.boden > this.baum.krone) this.entfernen()
    }
    if (d > 100 || this.alter > 300) this.entfernen()
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
    this.tun = null
  }

  // Der Fluchtweg: zum Giebel, der vom Fahrer weg liegt, und am liebsten
  // zum hinteren – dort steht das Haus zwischen ihm und der Kamera.
  _weg(skier, eilig) {
    v.copy(skier.position)
    this.huette.worldToLocal(v)
    const ende = v.z > this.dach.halb ? -1 : v.z < -this.dach.halb ? 1 : -1
    this.weg = { ende, eilig }
    this.zustand = 'weg'
    this.zeit = 0
    this.flitz = { hz: ende * this.dach.halb }
  }

  _ablauf(dt, skier) {
    const s = this.soll
    s.rumpf = 0
    s.kopfX = 0
    s.kopfY = 0
    // Der Schwanz steht als Bogen ueber dem Ruecken: Wurzel leicht hoch,
    // die Spitze nach vorn eingerollt (positiv kippt sie nach vorn).
    s.schwanz = 0.25
    s.spitze = 0.3 + 0.1 * Math.sin(this.uhr * 1.1)
    s.hinten = 0
    s.vorn = 0
    s.hub = 0
    this.m.zapfen.visible = false

    const galopp = (tempo) => {
      // Gesprungen wird mit allen vieren: hinten ab, vorn auf. Der Schwanz
      // streckt sich dabei flach nach hinten.
      this.phase += dt * (tempo / 0.32) * Math.PI * 2
      const q = this.phase
      s.hinten = 0.8 * Math.sin(q)
      s.vorn = -0.8 * Math.sin(q + 0.9)
      s.rumpf = 0.25 * Math.sin(q + 0.4)
      s.hub = 0.05 * Math.max(0, Math.sin(q + 0.3))
      s.schwanz = 0.1
      s.spitze = -1.2
      s.kopfX = 0.1
    }

    if (this.zustand === 'sitzen' || this.zustand === 'wachsam') {
      if (this.flitz) {
        if (this._flitzen(dt)) galopp(FLITZEN)
        return
      }
      if (this.zustand === 'wachsam') {
        // Aufrecht, den Fahrer im Blick, und der Schwanz schlaegt.
        this._aufrecht(s)
        s.kopfY = Math.max(-1.1, Math.min(1.1, winkelDiff(this.lgier + this.dreh, Math.atan2(skier.position.x - this._welt().x, skier.position.z - this._welt().z))))
        s.schwanz = 1.05 + Math.max(0, Math.sin(this.zeit * 14)) * 0.4
        s.spitze = 0.2 + 0.6 * Math.sin(this.zeit * 14 + 0.8)
        return
      }
      this.tunZeit -= dt
      if (!this.tun || this.tunZeit <= 0) {
        const w = Math.random()
        this.tun = w < 0.4 ? 'knabbern' : w < 0.65 ? 'umschauen' : w < 0.8 ? 'zucken' : 'flitzen'
        this.tunZeit = { knabbern: zufall(3, 6), umschauen: zufall(1.5, 3), zucken: zufall(0.8, 1.4), flitzen: 0 }[this.tun]
        this.blick = zufall(-1, 1)
        if (this.tun === 'flitzen') {
          // Ein Stueck den First entlang, nie ueber die Enden hinaus.
          const h = this.dach.halb
          let ziel = this.hz + (Math.random() < 0.5 ? -1 : 1) * zufall(0.6, 1.6)
          ziel = Math.max(-h * 0.85, Math.min(h * 0.85, ziel))
          this.flitz = { hz: ziel }
          this.tun = null
          return
        }
      }
      switch (this.tun) {
        case 'knabbern':
          this._aufrecht(s)
          s.kopfX = 1.25 + Math.sin(this.uhr * 22) * 0.06
          s.vorn = -1.5
          this.m.zapfen.visible = true
          break
        case 'umschauen':
          s.kopfY = this.blick
          s.kopfX = -0.1
          break
        case 'zucken':
          s.schwanz = 0.25 + Math.max(0, Math.sin(this.zeit * 18)) * 0.35
          s.spitze = 0.3 + 0.4 * Math.sin(this.zeit * 18 + 1)
          break
      }
      return
    }

    // --- Flucht oder Abgang ----------------------------------------------------
    const tempo = this.weg.eilig ? 1 : 0.55
    if (this.ort === 'dach') {
      if (this._flitzen(dt, tempo)) { galopp(FLITZEN * tempo); return }
      // Am Giebel: hinunter in den Schnee. Hinter der Huette steigt der Hang
      // gleich wieder an (sie steht in einer Mulde): von 1,5 bis 4 Meter
      // hinaus nimmt es die hoechste Stelle, die noch unter dem First liegt,
      // sonst sprang es 4,4 m tief in die Kehle hinter der Rueckwand.
      const start = this._welt().clone()
      let nach = null
      let best = -Infinity
      for (const weit of [1.5, 2, 2.5, 3, 3.5, 4]) {
        v.set(0, 0, this.weg.ende * (this.dach.halb + weit))
        this.huette.localToWorld(v)
        const h = terrainHeight(v.x, v.z)
        if (h < start.y - 0.3 && h > best) { best = h; nach = { x: v.x, z: v.z } }
      }
      if (!nach) nach = { x: v.x, z: v.z }
      this.ort = 'luft'
      this.x = start.x
      this.y = start.y
      this.z = start.z
      this.gier = Math.atan2(nach.x - start.x, nach.z - start.z)
      this.sprung = { von: start, nach, t: 0, dauer: 0.55 }
      return
    }

    if (this.ort === 'luft') {
      const j = this.sprung
      j.t = Math.min(1, j.t + dt / j.dauer)
      const boden = terrainHeight(j.nach.x, j.nach.z)
      this.x = j.von.x + (j.nach.x - j.von.x) * j.t
      this.z = j.von.z + (j.nach.z - j.von.z) * j.t
      // Ein Bogen von der Firsthoehe in den Schnee, wie ein Wurf.
      this.y = j.von.y + (boden - j.von.y) * j.t * j.t + 0.6 * Math.sin(Math.PI * j.t)
      s.rumpf = -0.4 + 0.8 * j.t
      s.hinten = -0.9
      s.vorn = -0.9
      s.schwanz = 0.1
      s.spitze = -1.0
      if (j.t >= 1) {
        this.sprung = null
        this.y = boden
        this.ort = 'boden'
        stauben(this.spray, this.x, boden, this.z, 6, 0.9)
        this.baum = this._baumWaehlen()
      }
      return
    }

    if (this.ort === 'boden') {
      if (!this.baum) {
        // Kein Baum in der Naehe: einfach weg vom Haus, bis es keiner sieht.
        this._laufen(dt, this.x + Math.sin(this.gier) * 5, this.z + Math.cos(this.gier) * 5, RENNEN * tempo, false)
        galopp(RENNEN * tempo)
        return
      }
      const b = this.baum
      const rest = this._laufen(dt, b.x - b.rx * b.stamm, b.z - b.rz * b.stamm, RENNEN * tempo, true)
      galopp(RENNEN * tempo)
      if (rest < 0.05) {
        this.ort = 'baum'
        this.gier = Math.atan2(b.rx, b.rz)
      }
      return
    }

    if (this.ort === 'baum') {
      // Den Stamm hinauf, Kopf voran, ein wenig um ihn herum.
      this.y += KLETTERN * dt
      s.rumpf = -1.45
      s.hinten = 1.2 + 0.4 * Math.sin(this.uhr * 30)
      s.vorn = -1.6 + 0.4 * Math.sin(this.uhr * 30 + 1.4)
      s.schwanz = 0.2
      s.spitze = -1.2
    }
  }

  _aufrecht(s) {
    s.rumpf = -1.05
    s.hinten = 1.05
    s.kopfX = 0.9
    s.vorn = -0.6
    // Der Rumpf kippt um 1,05 nach hinten; die Wurzel dreht das zurueck,
    // damit der Schwanz hinter dem Ruecken aufrecht bleibt.
    s.schwanz = 1.05
    s.spitze = 0.15
  }

  // Den First entlang. Gibt zurueck, ob es noch unterwegs ist.
  _flitzen(dt, tempo = 1) {
    const f = this.flitz
    if (!f) return false
    const rest = f.hz - this.hz
    if (Math.abs(rest) < 0.04) {
      this.hz = f.hz
      this.flitz = null
      return false
    }
    this.lgier = rest > 0 ? 0 : Math.PI
    this.hz += Math.sign(rest) * Math.min(Math.abs(rest), FLITZEN * tempo * dt)
    return true
  }

  _baumWaehlen() {
    const b = this.wald.naechsterBaum(this.x, this.z, 30)
    if (!b) return null
    // Es laeuft auf den Stamm zu und haelt vor der Rinde an.
    const dx = b.x - this.x
    const dz = b.z - this.z
    const l = Math.hypot(dx, dz) || 1
    const sc = b.scale || 1
    return {
      x: b.x, z: b.z, rx: dx / l, rz: dz / l,
      stamm: 0.18 * sc,
      boden: terrainHeight(b.x, b.z),
      // Die unterste Zweigrunde haengt bei drei Vierteln des Stamms; darueber
      // ist es in den Zweigen verschwunden.
      krone: 1.1 * sc,
    }
  }

  _laufen(dt, zx, zz, tempo, zumBaum) {
    const dx = zx - this.x
    const dz = zz - this.z
    const rest = Math.hypot(dx, dz)
    if (rest > 0.01) this.gier += winkelDiff(this.gier, Math.atan2(dx, dz)) * glatt(12, dt)
    const sch = Math.min(rest, tempo * dt)
    let nx = this.x + Math.sin(this.gier) * sch
    let nz = this.z + Math.cos(this.gier) * sch
    // Am Ziel-Baum nicht abprallen, sonst kaeme es nie an die Rinde.
    if (!zumBaum || rest > 2.5) {
      const r = this.world.resolve(nx, nz, 0.15, 0, 0, 0)
      nx = r.x
      nz = r.z
    }
    this.spurWeg += Math.hypot(nx - this.x, nz - this.z)
    this.x = nx
    this.z = nz
    this.y = terrainHeight(nx, nz)
    if (this.spurWeg > 0.9) {
      this.spurWeg = 0
      abdruck(this.trail, 'hoernchen', this.x, this.z, this.gier, 0.5)
    }
    return Math.hypot(zx - this.x, zz - this.z)
  }

  _setzen(k) {
    const p = this.pose
    const s = this.soll
    for (const key of Object.keys(p)) p[key] += (s[key] - p[key]) * k
    const m = this.m
    if (this.ort === 'dach') {
      const w = this._welt()
      m.root.position.set(w.x, w.y + p.hub, w.z)
      m.root.quaternion.setFromAxisAngle(oben, this.lgier + this.dreh)
    } else if (this.ort === 'baum') {
      m.root.position.set(this.x, this.y, this.z)
      m.root.quaternion.setFromAxisAngle(oben, this.gier)
    } else {
      m.root.position.set(this.x, this.y + p.hub, this.z)
      if (this.ort === 'boden') amHang(m.root, this.x, this.z, this.gier, 0.6)
      else {
        qGier.setFromAxisAngle(oben, this.gier)
        qNeig.identity()
        m.root.quaternion.copy(qNeig).multiply(qGier)
      }
    }
    m.rumpf.rotation.x = p.rumpf
    m.kopf.rotation.set(p.kopfX, p.kopfY, 0, 'YXZ')
    m.schwanz.rotation.x = p.schwanz
    m.spitze.rotation.x = p.spitze
    for (const h of m.hinten) h.rotation.x = p.hinten
    for (const f of m.vorn) f.rotation.x = p.vorn
  }
}
