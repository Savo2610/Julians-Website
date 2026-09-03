import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Tore, Start und Ziel der Rennstrecke.
//
// Die Kamera schaut aus 36 Grad von schraeg oben. Eine senkrechte Torflagge
// waere von dort ein Strich. Deshalb haengt das Tuch hier nach hinten geneigt
// zwischen den Stangen: von oben liest man die Farbe, von der Seite bleibt es
// eine Flagge. Dieselbe Regel wie bei den Schildern im Tal.

const POLE = 0x2b3138
const SNOW = 0xf7fbff

const RED = 0xd8402f
const BLUE = 0x2f6bd8

export const GATE_WIDTH = 4.4
const PANEL_TILT = -0.42

// Eine Torstange: leicht konisch, mit Teller im Schnee und Kappe oben.
function poleParts(parts, x, color, lean) {
  const H = 1.95
  parts.push({
    geo: new THREE.CylinderGeometry(0.045, 0.06, H, 7),
    color: POLE,
    position: [x, H / 2, 0],
    rotation: [lean * 0.1, 0, -lean * 0.06],
  })
  // Farbring, damit die Stange auch ohne Tuch die Torfarbe traegt.
  for (const y of [H * 0.82, H * 0.62]) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.062, 0.062, 0.16, 7),
      color,
      position: [x, y, 0],
    })
  }
  parts.push({ geo: new THREE.SphereGeometry(0.07, 7, 5), color, position: [x, H + 0.03, 0] })
  parts.push({
    geo: new THREE.CylinderGeometry(0.26, 0.3, 0.07, 9),
    color: SNOW,
    position: [x, 0.035, 0],
  })
}

export function createSlalomGate({ color = 'red', width = GATE_WIDTH, number = null } = {}) {
  const group = new THREE.Group()
  const parts = []
  const tone = color === 'red' ? RED : BLUE
  const half = width / 2

  poleParts(parts, -half, tone, 1)
  poleParts(parts, half, tone, -1)

  // Das Tuch: eine flache Platte, nach hinten gekippt. Sie haengt an der
  // Oberkante zwischen den Stangen und faellt nach vorn ab.
  const cloth = new THREE.BoxGeometry(width - 0.16, 0.62, 0.035)
  parts.push({
    geo: cloth,
    color: tone,
    position: [0, 1.42, 0.12],
    rotation: [PANEL_TILT, 0, 0],
  })
  // Schmaler heller Streifen als Kante – gibt dem Tuch von oben Kontur.
  parts.push({
    geo: new THREE.BoxGeometry(width - 0.16, 0.08, 0.04),
    color: 0xf2f6fb,
    position: [0, 1.15, 0.24],
    rotation: [PANEL_TILT, 0, 0],
  })

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.72 }))
  mesh.castShadow = true
  group.add(mesh)

  if (number !== null) {
    const tex = labelTexture(String(number), {
      width: 128, height: 128, background: null, color: '#ffffff',
      font: '700 92px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    })
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    tag.position.set(0, 1.44, 0.145)
    tag.rotation.x = PANEL_TILT
    group.add(tag)
  }

  return group
}

// Start- und Zielbogen. Beide tragen ein geneigtes Schild, damit man von oben
// lesen kann, wo man dran ist.
function createArch(text, accent, { span = 7.2, height = 3.1 } = {}) {
  const group = new THREE.Group()
  const parts = []
  const half = span / 2

  for (const sx of [-1, 1]) {
    // Mast
    parts.push({
      geo: new THREE.CylinderGeometry(0.09, 0.13, height, 8),
      color: POLE,
      position: [sx * half, height / 2, 0],
    })
    // Fussplatte im Schnee
    parts.push({
      geo: new THREE.CylinderGeometry(0.42, 0.5, 0.16, 10),
      color: SNOW,
      position: [sx * half, 0.08, 0],
    })
    // Strebe nach hinten
    parts.push({
      geo: new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6),
      color: POLE,
      position: [sx * half, height * 0.42, -0.62],
      rotation: [0.6, 0, 0],
    })
  }

  // Querbalken
  parts.push({
    geo: new THREE.BoxGeometry(span + 0.3, 0.16, 0.16),
    color: POLE,
    position: [0, height - 0.1, 0],
  })
  // Banner: nach hinten gekippt unter dem Querbalken.
  parts.push({
    geo: new THREE.BoxGeometry(span * 0.82, 1.02, 0.06),
    color: accent,
    position: [0, height - 0.62, 0.2],
    rotation: [-0.5, 0, 0],
  })

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.68 }))
  mesh.castShadow = true
  group.add(mesh)

  const tex = labelTexture(text, {
    width: 512, height: 160, background: null, color: '#ffffff',
    font: '700 104px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 0.78, 0.92),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  label.position.set(0, height - 0.62, 0.235)
  label.rotation.x = -0.5
  group.add(label)

  return group
}

export function createStartArch() {
  return createArch('START', 0x2f6bd8)
}

export function createFinishArch() {
  return createArch('ZIEL', 0xd8402f)
}
