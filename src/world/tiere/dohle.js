import * as THREE from 'three'
import { terrainHeight } from '../heightfield.js'
import { createDohle } from './modelle.js'
import { glatt, imBild, winkelDiff } from './werkzeug.js'

// Eine Alpendohle. Sie sitzt auf dem Gipfelkreuz oder auf dem First der
// Huette, trippelt, schaut, lueftet die Fluegel. Scheucht man sie auf,
// fliegt sie nicht einfach weg, sondern bleibt eine Weile ueber dem Platz:
// sie kreist, segelt mit gespreizten Handschwingen, schlaegt nur ab und zu.
// Danach landet sie wieder, wenn man weit genug weg ist – oft an der Huette,
// denn dort faellt bei echten Dohlen immer etwas ab – oder sie zieht davon.
//
// Den Himmel zeigt die feste Kamera nicht (ihr oberer Bildrand blickt noch
// 17° nach unten). Man sieht die kreisende Dohle also ueber dem Schnee, und
// mit ihr ihren Schatten.

const zufall = (a, b) => a + Math.random() * (b - a)
const RUHE = 5
const JE_TEMPO = 0.55
const BLEIBT = [120, 220]
const KREIS = { radius: [7, 11], hoehe: [7, 10], tempo: 6.5, dauer: [20, 40] }

const oben = new THREE.Vector3(0, 1, 0)
const qGier = new THREE.Quaternion()
const qRoll = new THREE.Quaternion()
const vorn = new THREE.Vector3(0, 0, 1)

export class Dohle {
  // `sitze` sind die moeglichen Plaetze ({ x, y, z, gier, art, laengs? }),
  // `start` der, auf dem sie sitzt.
  constructor({ scene, camera }, { sitze, start }) {
    this.scene = scene
    this.camera = camera
    this.sitze = sitze
    this.m = createDohle()
    scene.add(this.m.root)

    this.sitz = start
    this.x = start.x
    this.y = start.y
    this.z = start.z
    this.gier = start.gier + zufall(-0.6, 0.6)
    this.versatz = 0     // auf dem First: Meter laengs vom Platz

    this.zustand = 'sitzen'
    this.zeit = 0
    this.alter = 0
    this.uhr = Math.random() * 10
    this.bleibt = zufall(...BLEIBT)
    this.tun = null
    this.tunZeit = 0
    this.lebt = true
    this.ausserBild = 0
    this._gesehen = false

    this.vx = 0
    this.vy = 0
    this.vz = 0
    this.phase = 0
    this.schlaegt = false
    this.takt = 0
    this.roll = 0
    this.kreis = null

    this.pose = { rumpf: 0, kopfX: 0, kopfY: 0, schwanz: 1, fluegelY: 1.45, schlag: 0.15, beine: 0 }
    this.soll = { ...this.pose }
    this._setzen(1)
  }

  get gesehen() { return this._gesehen }

