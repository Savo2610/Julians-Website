import { terrainHeight, playAreaDistance } from '../heightfield.js'
import { createFuchs } from './modelle.js'
import { abdruck, amHang, buckel, glatt, imBild, stauben, winkelDiff } from './werkzeug.js'

// Der Fuchs ist das seltenste Tier im Tal. Er schnuert aus dem Wald ins
// Offene, bleibt stehen und lauscht, den Kopf schief – unter dem Schnee
// raschelt eine Maus. Dann der Maeuselsprung: hoch hinauf und kopfueber
// hinein, bis nur noch Hinterteil und Lunte herausschauen. Er zieht den
// Kopf wieder heraus, schuettelt sich und trabt auf der anderen Seite
// davon. Seine Spur ist eine einzige Perlenkette quer durchs Bild.
//
// Er ist weniger schreckhaft als der Hase, aber schneller weg. Nur solange
// er mit dem Kopf im Schnee steckt, merkt er fast nichts – wer genau dann
// heranschleicht, kommt ihm so nah wie sonst nie.

const zufall = (a, b) => a + Math.random() * (b - a)
const RUHE = 6
const JE_TEMPO = 0.85
const TRAB = 2.4          // m/s
const GALOPP = 9          // m/s
const SPURABSTAND = 1.0   // m, eine Textur traegt zwei Abdruecke

export class Fuchs {
  constructor({ scene, trail, spray, camera, world, wald }, { von, ziel, ausgang }) {
    this.scene = scene
    this.trail = trail
    this.spray = spray
    this.camera = camera
    this.world = world
    this.wald = wald

    this.m = createFuchs()
    scene.add(this.m.root)

    this.x = von.x
    this.z = von.z
    this.ziel = ziel
    this.ausgang = ausgang
    this.gier = Math.atan2(ziel.x - von.x, ziel.z - von.z)
    this.zustand = 'kommen'
    this.zeit = 0
    this.uhr = 0
    this.phase = 0
    this.weg = 0
    this.tempo = 0
    this.lebt = true
    this.ausserBild = 0
    this._gesehen = false
    this.sprung = null
    this.pose = { rumpf: 0, rumpfZ: 0, kopfX: 0, kopfY: 0, kopfZ: 0, ohrX: 0, schwanzX: -0.35, schwanzY: 0, hub: 0, vorn: 0, hinten: 0 }
    this.soll = { ...this.pose }
    this._setzen(1, [0, 0, 0, 0])
  }

  get gesehen() { return this._gesehen }

  update(dt, skier) {
    if (!this.lebt) return false
    this.zeit += dt
    this.uhr += dt

    const dx = this.x - skier.position.x
    const dz = this.z - skier.position.z
    const d = Math.hypot(dx, dz)
    const naht = d > 0.01 ? Math.max(0, (skier.forward.x * dx + skier.forward.z * dz) / d) : 0
    const taub = this.zustand === 'stecken'
    const flucht = taub ? 3.5 : RUHE + skier.speed * (0.45 + 0.55 * naht) * JE_TEMPO
    if (d < flucht && this.zustand !== 'flucht' && this.zustand !== 'stutzen' && this.zustand !== 'sprung') {
      this._wechsel('stutzen')
    }

    const sichtbar = imBild(this.camera, this.x, terrainHeight(this.x, this.z) + 0.4, this.z, 1.08)
    if (sichtbar) this._gesehen = true

    const beine = this._ablauf(dt, skier)
    this._setzen(glatt(this.zustand === 'sprung' ? 30 : 9, dt), beine)

    if (this.zustand === 'flucht' || this.zustand === 'gehen') {
      this.ausserBild = sichtbar ? 0 : this.ausserBild + dt
      if (this.ausserBild > 0.6) this.entfernen()
    }
    if (d > 65 || this.zeit > 200) this.entfernen()
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
  }

  // Laufen zu einem Punkt; gibt die verbleibende Strecke zurueck.
  _laufen(dt, zx, zz, tempo) {
    const dx = zx - this.x
    const dz = zz - this.z
    const rest = Math.hypot(dx, dz)
    this.gier += winkelDiff(this.gier, Math.atan2(dx, dz)) * glatt(tempo > 5 ? 9 : 5, dt)
    this.tempo += (tempo - this.tempo) * glatt(tempo > 5 ? 6 : 4, dt)
    const s = Math.min(rest, this.tempo * dt)
    const r = this.world.resolve(this.x + Math.sin(this.gier) * s, this.z + Math.cos(this.gier) * s, 0.35, 0, 0, 0)
    const schritt = Math.hypot(r.x - this.x, r.z - this.z)
    this.x = r.x
    this.z = r.z
    this.weg += schritt
    if (this.weg > SPURABSTAND) {
      this.weg -= SPURABSTAND
      abdruck(this.trail, 'fuchs', this.x, this.z, this.gier, 0.55)
    }
    return rest
  }

