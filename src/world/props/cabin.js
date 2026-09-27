import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture, snowDust } from '../../core/geometry.js'
import { createSmoke } from './smoke.js'

// Berghuette aus Holz: Steinsockel, Bohlenwaende, dick verschneites Schindel-
// dach, warm erleuchtetes Fenster, Kamin mit Rauch und ein Holzstapel an der
// Wand. Das Objekt traegt das meiste Detail in der Welt – es soll der Ort sein,
// an dem man von selbst anhaelt.

const WOOD = 0x7b5236
const WOOD_DARK = 0x5c3c28
const WOOD_LIGHT = 0x94663f
const STONE = 0x6e7178
const SNOW = 0xf7fbff
const SNOW_SHADE = 0xdfe9f5
const WARM = 0xffb459

export function createCabin({ label = null } = {}) {
  const group = new THREE.Group()
  const parts = []

  const W = 3.0   // Breite
  const D = 2.4   // Tiefe
  const H = 1.85  // Wandhoehe

  // --- Steinsockel --------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W + 0.3, 0.42, D + 0.3), color: STONE, position: [0, 0.21, 0] })
  // Einzelne Steine andeuten
  for (let i = 0; i < 14; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const along = ((i / 14) - 0.5) * (W + 0.2)
    parts.push({
      geo: new THREE.BoxGeometry(0.3 + (i % 3) * 0.1, 0.2, 0.14),
      color: i % 3 === 0 ? 0x7d8087 : STONE,
      position: [along, 0.14 + (i % 2) * 0.16, side * (D / 2 + 0.16)],
      rotation: [0, 0, ((i % 5) - 2) * 0.03],
    })
  }

  // --- Bohlenwaende -------------------------------------------------------
  const logCount = 6
  for (let i = 0; i < logCount; i++) {
    const y = 0.42 + 0.16 + i * ((H - 0.2) / logCount)
    const shade = i % 2 === 0 ? WOOD : WOOD_LIGHT
    // Vorder- und Rueckwand
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.15, 0.15, W, 7),
        color: shade,
        position: [0, y, sz * (D / 2)],
        rotation: [0, 0, Math.PI / 2],
      })
    }
    // Seitenwaende
    for (const sx of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.15, 0.15, D, 7),
        color: i % 2 === 0 ? WOOD_LIGHT : WOOD,
        position: [sx * (W / 2), y + 0.08, 0],
        rotation: [Math.PI / 2, 0, 0],
      })
    }
  }

  // --- Giebel -------------------------------------------------------------
  const gableShape = new THREE.Shape()
  gableShape.moveTo(-W / 2 - 0.05, 0)
  gableShape.lineTo(W / 2 + 0.05, 0)
  gableShape.lineTo(0, 1.05)
  gableShape.closePath()
  for (const sz of [-1, 1]) {
    parts.push({
      geo: new THREE.ExtrudeGeometry(gableShape, { depth: 0.12, bevelEnabled: false }),
      color: WOOD_DARK,
      position: [0, 0.42 + H, sz * (D / 2) - 0.06],
    })
  }

  // --- Dach ---------------------------------------------------------------
  const roofLen = Math.hypot(W / 2 + 0.35, 1.05)
  const roofAngle = Math.atan2(1.05, W / 2 + 0.35)
  for (const sx of [-1, 1]) {
    // Schindeln
    parts.push({
      geo: new THREE.BoxGeometry(roofLen, 0.12, D + 0.7),
      color: WOOD_DARK,
      position: [sx * (W / 4 + 0.16), 0.42 + H + 0.52, 0],
      rotation: [0, 0, sx * -roofAngle],
    })
    // Dicke Schneeauflage
    parts.push({
      geo: new THREE.BoxGeometry(roofLen * 0.99, 0.2, D + 0.72),
      color: SNOW,
      position: [sx * (W / 4 + 0.16), 0.42 + H + 0.68, 0],
      rotation: [0, 0, sx * -roofAngle],
    })
  }
  // Firstbalken
  parts.push({
    geo: new THREE.CylinderGeometry(0.09, 0.09, D + 0.75, 6),
    color: WOOD_DARK,
    position: [0, 0.42 + H + 1.05, 0],
    rotation: [Math.PI / 2, 0, 0],
  })

  // --- Tuer ---------------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(0.86, 1.42, 0.1), color: WOOD_DARK, position: [-0.72, 0.42 + 0.71, D / 2 + 0.1] })
  for (const dy of [0.42, -0.42]) {
    parts.push({ geo: new THREE.BoxGeometry(0.9, 0.08, 0.04), color: WOOD_LIGHT, position: [-0.72, 0.42 + 0.71 + dy, D / 2 + 0.16] })
  }
  parts.push({ geo: new THREE.SphereGeometry(0.05, 8, 6), color: 0x4a4136, position: [-0.38, 0.42 + 0.71, D / 2 + 0.18] })

  // --- Holzstapel ---------------------------------------------------------
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5; i++) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.09, 0.09, 0.62, 6),
        color: row % 2 ? WOOD : WOOD_LIGHT,
        position: [W / 2 + 0.36, 0.42 + 0.1 + row * 0.18, -0.7 + i * 0.19 + (row % 2) * 0.08],
        rotation: [0, 0, Math.PI / 2],
      })
    }
  }
  // Schnee auf dem Holzstapel
  parts.push({
    geo: new THREE.BoxGeometry(0.68, 0.09, 1.1),
    color: SNOW,
    position: [W / 2 + 0.36, 0.42 + 0.62, -0.3],
  })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.86 }))
  snowDust(body.geometry, 0.35, 0.72)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Fenster mit warmem Licht -------------------------------------------
  const windowGroup = new THREE.Group()
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.6),
    new THREE.MeshStandardMaterial({
      color: WARM,
      emissive: new THREE.Color(WARM),
      emissiveIntensity: 1.6,
      roughness: 0.4,
    }),
  )
  pane.position.set(0.68, 0.42 + 0.95, D / 2 + 0.09)
  windowGroup.add(pane)

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.84, 0.72, 0.07),
    new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8, flatShading: true }),
  )
  frame.position.set(0.68, 0.42 + 0.95, D / 2 + 0.05)
  windowGroup.add(frame)

  // Sprossenkreuz
  for (const [w, h] of [[0.05, 0.62], [0.76, 0.05]]) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.05),
      new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8, flatShading: true }),
    )
    bar.position.set(0.68, 0.42 + 0.95, D / 2 + 0.11)
    windowGroup.add(bar)
  }
  group.add(windowGroup)

  // Warmes Licht faellt in den Schnee davor.
  const glow = new THREE.PointLight(WARM, 6, 7, 2)
  glow.position.set(0.68, 0.42 + 1.0, D / 2 + 0.7)
  group.add(glow)

  // --- Kamin mit Rauch ----------------------------------------------------
  const chimney = new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(0.42, 0.9, 0.42), color: STONE, position: [0, 0.45, 0] },
      { geo: new THREE.BoxGeometry(0.52, 0.1, 0.52), color: 0x5f6268, position: [0, 0.92, 0] },
      { geo: new THREE.BoxGeometry(0.5, 0.07, 0.5), color: SNOW_SHADE, position: [0, 0.99, 0] },
    ]),
    vertexColorMaterial({ roughness: 0.9 }),
  )
  chimney.position.set(-0.85, 0.42 + H + 0.55, -0.5)
  chimney.castShadow = true
  group.add(chimney)

  const smoke = createSmoke({ scale: 0.9, rate: 0.42 })
  smoke.position.set(-0.85, 0.42 + H + 1.6, -0.5)
  group.add(smoke)

  // --- Schild ueber der Tuer ----------------------------------------------
  if (label) {
    const tex = labelTexture(label, {
      width: 512, height: 160,
      background: '#4a3524', color: '#f0e0c8',
      font: '700 88px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    })
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 0.38, 0.06),
      [
        new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8 }),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }),
        new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.8 }),
      ],
    )
    sign.position.set(-0.72, 0.42 + 1.62, D / 2 + 0.14)
    sign.castShadow = true
    group.add(sign)
  }

  group.userData.animate = (t) => {
    smoke.userData.animate(t)
    // Kaminfeuer flackert leicht.
    const flicker = 1 + Math.sin(t * 7.3) * 0.06 + Math.sin(t * 3.1) * 0.04
    glow.intensity = 6 * flicker
    pane.material.emissiveIntensity = 1.6 * flicker
  }

  group.userData.footprint = { width: W + 0.9, depth: D + 0.9 }
  return group
}
