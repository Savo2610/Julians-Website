import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { makeRng } from '../core/rng.js'
import { terrainHeight, LAKE } from './heightfield.js'
import { createRocks } from './props/rocks.js'
import { createLakeBench } from './props/lake-bench.js'
import { createFrozenFall } from './props/frozen-fall.js'
import { CAMERA } from '../config.js'

// Mitte des Eisfalls an der Quelle; die Station haengt an derselben Stelle.
export const FALL_SPOT = { x: -57.5, z: 26.4 }

export function createLandscapeDetails(world, trees) {
  const rng = makeRng(210927)

  // Die Quelle sitzt am oberen Seeufer. Fels, Eis und der Schneeruecken
  // erzaehlen denselben Ort; die Mitte davor bleibt als Aussicht frei.
  createRocks(world, [
    { x: -59.9, z: 23.9, variant: 0, scale: 1.8, stretch: 1.2, rotation: 0.7, tilt: 0.1 },
    { x: -56.2, z: 22.8, variant: 1, scale: 1.55, stretch: 1.2, rotation: 2, tilt: 0 },
    { x: -61, z: 27, variant: 2, scale: 1.1, stretch: 0.7, rotation: 1, tilt: 0.1 },
  ], 210928)
  // Zwischen den Felsen ist die Quelle mitten im Fallen erstarrt, und im
  // Eis steckt, was gerade auf broadcast.veerka.mp laeuft – siehe
  // props/frozen-fall.js. Vorher hing hier nur ein Vorhang aus 13 Zapfen.
  const fall = createFrozenFall()
  world.place(fall, FALL_SPOT.x, FALL_SPOT.z, { rotation: CAMERA.azimuth })
  for (const c of fall.userData.colliders) world.addCollider(FALL_SPOT.x + c.dx, FALL_SPOT.z + c.dz, c.r, null, 1.2)

  // Eine Bank macht das Ufer zum Ziel. Sie schaut aufs Eis und zerbricht,
  // wenn man hineinfaehrt – siehe props/lake-bench.js.
  const bx = -34, bz = 25
  const bench = createLakeBench(world, { x: bx, z: bz, yaw: Math.atan2(LAKE.x - bx, LAKE.z - bz) })

  // Ein gemeinsamer Partikelpuffer fuer alle Haine statt eines Effekts je
  // Baum. Die Sperre verhindert Dauerschnee, wenn jemand darunter parkt.
  const count = 180
  const positions = new Float32Array(count * 3)
  positions.fill(-1000)
  const life = new Float32Array(count)
  const velocity = new Float32Array(count * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
  geometry.setAttribute('life', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage))
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `attribute float life; varying float alpha;
      void main() {
        alpha = clamp(life, 0.0, 1.0);
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(95.0 / -p.z, 1.0, 9.0);
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `varying float alpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || alpha <= 0.0) discard;
        gl_FragColor = vec4(0.94, 0.98, 1.0, (1.0 - smoothstep(0.1, 0.5, d)) * alpha * 0.8);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  })
  const snow = new THREE.Points(geometry, material)
  snow.name = 'tannen-schneeschauer'
  snow.frustumCulled = false
  world.scene.add(snow)
  const sources = trees.map(t => ({ ...t, cooldown: 0 }))
  let cursor = 0, bursts = 0
  return {
    get bursts() { return bursts },
    get treeCount() { return sources.length },
    bench,
    fall,
    update(dt, skier) {
      bench.update(dt, skier)
      if (!skier) return
      for (const tree of sources) {
        tree.cooldown = Math.max(0, tree.cooldown - dt)
        if (tree.cooldown || skier.speed < 2 || Math.hypot(skier.position.x - tree.x, skier.position.z - tree.z) > 3.6) continue
        tree.cooldown = 12
        bursts++
        for (let i = 0; i < 24; i++) {
          const index = cursor++ % count, j = index * 3
          const a = rng() * Math.PI * 2, r = rng() * 1.5
          positions[j] = tree.x + Math.cos(a) * r
          positions[j + 1] = terrainHeight(tree.x, tree.z) + tree.scale * (2.3 + rng() * 1.5)
          positions[j + 2] = tree.z + Math.sin(a) * r
          velocity[j] = Math.cos(a) * (0.4 + rng())
          velocity[j + 1] = -0.4 - rng()
          velocity[j + 2] = Math.sin(a) * (0.4 + rng())
          life[index] = 1.7 + rng() * 0.8
        }
      }
      for (let i = 0; i < count; i++) {
        if (life[i] <= 0) continue
        life[i] = Math.max(0, life[i] - dt)
        const j = i * 3
        velocity[j + 1] -= dt * 1.8
        positions[j] += velocity[j] * dt
        positions[j + 1] += velocity[j + 1] * dt
        positions[j + 2] += velocity[j + 2] * dt
        if (positions[j + 1] < terrainHeight(positions[j], positions[j + 2]) + 0.08) life[i] = 0
      }
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.life.needsUpdate = true
    },
  }
}
