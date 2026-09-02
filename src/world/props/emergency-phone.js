import * as THREE from 'three'
import { assemble, vertexColorMaterial, transformed, tint } from '../../core/geometry.js'

// Gelbes Notfalltelefon, wie es an Pisten und Passstrassen steht: Saeule mit
// Kastenkopf, schwarzem Hoerer an der Spirale, Blinklicht und Schneekappe.

const YELLOW = 0xf2c33d
const YELLOW_DARK = 0xd39f24
const DARK = 0x24282e
const STEEL = 0x8d949e
const SNOW = 0xf7fbff
const RED = 0xd94b3f

export function createEmergencyPhone() {
  const parts = []

  // Betonsockel, halb eingeschneit.
  parts.push({ geo: new THREE.CylinderGeometry(0.42, 0.5, 0.3, 8), color: 0x9aa0a8, position: [0, 0.15, 0] })

  // Mast
  parts.push({ geo: new THREE.CylinderGeometry(0.09, 0.11, 1.5, 8), color: STEEL, position: [0, 1.0, 0] })

  // Kasten mit dem Telefon – leicht nach vorne geneigt, damit man hineinschaut.
  const boxY = 1.95
  parts.push({ geo: new THREE.BoxGeometry(0.62, 0.78, 0.4), color: YELLOW, position: [0, boxY, 0] })
  // Dachschraege gegen Schnee
  parts.push({
    geo: new THREE.BoxGeometry(0.7, 0.1, 0.5),
    color: YELLOW_DARK,
    position: [0, boxY + 0.42, 0.02],
    rotation: [-0.18, 0, 0],
  })
  parts.push({
    geo: new THREE.BoxGeometry(0.7, 0.05, 0.5),
    color: SNOW,
    position: [0, boxY + 0.48, 0.02],
    rotation: [-0.18, 0, 0],
  })

  // Vertiefte Nische mit dem Hoerer.
  parts.push({ geo: new THREE.BoxGeometry(0.44, 0.5, 0.1), color: DARK, position: [0, boxY + 0.02, 0.2] })

  // Hoerer: Griff plus zwei Muscheln.
  parts.push({
    geo: new THREE.BoxGeometry(0.09, 0.34, 0.09),
    color: DARK,
    position: [-0.02, boxY + 0.02, 0.29],
  })
  for (const dy of [0.2, -0.2]) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.075, 0.085, 0.11, 8),
      color: DARK,
      position: [-0.02, boxY + 0.02 + dy, 0.31],
      rotation: [Math.PI / 2, 0, 0],
    })
  }
  // Spiralkabel
  const curve = new THREE.CatmullRomCurve3(
    Array.from({ length: 26 }, (_, i) => {
      const t = i / 25
      return new THREE.Vector3(
        -0.02 + Math.sin(t * Math.PI * 7) * 0.045,
        boxY - 0.2 - t * 0.34,
        0.29 + Math.cos(t * Math.PI * 7) * 0.045 - t * 0.06,
      )
    }),
  )
  parts.push({ geo: new THREE.TubeGeometry(curve, 30, 0.016, 5, false), color: DARK })

  // Tastenfeld
  parts.push({ geo: new THREE.BoxGeometry(0.2, 0.16, 0.05), color: 0x3a4048, position: [0.19, boxY - 0.02, 0.21] })

  // Blinklicht obendrauf
  parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.075, 0.06, 8), color: STEEL, position: [0, boxY + 0.52, -0.06] })
  parts.push({
    geo: new THREE.SphereGeometry(0.075, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    color: RED,
    position: [0, boxY + 0.55, -0.06],
  })

  // Kreuz-Emblem auf der Seite: als Notruf erkennbar auch ohne Text.
  parts.push({ geo: new THREE.BoxGeometry(0.26, 0.08, 0.02), color: DARK, position: [0, boxY + 0.02, -0.21] })
  parts.push({ geo: new THREE.BoxGeometry(0.08, 0.26, 0.02), color: DARK, position: [0, boxY + 0.02, -0.21] })

  const group = new THREE.Group()
  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.62 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Das Blinklicht bekommt ein eigenes, leuchtendes Material.
  const lampGeo = tint(
    transformed(new THREE.SphereGeometry(0.062, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), {
      position: [0, boxY + 0.555, -0.06],
    }),
    0xffffff,
  )
  const lampMat = new THREE.MeshStandardMaterial({
    color: RED,
    emissive: new THREE.Color(RED),
    emissiveIntensity: 1.2,
    roughness: 0.35,
    flatShading: true,
  })
  const lamp = new THREE.Mesh(lampGeo, lampMat)
  group.add(lamp)

  // Schneewehe am Sockel, damit es nicht aufgesetzt wirkt.
  const drift = new THREE.Mesh(
    (() => {
      const g = new THREE.SphereGeometry(0.72, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)
      g.scale(1, 0.3, 0.85)
      return tint(g, SNOW)
    })(),
    vertexColorMaterial({ roughness: 0.95 }),
  )
  drift.position.y = 0.02
  drift.receiveShadow = true
  group.add(drift)

  group.userData.animate = (t) => {
    // Langsames Pulsieren, wie ein echtes Notruf-Blinklicht im Standby.
    const pulse = 0.5 + 0.5 * Math.pow(Math.max(0, Math.sin(t * 1.6)), 6)
    lampMat.emissiveIntensity = 0.35 + pulse * 2.6
  }

  return group
}
