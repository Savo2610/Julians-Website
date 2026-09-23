import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { makeRng } from '../core/rng.js'
import { terrainHeight } from './heightfield.js'
import { createRocks } from './props/rocks.js'
import { CAMERA } from '../config.js'

export function createLandscapeDetails(world, trees) {
  const rng = makeRng(210927)

  // Die Quelle sitzt am oberen Seeufer. Fels, Eis und der Schneeruecken
  // erzaehlen denselben Ort; die Mitte davor bleibt als Aussicht frei.
  createRocks(world, [
    { x: -59.8, z: 24, variant: 0, scale: 2.0, stretch: 1.2, rotation: 0.7, tilt: 0.1 },
    { x: -56.9, z: 23.5, variant: 1, scale: 1.55, stretch: 1.2, rotation: 2, tilt: 0 },
    { x: -61, z: 27, variant: 2, scale: 1.1, stretch: 0.7, rotation: 1, tilt: 0.1 },
  ], 210928)
  const iceParts = []
  for (let i = 0; i < 13; i++) {
    const x = -59.8 + i * 0.22, z = 25 + Math.sin(i * 0.5) * 0.3
    const length = 0.65 + rng() * 1.15
    iceParts.push({
      geo: new THREE.ConeGeometry(0.1 + rng() * 0.09, length, 6),
      color: i % 3 ? 0xb4e1e8 : 0x7cb6c9,
      position: [x, terrainHeight(x, z) + 1.7 - length / 2, z],
      rotation: [Math.PI, 0, 0],
    })
  }
  const ice = new THREE.Mesh(assemble(iceParts), vertexColorMaterial({ roughness: 0.24, metalness: 0.08 }))
  ice.name = 'gefrorene-quelle'
  ice.castShadow = true
  world.scene.add(ice)

  // Eine Bank macht das Ufer zum Ziel. Alle vier Fuesse nehmen die lokale
  // Hoehe ab; ein gemeinsamer Bodenwert liess solche Aufbauten schweben.
  const bx = -34, bz = 25, yaw = CAMERA.azimuth
  const base = terrainHeight(bx, bz)
  const bench = []
  for (const x of [-1, 1]) for (const z of [-0.28, 0.28]) {
    const ground = terrainHeight(bx + x * Math.cos(yaw) + z * Math.sin(yaw), bz - x * Math.sin(yaw) + z * Math.cos(yaw)) - base
    const top = 0.8
    bench.push({ geo: new THREE.BoxGeometry(0.14, top - ground, 0.15), color: 0x604737, position: [x, (top + ground) / 2, z] })
  }
  for (const z of [-0.22, 0, 0.22]) bench.push({ geo: new THREE.BoxGeometry(2.7, 0.12, 0.19), color: 0x9b7150, position: [0, 0.83, z] })
  for (const x of [-1, 1]) bench.push({ geo: new THREE.BoxGeometry(0.13, 0.95, 0.13), color: 0x604737, position: [x, 1.05, -0.34] })
  bench.push({ geo: new THREE.BoxGeometry(2.7, 0.32, 0.12), color: 0x9b7150, position: [0, 1.36, -0.34] })
  bench.push({ geo: new THREE.BoxGeometry(2.72, 0.08, 0.16), color: 0xf8f4eb, position: [0, 1.56, -0.34] })
  const seat = new THREE.Mesh(assemble(bench), vertexColorMaterial())
  seat.name = 'uferbank'
  seat.castShadow = true
  world.place(seat, bx, bz, { rotation: yaw })
  world.addCollider(bx, bz, 1.4)

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
    update(dt, skier) {
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
