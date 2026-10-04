import * as THREE from 'three'
import { terrainHeight, terrainNormal } from '../heightfield.js'
import { createSteinbock } from './modelle.js'
import { amHang, glatt, imBild, stauben, winkelDiff } from './werkzeug.js'

// Der Steinbock steht oben auf einem Felsen der Rueckseite, am Grat oder an
// der Klamm, und tut fast nichts – das ist das Schoene an ihm. Er kaut,
// schaut lange in eine Richtung, kratzt sich mit der Hornspitze am Ruecken,
// tritt einmal auf dem Fels herum. Er ist weniger schreckhaft als jedes
// andere Tier im Tal, aber wer zu nah kommt, sieht ihn vom Fels springen
// und in grossen Saetzen bergauf davonziehen, dorthin, wo kein Ski hinkommt.
//
// Er steht quer zur Kamera: von der Seite liest man die Hoerner als Bogen,
// von vorn waeren sie zwei Striche.

const zufall = (a, b) => a + Math.random() * (b - a)
const RUHE = 7
const JE_TEMPO = 0.5
const AEUGEN = 6
const BLEIBT = [150, 240]
const SCHRITT = 1.1     // m/s
const SATZ = 6.5        // m/s in der Flucht

const oben = new THREE.Vector3(0, 1, 0)
const n = new THREE.Vector3()

export class Steinbock {
  constructor({ scene, spray, camera, world }, { fels, gier }) {
    this.scene = scene
    this.spray = spray
    this.camera = camera
    this.world = world
    this.m = createSteinbock()
    scene.add(this.m.root)

    this.fels = fels
    this.x = fels.x
    this.z = fels.z
    this.y = fels.top
    this.gier = gier
    this.ort = 'fels'

    this.zustand = 'stehen'
    this.zeit = 0
    this.alter = 0
    this.uhr = Math.random() * 10
    this.bleibt = zufall(...BLEIBT)
    this.tun = null
    this.tunZeit = 0
    this.lebt = true
    this.ausserBild = 0
    this._gesehen = false
    this.sprung = null
    this.phase = 0
    this.tempo = 0
    this.richtung = null

    this.pose = { rumpf: 0, kopfX: 0, kopfY: 0, kopfZ: 0, hub: 0, vorn: 0, hinten: 0 }
    this.soll = { ...this.pose }
    this._setzen(1, [0, 0, 0, 0])
  }

  get gesehen() { return this._gesehen }

