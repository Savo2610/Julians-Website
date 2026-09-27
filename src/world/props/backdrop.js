import * as THREE from 'three'
import { makeRng } from '../../core/rng.js'
import { assemble } from '../../core/geometry.js'

// Ferne Gipfelkulisse. Sie steht weit ausserhalb der begehbaren Welt, hat
// keine Kollision und ist unbeleuchtet: der Farbverlauf von dunstig-hell unten
// nach kuehl oben ist einfach in die Vertex-Farben gemalt. Das gibt dem kleinen
// Tal Tiefe, ohne die Sicht auf den Himmel zu nehmen.

export function createBackdrop(scene, { fogColor }) {
  const rng = makeRng(6180)
  const haze = new THREE.Color(fogColor)
  const parts = []

  const rings = [
    { radius: 255, count: 18, minH: 38, maxH: 68, width: 68, mix: 0.5 },
    { radius: 320, count: 14, minH: 50, maxH: 90, width: 94, mix: 0.72 },
    { radius: 400, count: 11, minH: 62, maxH: 112, width: 126, mix: 0.86 },
  ]

  for (const ring of rings) {
    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + rng() * 0.35
      const dist = ring.radius * (0.9 + rng() * 0.22)
      const height = ring.minH + rng() * (ring.maxH - ring.minH)
      const width = ring.width * (0.55 + rng() * 0.7)

      // Eine Bergsilhouette aus zwei versetzten Pyramiden – reicht voellig,
      // weil man sie nur als Umriss wahrnimmt.
      const sides = 4 + Math.floor(rng() * 3)
      const geo = new THREE.ConeGeometry(width * 0.5, height, sides, 2)
      geo.scale(1, 1, 0.55 + rng() * 0.35)

      const base = haze.clone().lerp(new THREE.Color(0xa9c0da), 1 - ring.mix)
      parts.push({
        geo,
        color: base.getHex(),
        position: [Math.cos(angle) * dist, height * 0.42 - 8, Math.sin(angle) * dist],
        rotation: [0, rng() * Math.PI, (rng() - 0.5) * 0.12],
      })
    }
  }

  const geometry = assemble(parts)

  // Hoehenabhaengiger Dunst: unten geht der Berg in den Nebel ueber.
  const pos = geometry.attributes.position
  const col = geometry.attributes.color
  const snow = new THREE.Color(0xfaf7f2)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const fade = THREE.MathUtils.smoothstep(y, -6, 46)
    const c = new THREE.Color(col.getX(i), col.getY(i), col.getZ(i))
    c.lerp(haze, 1 - fade * 0.68)
    // Schneekappen auf den Spitzen.
    c.lerp(snow, THREE.MathUtils.smoothstep(y, 34, 76) * 0.7)
    col.setXYZ(i, c.r, c.g, c.b)
  }
  col.needsUpdate = true

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: true }),
  )
  mesh.name = 'backdrop'
  mesh.frustumCulled = false
  mesh.renderOrder = -1
  scene.add(mesh)
  return mesh
}
