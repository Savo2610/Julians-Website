import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust, jitter } from '../../core/geometry.js'
import { COLORS } from '../../config.js'
import { makeRng } from '../../core/rng.js'

// Findlinge: verzogene Ikosaeder mit Schneeauflage auf den Oberseiten.

function rockGeometry(rng, blobs = 3) {
  // Findlinge aus mehreren ineinandergeschobenen, verzogenen Kugeln. Das gibt
  // rundliche Formen mit zerklueftetem Uebergang – deutlich naeher an echtem
  // Gestein als ein einzelnes verzerrtes Ikosaeder.
  const parts = []
  for (let i = 0; i < blobs; i++) {
    const geo = new THREE.IcosahedronGeometry(1, 1).toNonIndexed()
    jitter(geo, 0.34, rng)
    const sx = 0.7 + rng() * 0.65
    const sy = 0.55 + rng() * 0.45
    const sz = 0.7 + rng() * 0.65
    const spread = i === 0 ? 0 : 0.55
    parts.push({
      geo,
      color: COLORS.rock,
      scale: [sx, sy, sz],
      rotation: [rng() * 3, rng() * 3, rng() * 3],
      position: [(rng() - 0.5) * spread, (rng() - 0.5) * spread * 0.5, (rng() - 0.5) * spread],
    })
  }
  const merged = assemble(parts)
  // Nur die deutlich nach oben zeigenden Flaechen bekommen Schnee, sonst
  // verschwindet der Fels komplett im Weiss.
  snowDust(merged, 0.8, 0.55)
  return merged
}

export function createRocks(world, placements, seed = 4711) {
  const rng = makeRng(seed)
  const variants = [rockGeometry(rng, 3), rockGeometry(rng, 2), rockGeometry(rng, 4)]
  const material = vertexColorMaterial({ roughness: 0.95 })
  const groups = variants.map(() => [])
  placements.forEach((p, i) => groups[(p.variant ?? i) % variants.length].push(p))

  const dummy = new THREE.Object3D()
  const meshes = []

  variants.forEach((geo, vi) => {
    const list = groups[vi]
    if (!list.length) return
    geo.computeBoundingBox()
    const topY = geo.boundingBox.max.y
    const mesh = new THREE.InstancedMesh(geo, material, list.length)
    mesh.castShadow = true
    mesh.receiveShadow = true
    list.forEach((p, i) => {
      const s = p.scale
      // Knapp zur Haelfte eingegraben – so schwebt auch am Hang nichts.
      dummy.position.set(p.x, world.heightAt(p.x, p.z) - s * 0.46, p.z)
      dummy.rotation.set((p.tilt || 0) * 0.25, p.rotation, (p.tilt || 0) * 0.2)
      dummy.scale.set(s * (p.stretch || 1), s * 0.86, s)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // Die Blob-Form ragt weiter als der Grundradius – lieber grosszuegig,
      // sonst steckt man optisch im Fels. Die Hoehe ist die der Kuppe ueber
      // dem Boden: die meisten Steine ragen 0,3 bis 0,9 m auf und lassen sich
      // mit der Leertaste ueberspringen (Scheitel 1,14 m).
      world.addCollider(p.x, p.z, s * 1.02 * (p.stretch || 1), null, Math.max(0.2, topY * s * 0.86 - s * 0.46))
    })
    mesh.instanceMatrix.needsUpdate = true
    meshes.push(mesh)
    world.scene.add(mesh)
  })
  return meshes
}

// Ein grosser, einzeln gesetzter Fels – z.B. als Landmarke oder Sprungfelsen.
export function createBoulder(seed, scale = 3) {
  const rng = makeRng(seed)
  const geo = rockGeometry(rng, 4)
  geo.scale(scale, scale * 0.8, scale)
  const mesh = new THREE.Mesh(geo, vertexColorMaterial({ roughness: 0.95 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
