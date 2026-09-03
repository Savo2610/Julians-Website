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
// Kollision – man darf und soll sie ueberfahren. Und weil man das darf, sollen
// sie es auch merken: wer eine erwischt, legt sie um, und sie richtet sich
// nach ein paar Sekunden wieder auf. Dasselbe Verhalten wie bei den Fackeln
// am Startplateau, aus demselben Grund – ein Gegenstand am Wegrand, der auf
// nichts reagiert, ist eine Kulisse und kein Gegenstand.
//
// Alle Stangen einer Reihe sind eine einzige InstancedMesh. Das ist hier nicht
// nur Sparsamkeit: ein umgestossener Pfahl ist eine geaenderte Matrix, und
// eine Matrix je Instanz kostet nichts. Waeren es einzelne Meshes, haetten
// fuenfzig Pfaehle fuenfzig Zeichenaufrufe – fuer eine Randmarkierung.
//
// Die Instanzen stehen bewusst ohne Gierung. Eine Stange ist rund, die
// Drehung um die Hochachse sieht man ihr nicht an – dafuer sind ohne sie die
// Kippwinkel x und z direkt Weltrichtungen und muessen nicht zurueckgerechnet
// werden.

const POLE_HEIGHT = 1.76
const KNOCK_RADIUS = 0.62     // ab hier gilt die Stange als erwischt
const KNOCK_HOLD = 2.4        // wie lange sie liegen bleibt
const FALL_RATE = 5.0         // 1/s beim Umfallen
const RISE_RATE = 1.4         // 1/s beim Aufrichten

export function createPisteMarkers(world, points, { seed = 12, color = 0xe8703a } = {}) {
  if (!points.length) return null
  const rng = makeRng(seed)

  // Eine Stange als Geometrie, Fusspunkt im Ursprung.
  const parts = [{
    geo: new THREE.CylinderGeometry(0.032, 0.042, POLE_HEIGHT, 6),
    color: 0xe8e4dc,
    position: [0, POLE_HEIGHT / 2, 0],
  }]
  for (const rel of [0.86, 0.66]) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.044, 0.044, 0.19, 6),
      color,
      position: [0, POLE_HEIGHT * rel, 0],
    })
  }

  const mesh = new THREE.InstancedMesh(
    assemble(parts),
    vertexColorMaterial({ roughness: 0.7 }),
    points.length,
  )
  mesh.castShadow = true
  // Die Stangen kippen bis in die Waagerechte; die Huelle aus der Ruhelage
  // waere dann zu klein und die Reihe verschwaende am Bildrand.
  mesh.frustumCulled = false

  const poles = []
  const dummy = new THREE.Object3D()

  points.forEach((p, i) => {
    const pole = {
      x: p.x,
      z: p.z,
      y: terrainHeight(p.x, p.z),
      leanX: (rng() - 0.5) * 0.16,
      leanZ: (rng() - 0.5) * 0.16,
      scale: 0.92 + rng() * 0.16,
      fall: 0,
      hold: 0,
      tipX: 1,
      tipZ: 0,
    }
    poles.push(pole)
    write(i, pole)
  })

  // Die Matrix einer Stange aus ihrem Zustand. Der Fusspunkt bleibt immer
  // liegen – gekippt wird um ihn herum, nicht um die Mitte.
  function write(i, pole) {
    const a = pole.fall * (Math.PI / 2) * 0.95
    dummy.position.set(pole.x, pole.y, pole.z)
    dummy.rotation.set(pole.leanX + a * pole.tipZ, 0, pole.leanZ - a * pole.tipX)
    dummy.scale.set(1, pole.scale, 1)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  }

  mesh.instanceMatrix.needsUpdate = true
  world.scene.add(mesh)

  // Jeden Frame aus populate aufgerufen. Der Abstandstest laeuft ueber alle
  // Stangen der Reihe – bei ein paar Dutzend je Reihe ist das billiger als
  // jede Buchfuehrung, die man sich stattdessen ausdenken koennte.
  mesh.userData.update = (dt, skier) => {
    if (!skier) return
    const sx = skier.position.x
    const sz = skier.position.z
    let dirty = false

    for (let i = 0; i < poles.length; i++) {
      const pole = poles[i]
      const dx = sx - pole.x
      const dz = sz - pole.z

      if (dx * dx + dz * dz < KNOCK_RADIUS * KNOCK_RADIUS && pole.fall < 0.4) {
        const len = Math.hypot(skier.forward.x, skier.forward.z) || 1
        pole.tipX = skier.forward.x / len
        pole.tipZ = skier.forward.z / len
        pole.hold = KNOCK_HOLD
      }

      if (pole.hold > 0) {
        pole.hold -= dt
        pole.fall = Math.min(1, pole.fall + dt * FALL_RATE)
      } else if (pole.fall > 0) {
        pole.fall = Math.max(0, pole.fall - dt * RISE_RATE)
      } else {
        continue
      }
      write(i, pole)
      dirty = true
    }
    if (dirty) mesh.instanceMatrix.needsUpdate = true
  }

  return mesh
}
