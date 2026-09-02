import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { makeRng } from '../../core/rng.js'

// Weidezaun aus krummen Holzpfosten mit zwei Querlatten. Er folgt dem Gelaende
// und wird in einem einzigen Mesh zusammengefasst.

const WOOD = 0x6f5038
const WOOD_LIGHT = 0x8a6543
const SNOW = 0xf7fbff

export function createFence(world, points, { spacing = 2.3, height = 1.1, seed = 5 } = {}) {
  const rng = makeRng(seed)
  const parts = []
  const posts = []

  // Punkte entlang des Polygonzugs in gleichmaessigen Abstaenden abtasten.
  let carry = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const steps = Math.floor((len - carry) / spacing)
    for (let k = 0; k <= steps; k++) {
      const t = (carry + k * spacing) / len
      if (t > 1) break
      posts.push({ x: a.x + dx * t, z: a.z + dz * t, angle: Math.atan2(dx, dz) })
    }
    carry = (carry + (steps + 1) * spacing) - len
    if (carry < 0) carry = 0
  }

  const base = posts.length ? terrainHeight(posts[0].x, posts[0].z) : 0

  posts.forEach((p, i) => {
    const y = terrainHeight(p.x, p.z) - base
    const lean = (rng() - 0.5) * 0.16
    const h = height * (0.88 + rng() * 0.24)

    parts.push({
      geo: new THREE.CylinderGeometry(0.06, 0.08, h, 6),
      color: i % 3 === 0 ? WOOD_LIGHT : WOOD,
      position: [p.x, y + h / 2 - 0.12, p.z],
      rotation: [lean, p.angle, (rng() - 0.5) * 0.12],
    })
    // Schneehaube auf dem Pfosten
    parts.push({
      geo: new THREE.CylinderGeometry(0.075, 0.06, 0.07, 6),
      color: SNOW,
      position: [p.x, y + h - 0.12, p.z],
    })

    // Querlatten zum naechsten Pfosten
    const next = posts[i + 1]
    if (!next) return
    const dx = next.x - p.x
    const dz = next.z - p.z
    const span = Math.hypot(dx, dz)
    if (span > spacing * 1.8) return   // Luecke zwischen zwei Abschnitten
    const ny = terrainHeight(next.x, next.z) - base
    const mx = (p.x + next.x) / 2
    const mz = (p.z + next.z) / 2
    const my = (y + ny) / 2
    const pitch = Math.atan2(ny - y, span)

    for (const rel of [0.72, 0.4]) {
      parts.push({
        geo: new THREE.BoxGeometry(span + 0.1, 0.075, 0.05),
        color: rel > 0.5 ? WOOD_LIGHT : WOOD,
        position: [mx, my + h * rel - 0.12, mz],
        rotation: [0, Math.atan2(dx, dz) + Math.PI / 2, pitch],
      })
    }
  })

  if (!parts.length) return null
  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.9 }))
  mesh.position.y = base
  mesh.castShadow = true
  mesh.receiveShadow = true
  world.scene.add(mesh)

  // Kollision: jeder zweite Pfosten reicht, die Latten dazwischen sind duenn.
  posts.forEach((p, i) => {
    if (i % 1 === 0) world.addCollider(p.x, p.z, 0.4)
  })

  return mesh
}

// Pistenstangen: orange Markierungen, die einen Weg andeuten. Sie haben keine
// Kollision – man darf und soll sie ueberfahren.
export function createPisteMarkers(world, points, { seed = 12, color = 0xe8703a } = {}) {
  const rng = makeRng(seed)
  const parts = []
  const base = terrainHeight(points[0].x, points[0].z)

  for (const p of points) {
    const y = terrainHeight(p.x, p.z) - base
    const h = 1.62 + rng() * 0.28
    const lean = (rng() - 0.5) * 0.22

    parts.push({
      geo: new THREE.CylinderGeometry(0.032, 0.042, h, 6),
      color: 0xe8e4dc,
      position: [p.x, y + h / 2, p.z],
      rotation: [lean, 0, (rng() - 0.5) * 0.18],
    })
    // Zwei orange Ringe oben – die klassische Slalomstangen-Optik.
    for (const rel of [0.86, 0.66]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.044, 0.044, 0.19, 6),
        color,
        position: [p.x + Math.sin(lean) * 0, y + h * rel, p.z],
        rotation: [lean, 0, 0],
      })
    }
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.7 }))
  mesh.position.y = base
  mesh.castShadow = true
  world.scene.add(mesh)
  return mesh
}