  update(dt, skier) {
    if (!this.lebt) return false
    this.zeit += dt
    this.alter += dt
    this.uhr += dt

    const dx = this.x - skier.position.x
    const dz = this.z - skier.position.z
    const d = Math.hypot(dx, dz)
    const naht = d > 0.01 ? Math.max(0, (skier.forward.x * dx + skier.forward.z * dz) / d) : 0
    const flucht = RUHE + skier.speed * (0.4 + 0.6 * naht) * JE_TEMPO

    const sichtbar = imBild(this.camera, this.x, this.y + 0.8, this.z, 1.08)
    if (sichtbar) this._gesehen = true

    if (this.zustand === 'stehen' || this.zustand === 'aeugen') {
      if (d < flucht) this._fort(skier, true)
      else if (d < flucht + AEUGEN) { if (this.zustand !== 'aeugen') this._wechsel('aeugen') }
      else if (this.zustand === 'aeugen' && this.zeit > 3) this._wechsel('stehen')
      else if (this.zustand === 'stehen' && this.alter > this.bleibt) this._fort(skier, false)
    }

    const beine = this._ablauf(dt, skier)
    this._setzen(glatt(this.sprung ? 25 : 6, dt), beine)

    if (this.zustand === 'fort') {
      this.ausserBild = sichtbar ? 0 : this.ausserBild + dt
      if (this.ausserBild > 0.6) this.entfernen()
    }
    if (d > 110 || this.alter > 420) this.entfernen()
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

  // Fort heisst bergauf: weg vom Fahrer, aber mit dem Hang hinauf, wo die
  // Felsen sind. Eilig mit einem Satz vom Fels, sonst steigt er ab.
  _fort(skier, eilig) {
    let rx = this.x - skier.position.x
    let rz = this.z - skier.position.z
    const l = Math.hypot(rx, rz) || 1
    terrainNormal(this.x, this.z, n)
    const hl = Math.hypot(n.x, n.z) || 1
    // Die Normale zeigt hangab; bergauf ist ihr Gegenteil.
    rx = rx / l - (n.x / hl) * 1.2
    rz = rz / l - (n.z / hl) * 1.2
    const rl = Math.hypot(rx, rz) || 1
    this.richtung = { x: rx / rl, z: rz / rl }
    this.eilig = eilig
    this._wechsel('fort')
    // Ueber den Rand des Felsens hinaus, sonst landet er in dessen Kollision
    // und wird seitlich weggeschoben.
    const fels = this.fels
    const weit = fels.scale * (fels.stretch || 1) * 1.02 + (eilig ? 1.4 : 0.8)
    const nx = this.x + this.richtung.x * weit
    const nz = this.z + this.richtung.z * weit
    this.sprung = { von: { x: this.x, y: this.y, z: this.z }, nach: { x: nx, z: nz }, t: 0, dauer: eilig ? 0.7 : 0.95 }
  }

  _ablauf(dt, skier) {
    const s = this.soll
    s.rumpf = 0
    s.kopfX = 0
    s.kopfY = 0
    s.kopfZ = 0
    s.hub = 0
    s.vorn = 0
    s.hinten = 0
    let beine = [0, 0, 0, 0]

    if (this.zustand === 'stehen' || this.zustand === 'aeugen') {
      if (this.zustand === 'aeugen') {
        // Kopf hoch, zum Fahrer – und er bleibt erst einmal stehen.
        s.kopfX = -0.3
        s.kopfY = Math.max(-1.2, Math.min(1.2, winkelDiff(this.gier, Math.atan2(skier.position.x - this.x, skier.position.z - this.z))))
        return beine
      }
      this.tunZeit -= dt
      if (!this.tun || this.tunZeit <= 0) {
        const w = Math.random()
        this.tun = w < 0.35 ? 'kauen' : w < 0.65 ? 'schauen' : w < 0.8 ? 'kratzen' : 'treten'
        this.tunZeit = { kauen: zufall(4, 8), schauen: zufall(4, 9), kratzen: zufall(1.6, 2.6), treten: 1.2 }[this.tun]
        this.blick = zufall(-0.9, 0.9)
        if (this.tun === 'treten') this.gierSoll = this.gier + (Math.random() < 0.5 ? -1 : 1) * zufall(0.4, 0.9)
      }
      switch (this.tun) {
        case 'kauen':
          // Wiederkaeuen: der Kopf nickt kaum merklich im Takt.
          s.kopfX = 0.1 + Math.sin(this.uhr * 6) * 0.03
          s.kopfY = this.blick * 0.3
          break
        case 'schauen':
          s.kopfX = -0.15
          s.kopfY = this.blick
          break
        case 'kratzen':
          // Kopf zurueckgeworfen, die Hornspitze faehrt ueber den Ruecken.
          s.kopfX = -1.1 + Math.sin(this.zeit * 7) * 0.15
          s.kopfY = 0.25 * Math.sign(this.blick || 1)
          s.kopfZ = 0.2 * Math.sign(this.blick || 1)
          break
        case 'treten': {
          // Auf dem Fels umtreten: kleine Schritte auf der Stelle.
          this.gier += winkelDiff(this.gier, this.gierSoll) * glatt(3, dt)
          const q = this.uhr * 9
          beine = [0.2 * Math.sin(q), 0.2 * Math.sin(q + Math.PI), 0.2 * Math.sin(q + Math.PI), 0.2 * Math.sin(q)]
          break
        }
      }
      return beine
    }

    // --- Fort ------------------------------------------------------------------
    if (this.sprung) {
      const j = this.sprung
      j.t = Math.min(1, j.t + dt / j.dauer)
      const boden = terrainHeight(j.nach.x, j.nach.z)
      this.x = j.von.x + (j.nach.x - j.von.x) * j.t
      this.z = j.von.z + (j.nach.z - j.von.z) * j.t
      this.y = j.von.y + (boden - j.von.y) * j.t + 0.7 * Math.sin(Math.PI * j.t)
      this.gier += winkelDiff(this.gier, Math.atan2(this.richtung.x, this.richtung.z)) * glatt(10, dt)
      // Gestreckt: vorn weit vor, hinten weit zurueck, dann eingeholt.
      s.vorn = -0.8 + 0.5 * j.t
      s.hinten = 0.7 - 0.4 * j.t
      s.rumpf = -0.25 + 0.4 * j.t
      s.kopfX = -0.1
      if (j.t >= 1) {
        this.sprung = null
        this.ort = 'boden'
        this.y = boden
        this.tempo = this.eilig ? SATZ * 0.7 : SCHRITT
        stauben(this.spray, this.x, boden, this.z, 10, 1.1)
      }
      return beine
    }

    // Laufend nachlenken: weg vom Fahrer und hangauf. Nur zu Beginn
    // gerechnet lief er ueber den Grat und drueben bergab, 22 Meter tief bis
    // vor die Kulisse. So folgt er auf dem Kamm dem Kamm, wie ein echter.
    const r = this.richtung
    terrainNormal(this.x, this.z, n)
    let wx = this.x - skier.position.x
    let wz = this.z - skier.position.z
    const wl = Math.hypot(wx, wz) || 1
    const k = glatt(1.5, dt)
    r.x += ((wx / wl) - n.x * 4 - r.x) * k
    r.z += ((wz / wl) - n.z * 4 - r.z) * k
    const rl0 = Math.hypot(r.x, r.z) || 1
    r.x /= rl0
    r.z /= rl0
    const tempo = this.eilig ? SATZ : SCHRITT
    this.tempo += (tempo - this.tempo) * glatt(3, dt)
    this.gier += winkelDiff(this.gier, Math.atan2(r.x, r.z)) * glatt(4, dt)
    const sch = this.tempo * dt
    const res = this.world.resolve(this.x + Math.sin(this.gier) * sch, this.z + Math.cos(this.gier) * sch, 0.45, 0, 0, 0)
    if (res.hit) {
      // Am Fels oder Baum vorbei: die Richtung nimmt den Abprall mit.
      const pl = Math.hypot(res.pushX, res.pushZ) || 1
      r.x += (res.pushX / pl) * 0.5
      r.z += (res.pushZ / pl) * 0.5
      const rl = Math.hypot(r.x, r.z) || 1
      r.x /= rl
      r.z /= rl
    }
    this.x = res.x
    this.z = res.z
    this.y = terrainHeight(this.x, this.z)

    if (this.eilig) {
      // Saetze wie ein Bock im Fels: hinten beide zusammen, vorn beide.
      this.phase += dt * (this.tempo / 2.2) * Math.PI * 2
      const q = this.phase
      const a = 0.85
      beine = [a * Math.sin(q), a * Math.sin(q + 0.2), a * Math.sin(q + Math.PI), a * Math.sin(q + Math.PI + 0.2)]
      s.hub = 0.22 * Math.max(0, Math.sin(q + 0.8))
      s.rumpf = 0.12 * Math.sin(q + 0.5)
      s.kopfX = 0.05
    } else {
      // Schritt: vier Takte, jeder Lauf fuer sich.
      this.phase += dt * (this.tempo / 0.9) * Math.PI * 2
      const q = this.phase
      const a = 0.32
      beine = [a * Math.sin(q), a * Math.sin(q + Math.PI), a * Math.sin(q + Math.PI * 1.5), a * Math.sin(q + Math.PI * 0.5)]
      s.hub = Math.abs(Math.sin(q)) * 0.015
      s.kopfX = 0.2
    }
    return beine
  }

  _setzen(k, beine) {
    const p = this.pose
    const s = this.soll
    for (const key of Object.keys(p)) p[key] += (s[key] - p[key]) * k
    const m = this.m
    m.root.position.set(this.x, this.y + p.hub, this.z)
    if (this.ort === 'boden' && !this.sprung) amHang(m.root, this.x, this.z, this.gier, 0.5)
    else m.root.quaternion.setFromAxisAngle(oben, this.gier)
    m.rumpf.rotation.x = p.rumpf
    m.kopf.rotation.set(p.kopfX, p.kopfY, p.kopfZ, 'YXZ')
    m.beine[0].rotation.x = beine[0] + p.vorn
    m.beine[1].rotation.x = beine[1] + p.vorn
    m.beine[2].rotation.x = beine[2] + p.hinten
    m.beine[3].rotation.x = beine[3] + p.hinten
  }
}
