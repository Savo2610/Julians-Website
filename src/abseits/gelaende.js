import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { fbm } from '../core/noise.js'
import { makeRng } from '../core/rng.js'
import { COLORS } from '../config.js'
import { createForest } from '../world/props/trees.js'
import { createBoulder } from '../world/props/rocks.js'

// Das Stueck Hang der 404-Seite: oben die gewalzte Piste, dann das gelbe
// Fangnetz mit einem niedergerissenen Feld, darunter Tiefschnee. Die Spur
// kommt die Piste herunter, geht durchs Netz, ueber eine Wechte – und hoert
// auf. Vier Meter weiter steckt der Fahrer.
//
// Gerechnet wird in Hangrichtungen: u bergab (zur Kamera hin), v quer
// (im Bild nach rechts). Die Kamera steht wie im Tal bei Azimut 45 Grad,
// also genau bergab gesehen; so liegt der Hang ohne Drehung im Bild.

const S2 = Math.SQRT1_2
export const bergab = (x, z) => (x + z) * S2
export const quer = (x, z) => (x - z) * S2
export const welt = (u, v) => ({ x: (u + v) * S2, z: (u - v) * S2 })

export const LOCH = { u: 1.2, v: 0.2 }
export const KANTE = { u: -2.4, v: -0.2 }
export const NETZ_U = -5.6
// Pfosten quer zum Hang; zwischen dem dritten und vierten ist das Feld
// heruntergerissen, genau dort, wo die Spur durchgeht.
const PFOSTEN_V = [-12, -7.4, -2.8, 1.6, 6.2, 11]
const GERISSEN = 2
const NETZ_H = 1.9

// Die Spur von oben bis an die Wechte, in (u, v).
const SPUR_PUNKTE = [[-30, -7], [-22, -5.6], [-15, -3.4], [-9, -1.3], [-5.6, -0.6], [-3.7, -0.3], [KANTE.u, KANTE.v]]

const glatt = (a, b, t) => {
  const s = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return s * s * (3 - 2 * s)
}

// Einzige Hoehenquelle der Seite: Boden, Spur, Netz und Fahrer lesen sie.
export function hoehe(x, z) {
  const u = bergab(x, z), v = quer(x, z)
  let h = -0.17 * u
  // Jenseits des Netzes gewalzt, diesseits Kissen aus Tiefschnee.
  const tief = glatt(NETZ_U - 0.4, NETZ_U + 2.5, u)
  h += tief * (fbm(x * 0.21 + 3.1, z * 0.21 - 1.7, 3) - 0.5) * 1.1
  // Am Netz schiebt der Wind einen kleinen Wall zusammen.
  h += 0.22 * Math.exp(-(((u - NETZ_U - 0.7) / 0.9) ** 2))
  // Die Wechte: flach hinauf, steil hinunter.
  const du = u - KANTE.u, dv = v - KANTE.v
  const lang = du < 0 ? du / 1.9 : du / 0.6
  h += 0.55 * Math.exp(-lang * lang - (dv / 1.7) ** 2)
  // Das Loch.
  const lu = u - LOCH.u, lv = v - LOCH.v
  h -= 0.3 * Math.exp(-(lu * lu + lv * lv) / 0.3)
  return h
}

export function createBoden() {
  const size = 170, n = 420
  const geo = new THREE.PlaneGeometry(size, size, n, n)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const farben = new Float32Array(pos.count * 3)
  const hell = new THREE.Color(COLORS.snowLit)
  const blau = new THREE.Color(0xdfe8f6)
  const piste = new THREE.Color(0xeef2f9)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i)
    pos.setY(i, hoehe(x, z))
    const u = bergab(x, z)
    // Ein Hauch Blau in den Mulden, die Piste etwas matter als der Pulver.
    c.copy(hell).lerp(blau, glatt(0.45, 0.7, fbm(x * 0.5, z * 0.5, 2)) * 0.6)
    c.lerp(piste, 1 - glatt(NETZ_U - 0.4, NETZ_U + 0.6, u))
    farben.set([c.r, c.g, c.b], i * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3))
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.93 }))
  mesh.receiveShadow = true
  return mesh
}

