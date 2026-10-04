import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { MURMEL } from '../config.js'
import { terrainHeight, terrainNormal } from './heightfield.js'
import { shorePoint } from './populate.js'

// Murmeltiere am Nordwestufer, zwischen Bootshaus und Station. Im Winter
// schlafen sie (Oktober bis April, deshalb gibt es im Tal keine), im Sommer
// sitzen sie vor ihren Bauen, grasen, und einer steht Wache.
//
// Kommt der Fahrer am Seil vorbei, pfeift die Wache – aufrecht, der Kopf
// ruckt bei jedem Pfiff –, und alle rennen zu ihren Loechern und sind weg.
// Zwischen zwei Runden (gut 27 s) tauchen sie wieder auf: erst die Nase,
// dann der Kopf, ein Blick in die Runde, dann heraus. Der See bleibt still
// wie das Tal; der Pfiff ist nur zu sehen.

const zufall = (a, b) => a + Math.random() * (b - a)
// Die Bahn laeuft 34 m an der Kolonie vorbei, ausgeschwungen naeher: bei
// 40 m pfeift die Wache, bei 30 rennen alle auch ohne Pfiff, und erst ab
// 52 m kommen sie wieder heraus.
const ALARM = 40
const FLUCHT = 30
const RUHIG = 52
const RENNEN = 4.2       // m/s
const GROESSE = 1.6      // echt gut einen halben Meter lang; aus 26 m zu klein

// --- Gestalt ------------------------------------------------------------------
const FELL = 0x8b6c4c
const RUECKEN = 0x6f5640
const BAUCH = 0xbf9f78
const GESICHT = 0x3b2c22
const NASE = 0x1c1512
const ERDE = 0x7d6650
const ERDE_DUNKEL = 0x5e4c3b
const LOCH = 0x241c16

function ei(rx, ry, rz, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  g.scale(rx, ry, rz)
  return g
}

// Ein Gelenk: Gruppe am Drehpunkt, darin die Teile relativ dazu.
function gelenk(eltern, [px, py, pz], teile, material) {
  const g = new THREE.Group()
  g.position.set(px, py, pz)
  eltern.add(g)
  const mesh = new THREE.Mesh(
    assemble(teile.map((t) => ({ ...t, position: [t.position[0] - px, t.position[1] - py, t.position[2] - pz] }))),
    material,
  )
  mesh.castShadow = true
  g.add(mesh)
  return g
}

function bauen(material) {
  const root = new THREE.Group()
  root.name = 'murmeltier'
  const koerper = new THREE.Group()
  koerper.scale.setScalar(GROESSE)
  root.add(koerper)
  // Der Rumpf dreht um die Huefte: aufrecht sitzen ist eine Drehung nach
  // hinten, die Hinterbeine bleiben am Boden.
  const H = [0, 0.1, -0.12]
  const rumpf = gelenk(koerper, H, [
    { geo: ei(0.15, 0.14, 0.22), color: FELL, position: [0, 0.16, 0] },
    { geo: ei(0.12, 0.08, 0.18), color: RUECKEN, position: [0, 0.25, -0.02] },
    { geo: ei(0.11, 0.1, 0.15), color: BAUCH, position: [0, 0.12, 0.05] },
    { geo: ei(0.035, 0.035, 0.09, 0), color: GESICHT, position: [0, 0.14, -0.24] },
  ], material)
  const K = [0, 0.24, 0.16]
  const kopf = gelenk(rumpf, [K[0] - H[0], K[1] - H[1], K[2] - H[2]], [
    { geo: ei(0.09, 0.08, 0.1), color: FELL, position: [0, 0.27 - H[1], 0.24 - H[2]] },
    { geo: ei(0.065, 0.055, 0.06), color: GESICHT, position: [0, 0.255 - H[1], 0.31 - H[2]] },
    { geo: ei(0.02, 0.016, 0.014, 0), color: NASE, position: [0, 0.27 - H[1], 0.36 - H[2]] },
    { geo: ei(0.014, 0.014, 0.01, 0), color: NASE, position: [0.05, 0.3 - H[1], 0.3 - H[2]] },
    { geo: ei(0.014, 0.014, 0.01, 0), color: NASE, position: [-0.05, 0.3 - H[1], 0.3 - H[2]] },
    { geo: ei(0.025, 0.022, 0.015, 0), color: RUECKEN, position: [0.065, 0.335 - H[1], 0.21 - H[2]] },
    { geo: ei(0.025, 0.022, 0.015, 0), color: RUECKEN, position: [-0.065, 0.335 - H[1], 0.21 - H[2]] },
  ], material)
  // Kopf als Kind des Rumpfs: die Teile wurden oben relativ zur Huefte
  // angegeben, gelenk() zieht noch den Kopfpunkt ab.
  // Vorderpfoten, im Rahmen des Rumpfs (Ursprung an der Huefte).
  const vorn = [1, -1].map((s) => gelenk(rumpf, [s * 0.07, 0.06, 0.24], [
    { geo: ei(0.03, 0.07, 0.035), color: GESICHT, position: [s * 0.07, 0.0, 0.25] },
  ], material))
  const hinten = [1, -1].map((s) => gelenk(koerper, [s * 0.1, 0.08, -0.12], [
    { geo: ei(0.05, 0.07, 0.08), color: FELL, position: [s * 0.1, 0.07, -0.1] },
    { geo: ei(0.03, 0.015, 0.06, 0), color: GESICHT, position: [s * 0.1, 0.012, -0.05] },
  ], material))
  return { root, rumpf, kopf, vorn, hinten }
}

