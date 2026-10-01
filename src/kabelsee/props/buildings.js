import * as THREE from 'three'
import { assemble, jitter } from '../../core/geometry.js'
import { makeRng } from '../../core/rng.js'
import { COLORS } from '../config.js'

// Die Bauten und Kleinteile am See, jedes als eine gemergte Geometrie mit
// Eckfarben. Lokal gilt: +z ist die Schauseite, die zur Kamera zeigt.

const WOOD = COLORS.woodLight
const WOOD_DARK = COLORS.wood
const PLANK = 0xd6b489
const ROOF = 0x5a4636
const GLASS = 0x9fd0de
const WHITE = 0xf6f3ec
const ORANGE = 0xe4613a
const TEAL = 0x3a9ea5
const NAVY = 0x2f3d5c

const box = (w, h, d, color, position, rotation) => ({ geo: new THREE.BoxGeometry(w, h, d), color, position, rotation })
const cyl = (rt, rb, h, seg, color, position, rotation) => ({ geo: new THREE.CylinderGeometry(rt, rb, h, seg), color, position, rotation })

// Die Station: Kiosk mit Glasfront, Dachterrasse und Holzdeck davor.
export function stationGeometry() {
  const p = []
  // Deck
  p.push(box(16, 0.3, 12, PLANK, [0, 0.15, 1]))
  for (let x = -7.5; x <= 7.5; x += 1.5) p.push(box(0.04, 0.02, 12, 0xb8946b, [x, 0.31, 1]))
  // Haus
  const w = 10, d = 6, h = 3.3
  p.push(box(w, h, d, 0xe2c79c, [0, 0.3 + h / 2, -2.5]))
  // Senkrechte Leisten an der Seite, damit es nach Holz aussieht.
  for (let z = -5.2; z <= 0.2; z += 0.6) {
    p.push(box(0.06, h, 0.12, 0xc9a877, [w / 2 + 0.02, 0.3 + h / 2, z]))
    p.push(box(0.06, h, 0.12, 0xc9a877, [-w / 2 - 0.02, 0.3 + h / 2, z]))
  }
  // Glasfront mit Sprossen und Tresenfenster
  p.push(box(w - 1.2, 2.1, 0.08, GLASS, [0.6, 1.6, 0.52]))
  for (let x = -3.6; x <= 4.8; x += 1.4) p.push(box(0.1, 2.2, 0.12, WOOD_DARK, [x + 0.6, 1.6, 0.56]))
  p.push(box(w - 1.1, 0.12, 0.3, WOOD_DARK, [0.6, 2.72, 0.6]))
  p.push(box(3.6, 0.14, 0.7, WOOD_DARK, [2.4, 1.2, 0.85]))
  // Tuer
  p.push(box(1.1, 2.2, 0.1, 0x7d5a3f, [-4.2, 1.4, 0.54]))
  // Dach mit Ueberstand und Gelaender der Dachterrasse
  p.push(box(w + 1.6, 0.28, d + 3.2, ROOF, [0, 0.3 + h + 0.14, -1.3]))
  for (let x = -5.6; x <= 5.6; x += 0.8) p.push(box(0.07, 0.8, 0.07, WHITE, [x, h + 1.25, 2.1]))
  p.push(box(11.4, 0.08, 0.1, WHITE, [0, h + 1.65, 2.1]))
  for (const s of [-1, 1]) {
    for (let z = -4.6; z <= 2.1; z += 0.8) p.push(box(0.07, 0.8, 0.07, WHITE, [s * 5.7, h + 1.25, z]))
    p.push(box(0.1, 0.08, 6.8, WHITE, [s * 5.7, h + 1.65, -1.25]))
  }
  // Stuetzen des Vordachs
  for (const x of [-5.4, 5.4]) p.push(cyl(0.12, 0.12, h, 6, WOOD_DARK, [x, 0.3 + h / 2, 1.9]))
  // Schwimmwesten an der Wand
  for (let i = 0; i < 4; i++) p.push(box(0.45, 0.6, 0.12, i % 2 ? ORANGE : 0xf2c84b, [w / 2 + 0.1, 1.8, -4.6 + i * 0.7]))
  // Bank und zwei Tische auf dem Deck
  for (const x of [-5.5, -1.8]) {
    p.push(box(1.6, 0.08, 0.9, WOOD, [x, 1.0, 4.2]))
    p.push(box(0.1, 0.7, 0.7, WOOD_DARK, [x - 0.6, 0.65, 4.2]))
    p.push(box(0.1, 0.7, 0.7, WOOD_DARK, [x + 0.6, 0.65, 4.2]))
    p.push(box(1.6, 0.07, 0.3, WOOD, [x, 0.72, 3.4]))
    p.push(box(1.6, 0.07, 0.3, WOOD, [x, 0.72, 5.0]))
  }
  return assemble(p)
}

