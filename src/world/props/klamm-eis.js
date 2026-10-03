import * as THREE from 'three'
import { terrainHeight, KLAMM, BRUECKE, klammAt } from '../heightfield.js'

// Ein zugefrorener Bach in der Sohle der Klamm.
//
// Er ist die Tiefe, die man sonst nicht sieht: viereinhalb Meter Rinne in
// einem Hang aus Schnee haben aus der festen Kamera keine Kante, und seit an
// Steg und Schanze kein Fels mehr liegen darf (er stuende in Spur und
// Flugbahn), fehlte ihr dort auch die. Ein blaugruenes Band unten in der
// Rinne sagt sofort: da unten ist Grund, und er ist weit weg.
//
// Unter der Bruecke liegt er nicht – dort traegt ein Damm aus Gelaende das
// Deck (BRUECKE in heightfield.js), und Eis auf einem Damm waere eine Pfuetze
// auf der Fahrbahn.

const EIS = new THREE.Color(0x9fd8e4)
const EIS_TIEF = new THREE.Color(0x6fb3c9)

export function createKlammEis(world, { breite = 2.6, schritt = 0.5 } = {}) {
  const ax = KLAMM.bis.x - KLAMM.von.x
  const az = KLAMM.bis.z - KLAMM.von.z
  const la = Math.hypot(ax, az)
  const ux = ax / la
  const uz = az / la
  const nx = -uz
  const nz = ux
  const brueckeBei = (BRUECKE.x - KLAMM.von.x) * ux + (BRUECKE.z - KLAMM.von.z) * uz
  const frei = BRUECKE.halb + BRUECKE.saum + 0.4

  const pos = []
  const col = []
  const idx = []
  const quer = 5
  let reihe = 0
  let offen = false
  for (let s = 0; s <= la; s += schritt) {
    const mx = KLAMM.von.x + ux * s
    const mz = KLAMM.von.z + uz * s
    // Nur, wo die Rinne wirklich tief ist und nicht unter dem Damm.
    const tief = -klammAt(mx, mz)
    if (tief < 1.2 || Math.abs(s - brueckeBei) < frei) { offen = false; continue }
    for (let i = 0; i < quer; i++) {
      const o = (i / (quer - 1) - 0.5) * breite
      const x = mx + nx * o
      const z = mz + nz * o
      pos.push(x, terrainHeight(x, z) + 0.05, z)
      const c = EIS.clone().lerp(EIS_TIEF, 0.5 + 0.5 * Math.sin(s * 0.9 + o * 1.7))
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
    vertexColors: true, roughness: 0.25, metalness: 0.05, side: THREE.DoubleSide,
  }))
  mesh.receiveShadow = true
  world.scene.add(mesh)
  return mesh
}