  update(dt, skier) {
    if (!this.lebt) return false
    this.zeit += dt
    this.alter += dt
    this.uhr += dt

    const d = Math.hypot(this.x - skier.position.x, this.z - skier.position.z)
    const flucht = RUHE + skier.speed * JE_TEMPO
    const sichtbar = imBild(this.camera, this.x, this.y + 0.15, this.z, 1.08)
    if (sichtbar) this._gesehen = true

    if (this.zustand === 'sitzen') {
      if (d < flucht) this._auffliegen(skier)
      else if (this.alter > this.bleibt) this._davon(skier)
    }

    this._ablauf(dt, skier)
    this._setzen(glatt(this.zustand === 'sitzen' ? 9 : 14, dt))

    if (this.zustand === 'davon') {
      this.ausserBild = sichtbar ? 0 : this.ausserBild + dt
      if (this.ausserBild > 0.6) this._umziehenOderGehen(skier)
    }
    if (d > 130 || this.alter > 420) this.entfernen()
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

  _auffliegen(skier) {
    // Weg vom Fahrer und steil hinauf, dann in den Kreis ueber dem Platz.
    let rx = this.x - skier.position.x
    let rz = this.z - skier.position.z
    const l = Math.hypot(rx, rz) || 1
    rx /= l
    rz /= l
    this.gier = Math.atan2(rx, rz)
    this.vx = rx * 4
    this.vz = rz * 4
    this.vy = 3.5
    const r = zufall(...KREIS.radius)
    // Kreismitte etwas vom Fahrer weg versetzt, damit sie ihm nicht gleich
    // wieder ueber den Kopf kreist.
    this.kreis = {
      x: this.sitz.x + rx * r * 0.5,
      z: this.sitz.z + rz * r * 0.5,
      r,
      hoch: zufall(...KREIS.hoehe),
      sinn: Math.random() < 0.5 ? 1 : -1,
      bis: zufall(...KREIS.dauer),
    }
    this.flugzeit = 0
    this._wechsel('kreisen')
  }

  _davon(skier) {
    let rx = this.x - skier.position.x
    let rz = this.z - skier.position.z
    const l = Math.hypot(rx, rz) || 1
    this.ziel = { rx: rx / l, rz: rz / l }
    if (this.zustand === 'sitzen') {
      this.vx = this.ziel.rx * 4
      this.vz = this.ziel.rz * 4
      this.vy = 3
      this.flugzeit = 0
    }
    this._wechsel('davon')
  }

  // Ausser Sicht: manchmal hat sie sich auf die Huette gesetzt und wartet
  // dort auf den Naechsten, der vorbeikommt. Sonst ist sie fort.
  _umziehenOderGehen(skier) {
    const frei = this.sitze.filter((s) => s.art === 'huette' && s !== this.sitz
      && Math.hypot(s.x - skier.position.x, s.z - skier.position.z) > 24
      && !imBild(this.camera, s.x, s.y + 0.2, s.z, 1.15))
    if (!this._umgezogen && frei.length && Math.random() < 0.5) {
      this._umgezogen = true
      this._setzenAuf(frei[Math.floor(Math.random() * frei.length)])
      this.alter = 0
      this.bleibt = zufall(...BLEIBT)
      this.ausserBild = 0
      return
    }
    this.entfernen()
  }

  _setzenAuf(sitz) {
    this.sitz = sitz
    this.x = sitz.x
    this.y = sitz.y
    this.z = sitz.z
    this.versatz = 0
    this.gier = sitz.gier + zufall(-0.6, 0.6)
    this.vx = this.vy = this.vz = 0
    this.roll = 0
    this._wechsel('sitzen')
  }

  _ablauf(dt, skier) {
    const s = this.soll
    s.rumpf = 0
    s.kopfX = 0
    s.kopfY = 0
    s.schwanz = 1
    s.fluegelY = 1.45
    s.schlag = 0.15
    s.beine = 0

    if (this.zustand === 'sitzen') {
      this.tunZeit -= dt
      if (!this.tun || this.tunZeit <= 0) {
        const w = Math.random()
        const laengs = this.sitz.laengs || 0
        this.tun = w < 0.35 ? 'schauen' : w < 0.55 ? 'putzen' : w < 0.7 ? 'lueften' : laengs > 0 && w < 0.88 ? 'trippeln' : 'drehen'
        this.tunZeit = { schauen: zufall(1.5, 3.5), putzen: zufall(1.2, 2.2), lueften: 0.7, trippeln: zufall(0.6, 1.2), drehen: 0.4 }[this.tun]
        this.blick = zufall(-1.2, 1.2)
        if (this.tun === 'drehen') this.gierSoll = this.gier + zufall(-1.5, 1.5)
        if (this.tun === 'trippeln') {
          const ziel = Math.max(-laengs, Math.min(laengs, this.versatz + zufall(-0.8, 0.8)))
          this.trippelZiel = ziel
          this.gierSoll = this.sitz.gier + (ziel > this.versatz ? 0 : Math.PI)
        }
      }
      switch (this.tun) {
        case 'schauen':
          s.kopfY = this.blick
          s.kopfX = Math.sin(this.uhr * 2.3) > 0.8 ? 0.4 : -0.1
          break
        case 'putzen':
          s.kopfY = Math.sin(this.uhr * 5) > 0 ? 1.9 : -1.9
          s.kopfX = 0.5
          s.fluegelY = 1.25
          break
        case 'lueften':
          s.fluegelY = 0.35
          s.schlag = 0.5 + Math.sin(this.zeit * 30) * 0.3
          s.schwanz = 1.4
          break
        case 'drehen':
          this.gier += winkelDiff(this.gier, this.gierSoll) * glatt(12, dt)
          s.beine = Math.sin(this.uhr * 30) * 0.4
          break
        case 'trippeln': {
          this.gier += winkelDiff(this.gier, this.gierSoll) * glatt(14, dt)
          const rest = this.trippelZiel - this.versatz
          this.versatz += Math.sign(rest) * Math.min(Math.abs(rest), 0.9 * dt)
          s.beine = Math.sin(this.uhr * 26) * 0.5
          // Laengs des Firsts: Richtung aus dem Platz selbst.
          this.x = this.sitz.x + Math.sin(this.sitz.gier) * this.versatz
          this.z = this.sitz.z + Math.cos(this.sitz.gier) * this.versatz
          break
        }
      }
      return
    }

    // --- Im Flug -------------------------------------------------------------
    this.flugzeit += dt
    let soll = null
    if (this.zustand === 'kreisen') {
      const k = this.kreis
      // Zielpunkt ein Stueck voraus auf dem Kreis.
      const a = Math.atan2(this.x - k.x, this.z - k.z) + k.sinn * 0.6
      const boden = terrainHeight(k.x, k.z)
      soll = { x: k.x + Math.sin(a) * k.r, y: boden + k.hoch + Math.sin(this.flugzeit * 0.4) * 1.2, z: k.z + Math.cos(a) * k.r }
      if (this.flugzeit > k.bis) {
        // Landen nur, wenn der Fahrer nicht mehr in der Naehe ist.
        const ziel = this._landeplatz(skier)
        if (ziel) {
          this.landung = ziel
          this._wechsel('landen')
        } else this._davon(skier)
      }
    } else if (this.zustand === 'landen') {
      const z = this.landung
      const rest = Math.hypot(z.x - this.x, z.z - this.z)
      soll = { x: z.x, y: z.y + Math.min(4, rest * 0.35), z: z.z }
      if (Math.hypot(z.x - skier.position.x, z.z - skier.position.z) < RUHE + 3) {
        // Doch wieder jemand da: weiter kreisen.
        this.kreis.bis = this.flugzeit + zufall(8, 14)
        this._wechsel('kreisen')
      } else if (rest < 0.35 && Math.abs(this.y - z.y) < 0.4) {
        this._setzenAuf(z)
        return
      }
    } else if (this.zustand === 'davon') {
      const r = this.ziel
      soll = { x: this.x + r.rx * 10, y: terrainHeight(this.x, this.z) + 12, z: this.z + r.rz * 10 }
    }

    this._fliegen(dt, soll)
  }

  // Ein freier Platz mindestens zwanzig Meter vom Fahrer, am liebsten die
  // Huette. Null, wenn keiner frei ist.
  _landeplatz(skier) {
    const frei = this.sitze.filter((s) => Math.hypot(s.x - skier.position.x, s.z - skier.position.z) > 20
      && Math.hypot(s.x - this.x, s.z - this.z) < 45)
    if (!frei.length) return null
    const huette = frei.filter((s) => s.art === 'huette')
    const liste = huette.length && Math.random() < 0.7 ? huette : frei
    return liste[Math.floor(Math.random() * liste.length)]
  }

  _fliegen(dt, soll) {
    // Lenken wie ein Segler: die Richtung dreht zum Ziel, das Tempo bleibt.
    const dx = soll.x - this.x
    const dz = soll.z - this.z
    const zielGier = Math.atan2(dx, dz)
    const dreh = winkelDiff(this.gier, zielGier)
    const landen = this.zustand === 'landen'
    const rest = Math.hypot(dx, dz)
    const tempo = landen ? Math.max(1.6, Math.min(KREIS.tempo, rest * 1.4)) : this.zustand === 'davon' ? 9 : KREIS.tempo
    const rate = Math.max(-2.2, Math.min(2.2, dreh * 2.5))
    this.gier += rate * dt
    const h = Math.hypot(this.vx, this.vz)
    const neu = h + (tempo - h) * glatt(2.5, dt)
    this.vx = Math.sin(this.gier) * neu
    this.vz = Math.cos(this.gier) * neu
    this.vy += ((soll.y - this.y) * 1.3 - this.vy) * glatt(2.4, dt)
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.z += this.vz * dt
    this.y = Math.max(this.y, terrainHeight(this.x, this.z) + 0.6)
    // In die Kurve gelegt, wie ein Segler.
    this.roll += (-rate * 0.32 - this.roll) * glatt(4, dt)

    // Schlagen: am Anfang, beim Steigen und zum Landen; sonst segeln mit
    // kurzen Schlagfolgen dazwischen.
    this.takt -= dt
    if (this.takt <= 0) {
      this.schlaegt = !this.schlaegt
      this.takt = this.schlaegt ? zufall(0.5, 0.9) : zufall(1.2, 2.6)
    }
    const schlaegt = this.flugzeit < 1.4 || this.vy > 1.2 || (landen && rest < 4) || this.schlaegt
    if (schlaegt) this.phase += dt * (landen ? 40 : 30)

    const s = this.soll
    s.fluegelY = 0.08
    s.schlag = schlaegt ? Math.sin(this.phase) * 0.95 + 0.1 : 0.06
    s.schwanz = landen && rest < 3 ? 1.8 : 1.35
    s.rumpf = landen && rest < 2 ? -0.5 : -Math.max(-0.3, Math.min(0.3, this.vy * 0.08))
    s.beine = landen && rest < 2 ? -1 : 0.9
    s.kopfX = -0.1
  }

  _setzen(k) {
    const p = this.pose
    const s = this.soll
    for (const key of Object.keys(p)) p[key] += (s[key] - p[key]) * k
    const m = this.m
    m.root.position.set(this.x, this.y, this.z)
    qGier.setFromAxisAngle(oben, this.gier)
    qRoll.setFromAxisAngle(vorn, this.zustand === 'sitzen' ? 0 : this.roll)
    m.root.quaternion.copy(qGier).multiply(qRoll)
    m.rumpf.rotation.x = p.rumpf
    m.kopf.rotation.set(p.kopfX, p.kopfY, 0, 'YXZ')
    m.schwanz.scale.set(p.schwanz, 1, 1)
    for (const b of m.beine) b.rotation.x = p.beine
    for (const f of m.fluegel) {
      const sd = f.anlegen.userData.seite
      f.anlegen.rotation.y = sd * p.fluegelY
      f.schlag.rotation.z = sd * p.schlag
    }
  }
}
