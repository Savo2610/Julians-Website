import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Gipfelkreuz aus verwittertem Holz mit Eisenbeschlaegen und einem kleinen
// Schild. Es macht aus der Kuppe einen Ort, den man ansteuern will.

const WOOD = 0x6b4a30
const WOOD_LIGHT = 0x8a6242
const IRON = 0x4d545c
const SNOW = 0xf7fbff

export function createSummitCross({ label = null } = {}) {
  const group = new THREE.Group()
  const parts = []

  const H = 3.6
  const beam = 0.24

  // Steinsockel, in den das Kreuz gesetzt ist.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const r = 0.62 + (i % 3) * 0.12
    parts.push({
      geo: new THREE.BoxGeometry(0.42 + (i % 2) * 0.16, 0.3 + (i % 3) * 0.1, 0.38),
      color: i % 2 ? 0x6a6f76 : 0x777d85,
      position: [Math.cos(a) * r, 0.12 + (i % 2) * 0.1, Math.sin(a) * r],
      rotation: [0, -a + 0.3, (i % 5 - 2) * 0.05],
    })
  }

  // Senkrechter Balken
  parts.push({ geo: new THREE.BoxGeometry(beam, H, beam), color: WOOD, position: [0, H / 2 + 0.2, 0] })
  // Querbalken
  parts.push({ geo: new THREE.BoxGeometry(1.75, beam, beam * 0.92), color: WOOD_LIGHT, position: [0, H * 0.74, 0] })

  // Eisenbeschlaege an der Kreuzung
  parts.push({ geo: new THREE.BoxGeometry(beam * 1.5, 0.1, beam * 1.5), color: IRON, position: [0, H * 0.74 + 0.2, 0] })
  parts.push({ geo: new THREE.BoxGeometry(beam * 1.5, 0.1, beam * 1.5), color: IRON, position: [0, H * 0.74 - 0.2, 0] })
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.08, beam * 1.4, beam * 1.3), color: IRON, position: [sx * 0.78, H * 0.74, 0] })
  }
  // Strebe gegen den Wind
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.5, 0.09, 0.09),
      color: WOOD,
      position: [sx * 0.19, H * 0.63, 0],
      rotation: [0, 0, sx * 0.78],
    })
  }

  // Schneeauflage auf dem Querbalken und der Spitze
  parts.push({ geo: new THREE.BoxGeometry(1.78, 0.08, beam * 0.95), color: SNOW, position: [0, H * 0.74 + beam * 0.58, 0] })
  parts.push({ geo: new THREE.BoxGeometry(beam * 1.05, 0.08, beam * 1.05), color: SNOW, position: [0, H + 0.24, 0] })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.9 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Kleines Gipfelschild, zur Kamera geneigt.
  if (label) {
    const tex = labelTexture(label, {
      width: 512, height: 150,
      background: '#4d545c', color: '#f2f6fa',
      font: '700 74px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    })
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 0.34, 0.06),
      [
        new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.5, metalness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.5, metalness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.5, metalness: 0.4 }),
        new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.5, metalness: 0.4 }),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }),
        new THREE.MeshStandardMaterial({ color: IRON, roughness: 0.5, metalness: 0.4 }),
      ],
    )
    sign.position.set(0, H * 0.44, 0.2)
    sign.rotation.x = -0.4
    sign.castShadow = true
    group.add(sign)
  }

  return group
}
