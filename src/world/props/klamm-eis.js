import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight, KLAMM, klammAt, bachVersatz } from '../heightfield.js'

// Ein zugefrorener Bach in der Sohle der Klamm.
//
// Er ist die Tiefe, die man sonst nicht sieht: viereinhalb Meter Rinne in
// einem Hang aus Schnee haben aus der festen Kamera keine Kante, und seit an
// Steg und Schanze kein Fels mehr liegen darf (er stuende in Spur und
// Flugbahn), fehlte ihr dort auch die. Ein blaugruenes Band unten in der
// Rinne sagt sofort: da unten ist Grund, und er ist weit weg.
//
// Das erste Band lag fuenf Zentimeter ueber dem Grund und folgte ihm – eine
// Farbe auf dem Schnee, die aussah wie aufgemalt. Jetzt liegt im Grund ein
// Bachbett (KLAMM.bach in heightfield.js), und das Eis ist darin eine ebene
// Flaeche, quer waagerecht wie gefrorenes Wasser. Wo sie die Boeschung des
// Bettes schneidet, ist das Ufer: unregelmaessig, weil es aus dem Gelaende
// kommt und nicht aus einer Breite. Dazu ein paar Steine am Ufer.
//
// Er laeuft unter der Bruecke durch: seit 04.10. traegt sie selbst (stegDeck
// in heightfield.js), und die Klamm ist darunter offen. Davor stand dort ein
// Damm, an dem der Bach aufhoerte.
//
// Gegen das Aufgemalte hilft am meisten, was Schatten wirft: das Bett ist
// 45 Zentimeter tief mit steiler Boeschung (KLAMM.bach), und an beiden
// Ufern liegt eine Schneelippe, die ein Stueck ueber das Eis haengt. Ihr
// Schatten auf dem Eis ist aus 33 Metern die Kante, an der man sieht, dass
// der Bach tiefer liegt als der Schnee.

const EIS = new THREE.Color(0x9fd8e4)
const EIS_TIEF = new THREE.Color(0x6fb3c9)
const RISS = new THREE.Color(0xd9f1f6)
const STEIN = 0x7d838c
const STEIN_HELL = 0x9aa0a8
const SCHNEE = 0xf7fbff

// Wie hoch das Eis ueber der tiefsten Stelle des Bettes steht. Es schwankt
// laengs ein wenig – dadurch wird der Bach mal breiter, mal schmaler.
const pegel = (s) => 0.1 + 0.04 * Math.sin(s * 0.73) + 0.02 * Math.sin(s * 1.9 + 0.4)