  _ablauf(dt, skier) {
    const s = this.soll
    s.rumpf = 0
    s.rumpfZ = 0
    s.kopfX = 0
    s.kopfY = 0
    s.kopfZ = 0
    s.ohrX = 0
    s.schwanzX = -0.35
    s.schwanzY = Math.sin(this.uhr * 1.3) * 0.12
    s.hub = 0
    s.vorn = 0
    s.hinten = 0
    let beine = [0, 0, 0, 0]

    const trab = () => {
      this.phase += dt * (this.tempo / 0.75) * Math.PI * 2
      const a = Math.min(1, this.tempo / TRAB) * 0.5
      const p = this.phase
      // Trab: diagonale Paare im Gleichschritt.
      beine = [a * Math.sin(p), a * Math.sin(p + Math.PI), a * Math.sin(p + Math.PI), a * Math.sin(p)]
      s.hub = Math.abs(Math.sin(p)) * 0.012
    }

    switch (this.zustand) {
      case 'kommen': {
        const rest = this._laufen(dt, this.ziel.x, this.ziel.z, TRAB)
        trab()
        s.kopfX = 0.15
        if (rest < 0.3) this._wechsel('lauschen')
        break
      }
      case 'lauschen': {
        this.tempo = 0
        // Kopf tief, Ohren nach vorn, und schief gelegt – erst auf die eine,
        // dann auf die andere Seite.
        s.kopfX = 0.45
        s.ohrX = 0.35
        s.kopfZ = Math.sin(this.zeit * 1.6) > 0 ? 0.38 : -0.32
        s.rumpf = 0.08
        if (this.zeit > (this.lauschDauer ||= zufall(1.8, 2.8))) this._wechsel('ducken')
        break
      }
      case 'ducken': {
        s.hub = -0.07
        s.rumpf = -0.12
        s.hinten = -0.35
        s.kopfX = 0.2
        s.ohrX = 0.4
        if (this.zeit > 0.45) {
          this.sprung = { x: this.x, z: this.z, nx: this.x + Math.sin(this.gier) * 1.5, nz: this.z + Math.cos(this.gier) * 1.5 }
          stauben(this.spray, this.x, terrainHeight(this.x, this.z), this.z, 5, 0.8)
          this._wechsel('sprung')
        }
        break
      }
      case 'sprung': {
        const p = Math.min(1, this.zeit / 0.72)
        const j = this.sprung
        this.x = j.x + (j.nx - j.x) * p
        this.z = j.z + (j.nz - j.z) * p
        s.hub = 1.0 * Math.sin(Math.PI * p) - 0.3 * p * p
        // Steil hinauf, kopfueber hinab.
        s.rumpf = -0.7 + 2.05 * p * p
        s.kopfX = 0.3 * p
        s.ohrX = -0.4
        s.vorn = -1.1 * buckel(p, 0.1, 1.2)
        s.hinten = 0.9 * buckel(p, 0, 0.6) - s.rumpf * 0.6
        s.schwanzX = 0.2 - 0.5 * p
        if (p >= 1) {
          stauben(this.spray, this.x + Math.sin(this.gier) * 0.4, terrainHeight(this.x, this.z), this.z + Math.cos(this.gier) * 0.4, 18, 1.6)
          abdruck(this.trail, 'loch', this.x + Math.sin(this.gier) * 0.35, this.z + Math.cos(this.gier) * 0.35, this.gier, 0.6)
          this._wechsel('stecken')
        }
        break
      }
      case 'stecken': {
        // Kopf und Vorderlaeufe im Schnee, das Hinterteil in der Luft, die
        // Lunte wedelt.
        s.hub = -0.3
        s.rumpf = 1.3
        s.hinten = -1.3
        s.vorn = -0.3
        s.schwanzX = -0.3
        s.schwanzY = Math.sin(this.zeit * 11) * 0.55
        if (this.zeit > 1.5) {
          stauben(this.spray, this.x + Math.sin(this.gier) * 0.4, terrainHeight(this.x, this.z) + 0.1, this.z + Math.cos(this.gier) * 0.4, 10, 1.1)
          this._wechsel('schuetteln')
        }
        break
      }
      case 'schuetteln': {
        const k = Math.max(0, 1 - this.zeit / 0.9)
        s.rumpfZ = Math.sin(this.zeit * 32) * 0.22 * k
        s.kopfZ = Math.sin(this.zeit * 32 + 0.6) * 0.35 * k
        s.schwanzY = Math.sin(this.zeit * 32 + 1.2) * 0.5 * k
        s.kopfX = 0.1
        if (this.zeit > 0.25 && this.zeit < 0.3) stauben(this.spray, this.x, terrainHeight(this.x, this.z) + 0.4, this.z, 6, 0.8)
        if (this.zeit > 1.1) this._wechsel('gehen')
        break
      }
      case 'gehen': {
        if (Math.hypot(this.ausgang.x - this.x, this.ausgang.z - this.z) < 0.6) {
          const r = this.wald.richtung(this.x, this.z, 16) || { x: Math.sin(this.gier), z: Math.cos(this.gier) }
          this.ausgang = { x: this.x + r.x * 6, z: this.z + r.z * 6 }
        }
        this._laufen(dt, this.ausgang.x, this.ausgang.z, TRAB)
        trab()
        s.kopfX = 0.1
        break
      }
      case 'stutzen': {
        // Einen Moment schauen, wer da kommt – dann weg.
        this.tempo *= 1 - glatt(10, dt)
        s.kopfY = Math.max(-1.1, Math.min(1.1, winkelDiff(this.gier, Math.atan2(skier.position.x - this.x, skier.position.z - this.z))))
        s.kopfX = -0.15
        s.ohrX = 0.3
        s.schwanzX = -0.1
        if (this.zeit > 0.35) {
          const wx = this.x - skier.position.x
          const wz = this.z - skier.position.z
          const l = Math.hypot(wx, wz) || 1
          const w = this.wald.richtung(this.x, this.z, 24) || { x: wx / l, z: wz / l }
          let rx = wx / l + w.x * 0.7
          let rz = wz / l + w.z * 0.7
          if (rx * wx + rz * wz < 0) { rx = wx / l; rz = wz / l }
          this.fluchtRichtung = { x: rx, z: rz }
          this._wechsel('flucht')
        }
        break
      }
      case 'flucht': {
        const r = this.fluchtRichtung
        const wx = this.x - skier.position.x
        const wz = this.z - skier.position.z
        const l = Math.hypot(wx, wz) || 1
        r.x = r.x * 0.97 + (wx / l) * 0.03
        r.z = r.z * 0.97 + (wz / l) * 0.03
        if (playAreaDistance(this.x + r.x * 3, this.z + r.z * 3) > 9) { const t = r.x; r.x = r.z; r.z = -t }
        this._laufen(dt, this.x + r.x * 5, this.z + r.z * 5, GALOPP)
        // Galopp: Vorder- und Hinterpaar abwechselnd, der Ruecken federt.
        this.phase += dt * (this.tempo / 1.7) * Math.PI * 2
        const p = this.phase
        const a = Math.min(1, this.tempo / GALOPP) * 0.95
        beine = [a * Math.sin(p), a * Math.sin(p + 0.3), a * Math.sin(p + Math.PI * 0.85), a * Math.sin(p + Math.PI * 0.85 + 0.3)]
        s.rumpf = 0.12 * Math.sin(p + 0.6)
        s.hub = 0.08 * Math.max(0, Math.sin(p + 0.9))
        s.kopfX = 0.15
        s.ohrX = -0.5
        s.schwanzX = -0.05
        s.schwanzY = 0
        break
      }
    }
    return beine
  }

  _setzen(k, beine) {
    const p = this.pose
    const s = this.soll
    for (const key of Object.keys(p)) p[key] += (s[key] - p[key]) * k
    const m = this.m
    m.root.position.set(this.x, terrainHeight(this.x, this.z) + p.hub, this.z)
    amHang(m.root, this.x, this.z, this.gier, 0.7)
    m.rumpf.rotation.set(p.rumpf, 0, p.rumpfZ)
    m.kopf.rotation.set(p.kopfX, p.kopfY, p.kopfZ, 'YXZ')
    for (const o of m.ohren) o.rotation.x = p.ohrX
    m.schwanz.rotation.set(p.schwanzX, p.schwanzY, 0, 'YXZ')
    // Gangbild direkt, Haltung (vorn/hinten) gedaempft dazu.
    m.beine[0].rotation.x = beine[0] + p.vorn
    m.beine[1].rotation.x = beine[1] + p.vorn
    m.beine[2].rotation.x = beine[2] + p.hinten
    m.beine[3].rotation.x = beine[3] + p.hinten
  }
}
