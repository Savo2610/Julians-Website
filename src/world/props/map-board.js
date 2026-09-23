import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust } from '../../core/geometry.js'

// Das Kartenpult am Startplatz.
//
// Die alte Tafel war ein Brett mit Papier darauf und sah aus wie
// hingestellt. Dieses steht im Winter: auf dem Rahmen liegt eine dicke
// Schneehaube, an der Unterkante haengen Eiszapfen, an den Pfosten hat der
// Wind Schnee angeweht. Die Karte selbst ist das Relief aus valley-map.js.
//
// Neigung 0,9 rad: die Kamera schaut aus 36 Grad, eine Flaeche mit 0,63
// stuende ihr genau gegenueber. Ein Pult so steil sieht aber aus wie eine
// Wand; 0,9 ist der Kompromiss – die Karte ist aus 33 m lesbar und das Pult
// liegt noch wie ein Pult.

const WOOD = 0x6b4a35
const WOOD_DARK = 0x4a3326
const SNOW = 0xf7fbff
const SNOW_SHADE = 0xe2ecf6
const ICE = 0xd8ecfb

export function createMapBoard(texture, { fuss = [0, 0] } = {}) {
  const group = new THREE.Group()
  group.name = 'talplan'

  const W = 4.4
  const H = 3.3
  const tilt = -0.9
  const cy = 1.5
  const postX = W / 2 - 0.35

  // Pfosten reichen bis zu ihrem eigenen Bodenpunkt (fuss), sonst steht das
  // Pult auf dem gewoelbten Plateau mit einem Bein in der Luft.
  const parts = []
  fuss.forEach((floor, i) => {
    const x = i === 0 ? -postX : postX
    const top = cy + 0.35
    const len = top - floor
    parts.push({ geo: new THREE.CylinderGeometry(0.12, 0.14, len, 8), color: WOOD, position: [x, floor + len / 2, -0.15] })
    // Schneewehe am Fuss: flach, auf der Windseite (hinten) hoeher.
    parts.push({ geo: new THREE.SphereGeometry(0.55, 10, 6), color: SNOW_SHADE, position: [x, floor + 0.02, -0.3], scale: [1.2, 0.38, 1] })
    parts.push({ geo: new THREE.SphereGeometry(0.38, 10, 6), color: SNOW, position: [x + 0.1, floor + 0.04, 0.1], scale: [1, 0.3, 1] })
  })
  const posts = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85 }))
  posts.castShadow = true
  posts.receiveShadow = true
  group.add(posts)

  // Die Platte mit Rahmen, geneigt.
  const panel = new THREE.Group()
  panel.position.set(0, cy, 0)
  panel.rotation.x = tilt
  const frame = []
  frame.push({ geo: new THREE.BoxGeometry(W, H, 0.1), color: WOOD_DARK, position: [0, 0, -0.05] })
  for (const sy of [-1, 1]) {
    frame.push({ geo: new THREE.BoxGeometry(W + 0.24, 0.16, 0.16), color: WOOD, position: [0, sy * (H / 2 + 0.04), 0.02] })
  }
  for (const sx of [-1, 1]) {
    frame.push({ geo: new THREE.BoxGeometry(0.16, H + 0.24, 0.16), color: WOOD, position: [sx * (W / 2 + 0.04), 0, 0.02] })
  }
  // Schneehaube auf der Oberkante: im Pult gedreht zurueck in die
  // Waagerechte, damit sie liegt statt klebt.
  frame.push({ geo: new THREE.CylinderGeometry(0.2, 0.24, W + 0.4, 10), color: SNOW, position: [0, H / 2 + 0.16, 0.02], rotation: [0, 0, Math.PI / 2], scale: [1, 1, 0.7] })
  for (const sx of [-1, 1]) {
    frame.push({ geo: new THREE.SphereGeometry(0.26, 10, 6), color: SNOW, position: [sx * (W / 2 + 0.12), H / 2 + 0.1, 0.02], scale: [1, 0.7, 0.8] })
  }
  // Eiszapfen an der Unterkante, unregelmaessig, damit es kein Kamm wird.
  const lens = [0.2, 0.32, 0.14, 0.26, 0.38, 0.18, 0.3, 0.12, 0.24, 0.34, 0.16]
  lens.forEach((len, i) => {
    frame.push({
      geo: new THREE.ConeGeometry(0.035, len, 5),
      color: ICE,
      position: [-W / 2 + 0.2 + i * ((W - 0.4) / (lens.length - 1)), -H / 2 - 0.1 - len * 0.4, 0.1],
      rotation: [Math.PI + tilt, 0, 0],
    })
  })
  const frameMesh = new THREE.Mesh(assemble(frame), vertexColorMaterial({ roughness: 0.8 }))
  snowDust(frameMesh.geometry, 0.4, 0.75)
  frameMesh.castShadow = true
  frameMesh.receiveShadow = true
  panel.add(frameMesh)

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.06, H - 0.06),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }),
  )
  face.position.z = 0.012
  face.receiveShadow = true
  panel.add(face)
  group.add(panel)

  group.userData.footprint = { width: W + 0.6, depth: 2.4 }
  return group
}