// Ein Bau: ein flacher Erdhuegel mit dunklem Loch und ein paar Steinen.
function bau(x, z, gier, material) {
  const teile = [
    // Flach: mit 0,25 m Hoehe lasen sich die Huegel wie Felsen.
    { geo: ei(1.0, 0.16, 0.85), color: ERDE, position: [0, 0, 0] },
    { geo: ei(0.55, 0.12, 0.45), color: ERDE_DUNKEL, position: [0.2, 0.05, -0.3] },
    { geo: new THREE.CircleGeometry(0.3, 10), color: LOCH, position: [0, 0.15, 0.3], rotation: [-Math.PI / 2 + 0.3, 0, 0] },
    { geo: ei(0.12, 0.08, 0.1, 0), color: 0x8e8b86, position: [-0.6, 0.12, 0.3] },
    { geo: ei(0.09, 0.07, 0.08, 0), color: 0x7c7a76, position: [0.7, 0.1, 0.2] },
  ]
  const mesh = new THREE.Mesh(assemble(teile), material)
  mesh.receiveShadow = true
  mesh.castShadow = true
  mesh.position.set(x, terrainHeight(x, z) - 0.02, z)
  mesh.rotation.y = gier
  return mesh
}

// --- Kolonie -------------------------------------------------------------------
const oben = new THREE.Vector3(0, 1, 0)
const n = new THREE.Vector3()
const qHang = new THREE.Quaternion()
const qGier = new THREE.Quaternion()
const eins = new THREE.Quaternion()

export class Murmeltiere {
  constructor(scene) {
    const mitte = shorePoint(MURMEL.winkel, MURMEL.inland)
    this.mitte = mitte
    const material = vertexColorMaterial({ roughness: 0.85 })
    // Drei Baue, das Loch zum Wasser hin.
    this.baue = [[-2.6, 0.4], [0.2, -1.4], [2.8, 0.8]].map(([u, v]) => {
      const c = Math.cos(mitte.face)
      const s = Math.sin(mitte.face)
      const x = mitte.x + u * c + v * s
      const z = mitte.z - u * s + v * c
      const b = { x, z, gier: mitte.face, loch: { x: x + Math.sin(mitte.face) * 0.4, z: z + Math.cos(mitte.face) * 0.4 } }
      scene.add(bau(x, z, mitte.face, material))
      return b
    })
    this.tiere = this.baue.map((b, i) => {
      const m = bauen(material)
      scene.add(m.root)
      return {
        m, bau: b, wache: i === 1,
        x: b.loch.x, z: b.loch.z, gier: b.gier + zufall(-1, 1),
        zustand: 'draussen', zeit: zufall(0, 5), tief: 0,
        ziel: null, tun: null, tunZeit: 0, uhr: Math.random() * 10,
        pose: { rumpf: 0, kopfX: 0, kopfY: 0, vorn: 0, hub: 0 },
      }
    })
    this.alarm = false
    this.unten = 0
    // Gleich an ihren Platz: sonst standen sie bis zum ersten Bild im
    // Nullpunkt der Welt, mitten im See.
    for (const t of this.tiere) this._setzen(t, t.pose, 1)
  }

