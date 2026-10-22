import * as THREE from 'three'
import { createSkierModel, HIP } from '../player/skier-model.js'
import { bergab, hoehe, welt, LOCH, spurKurve } from './gelaende.js'

// Der Fahrer der 404-Seite: derselbe wie im Tal, nur ohne Helm und Stoecke
// (die liegen im Bild herum) und mit den Ski an den Beinen, damit sie beim
// Strampeln mitgehen. Gedreht wird er um die Huefte – dort sitzt der
// Schwerpunkt, und um sie kippt er beim Herausploppen und Hineinfallen.
//
// Ablauf: steckt → (Klick) raus → steht → weg → fort → kommt → fliegt →
// steckt. Wer klickt, waehrend er steht, erschreckt ihn: dann springt er
// zurueck ins Loch.

const HUEFTE = 0.1 + HIP.y
const KOPFUEBER = 2.75  // rad Vorlage: Kopf unten und etwas voraus, Beine schraeg nach hinten
// Die Huefte sitzt knapp unter dem Rand: der Lochboden liegt 0,3 m tiefer
// als der Schnee ringsum. Bei 0,26 m darunter ragten nur noch die Ski heraus.
const HUEFTE_IM_LOCH = 0.16

const glatt = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t) }
const bogen = (s) => 4 * s * (1 - s)
function kuerzer(von, nach) {
  let d = nach - von
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

export class Fahrer {
  constructor({ staub, neueSpur, melden = () => {}, ruhig = false }) {
    this.staub = staub
    this.neueSpur = neueSpur
    this.melden = melden
    this.ruhig = ruhig

    this.group = new THREE.Group()
    this.model = createSkierModel()
    this.model.position.y = -HUEFTE
    this.group.add(this.model)
    const p = this.p = this.model.userData.parts

    this.model.updateMatrixWorld(true)
    p.legSides.left.attach(p.skiLeft)
    p.legSides.right.attach(p.skiRight)

    // Der Helm haengt am Netz, auf dem Kopf bleibt Haar.
    this.helm = new THREE.Group()
    for (const teil of p.head.children.slice(1, 4)) this.helm.add(teil)
    const haar = new THREE.Mesh(
      new THREE.SphereGeometry(0.176, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({ color: 0x5b3d29, roughness: 0.9, flatShading: true }),
    )
    haar.position.set(0, 0.015, -0.02)
    haar.rotation.x = -0.3
    haar.castShadow = true
    p.head.add(haar)

    this.stoecke = [p.arms.left, p.arms.right].map((arm) => {
      const stock = arm.children.at(-1)
      arm.remove(stock)
      return stock
    })

    this.group.traverse((o) => { if (o.isMesh) o.castShadow = true })

    const m = welt(LOCH.u, LOCH.v)
    this.loch = new THREE.Vector3(m.x, hoehe(m.x, m.z), m.z)
    this.kurve = spurKurve()
    const ende = this.kurve.at(-1)
    this.anflugYaw = Math.atan2(this.loch.x - ende.x, this.loch.z - ende.z)

    this.pose = {
      pos: new THREE.Vector3(), yaw: 0, pitch: 0, roll: 0, stauch: 1,
      beinX: [0, 0], beinZ: [0, 0], ski: 0, armX: 0, armZ: 0, torso: 0, kopf: 0,
    }
    this.start = new THREE.Vector3()
    this.stand = new THREE.Vector3()
    this.yaw = this.anflugYaw
    this.zappel = { art: 'pause', t: 0, dauer: 1.5 }
    this.setze('steckt')
    this.update(0)
  }

  get position() { return this.group.position }

  lochPunkt(ziel = new THREE.Vector3()) {
    return ziel.set(this.loch.x, this.loch.y + HUEFTE_IM_LOCH, this.loch.z)
  }

  setze(zustand) {
    this.zustand = zustand
    this.t = 0
    this.start.copy(this.group.position)
    this.startYaw = this.yaw
    if (zustand === 'weg') {
      this.v = 0
      this.richtung = this.yaw
      this.spur = this.neueSpur()
    }
    if (zustand === 'kommt') this.s = 0
    this.group.visible = zustand !== 'fort'
    this.melden(zustand)
  }

  // Klick, Tippen oder Leertaste. true, wenn er darauf reagiert.
  aktion() {
    if (this.zustand === 'steckt') { this.setze('raus'); return true }
    if (this.zustand === 'steht' && this.t > 0.3) { this.setze('erschrickt'); return true }
    return false
  }

  wolke(x, y, z, n, kraft = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random()
      this.staub(
        x + Math.cos(a) * 0.4 * r, y + 0.1, z + Math.sin(a) * 0.4 * r,
        Math.cos(a) * (1 + r * 2.5) * kraft, (2 + Math.random() * 3.5) * kraft, Math.sin(a) * (1 + r * 2.5) * kraft,
        0.4 + Math.random() * 0.6, 0.8 + Math.random() * 0.4,
      )
    }
  }

  update(dt) {
    this.t += dt
    const P = this.pose
    // Grundhaltung, die jeder Zustand nur abwandelt.
    P.roll = 0; P.stauch = 1; P.ski = 0; P.armX = 0; P.armZ = 0; P.torso = 0; P.kopf = 0
    P.beinX[0] = P.beinX[1] = 0; P.beinZ[0] = P.beinZ[1] = 0
    this[this.zustand](dt, this.t, P)
    this.anwenden()
  }

  // Kopfueber, die Beine als V in der Luft, die Ski ueberkreuzt.
  kopfueber(P, anteil = 1) {
    P.beinZ[0] = -0.34 * anteil
    P.beinZ[1] = 0.34 * anteil
    P.beinX[0] = P.beinX[1] = 0.15 * anteil
    P.ski = 0.38 * anteil
  }

  steckt(dt, t, P) {
    this.lochPunkt(P.pos)
    P.yaw = this.yaw
    this.kopfueber(P)
    if (this.ruhig) { P.pitch = KOPFUEBER; return }
    P.pitch = KOPFUEBER + 0.05 * Math.sin(t * 1.3)
    P.roll = 0.06 * Math.sin(t * 0.9)
    P.beinX[0] += 0.05 * Math.sin(t * 2.1)
    P.beinX[1] += 0.05 * Math.sin(t * 2.1 + 1)

    // Alle paar Sekunden ein Anfall: strampeln, Schere oder ein Tritt.
    const z = this.zappel
    z.t += dt
    if (z.t > z.dauer) {
      const war = z.art
      z.art = war === 'pause' ? ['strampeln', 'schere', 'tritt', 'strampeln'][Math.floor(Math.random() * 4)] : 'pause'
      z.dauer = { pause: 0.9 + Math.random() * 2.2, strampeln: 1.1, schere: 1.3, tritt: 0.45 }[z.art]
      z.t = 0
      z.seite = Math.random() < 0.5 ? 0 : 1
    }
    const h = Math.sin(Math.PI * Math.min(1, z.t / z.dauer))
    if (z.art === 'strampeln') {
      const w = 0.6 * h * Math.sin(z.t * Math.PI * 2 * 6)
      P.beinX[0] += w
      P.beinX[1] -= w
      P.pos.y += 0.025 * h * Math.sin(z.t * 50)
      if (Math.random() < dt * 14) this.wolke(this.loch.x, this.loch.y, this.loch.z, 1, 0.5)
    } else if (z.art === 'schere') {
      const w = 0.3 * h * Math.sin(z.t * Math.PI * 2 * 2.4)
      P.beinZ[0] -= w
      P.beinZ[1] += w
      P.ski += 0.3 * h * Math.sin(z.t * Math.PI * 2 * 2.4)
    } else if (z.art === 'tritt') {
      P.beinX[z.seite] -= 0.9 * h
    }
  }

  raus(dt, t, P) {
    const T0 = 0.4, T1 = 1.05
    P.yaw = this.yaw
    const vor = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    this.stand.copy(this.loch).addScaledVector(vor, 0.95)
    this.stand.y = hoehe(this.stand.x, this.stand.z) + HUEFTE
    if (t < T0) {
      // Erst ein Ruck: heftig strampeln, ein Stueck tiefer, dann raus.
      this.lochPunkt(P.pos)
      P.pos.y -= 0.07 * t / T0
      P.pos.x += 0.03 * Math.sin(t * 61)
      P.pitch = KOPFUEBER
      this.kopfueber(P)
      const w = 0.75 * Math.sin(t * Math.PI * 2 * 9)
      P.beinX[0] += w
      P.beinX[1] -= w
      if (Math.random() < dt * 30) this.wolke(this.loch.x, this.loch.y, this.loch.z, 1, 0.6)
      return
    }
    if (!this.geploppt) {
      this.geploppt = true
      this.wolke(this.loch.x, this.loch.y, this.loch.z, 46, 1.1)
    }
    const s = Math.min(1, (t - T0) / (T1 - T0)), e = glatt(s)
    P.pos.copy(this.lochPunkt(P.pos)).lerp(this.stand, e)
    P.pos.y += 1.5 * bogen(s)
    P.pitch = KOPFUEBER * (1 - e)
    this.kopfueber(P, 1 - e)
    P.armZ = (1.5 + 0.7 * Math.sin(t * 26)) * Math.sin(Math.PI * s)
    if (t >= T1) {
      this.geploppt = false
      this.setze('steht')
    }
  }

  steht(dt, t, P) {
    P.pos.copy(this.stand)
    P.yaw = this.yaw
    P.pitch = 0
    if (t < 0.3) {
      // Landen: in die Knie, wieder hoch.
      P.stauch = 1 - 0.16 * Math.sin(Math.PI * t / 0.3)
    } else if (t < 1.7) {
      // Schuetteln wie ein nasser Hund, und der Schnee fliegt.
      const tau = t - 0.3, amp = 1 - tau / 1.4
      const w = Math.sin(tau * Math.PI * 2 * 6.5)
      P.torso = 0.6 * amp * w
      P.roll = 0.1 * amp * Math.sin(tau * Math.PI * 2 * 6.5 + 1)
      P.kopf = 0.45 * amp * Math.sin(tau * Math.PI * 2 * 6.5 - 0.8)
      if (!this.ruhig) {
        const n = Math.random() < dt * 70 * amp ? 2 : 0
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2
          const v = 2 + Math.random() * 1.8
          this.staub(
            P.pos.x + Math.cos(a) * 0.3, P.pos.y + 0.1 + Math.random() * 0.6, P.pos.z + Math.sin(a) * 0.3,
            Math.cos(a) * v, 0.6 + Math.random(), Math.sin(a) * v, 0.25 + Math.random() * 0.25, 0.7,
          )
        }
      }
    } else if (t < 2.9) {
      // Umschauen: hat das wer gesehen?
      P.kopf = 0.75 * Math.sin(Math.PI * 2 * (t - 1.7) / 1.2)
    } else if (t < 3.5) {
      P.armZ = 0.55 * Math.sin(Math.PI * (t - 2.9) / 0.6)
      P.stauch = 1 + 0.03 * Math.sin(Math.PI * (t - 2.9) / 0.6)
    } else if (t > 3.7) {
      this.setze('weg')
    }
  }

  erschrickt(dt, t, P) {
    const T0 = 0.35, T1 = 1.0
    const ziel = Math.atan2(this.loch.x - this.start.x, this.loch.z - this.start.z)
    if (t < T0) {
      P.pos.copy(this.start)
      P.pos.y += 0.45 * Math.sin(Math.PI * t / T0)
      P.yaw = this.startYaw + kuerzer(this.startYaw, ziel) * glatt(t / T0)
      P.pitch = 0
      P.armZ = 2.4 * glatt(t / 0.12)
      return
    }
    const s = Math.min(1, (t - T0) / (T1 - T0)), e = glatt(s)
    P.pos.copy(this.start).lerp(this.lochPunkt(), e)
    P.pos.y += 1.0 * bogen(s)
    P.yaw = ziel
    P.pitch = KOPFUEBER * e
    P.armX = -2.6 * glatt(s * 3)
    P.armZ = 0.3
    this.kopfueber(P, e)
    if (t >= T1) {
      this.yaw = ziel
      this.wolke(this.loch.x, this.loch.y, this.loch.z, 40, 0.9)
      this.setze('steckt')
    }
  }

  weg(dt, t, P) {
    const ziel = welt(20, 4.5)
    const x = this.group.position.x, z = this.group.position.z
    const soll = Math.atan2(ziel.x - x, ziel.z - z)
    const d = kuerzer(this.richtung, soll)
    const dreh = Math.max(-2.4 * dt, Math.min(2.4 * dt, d))
    this.richtung += dreh
    // Erst umdrehen, dann Fahrt aufnehmen.
    this.v = Math.abs(d) > 1.2 ? Math.min(this.v + dt, 1) : Math.min(7.5, this.v + dt * (this.v < 1 ? 1.8 : 3.4))
    const nx = x + Math.sin(this.richtung) * this.v * dt
    const nz = z + Math.cos(this.richtung) * this.v * dt
    P.pos.set(nx, hoehe(nx, nz) + HUEFTE, nz)
    P.yaw = this.yaw = this.richtung
    P.pitch = 0
    P.stauch = 0.93
    P.roll = dt > 0 ? Math.max(-0.4, Math.min(0.4, -dreh / dt * 0.2 * Math.min(1, this.v / 3))) : 0
    this.spur.punkt(nx, nz)
    this.spritzen(P, dt)
    if (bergab(nx, nz) > 17) this.setze('fort')
  }

  fort(dt, t) {
    if (t > 3.2) this.setze('kommt')
  }

  kommt(dt, t, P) {
    const k = this.kurve
    this.s += dt * 7
    const f = this.s / 0.25
    const i = Math.min(k.length - 2, Math.floor(f))
    const a = k[i], b = k[i + 1], w = Math.min(1, f - i)
    const x = a.x + (b.x - a.x) * w, z = a.z + (b.z - a.z) * w
    P.pos.set(x, hoehe(x, z) + HUEFTE, z)
    P.yaw = this.yaw = Math.atan2(b.x - a.x, b.z - a.z)
    P.pitch = 0
    P.stauch = 0.92
    this.spritzen(P, dt)
    if (f >= k.length - 1) {
      this.yaw = this.anflugYaw
      this.setze('fliegt')
    }
  }

  fliegt(dt, t, P) {
    const T = 0.8, s = Math.min(1, t / T)
    P.pos.copy(this.start).lerp(this.lochPunkt(), s)
    P.pos.y += 1.4 * bogen(s)
    P.yaw = this.yaw
    // Er dreht erst spaet ueber – bis zur Wechte sah es noch nach Absicht aus.
    P.pitch = KOPFUEBER * s ** 1.8
    P.armZ = (1.3 + 0.8 * Math.sin(t * 30)) * s
    this.kopfueber(P, s)
    if (t >= T) {
      this.wolke(this.loch.x, this.loch.y, this.loch.z, 60, 1.2)
      this.einschlag?.()
      this.setze('steckt')
    }
  }

  spritzen(P, dt) {
    if (this.ruhig || Math.random() > dt * 40) return
    const hinten = new THREE.Vector3(-Math.sin(P.yaw), 0, -Math.cos(P.yaw))
    const seite = Math.random() < 0.5 ? -0.19 : 0.19
    const x = P.pos.x + hinten.x * 0.6 + Math.cos(P.yaw) * seite
    const z = P.pos.z + hinten.z * 0.6 - Math.sin(P.yaw) * seite
    this.staub(x, hoehe(x, z) + 0.05, z, (Math.random() - 0.5) * 1.2, 0.6 + Math.random(), (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.3, 0.6)
  }

  anwenden() {
    const P = this.pose, p = this.p
    this.group.position.copy(P.pos)
    // Gestaucht wird um die Fuesse, damit die Ski auf dem Schnee bleiben.
    this.group.position.y -= HUEFTE * (1 - P.stauch) * Math.cos(P.pitch)
    this.model.scale.set(1 + (1 - P.stauch) * 0.4, P.stauch, 1 + (1 - P.stauch) * 0.4)
    this.model.position.y = -HUEFTE * P.stauch
    this.group.rotation.set(P.pitch, P.yaw, P.roll, 'YXZ')
    p.legSides.left.rotation.set(P.beinX[0], 0, P.beinZ[0])
    p.legSides.right.rotation.set(P.beinX[1], 0, P.beinZ[1])
    p.skiLeft.rotation.y = P.ski
    p.skiRight.rotation.y = -P.ski
    p.arms.left.rotation.set(P.armX, 0, -P.armZ)
    p.arms.right.rotation.set(P.armX, 0, P.armZ)
    p.torso.rotation.y = P.torso
    p.head.rotation.y = P.kopf
  }
}