// Sonnenschirm, Streifen abwechselnd in zwei Farben.
export function parasolGeometry(a = ORANGE, b = WHITE) {
  const p = [cyl(0.04, 0.05, 2.5, 5, 0xd9d2c4, [0, 1.25, 0])]
  const n = 8
  for (let i = 0; i < n; i++) {
    const g = new THREE.ConeGeometry(1.5, 0.55, n, 1, true, (i / n) * Math.PI * 2, (Math.PI * 2) / n)
    p.push({ geo: g, color: i % 2 ? a : b, position: [0, 2.5, 0] })
  }
  p.push(cyl(0.05, 0.05, 0.3, 5, 0xd9d2c4, [0, 2.9, 0]))
  return assemble(p)
}

export function loungerGeometry(color = TEAL) {
  return assemble([
    box(0.7, 0.08, 1.4, color, [0, 0.35, 0.2]),
    box(0.7, 0.08, 0.7, color, [0, 0.62, -0.72], [-0.75, 0, 0]),
    box(0.06, 0.35, 0.06, 0xd9d2c4, [-0.3, 0.17, 0.8]),
    box(0.06, 0.35, 0.06, 0xd9d2c4, [0.3, 0.17, 0.8]),
    box(0.06, 0.35, 0.06, 0xd9d2c4, [-0.3, 0.17, -0.3]),
    box(0.06, 0.35, 0.06, 0xd9d2c4, [0.3, 0.17, -0.3]),
  ])
}

// Staender mit Wasserski und Boards, bunt wie an jeder Anlage.
export function boardRackGeometry() {
  const p = [
    box(3.2, 0.1, 0.12, WOOD_DARK, [0, 1.3, 0]),
    box(0.1, 1.4, 0.12, WOOD_DARK, [-1.5, 0.7, 0]),
    box(0.1, 1.4, 0.12, WOOD_DARK, [1.5, 0.7, 0]),
  ]
  const colors = [0x8fc23a, ORANGE, TEAL, 0xf2c84b, NAVY, 0x8fc23a, 0xd9553a]
  colors.forEach((c, i) => {
    p.push(box(0.2, 1.45, 0.05, c, [-1.3 + i * 0.43, 0.75, 0.12], [-0.22, 0, 0]))
  })
  return assemble(p)
}

// Bedienkabine am Steg: kleiner Glaskasten, von dem aus die Anlage laeuft.
export function boothGeometry() {
  return assemble([
    box(2.2, 0.25, 2.2, 0xb9b4a8, [0, 0.12, 0]),
    box(2, 1.1, 2, 0xe2c79c, [0, 0.8, 0]),
    box(2.02, 1.1, 2.02, GLASS, [0, 1.9, 0]),
    box(0.08, 1.1, 0.08, WOOD_DARK, [0.98, 1.9, 0.98]),
    box(0.08, 1.1, 0.08, WOOD_DARK, [-0.98, 1.9, 0.98]),
    box(0.08, 1.1, 0.08, WOOD_DARK, [0.98, 1.9, -0.98]),
    box(0.08, 1.1, 0.08, WOOD_DARK, [-0.98, 1.9, -0.98]),
    box(2.5, 0.2, 2.5, ROOF, [0, 2.55, 0]),
    cyl(0.05, 0.05, 1.2, 4, WHITE, [0.9, 3.2, -0.9]),
    box(0.02, 0.4, 0.7, ORANGE, [0.9, 3.55, -0.55]),
  ])
}

export function flagGeometry(color = ORANGE, height = 6) {
  return assemble([
    cyl(0.06, 0.08, height, 6, WHITE, [0, height / 2, 0]),
    { geo: new THREE.SphereGeometry(0.1, 6, 4), color: 0xf2c84b, position: [0, height + 0.05, 0] },
    box(0.03, 0.8, 1.3, color, [0, height - 0.5, 0.66]),
  ])
}