  update(dt, rider) {
    const d = Math.hypot(rider.x - this.mitte.x, rider.z - this.mitte.z)
    const wache = this.tiere.find((t) => t.wache)
    // Alarm: die Wache pfeift, die anderen rennen nach dem ersten Pfiff.
    if (!this.alarm && d < ALARM && this.tiere.some((t) => t.zustand === 'draussen' || t.zustand === 'auftauchen')) {
      this.alarm = true
      this.alarmZeit = 0
      if (wache.zustand === 'draussen') { wache.zustand = 'pfeifen'; wache.zeit = 0 }
    }
    if (this.alarm) {
      this.alarmZeit += dt
      for (const t of this.tiere) {
        const los = d < FLUCHT || this.alarmZeit > (t.wache ? 1.4 : 0.45)
        if (los && (t.zustand === 'draussen' || t.zustand === 'auftauchen' || t.zustand === 'pfeifen')) {
          t.zustand = 'flucht'
          t.zeit = 0
        }
      }
      if (this.tiere.every((t) => t.zustand === 'unten')) {
        this.alarm = false
        this.unten = 0
      }
    }
    if (!this.alarm) this.unten += dt

    for (const t of this.tiere) this._tier(t, dt, d)
  }

  _tier(t, dt, d) {
    t.zeit += dt
    t.uhr += dt
    const s = { rumpf: 0, kopfX: 0, kopfY: 0, vorn: 0, hub: 0 }
    switch (t.zustand) {
      case 'draussen': {
        // Grasen, umschauen, ein paar Schritte – die Wache sitzt meist
        // aufrecht auf ihrem Huegel.
        t.tunZeit -= dt
        if (!t.tun || t.tunZeit <= 0) {
          const w = Math.random()
          t.tun = t.wache ? (w < 0.7 ? 'aufrecht' : 'grasen') : (w < 0.5 ? 'grasen' : w < 0.7 ? 'aufrecht' : 'laufen')
          t.tunZeit = zufall(2, 5)
          t.blick = zufall(-0.9, 0.9)
          if (t.tun === 'laufen') {
            const a = Math.random() * Math.PI * 2
            const r = zufall(0.8, 2.8)
            t.ziel = { x: t.bau.loch.x + Math.sin(a) * r, z: t.bau.loch.z + Math.cos(a) * r }
          }
        }
        if (t.tun === 'grasen') {
          s.kopfX = 0.65 + Math.sin(t.uhr * 14) * 0.05
          s.rumpf = 0.1
        } else if (t.tun === 'aufrecht') {
          this._aufrecht(s)
          s.kopfY = t.blick + Math.sin(t.uhr * 0.7) * 0.2
        } else if (t.tun === 'laufen' && t.ziel) {
          if (this._laufen(t, t.ziel, 1.2, dt) < 0.1) t.ziel = null
          s.hub = Math.abs(Math.sin(t.uhr * 16)) * 0.02
          s.vorn = Math.sin(t.uhr * 16) * 0.6
        }
        break
      }
      case 'pfeifen': {
        // Aufrecht, Kopf hoch, und bei jedem Pfiff ruckt der Kopf.
        this._aufrecht(s)
        const pfiff = (t.zeit % 0.45) < 0.12
        s.kopfX = pfiff ? -0.45 : -0.15
        s.rumpf = -1.25 + (pfiff ? -0.08 : 0)
        break
      }
      case 'flucht': {
        const rest = this._laufen(t, t.bau.loch, RENNEN, dt)
        s.hub = Math.abs(Math.sin(t.uhr * 22)) * 0.05
        s.vorn = Math.sin(t.uhr * 22) * 1.0
        s.rumpf = 0.15 * Math.sin(t.uhr * 22 + 0.6)
        if (rest < 0.08) {
          t.zustand = 'abtauchen'
          t.zeit = 0
          t.gier = t.bau.gier + Math.PI   // kopfueber hinein, vom Wasser weg
        }
        break
      }
      case 'abtauchen': {
        t.tief = Math.min(1, t.zeit / 0.35)
        s.rumpf = 0.6
        if (t.tief >= 1) {
          t.zustand = 'unten'
          t.zeit = 0
          t.warten = zufall(6, 18)
        }
        break
      }
      case 'unten': {
        t.tief = 1
        // Herauskommen erst, wenn der Fahrer weit weg ist und eine Weile
        // Ruhe war; die Wache zuerst.
        const vorWache = !t.wache && this.tiere.find((w) => w.wache).zustand === 'unten'
        if (!this.alarm && d > RUHIG && t.zeit > t.warten && !vorWache) {
          t.zustand = 'auftauchen'
          t.zeit = 0
          t.gier = t.bau.gier + zufall(-0.6, 0.6)
          t.x = t.bau.loch.x
          t.z = t.bau.loch.z
        }
        break
      }
      case 'auftauchen': {
        // Erst die Nase, ein Blick, dann heraus.
        const p = t.zeit
        t.tief = p < 0.6 ? 1 - p / 0.6 * 0.55 : p < 2.2 ? 0.45 : Math.max(0, 0.45 - (p - 2.2) / 0.5 * 0.45)
        s.kopfY = Math.sin(p * 2.4) * 0.7
        s.kopfX = -0.2
        if (p > 2.7) {
          t.zustand = 'draussen'
          t.zeit = 0
          t.tun = null
          t.tief = 0
        }
        break
      }
    }
    this._setzen(t, s, dt)
  }

