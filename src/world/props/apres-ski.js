import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { createSmoke } from './smoke.js'
import { createSignpost } from './signpost.js'

const WOOD = 0x7b5236, WOOD_DARK = 0x54382a, WOOD_LIGHT = 0x9a6b42
const STONE = 0x6e7178, SNOW = 0xf7fbff, SNOW_SHADE = 0xdfe9f5

// Nur das Haus: die befahrbare Terrasse und ihre beweglichen Moebel werden
// getrennt gesetzt, damit keine grosse Kollisionsscheibe den Zugang sperrt.
export function createApresSki() {
  const group = new THREE.Group()
  const parts = []
  const W = 4, D = 3, H = 2.05, DECK_Y = 0
  // --- Haus ---------------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W + 0.4, 0.4, D + 0.4), color: STONE, position: [0, DECK_Y - 0.2, 0] })
  for (let i = 0; i < 7; i++) {
    const y = DECK_Y + 0.2 + i * ((H - 0.2) / 7)
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.15, 0.15, W, 7),
        color: i % 2 ? WOOD : WOOD_LIGHT,
        position: [0, y, sz * (D / 2)],
        rotation: [0, 0, Math.PI / 2],
      })
    }
    for (const sx of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.15, 0.15, D, 7),
        color: i % 2 ? WOOD_LIGHT : WOOD,
        position: [sx * (W / 2), y + 0.08, 0],
        rotation: [Math.PI / 2, 0, 0],
      })
    }
  }

  // Giebel und Satteldach mit dicker Schneeauflage – das ist die Flaeche,
  // an der man das Haus von oben erkennt.
  const rise = 1.15
  const gable = new THREE.Shape()
  gable.moveTo(-W / 2 - 0.05, 0)
  gable.lineTo(W / 2 + 0.05, 0)
  gable.lineTo(0, rise)
  gable.closePath()
  for (const sz of [-1, 1]) {
    parts.push({
      geo: new THREE.ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false }),
      color: WOOD_DARK,
      position: [0, DECK_Y + H, sz * (D / 2) - 0.06],
    })
  }
  const roofLen = Math.hypot(W / 2 + 0.45, rise)
  const roofAngle = Math.atan2(rise, W / 2 + 0.45)
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(roofLen, 0.13, D + 0.9),
      color: WOOD_DARK,
      position: [sx * (W / 4 + 0.2), DECK_Y + H + rise / 2, 0],
      rotation: [0, 0, sx * -roofAngle],
    })
    parts.push({
      geo: new THREE.BoxGeometry(roofLen - 0.12, 0.24, D + 0.82),
      color: sx > 0 ? SNOW : SNOW_SHADE,
      position: [sx * (W / 4 + 0.2), DECK_Y + H + rise / 2 + 0.18, 0],
      rotation: [0, 0, sx * -roofAngle],
    })
  }

  // Fenster mit warmem Licht und eine Tuer zur Terrasse.
  parts.push({ geo: new THREE.BoxGeometry(1.5, 0.95, 0.1), color: 0xffce7a, position: [-0.9, DECK_Y + 1.3, D / 2 + 0.23] })
  parts.push({ geo: new THREE.BoxGeometry(1.62, 1.07, 0.06), color: WOOD_DARK, position: [-0.9, DECK_Y + 1.3, D / 2 + 0.18] })
  parts.push({ geo: new THREE.BoxGeometry(0.95, 1.75, 0.1), color: WOOD_DARK, position: [1.1, DECK_Y + 0.9, D / 2 + 0.23] })

  // Die Bohlen reichen 15 cm vor die Wandachse. Rahmen und Glas muessen
  // davor liegen, sonst verschwinden Fenster und Tuer zwischen den Staemmen.
  parts.push({ geo: new THREE.BoxGeometry(0.06, 0.95, 0.04), color: WOOD_DARK, position: [-0.9, 1.3, D / 2 + 0.30] })
  parts.push({ geo: new THREE.BoxGeometry(1.5, 0.06, 0.04), color: WOOD_DARK, position: [-0.9, 1.3, D / 2 + 0.30] })
  parts.push({ geo: new THREE.BoxGeometry(0.07, 0.18, 0.07), color: 0xd7b678, position: [1.4, 0.95, D / 2 + 0.31] })

  // Schornstein
  parts.push({
    geo: new THREE.BoxGeometry(0.42, 1.0, 0.42),
    color: STONE,
    position: [-1.3, DECK_Y + H + 0.75, -0.6],
  })

  // Holzstapel an der Seitenwand
  for (let i = 0; i < 9; i++) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6),
      color: i % 3 === 0 ? WOOD_LIGHT : WOOD_DARK,
      position: [-W / 2 - 0.28, DECK_Y + 0.12 + Math.floor(i / 3) * 0.19, -0.5 + (i % 3) * 0.2],
      rotation: [0, 0, Math.PI / 2],
    })
  }


  // Boxen an der Hausfront, oberhalb der Schneekante. Die Welt bleibt still.
  for (const x of [-2.6, 2.6]) {
    parts.push({ geo: new THREE.BoxGeometry(0.68, 1.25, 0.55), color: 0x30383b, position: [x, 0.7, 1.2] })
    for (const [y, radius] of [[0.48, 0.23], [1.03, 0.12]]) {
      parts.push({ geo: new THREE.CylinderGeometry(radius, radius, 0.055, 16), color: 0x11191d, position: [x, y, 1.5], rotation: [Math.PI / 2, 0, 0] })
      parts.push({ geo: new THREE.SphereGeometry(radius * 0.35, 8, 6), color: 0x616c70, position: [x, y, 1.54] })
    }
  }
  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.8 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  const sign = createSignpost([{text: 'APRÈS-SKI', width: 2.7, height: 0.65, background: '#654733'}], {height: 1.8})
  sign.position.set(-2.8, 0, 2.25)
  group.add(sign)
  const smoke = createSmoke({ scale: 0.8, rate: 0.4 })
  smoke.position.set(-1.3, H + 1.5, -0.6)
  group.add(smoke)
  group.userData.animate = t => smoke.userData.animate(t)
  return group
}