// Pavillon auf der Insel: sechseckiges Dach auf sechs Pfosten.
export function pavilionGeometry() {
  const p = [cyl(2.6, 2.8, 0.3, 6, PLANK, [0, 0.15, 0])]
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    p.push(cyl(0.1, 0.12, 2.4, 5, WOOD_DARK, [Math.cos(a) * 2.3, 1.5, Math.sin(a) * 2.3]))
    if (i !== 1) p.push(box(0.08, 0.08, 2.3, WOOD, [Math.cos(a + 0.52) * 2.0, 1.0, Math.sin(a + 0.52) * 2.0], [0, -a - 0.52, 0]))
  }
  p.push({ geo: new THREE.ConeGeometry(3.3, 1.7, 6), color: 0xb5543a, position: [0, 3.55, 0] })
  p.push({ geo: new THREE.ConeGeometry(0.3, 0.6, 6), color: 0xe7c46a, position: [0, 4.6, 0] })
  p.push(box(1.8, 0.08, 0.5, WOOD, [0, 0.75, -1.1]))
  return assemble(p)
}

export function rowboatGeometry(color = 0xd9553a) {
  const hull = new THREE.CylinderGeometry(0.75, 0.5, 3.6, 10, 1, false, 0, Math.PI)
  hull.rotateZ(Math.PI / 2)
  hull.rotateY(Math.PI / 2)
  hull.rotateZ(Math.PI)
  return assemble([
    { geo: hull, color, position: [0, 0.72, 0] },
    box(1.3, 0.06, 0.3, WOOD, [0, 0.55, 0.3]),
    box(1.3, 0.06, 0.3, WOOD, [0, 0.55, -0.7]),
    box(0.06, 0.06, 2.4, WOOD_DARK, [0.4, 0.8, 0], [0, 0.15, 0.3]),
  ])
}

export function benchGeometry() {
  return assemble([
    box(1.8, 0.08, 0.45, WOOD, [0, 0.46, 0]),
    box(1.8, 0.35, 0.06, WOOD, [0, 0.75, -0.22]),
    box(0.08, 0.46, 0.4, WOOD_DARK, [-0.8, 0.23, 0]),
    box(0.08, 0.46, 0.4, WOOD_DARK, [0.8, 0.23, 0]),
  ])
}

export function firepitGeometry() {
  const rng = makeRng(5)
  const p = []
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    p.push({ geo: jitter(new THREE.IcosahedronGeometry(0.22, 0), 0.08, rng), color: 0x8d8f93, position: [Math.cos(a) * 0.75, 0.12, Math.sin(a) * 0.75] })
  }
  p.push(box(1.1, 0.14, 0.16, WOOD_DARK, [0, 0.18, 0], [0, 0.5, 0.2]))
  p.push(box(1.1, 0.14, 0.16, WOOD_DARK, [0, 0.18, 0], [0, -0.7, -0.2]))
  // Zwei Baumstaemme zum Sitzen.
  p.push(cyl(0.22, 0.22, 1.8, 7, 0x7a5a42, [0, 0.22, 1.9], [0, 0, Math.PI / 2]))
  p.push(cyl(0.22, 0.22, 1.8, 7, 0x7a5a42, [-1.8, 0.22, 0.2], [Math.PI / 2, 0, 0.3]))
  return assemble(p)
}

export function lanternGeometry() {
  return assemble([
    cyl(0.05, 0.06, 1.6, 5, 0x2f3640, [0, 0.8, 0]),
    box(0.26, 0.32, 0.26, 0xffd98a, [0, 1.75, 0]),
    { geo: new THREE.ConeGeometry(0.24, 0.2, 4), color: 0x2f3640, position: [0, 2.0, 0], rotation: [0, Math.PI / 4, 0] },
  ])
}

export function tentGeometry(color = ORANGE) {
  const shape = new THREE.Shape()
  shape.moveTo(-1.3, 0)
  shape.lineTo(0, 1.5)
  shape.lineTo(1.3, 0)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: false })
  g.translate(0, 0, -1.3)
  return assemble([
    { geo: g, color },
    box(0.8, 1.0, 0.02, 0x3b3530, [0, 0.45, 1.31]),
    cyl(0.03, 0.03, 1.8, 4, 0x2f3640, [0, 0.9, 1.4]),
  ])
}

// Bulli in Tuerkis und Weiss, wie er an jedem Badesee steht.
export function vanGeometry() {
  const p = [
    box(1.9, 1.1, 4.3, TEAL, [0, 0.95, 0]),
    box(1.88, 0.9, 4.1, WHITE, [0, 1.9, -0.05]),
    box(1.92, 0.5, 1.2, GLASS, [0, 1.9, 1.5]),
    box(1.92, 0.45, 2.2, GLASS, [0, 1.95, -0.6]),
    box(1.6, 0.12, 3.2, 0xd9d2c4, [0, 2.42, -0.3]),
    box(1.2, 0.3, 0.1, WHITE, [0, 0.9, 2.16]),
  ]
  for (const [x, z] of [[-0.9, 1.4], [0.9, 1.4], [-0.9, -1.4], [0.9, -1.4]]) {
    p.push(cyl(0.38, 0.38, 0.25, 10, 0x22262c, [x, 0.38, z], [0, 0, Math.PI / 2]))
  }
  return assemble(p)
}