export function createKlammEis(world, { schritt = 0.5 } = {}) {
  const ax = KLAMM.bis.x - KLAMM.von.x
  const az = KLAMM.bis.z - KLAMM.von.z
  const la = Math.hypot(ax, az)
  const ux = ax / la
  const uz = az / la
  const nx = -uz
  const nz = ux
  const halb = KLAMM.bach.breite

  const pos = []
  const col = []
  const idx = []
  const quer = 7
  let reihe = 0
  let offen = false
  for (let s = 0; s <= la; s += schritt) {
    const v = bachVersatz(s)
    const mx = KLAMM.von.x + ux * s + nx * v
    const mz = KLAMM.von.z + uz * s + nz * v
    // Nur, wo die Rinne wirklich tief ist.
    const tief = -klammAt(mx, mz)
    if (tief < 1.2) { offen = false; continue }
    const y = terrainHeight(mx, mz) + pegel(s)
    for (let i = 0; i < quer; i++) {
      const o = (i / (quer - 1) - 0.5) * 2 * halb
      pos.push(mx + nx * o, y, mz + nz * o)
      // Laengs dunkler und heller in Schlieren, dazu feine helle Risse quer
      // ueber das Eis – nur hier und da, nicht ueberall.
      const c = EIS.clone().lerp(EIS_TIEF, 0.5 + 0.5 * Math.sin(s * 0.9 + o * 1.7))
      if (Math.sin(s * 2.3 + o * 0.8) > 0.93 && Math.abs(o) < halb * 0.6) c.lerp(RISS, 0.6)
      col.push(c.r, c.g, c.b)
    }
    if (offen) {
      const a = (reihe - 1) * quer
      const b = reihe * quer
      for (let i = 0; i < quer - 1; i++) idx.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1)
    }
    offen = true
    reihe++
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  // Die Dreiecke laufen je nach Richtung der Klamm andersherum; einseitig
  // gezeichnet waere das halbe Band unsichtbar. Undurchsichtig, also ohne
  // die Kosten, die DoubleSide bei transparenten Materialien hat.
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.2, metalness: 0.05, side: THREE.DoubleSide,
  }))
  mesh.receiveShadow = true
  world.scene.add(mesh)

  // Die Schneelippen an beiden Ufern: ein flacher Wulst auf der Oberkante
  // der Boeschung, zehn Zentimeter ueber sie hinaus zum Eis hin. Je Ufer ein
  // Rohr, solange die Rinne tief ist.
  // Gebaut als halber flacher Wulst (oben rund, unten offen im Schnee),
  // Querschnitt 32 auf 9 Zentimeter.
  const lp = [], li = []
  const RING = 7
  for (const seite of [-1, 1]) {
    let reihe = 0
    for (let s = 0; s <= la; s += 0.5) {
      const o = bachVersatz(s) + seite * (KLAMM.bach.breite - 0.62 + 0.08 * Math.sin(s * 1.3 + seite))
      const x = KLAMM.von.x + ux * s + nx * o
      const z = KLAMM.von.z + uz * s + nz * o
      if (-klammAt(x, z) < 1.5) { reihe = 0; continue }
      // Auf die Hoehe der Oberkante, nicht des Punktes: der liegt schon in
      // der Boeschung.
      const y = terrainHeight(x + nx * seite * 0.5, z + nz * seite * 0.5) - 0.03
      const basis = lp.length / 3
      for (let j = 0; j < RING; j++) {
        const a = Math.PI * j / (RING - 1)
        const q = Math.cos(a) * 0.32
        lp.push(x + nx * q, y + Math.sin(a) * 0.09, z + nz * q)
      }
      if (reihe > 0) {
        const vor = basis - RING
        for (let j = 0; j < RING - 1; j++) li.push(vor + j, basis + j, vor + j + 1, vor + j + 1, basis + j, basis + j + 1)
      }
      reihe++
    }
  }
  if (li.length) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3))
    geo.setIndex(li)
    geo.computeVertexNormals()
    const lippe = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SCHNEE, roughness: 0.95, side: THREE.DoubleSide }))
    lippe.castShadow = true
    lippe.receiveShadow = true
    world.scene.add(lippe)
  }

  // Steine am Ufer, abwechselnd links und rechts, mit Schneekappe. Nur, wo
  // die Rinne schon tief ist.
  const steine = []
  let k = 0
  for (let s = 6; s < la - 6; s += 3.2 + ((k * 7) % 5) * 0.6) {
    k++
    const seite = k % 2 ? 1 : -1
    const o = bachVersatz(s) + seite * (halb * 0.85 + ((k * 3) % 4) * 0.12)
    const x = KLAMM.von.x + ux * s + nx * o
    const z = KLAMM.von.z + uz * s + nz * o
    if (-klammAt(x, z) < 1.5) continue
    const r = 0.22 + ((k * 5) % 6) * 0.06
    const y = terrainHeight(x, z)
    const fels = new THREE.IcosahedronGeometry(r, 0)
    fels.scale(1.2, 0.7, 1)
    steine.push({ geo: fels, color: k % 3 ? STEIN : STEIN_HELL, position: [x, y + r * 0.25, z], rotation: [0, k * 1.7, 0] })
    const kappe = new THREE.SphereGeometry(r * 0.8, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2)
    kappe.scale(1.2, 0.35, 1)
    steine.push({ geo: kappe, color: SCHNEE, position: [x, y + r * 0.6, z], rotation: [0, k * 1.7, 0] })
    // Ein kleinerer daneben, bei jedem dritten.
    if (k % 3 === 0) {
      const r2 = r * 0.55
      const x2 = x + ux * (r + r2) * 1.1
      const z2 = z + uz * (r + r2) * 1.1
      const klein = new THREE.IcosahedronGeometry(r2, 0)
      klein.scale(1.1, 0.75, 1)
      steine.push({ geo: klein, color: STEIN_HELL, position: [x2, terrainHeight(x2, z2) + r2 * 0.2, z2], rotation: [0, k, 0] })
    }
  }
  if (steine.length) {
    const fels = new THREE.Mesh(assemble(steine), vertexColorMaterial({ roughness: 0.9 }))
    fels.castShadow = true
    fels.receiveShadow = true
    world.scene.add(fels)
  }
  return mesh
}