// Zwei Rillen, auf den Schnee gelegt. Waechst Punkt fuer Punkt mit, damit
// derselbe Bau auch die frische Spur beim Wegfahren zieht.
export class Spur {
  constructor(max = 900) {
    this.max = max
    this.n = 0
    this.letzter = null
    this.pos = new Float32Array(max * 4 * 3)
    const index = []
    for (let i = 0; i < max - 1; i++) {
      for (const rille of [0, 2]) {
        const a = i * 4 + rille, b = (i + 1) * 4 + rille
        index.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
    this.geo = new THREE.BufferGeometry()
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage))
    this.geo.setIndex(index)
    this.geo.setDrawRange(0, 0)
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({
      color: 0xc3d1ea, roughness: 1,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }))
    this.mesh.frustumCulled = false
    this.mesh.receiveShadow = true
  }

  punkt(x, z) {
    if (this.n >= this.max) return
    const l = this.letzter
    if (l && Math.hypot(x - l.x, z - l.z) < 0.2) return
    // Quer zur Fahrtrichtung; der erste Punkt nimmt die des zweiten.
    let dx = 0, dz = 1
    if (l) { dx = x - l.x; dz = z - l.z; const d = Math.hypot(dx, dz); dx /= d; dz /= d }
    if (this.n === 1) this.legen(0, l.x, l.z, dx, dz)
    this.legen(this.n, x, z, dx, dz)
    this.letzter = { x, z }
    this.n++
    this.geo.attributes.position.needsUpdate = true
    this.geo.setDrawRange(0, Math.max(0, this.n - 1) * 12)
  }

  legen(i, x, z, dx, dz) {
    const px = dz, pz = -dx
    let k = i * 12
    for (const mitte of [-0.19, 0.19]) {
      for (const rand of [-0.045, 0.045]) {
        const ax = x + px * (mitte + rand), az = z + pz * (mitte + rand)
        this.pos[k++] = ax
        this.pos[k++] = hoehe(ax, az) + 0.02
        this.pos[k++] = az
      }
    }
  }
}

// Die alte Spur als Kurve: der Fahrer faehrt sie beim Wiederkommen ab.
export function spurKurve() {
  const kurve = new THREE.CatmullRomCurve3(SPUR_PUNKTE.map(([u, v]) => {
    const p = welt(u, v)
    return new THREE.Vector3(p.x, 0, p.z)
  }))
  return kurve.getSpacedPoints(Math.ceil(kurve.getLength() / 0.25))
}

function maschenTextur() {
  // Dieselbe Rautenmasche wie am Fangnetz im Tal (world/props/fangnetz.js).
  const n = 128
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(242,194,27,0.16)'
  g.fillRect(0, 0, n, n)
  g.strokeStyle = '#f2c21b'
  g.lineWidth = 11
  g.lineCap = 'square'
  for (const o of [-n, 0, n]) {
    g.beginPath(); g.moveTo(o, 0); g.lineTo(o + n, n); g.stroke()
    g.beginPath(); g.moveTo(o + n, 0); g.lineTo(o, n); g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

// Das Netz. Im gerissenen Feld ist das obere Seil bis knapp ueber den
// Schnee heruntergedrueckt und die Flaeche bergab umgelegt – da ist einer
// drueber.
export function createNetz() {
  const group = new THREE.Group()
  const MASCHE = 0.32, ZEILEN = 8
  const pos = [], uv = [], index = []
  const seil = []
  const helmPlatz = new THREE.Vector3()
  for (let f = 0; f < PFOSTEN_V.length - 1; f++) {
    const va = PFOSTEN_V[f], vb = PFOSTEN_V[f + 1]
    const spalten = Math.ceil((vb - va) / 0.3)
    const basis = pos.length / 3
    for (let j = 0; j <= ZEILEN; j++) {
      for (let i = 0; i <= spalten; i++) {
        const s = i / spalten, r = j / ZEILEN
        const v = va + (vb - va) * s
        const beule = f === GERISSEN ? Math.sin(Math.PI * s) ** 0.7 : 0
        const durch = 0.08 * Math.sin(Math.PI * s)
        // Umgelegt: die Oberkante kippt bergab und sinkt.
        const kipp = beule * r * 1.25
        const p = welt(NETZ_U + kipp, v)
        const boden = hoehe(p.x, p.z)
        const oben = NETZ_H - durch - beule * (NETZ_H - 0.3)
        pos.push(p.x, boden + 0.12 + (oben - 0.12) * r, p.z)
        uv.push((v - va) / MASCHE, r * oben / MASCHE)
        if (j === ZEILEN) seil.push(new THREE.Vector3(p.x, boden + oben, p.z))
        if (f === GERISSEN && j === ZEILEN && i === Math.round(spalten * 0.78)) helmPlatz.set(p.x, boden + oben, p.z)
      }
    }
    for (let j = 0; j < ZEILEN; j++) {
      for (let i = 0; i < spalten; i++) {
        const a = basis + j * (spalten + 1) + i, b = a + spalten + 1
        index.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(index)
  geo.computeVertexNormals()
  const netz = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: maschenTextur(), transparent: true, depthWrite: false, side: THREE.DoubleSide,
    forceSinglePass: true, roughness: 0.85, emissive: new THREE.Color('#f2c21b'), emissiveIntensity: 0.18,
  }))
  netz.renderOrder = 2
  group.add(netz)

  const tau = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seil), seil.length, 0.022, 4),
    new THREE.MeshStandardMaterial({ color: 0xc9950c, roughness: 0.7 }),
  )
  tau.castShadow = true
  group.add(tau)

  const pfostenGeo = assemble([
    { geo: new THREE.CylinderGeometry(0.06, 0.075, NETZ_H + 0.45, 8), color: 0x4b545c, position: [0, (NETZ_H + 0.45) / 2 - 0.2, 0] },
    { geo: new THREE.CylinderGeometry(0.085, 0.085, 0.14, 8), color: 0xe0b014, position: [0, NETZ_H + 0.2, 0] },
    { geo: new THREE.ConeGeometry(0.32, 0.3, 9), color: 0xf2f6fb, position: [0, 0.02, 0] },
  ])
  const material = vertexColorMaterial({ roughness: 0.6 })
  PFOSTEN_V.forEach((v, i) => {
    const p = welt(NETZ_U, v)
    const m = new THREE.Mesh(pfostenGeo, material)
    m.position.set(p.x, hoehe(p.x, p.z), p.z)
    // Die beiden Pfosten am gerissenen Feld hat es zur Luecke hin gezogen.
    const zug = i === GERISSEN ? 1 : i === GERISSEN + 1 ? -1 : 0
    m.rotation.set(zug * 0.1, 0, -zug * 0.1)
    m.castShadow = true
    group.add(m)
  })
  // Der Helm haengt am heruntergedrueckten Seil des gerissenen Feldes. Oben
  // auf dem Pfosten stand er genau unter der Ueberschrift.
  return { group, helmPlatz }
}

