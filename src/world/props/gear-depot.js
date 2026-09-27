import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Die Packlisten-App als Materialdepot: eine offene Holzkiste mit ausgebreiteter
// Ausruestung, ein Rucksack daneben, angelehnte Ski. Eine aufgeklappte Liste
// haengt am Deckel.

const WOOD = 0x7b5236
const WOOD_DARK = 0x543a26
const CANVAS = 0x4a6b52
const METAL = 0x8d949e
const ORANGE = 0xe4613a

export function createGearDepot() {
  const group = new THREE.Group()
  const parts = []

  const W = 1.6
  const D = 0.95
  const H = 0.62

  // --- Kiste ---------------------------------------------------------------
  // Boden und vier Waende, damit sie von oben wirklich offen aussieht.
  parts.push({ geo: new THREE.BoxGeometry(W, 0.08, D), color: WOOD_DARK, position: [0, 0.04, 0] })
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.08, H, D), color: WOOD, position: [sx * (W / 2 - 0.04), H / 2, 0] })
  }
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(W, H, 0.08), color: WOOD, position: [0, H / 2, sz * (D / 2 - 0.04)] })
  }
  // Eisenbeschlaege an den Ecken
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new THREE.BoxGeometry(0.1, H + 0.04, 0.1),
        color: METAL,
        position: [sx * (W / 2 - 0.05), H / 2, sz * (D / 2 - 0.05)],
      })
    }
  }

  // --- Inhalt --------------------------------------------------------------
  // Gerollte Isomatte
  parts.push({
    geo: new THREE.CylinderGeometry(0.14, 0.14, 0.62, 10),
    color: ORANGE,
    position: [-0.38, H - 0.1, 0.12],
    rotation: [0, 0.2, Math.PI / 2],
  })
  // Zwei gefaltete Kleidungsstapel
  for (const [i, c] of [CANVAS, 0x3f5a72].entries()) {
    parts.push({
      geo: new THREE.BoxGeometry(0.42, 0.14, 0.32),
      color: c,
      position: [0.24, 0.12 + i * 0.15, -0.14 + i * 0.05],
      rotation: [0, i * 0.14, 0],
    })
  }
  // Thermoskanne
  parts.push({
    geo: new THREE.CylinderGeometry(0.075, 0.075, 0.32, 9),
    color: METAL,
    position: [0.5, H - 0.16, 0.24],
    rotation: [0.1, 0, 0.3],
  })

  // --- Rucksack daneben ----------------------------------------------------
  parts.push({
    geo: new THREE.BoxGeometry(0.42, 0.6, 0.28),
    color: CANVAS,
    position: [W / 2 + 0.42, 0.3, -0.16],
    rotation: [0.12, -0.5, 0.08],
  })
  parts.push({
    geo: new THREE.BoxGeometry(0.36, 0.16, 0.1),
    color: 0x3a5541,
    position: [W / 2 + 0.5, 0.5, 0.0],
    rotation: [0.12, -0.5, 0.08],
  })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Aufgeklappter Deckel mit Liste --------------------------------------
  const tex = labelTexture('PACKLISTE', {
    width: 512, height: 340,
    background: '#f4efe3', color: '#3b4a58',
    sub: 'abhaken', subColor: '#8a9099',
    font: '700 74px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.07, D),
    [
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
    ],
  )
  // Nach hinten aufgeklappt und der Kamera zugeneigt, damit die Liste lesbar ist.
  lid.position.set(0, H + D * 0.42, -D / 2 - D * 0.2)
  lid.rotation.x = -1.15
  lid.castShadow = true
  group.add(lid)

  // --- Angelehnte Ski ------------------------------------------------------
  for (const [i, off] of [-0.1, 0.1].entries()) {
    const ski = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.11, 1.7, 0.035), color: i ? 0xf5c542 : 0xe8703a },
        { geo: new THREE.BoxGeometry(0.13, 0.06, 0.05), color: 0x2b3240, position: [0, 0.1, 0.01] },
      ]),
      vertexColorMaterial({ roughness: 0.4 }),
    )
    ski.position.set(-W / 2 - 0.3 + off * 0.6, 0.78, 0.12 + off)
    ski.rotation.set(0.26, 0.3 + i * 0.1, -0.3 - i * 0.06)
    ski.castShadow = true
    group.add(ski)
  }

  group.userData.footprint = { width: W + 1.2, depth: D + 1.2 }
  return group
}
