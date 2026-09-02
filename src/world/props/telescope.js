import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Muenzfernrohr am Aussichtspunkt. Der Tubus schwenkt langsam, als haette ihn
// gerade jemand stehen lassen.

const PAINT = 0x3f7fa8
const PAINT_DARK = 0x2c5c7c
const BRASS = 0xc9a24a
const DARK = 0x21272e

export function createTelescope() {
  const group = new THREE.Group()

  // --- Stativ (fest) ------------------------------------------------------
  const standParts = []
  standParts.push({ geo: new THREE.CylinderGeometry(0.34, 0.42, 0.22, 10), color: 0x8e969f, position: [0, 0.11, 0] })
  standParts.push({ geo: new THREE.CylinderGeometry(0.1, 0.14, 1.1, 8), color: PAINT_DARK, position: [0, 0.7, 0] })
  standParts.push({ geo: new THREE.SphereGeometry(0.16, 10, 8), color: PAINT_DARK, position: [0, 1.26, 0] })
  // Muenzeinwurf am Mast
  standParts.push({ geo: new THREE.BoxGeometry(0.18, 0.26, 0.12), color: BRASS, position: [0, 0.92, 0.16] })
  standParts.push({ geo: new THREE.BoxGeometry(0.09, 0.02, 0.03), color: DARK, position: [0, 0.99, 0.23] })

  const stand = new THREE.Mesh(assemble(standParts), vertexColorMaterial({ roughness: 0.5, metalness: 0.35 }))
  stand.castShadow = true
  stand.receiveShadow = true
  group.add(stand)

  // --- Tubus (schwenkt) ---------------------------------------------------
  const headParts = []
  headParts.push({
    geo: new THREE.CylinderGeometry(0.15, 0.17, 0.92, 12),
    color: PAINT,
    position: [0, 0, 0],
    rotation: [Math.PI / 2, 0, 0],
  })
  // Objektiv vorne
  headParts.push({
    geo: new THREE.CylinderGeometry(0.19, 0.17, 0.12, 12),
    color: BRASS,
    position: [0, 0, 0.48],
    rotation: [Math.PI / 2, 0, 0],
  })
  // Okular hinten
  headParts.push({
    geo: new THREE.CylinderGeometry(0.075, 0.1, 0.18, 10),
    color: DARK,
    position: [0, 0, -0.52],
    rotation: [Math.PI / 2, 0, 0],
  })
  // Griffe seitlich
  for (const sx of [-1, 1]) {
    headParts.push({
      geo: new THREE.CylinderGeometry(0.035, 0.035, 0.26, 6),
      color: DARK,
      position: [sx * 0.22, -0.05, -0.2],
      rotation: [0, 0, Math.PI / 2],
    })
  }

  const head = new THREE.Mesh(assemble(headParts), vertexColorMaterial({ roughness: 0.45, metalness: 0.3 }))
  head.castShadow = true
  head.position.y = 1.26
  group.add(head)

  // Linse
  const lens = new THREE.Mesh(
    new THREE.CircleGeometry(0.155, 14),
    new THREE.MeshStandardMaterial({ color: 0x0f2733, roughness: 0.08, metalness: 0.7 }),
  )
  lens.position.set(0, 0, 0.545)
  head.add(lens)

  group.userData.animate = (t) => {
    head.rotation.y = Math.sin(t * 0.22) * 0.5
    head.rotation.x = -0.12 + Math.sin(t * 0.17 + 1) * 0.07
  }

  return group
}