// Das Loch mit aufgeworfenem Rand und den Brocken, die beim Einschlag
// herumgeflogen sind.
export function createLoch() {
  const rng = makeRng(404)
  const mitte = welt(LOCH.u, LOCH.v)
  const y0 = hoehe(mitte.x, mitte.z)
  const teile = []
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + rng.range(-0.2, 0.2)
    const r = rng.range(0.5, 0.62)
    const x = mitte.x + Math.cos(a) * r, z = mitte.z + Math.sin(a) * r
    const s = rng.range(0.22, 0.34)
    teile.push({ geo: new THREE.IcosahedronGeometry(s, 1), color: COLORS.snowLit, position: [x, hoehe(x, z) + s * 0.25, z], scale: [1, 0.55, 1] })
  }
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, Math.PI * 2)
    const r = rng.range(0.9, 2.4)
    const x = mitte.x + Math.cos(a) * r, z = mitte.z + Math.sin(a) * r
    const s = rng.range(0.06, 0.16)
    teile.push({ geo: new THREE.IcosahedronGeometry(s, 0), color: 0xf4f8fe, position: [x, hoehe(x, z) + s * 0.3, z], rotation: [rng(), rng(), rng()] })
  }
  const rand = new THREE.Mesh(assemble(teile), vertexColorMaterial({ roughness: 0.95, flatShading: false }))
  rand.castShadow = true
  rand.receiveShadow = true

  const loch = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshStandardMaterial({ color: 0x7f97c2, roughness: 1 }))
  loch.rotation.x = -Math.PI / 2
  loch.position.set(mitte.x, y0 + 0.04, mitte.z)
  loch.scale.set(1, 0.8, 1)

  const group = new THREE.Group()
  group.add(rand, loch)
  return group
}

// Wald links und rechts, eine Reihe hinter der Piste. Die Mitte bleibt
// frei: dort spielt das Bild.
export function createWald(scene) {
  const rng = makeRng(4040)
  const kurve = spurKurve()
  const frei = (u, v) => {
    const p = welt(u, v)
    if (Math.hypot(u - LOCH.u, v - LOCH.v) < 5) return false
    if (Math.abs(u - NETZ_U) < 1.2) return false
    return kurve.every((k) => Math.hypot(k.x - p.x, k.z - p.z) > 3)
  }
  const orte = []
  const zone = (n, u0, u1, v0, v1) => {
    const versuche = n * 6
    for (let i = 0; i < versuche && n > 0; i++) {
      const u = rng.range(u0, u1), v = rng.range(v0, v1)
      if (!frei(u, v) || orte.some((o) => Math.hypot(o.u - u, o.v - v) < 1.9)) continue
      orte.push({ u, v })
      n--
    }
  }
  zone(26, -14, 12, -22, -7.5)
  zone(24, -14, 12, 6.8, 22)
  zone(30, -46, -27, -30, 30)
  zone(6, -27, -14, -24, -9)
  zone(6, -27, -14, 9, 24)
  zone(4, 9, 16, -20, -9)
  const placements = orte.map(({ u, v }) => {
    const p = welt(u, v)
    return { x: p.x, z: p.z, variant: rng() < 0.12 ? 3 : rng.int(0, 2), rotation: rng.range(0, 6.3), scale: rng.range(0.75, 1.2), shade: rng() }
  })
  const flaeche = { scene, heightAt: hoehe, addCollider() {} }
  createForest(flaeche, placements)

  for (const [u, v, s, seed] of [[4.5, -6.2, 0.7, 7], [-10, 6.8, 1.1, 8], [8, 7.5, 0.55, 9]]) {
    const p = welt(u, v)
    const stein = createBoulder(seed, s)
    stein.position.set(p.x, hoehe(p.x, p.z) - s * 0.25, p.z)
    scene.add(stein)
  }
}
