import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { makeRng } from '../../core/rng.js'
import { COLORS } from '../../config.js'

// Tannen in drei Silhouetten. Jede Variante ist eine einzige gemergte
// Geometrie mit Vertex-Farben und wird als InstancedMesh hunderfach gesetzt.

function firGeometry(variant) {
  const parts = []
  const trunkH = variant.trunk
  parts.push({
    geo: new THREE.CylinderGeometry(0.13, 0.2, trunkH, 6),
    color: COLORS.wood,
    position: [0, trunkH / 2, 0],
  })

  let y = trunkH * 0.72
  for (let i = 0; i < variant.tiers; i++) {
    const t = i / Math.max(1, variant.tiers - 1)
    const radius = variant.radius * (1 - t * 0.62)
    const height = variant.tierHeight * (1 - t * 0.18)
    parts.push({
      geo: new THREE.ConeGeometry(radius, height, variant.sides, 1),
      color: i % 2 === 0 ? COLORS.pine : COLORS.pineDark,
      position: [0, y + height * 0.5, 0],
    })
    // Schneekappe: flacher Kegel knapp ueber dem Nadelkranz.
    parts.push({
      geo: new THREE.ConeGeometry(radius * 0.94, height * 0.42, variant.sides, 1),
      color: 0xf7fbff,
      position: [0, y + height * 0.78, 0],
    })
    y += height * variant.overlap
  }

  parts.push({
    geo: new THREE.ConeGeometry(variant.radius * 0.2, variant.tierHeight * 0.7, variant.sides, 1),
    color: 0xf7fbff,
    position: [0, y + variant.tierHeight * 0.3, 0],
  })

  return assemble(parts)
}

const VARIANTS = [
  { trunk: 1.1, tiers: 4, radius: 1.5, tierHeight: 1.9, sides: 7, overlap: 0.52, collide: 0.7 },
  { trunk: 0.9, tiers: 3, radius: 1.15, tierHeight: 1.6, sides: 6, overlap: 0.55, collide: 0.55 },
  { trunk: 1.5, tiers: 5, radius: 1.8, tierHeight: 2.1, sides: 8, overlap: 0.5, collide: 0.85 },
]

export function createForest(world, placements) {
  const material = vertexColorMaterial({ roughness: 0.88 })
  const groups = VARIANTS.map(() => [])
  placements.forEach((p) => groups[p.variant % VARIANTS.length].push(p))

  const meshes = []
  const dummy = new THREE.Object3D()
  const tintColor = new THREE.Color()

  VARIANTS.forEach((variant, vi) => {
    const list = groups[vi]
    if (!list.length) return
    const geo = firGeometry(variant)
    const mesh = new THREE.InstancedMesh(geo, material, list.length)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage)

    list.forEach((p, i) => {
      dummy.position.set(p.x, world.heightAt(p.x, p.z) - 0.15, p.z)
      dummy.rotation.set(p.tiltX || 0, p.rotation, p.tiltZ || 0)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // Leichte Farbstreuung, damit der Wald nicht wie eine Tapete wirkt.
      const shade = 0.86 + p.shade * 0.24
      tintColor.setRGB(shade, shade * (0.98 + p.shade * 0.04), shade * 1.02)
      mesh.setColorAt(i, tintColor)

      world.addCollider(p.x, p.z, variant.collide * p.scale)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    meshes.push(mesh)
    world.scene.add(mesh)
  })

  return meshes
}

// Umgestuerzter Baum: ein entasteter Stamm mit Wurzelteller. Eine bloss
// gekippte Tanne sieht aus wie eine Treppe – ein echter Windwurf hat keine
// Nadeln mehr und liegt tief im Schnee.
export function createFallenTree(seed = 1) {
  const rng = makeRng(seed)
  const parts = []
  const length = 4.2 + rng() * 1.6

  // Stamm, leicht konisch und in zwei Segmenten mit Knick.
  parts.push({
    geo: new THREE.CylinderGeometry(0.3, 0.36, length * 0.62, 8),
    color: COLORS.wood,
    position: [length * 0.31 - length * 0.5, 0, 0],
    rotation: [0, 0, Math.PI / 2],
  })
  parts.push({
    geo: new THREE.CylinderGeometry(0.2, 0.3, length * 0.42, 8),
    color: 0x5d4130,
    position: [length * 0.78 - length * 0.5, 0.05, 0.07],
    rotation: [0, 0.14, Math.PI / 2],
  })

  // Wurzelteller: eine Scheibe mit unregelmaessig abstehenden Wurzeln.
  parts.push({
    geo: new THREE.CylinderGeometry(1.05, 0.95, 0.28, 9),
    color: 0x4c3524,
    position: [-length * 0.5, 0.12, 0],
    rotation: [0, 0, Math.PI / 2],
  })
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rng()
    const len = 0.5 + rng() * 0.6
    parts.push({
      geo: new THREE.CylinderGeometry(0.05, 0.1, len, 5),
      color: 0x3f2c1e,
      position: [-length * 0.5 - 0.15, 0.12 + Math.sin(a) * 0.75, Math.cos(a) * 0.75],
      rotation: [a, 0, Math.PI / 2 + (rng() - 0.5) * 0.5],
    })
  }

  // Abgebrochene Aststummel
  for (let i = 0; i < 5; i++) {
    const along = (rng() - 0.35) * length * 0.8
    const a = rng() * Math.PI * 2
    parts.push({
      geo: new THREE.CylinderGeometry(0.05, 0.09, 0.34 + rng() * 0.3, 5),
      color: 0x5d4130,
      position: [along, 0.12 + Math.sin(a) * 0.28, Math.cos(a) * 0.28],
      rotation: [a * 0.5, 0, Math.PI / 2 + (rng() - 0.5) * 1.2],
    })
  }

  // Schneepolster auf dem liegenden Stamm.
  parts.push({
    geo: (() => {
      const g = new THREE.CylinderGeometry(0.34, 0.34, length * 0.9, 8, 1, false, 0, Math.PI)
      return g
    })(),
    color: 0xf7fbff,
    position: [-0.1, 0.06, 0],
    rotation: [Math.PI / 2, 0, Math.PI / 2],
  })

  const geo = assemble(parts)
  const mesh = new THREE.Mesh(geo, vertexColorMaterial({ roughness: 0.92 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