export function picnicGeometry() {
  return assemble([
    box(1.8, 0.08, 0.8, WOOD, [0, 0.75, 0]),
    box(1.8, 0.06, 0.3, WOOD, [0, 0.45, 0.65]),
    box(1.8, 0.06, 0.3, WOOD, [0, 0.45, -0.65]),
    box(0.08, 0.75, 1.6, WOOD_DARK, [-0.7, 0.37, 0], [0.0, 0, 0]),
    box(0.08, 0.75, 1.6, WOOD_DARK, [0.7, 0.37, 0], [0.0, 0, 0]),
  ])
}

export function boathouseGeometry() {
  const p = [
    box(5, 0.25, 9, PLANK, [0, 0.4, 0]),
    box(4.2, 2.6, 5.5, 0x8c5e3c, [0, 1.8, -1.5]),
    box(1.8, 1.9, 0.06, 0x5a4636, [0, 1.5, 1.26]),
  ]
  const roofL = new THREE.BoxGeometry(2.8, 0.14, 6.3)
  p.push({ geo: roofL, color: 0x4d5c63, position: [-1.1, 3.55, -1.5], rotation: [0, 0, 0.62] })
  p.push({ geo: roofL, color: 0x4d5c63, position: [1.1, 3.55, -1.5], rotation: [0, 0, -0.62] })
  for (const x of [-2.3, 2.3]) for (const z of [-4.2, 0, 4.2]) p.push(cyl(0.12, 0.14, 2.6, 5, 0x5a4636, [x, -0.6, z]))
  return assemble(p)
}

export function lifeguardGeometry() {
  const p = []
  for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) p.push(cyl(0.07, 0.08, 2.6, 5, WHITE, [x, 1.3, z]))
  p.push(box(1.8, 0.1, 1.8, WOOD, [0, 2.6, 0]))
  p.push(box(1.6, 0.9, 0.08, ORANGE, [0, 3.1, -0.8]))
  p.push(box(1.9, 0.1, 1.9, ORANGE, [0, 4.0, 0]))
  p.push(cyl(0.04, 0.04, 1.3, 4, WHITE, [0.8, 3.3, 0.8]))
  p.push(cyl(0.04, 0.04, 1.3, 4, WHITE, [-0.8, 3.3, 0.8]))
  p.push({ geo: new THREE.TorusGeometry(0.32, 0.1, 5, 10), color: ORANGE, position: [0, 1.8, 0.78] })
  return assemble(p)
}

export function rockGeometry(seed, r = 1) {
  const rng = makeRng(seed)
  const g = jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.45, rng)
  g.scale(1, 0.62, 1)
  return assemble([{ geo: g, color: COLORS.rock }])
}

// Schilfbueschel: ein paar duenne Halme mit dunklen Kolben.
export function reedGeometry(seed) {
  const rng = makeRng(seed)
  const p = []
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2
    const r = rng() * 0.45
    const h = 1.1 + rng() * 0.9
    const tilt = [(rng() - 0.5) * 0.3, 0, (rng() - 0.5) * 0.3]
    p.push({ geo: new THREE.ConeGeometry(0.035, h, 3), color: rng() < 0.5 ? 0x8aa655 : 0x6f8f47, position: [Math.cos(a) * r, h / 2, Math.sin(a) * r], rotation: tilt })
    if (i % 3 === 0) p.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 0.28, 5), color: 0x6b4a35, position: [Math.cos(a) * r, h * 0.82, Math.sin(a) * r], rotation: tilt })
  }
  return assemble(p)
}

export function duckGeometry() {
  return assemble([
    { geo: new THREE.SphereGeometry(0.22, 7, 5), color: 0x8a6b4f, position: [0, 0.1, 0], scale: [1, 0.7, 1.4] },
    { geo: new THREE.SphereGeometry(0.11, 6, 5), color: 0x2f6b45, position: [0, 0.32, 0.22] },
    { geo: new THREE.ConeGeometry(0.05, 0.12, 4), color: 0xf2b33b, position: [0, 0.3, 0.36], rotation: [Math.PI / 2, 0, 0] },
    box(0.18, 0.06, 0.16, 0xf6f3ec, [0, 0.2, 0.12]),
  ])
}

export function towelGeometry(color) {
  return assemble([box(0.9, 0.03, 1.8, color, [0, 0.02, 0]), box(0.9, 0.035, 0.18, 0xffffff, [0, 0.025, 0.5])])
}
