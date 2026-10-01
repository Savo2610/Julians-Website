import * as THREE from 'three'
import { assemble, vertexColorMaterial, jitter } from '../../core/geometry.js'
import { makeRng } from '../../core/rng.js'
import { COLORS } from '../config.js'

// Die Baeume. Dieselbe Bauweise wie die Tannen im Skital – eine gemergte
// Geometrie mit Eckfarben je Art, hundertfach als InstancedMesh –, nur
// ohne Schnee und um Laubbaeume und Birken ergaenzt, die einen Sommersee
// erst gemuetlich machen.

function pineGeometry(v) {
  const parts = [{
    geo: new THREE.CylinderGeometry(0.13, 0.2, v.trunk, 6),
    color: COLORS.wood,
    position: [0, v.trunk / 2, 0],
  }]
  let y = v.trunk * 0.7
  for (let i = 0; i < v.tiers; i++) {
    const t = i / Math.max(1, v.tiers - 1)
    const radius = v.radius * (1 - t * 0.62)
    const height = v.tierHeight * (1 - t * 0.18)
    parts.push({
      geo: new THREE.ConeGeometry(radius, height, v.sides, 1),
      color: i % 2 === 0 ? COLORS.pine : COLORS.pineDark,
      position: [0, y + height * 0.5, 0],
    })
    y += height * v.overlap
  }
  parts.push({
    geo: new THREE.ConeGeometry(v.radius * 0.22, v.tierHeight * 0.75, v.sides, 1),
    color: COLORS.pine,
    position: [0, y + v.tierHeight * 0.3, 0],
  })
  return assemble(parts)
}

// Laubbaum: ein Stamm mit zwei Aesten und drei Kronenballen aus
// verzogenen Ikosaedern, oben heller als unten.
function broadleafGeometry(seed, leaf, leafDark) {
  const rng = makeRng(seed)
  const parts = [{
    geo: new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6),
    color: 0x6d5140,
    position: [0, 1.2, 0],
  }]
  const blobs = [
    [0, 3.3, 0, 1.7],
    [0.9, 2.8, 0.4, 1.2],
    [-0.8, 2.9, -0.3, 1.25],
    [0.1, 4.2, -0.2, 1.1],
  ]
  for (const [x, y, z, r] of blobs) {
    const g = jitter(new THREE.IcosahedronGeometry(r * (0.9 + rng() * 0.2), 1), r * 0.28, rng)
    parts.push({ geo: g, color: y > 3.5 ? leaf : leafDark, position: [x, y, z] })
  }
  return assemble(parts)
}

function birchGeometry() {
  const parts = []
  const trunk = new THREE.CylinderGeometry(0.1, 0.15, 4.4, 6)
  parts.push({ geo: trunk, color: 0xefeae0, position: [0, 2.2, 0] })
  // Dunkle Ringe auf der Rinde.
  for (const y of [0.8, 1.7, 2.6, 3.4]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.135, 0.135, 0.09, 6), color: 0x2f2a27, position: [0, y, 0] })
  }
  const rng = makeRng(77)
  for (const [x, y, z, r] of [[0, 4.4, 0, 1.0], [0.5, 3.6, 0.3, 0.8], [-0.45, 3.8, -0.2, 0.75], [0.1, 5.0, 0, 0.6]]) {
    parts.push({
      geo: jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.3, rng),
      color: y > 4.2 ? 0xa9c267 : 0x8fae55,
      position: [x, y, z],
    })
  }
  return assemble(parts)
}

const KINDS = {
  pine: { make: () => pineGeometry({ trunk: 1.1, tiers: 4, radius: 1.5, tierHeight: 1.9, sides: 7, overlap: 0.52 }) },
  pineTall: { make: () => pineGeometry({ trunk: 1.5, tiers: 5, radius: 1.7, tierHeight: 2.1, sides: 8, overlap: 0.5 }) },
  pineSmall: { make: () => pineGeometry({ trunk: 0.9, tiers: 3, radius: 1.15, tierHeight: 1.6, sides: 6, overlap: 0.55 }) },
  oak: { make: () => broadleafGeometry(11, COLORS.leaf, COLORS.leafDark) },
  oakGold: { make: () => broadleafGeometry(23, COLORS.leafGold, 0xb98a37) },
  birch: { make: () => birchGeometry() },
}

// placements: [{ kind, x, y, z, rotation, scale, shade }]
export function createTrees(scene, placements) {
  const material = vertexColorMaterial({ roughness: 0.9 })
  const byKind = {}
  for (const p of placements) (byKind[p.kind] ||= []).push(p)
  const dummy = new THREE.Object3D()
  const tint = new THREE.Color()
  const meshes = []
  for (const [kind, list] of Object.entries(byKind)) {
    const mesh = new THREE.InstancedMesh(KINDS[kind].make(), material, list.length)
    mesh.castShadow = true
    mesh.receiveShadow = true
    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y - 0.12, p.z)
      dummy.rotation.set(0, p.rotation, 0)
      dummy.scale.setScalar(p.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      const s = 0.88 + p.shade * 0.22
      tint.setRGB(s, s * (0.98 + p.shade * 0.04), s * 0.98)
      mesh.setColorAt(i, tint)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    scene.add(mesh)
    meshes.push(mesh)
  }
  return meshes
}