  _aufrecht(s) {
    s.rumpf = -1.2
    s.kopfX = 1.0
    s.vorn = -0.9
  }

  _laufen(t, ziel, tempo, dt) {
    const dx = ziel.x - t.x
    const dz = ziel.z - t.z
    const rest = Math.hypot(dx, dz)
    if (rest < 0.01) return 0
    const soll = Math.atan2(dx, dz)
    t.gier += Math.atan2(Math.sin(soll - t.gier), Math.cos(soll - t.gier)) * Math.min(1, dt * 10)
    const sch = Math.min(rest, tempo * dt)
    t.x += (dx / rest) * sch
    t.z += (dz / rest) * sch
    return rest - sch
  }

  _setzen(t, s, dt) {
    const k = Math.min(1, dt * 9)
    for (const key of Object.keys(t.pose)) t.pose[key] += (s[key] - t.pose[key]) * k
    const m = t.m
    const p = t.pose
    // Im Loch versinkt es: 0,7 m tiefer ist es ganz weg.
    const y = terrainHeight(t.x, t.z) + (t.zustand === 'draussen' || t.zustand === 'flucht' ? 0.04 : 0.12)
    m.root.position.set(t.x, y + p.hub - t.tief * 0.7 * GROESSE, t.z)
    m.root.visible = t.tief < 0.99
    terrainNormal(t.x, t.z, n)
    qHang.setFromUnitVectors(oben, n)
    qHang.slerpQuaternions(eins, qHang, 0.6)
    qGier.setFromAxisAngle(oben, t.gier)
    m.root.quaternion.copy(qHang).multiply(qGier)
    m.rumpf.rotation.x = p.rumpf
    m.kopf.rotation.set(p.kopfX, p.kopfY, 0, 'YXZ')
    for (const v of m.vorn) v.rotation.x = p.vorn
    for (const h of m.hinten) h.rotation.x = -p.vorn * 0.6
  }
}
