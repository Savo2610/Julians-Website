import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Kleines Feuerwehrauto, das im Tal steht: Kabine, Geraeteaufbau mit Rollos,
// Drehleiter auf dem Dach, Blaulichter. Bewusst spielzeughaft proportioniert –
// kurz, hoch und rund, nicht wie ein echtes Fahrzeug.

const RED = 0xc8352c
const RED_DARK = 0x9c261f
const WHITE = 0xeef1f4
const GLASS = 0x9fc4d8
const TIRE = 0x22262b
const CHROME = 0xb8c0c8
const SILVER = 0x9aa3ac

export function createFireTruck() {
  const group = new THREE.Group()
  const parts = []

  const L = 3.4   // Laenge (entlang Z)
  const W = 1.5   // Breite

  // --- Chassis ------------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W, 0.24, L), color: RED_DARK, position: [0, 0.52, 0] })

  // --- Kabine vorne -------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W, 0.92, 1.15), color: RED, position: [0, 1.1, L / 2 - 0.6] })
  // Abgerundete Front
  parts.push({
    geo: new THREE.CylinderGeometry(0.2, 0.2, W, 8, 1, false, 0, Math.PI),
    color: RED,
    position: [0, 1.42, L / 2 - 0.03],
    rotation: [0, 0, Math.PI / 2],
  })
  // Kuehlergrill und Stossstange
  parts.push({ geo: new THREE.BoxGeometry(W * 0.86, 0.26, 0.08), color: CHROME, position: [0, 0.98, L / 2 + 0.02] })
  parts.push({ geo: new THREE.BoxGeometry(W + 0.08, 0.16, 0.14), color: SILVER, position: [0, 0.68, L / 2 + 0.02] })

  // --- Geraeteaufbau hinten ------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W, 1.0, 1.85), color: RED, position: [0, 1.14, -0.62] })
  // Rollladen an den Seiten
  for (const sx of [-1, 1]) {
    for (const dz of [-0.32, 0.42]) {
      parts.push({
        geo: new THREE.BoxGeometry(0.04, 0.66, 0.66),
        color: SILVER,
        position: [sx * (W / 2 + 0.01), 1.12, -0.62 + dz],
      })
      // Griffleiste
      parts.push({
        geo: new THREE.BoxGeometry(0.05, 0.05, 0.5),
        color: CHROME,
        position: [sx * (W / 2 + 0.03), 0.86, -0.62 + dz],
      })
    }
  }
  // Weisser Zierstreifen ueber die ganze Laenge
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.03, 0.14, L - 0.5),
      color: WHITE,
      position: [sx * (W / 2 + 0.005), 1.52, -0.1],
    })
  }

  // --- Drehleiter auf dem Dach --------------------------------------------
  const ladderY = 1.7
  parts.push({ geo: new THREE.CylinderGeometry(0.22, 0.26, 0.16, 10), color: SILVER, position: [0, ladderY - 0.04, -0.62] })
  // Zwei Holme
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.06, 0.08, 2.5),
      color: SILVER,
      position: [sx * 0.24, ladderY + 0.22, -0.2],
      rotation: [-0.1, 0, 0],
    })
  }
  // Sprossen
  for (let i = 0; i < 9; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(0.5, 0.04, 0.05),
      color: CHROME,
      position: [0, ladderY + 0.22 + (i - 4) * 0.028, -0.2 + (i - 4) * 0.27],
      rotation: [-0.1, 0, 0],
    })
  }

  // --- Raeder --------------------------------------------------------------
  for (const sx of [-1, 1]) {
    for (const pz of [L / 2 - 0.75, -0.75]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12),
        color: TIRE,
        position: [sx * (W / 2 - 0.05), 0.36, pz],
        rotation: [0, 0, Math.PI / 2],
      })
      parts.push({
        geo: new THREE.CylinderGeometry(0.17, 0.17, 0.28, 8),
        color: SILVER,
        position: [sx * (W / 2 - 0.05), 0.36, pz],
        rotation: [0, 0, Math.PI / 2],
      })
    }
  }

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.5, metalness: 0.15 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Scheiben ------------------------------------------------------------
  const glassMat = new THREE.MeshStandardMaterial({
    color: GLASS, roughness: 0.12, metalness: 0.35, flatShading: true,
  })
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(W * 0.84, 0.5, 0.06), glassMat)
  windshield.position.set(0, 1.36, L / 2 - 0.06)
  windshield.rotation.x = -0.16
  group.add(windshield)
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.6), glassMat)
    side.position.set(sx * (W / 2 - 0.01), 1.32, L / 2 - 0.7)
    group.add(side)
  }

  // --- Blaulichter ---------------------------------------------------------
  const beacons = []
  for (const sx of [-0.42, 0.42]) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x3f7de8,
      emissive: new THREE.Color(0x3f7de8),
      emissiveIntensity: 0.8,
      roughness: 0.25,
      flatShading: true,
    })
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.13, 8), mat)
    beacon.position.set(sx, 1.66, L / 2 - 0.62)
    group.add(beacon)
    beacons.push(mat)
  }

  // Schnee auf Dach und Leiter – das Fahrzeug steht schon eine Weile.
  const snowMat = new THREE.MeshStandardMaterial({ color: 0xf7fbff, roughness: 0.95, flatShading: true })
  const roofSnow = new THREE.Mesh(new THREE.BoxGeometry(W * 0.94, 0.09, 1.7), snowMat)
  roofSnow.position.set(0, 1.68, -0.62)
  group.add(roofSnow)

  group.userData.animate = (t) => {
    // Wechselblinker, aber sehr gemaechlich – niemand hat es eilig.
    const phase = Math.sin(t * 3.4)
    beacons[0].emissiveIntensity = phase > 0 ? 2.8 : 0.25
    beacons[1].emissiveIntensity = phase > 0 ? 0.25 : 2.8
  }

  group.userData.footprint = { width: W + 0.5, depth: L + 0.4 }
  return group
}
