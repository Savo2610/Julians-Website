import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { makeRng } from '../../core/rng.js'

// Der Zaun oben am Funpark – derselbe Weidezaun wie im Osten, nur dass man
// ihn umfahren kann. Er steht quer an der Einfahrt in den Park, genau dort,
// wo man von der Terrasse mit Tempo herunterkommt; ein Zaun, an dem man
// dort abprallt, ist eine Wand im Spielfeld. Die Seebank hat vorgemacht,
// wie es sich anfuehlt, wenn etwas nachgibt – das gilt jetzt auch hier.
//
// Gebrochen wird nicht der ganze Zaun, sondern nur das Stueck um die
// Aufprallstelle (2,6 m): Pfosten und Latten fliegen in Fahrtrichtung,
// legen sich in den Schnee und bauen sich nach 10 s wieder auf, sobald der
// Fahrer mindestens 12 m weg ist.
//
// Mit `bande` steht statt der Pfostenliste ein fertiger Satz Pfosten
// ({ x, z, h, fremd }) und gebaut wird im Stil der Slalombande: Kantholz,
// zwei breite Bretter. So bricht auch der Zaun zwischen Slalom und
// Nordabfahrt, durch den man vorher ohne Kollision hindurchfuhr. Ein
// `fremd`er Pfosten gehoert einem anderen Bauteil (dem Starttor) – dort
// haengen nur die Bretter.
//
// Pfosten und Latten sind je eine InstancedMesh: jedes Teil ist nur eine
// Matrix, der ganze Zaun kostet zwei Draw Calls statt dreissig.

const WOOD = 0x6f5038
const WOOD_LIGHT = 0x8a6543
const SNOW = 0xf7fbff
const BANDE = 0x8a6a44     // wie props/sled.js

const BREAK_SPEED = 5       // wie an der Seebank: bremsend schiebt man sich vorbei
const BREAK_REACH = 2.6
const GRAVITY = 18
const REST_AFTER = 10
const AWAY = 12
const REBUILD = 1.3
const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)

export function createBreakableFence(world, points, { spacing = 2.3, height = 1.1, seed = 5, bande = false } = {}) {
  const rng = makeRng(seed)

  // Pfostenorte wie in createFence: gleichmaessig den Polygonzug entlang.
  const spots = bande ? points.map((p) => ({ ...p })) : []
  let carry = 0
  for (let i = 0; !bande && i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const steps = Math.floor((len - carry) / spacing)
    for (let k = 0; k <= steps; k++) {
      const t = (carry + k * spacing) / len
      if (t > 1) break
      spots.push({ x: a.x + dx * t, z: a.z + dz * t })
    }
    carry = Math.max(0, (carry + (steps + 1) * spacing) - len)
  }

  // Einheitsformen, die je Teil skaliert werden. Die Schneehaube sitzt fest
  // auf dem Pfosten und fliegt mit.
  const postGeo = assemble(bande ? [
    { geo: new THREE.BoxGeometry(0.13, 1, 0.13), color: BANDE },
    { geo: new THREE.BoxGeometry(0.17, 0.065, 0.17), color: SNOW, position: [0, 0.47, 0] },
  ] : [
    { geo: new THREE.CylinderGeometry(0.06, 0.08, 1, 6), color: WOOD },
    { geo: new THREE.CylinderGeometry(0.075, 0.06, 0.065, 6), color: SNOW, position: [0, 0.5, 0] },
  ])
  const railGeo = assemble([bande
    ? { geo: new THREE.BoxGeometry(1, 0.16, 0.05), color: BANDE }
    : { geo: new THREE.BoxGeometry(1, 0.075, 0.05), color: WOOD_LIGHT }])
  const latten = bande ? [0.78, 0.42] : [0.72, 0.4]
  const material = vertexColorMaterial({ roughness: 0.9 })

  const pieces = []
  const _e = new THREE.Euler()
  const piece = (kind, slot, pos, quat, scale, rest) => pieces.push({
    kind, slot,
    home: pos.clone(), homeQ: quat.clone(), scale,
    pos: pos.clone(), q: quat.clone(),
    from: new THREE.Vector3(), fromQ: new THREE.Quaternion(),
    v: new THREE.Vector3(), spin: new THREE.Vector3(),
    rest, state: 'ganz', timer: 0,
  })

  spots.forEach((p, i) => {
    const ground = terrainHeight(p.x, p.z)
    const h = bande ? p.h : height * (0.88 + rng() * 0.24)
    p.h = h
    p.y = ground
    if (p.fremd) return
    const next = spots[i + 1]
    const angle = next ? Math.atan2(next.x - p.x, next.z - p.z) : spots[i - 1] ? Math.atan2(p.x - spots[i - 1].x, p.z - spots[i - 1].z) : 0
    const q = new THREE.Quaternion().setFromEuler(_e.set((rng() - 0.5) * 0.16, angle, (rng() - 0.5) * 0.12))
    piece('post', i, new THREE.Vector3(p.x, ground + h / 2 - 0.12, p.z), q, new THREE.Vector3(1, h, 1), 0.08)
  })
  spots.forEach((p, i) => {
    const next = spots[i + 1]
    if (!next) return
    const dx = next.x - p.x
    const dz = next.z - p.z
    const span = Math.hypot(dx, dz)
    const pitch = Math.atan2(next.y - p.y, span)
    const q = new THREE.Quaternion().setFromEuler(_e.set(0, Math.atan2(dx, dz) + Math.PI / 2, pitch, 'XYZ'))
    const h = (p.h + next.h) / 2
    for (const rel of latten) {
      piece('rail', i, new THREE.Vector3((p.x + next.x) / 2, (p.y + next.y) / 2 + h * rel - 0.12, (p.z + next.z) / 2), q,
        new THREE.Vector3(span + 0.1, 1, 1), 0.04)
    }
  })

  const posts = pieces.filter((p) => p.kind === 'post')
  const rails = pieces.filter((p) => p.kind === 'rail')
  const meshes = [[posts, postGeo], [rails, railGeo]].map(([list, geo]) => {
    const mesh = new THREE.InstancedMesh(geo, material, list.length)
    mesh.castShadow = true
    mesh.receiveShadow = true
    // Umherfliegende Teile verlassen die Huelle der Ruhelage.
    mesh.frustumCulled = false
    world.scene.add(mesh)
    return mesh
  })

  const _m = new THREE.Matrix4()
  const write = () => {
    ;[posts, rails].forEach((list, k) => {
      list.forEach((p, i) => meshes[k].setMatrixAt(i, _m.compose(p.pos, p.q, p.scale)))
      meshes[k].instanceMatrix.needsUpdate = true
    })
  }
  write()

  // Kollision: jeder Pfosten und das Innere jedes Lattenfelds. Nur Pfosten
  // liessen zwischen sich 0,4 m Luft, durch die der Fahrer schluepfte.
  let skier = null
  const colliders = []
  const addHit = (x, z, slot) => {
    const c = world.addCollider(x, z, 0.4, {
      // true = zerbrochen: der Fahrer wird dann nicht zurueckgeschoben,
      // sondern faehrt hindurch (siehe World.resolve).
      onHit: () => {
        // Auch Tiere laufen durch resolve(); bricht nur, wo der Fahrer ist.
        if (c.off || !skier || skier.speed < BREAK_SPEED) return false
        if (Math.hypot(skier.position.x - x, skier.position.z - z) > 1.5) return false
        smash(x, z, skier)
        return true
      },
    })
    c.slot = slot
    colliders.push(c)
  }
  spots.forEach((p, i) => {
    if (!p.fremd) addHit(p.x, p.z, i)
    const next = spots[i + 1]
    if (!next) return
    // Alle 1,2 m ein Kreis: am Funpark ist das die Feldmitte, an der Bande
    // (3,6 m Feld) sind es zwei.
    const n = Math.max(2, Math.ceil(Math.hypot(next.x - p.x, next.z - p.z) / 1.2))
    for (let k = 1; k < n; k++) addHit(p.x + (next.x - p.x) * k / n, p.z + (next.z - p.z) * k / n, i)
  })

  function smash(x, z, s) {
    const fx = s.forward.x * s.speed
    const fz = s.forward.z * s.speed
    for (const p of pieces) {
      if (Math.hypot(p.home.x - x, p.home.z - z) > BREAK_REACH) continue
      if (p.state === 'kaputt') { p.timer = 0; continue }
      p.state = 'kaputt'
      p.timer = 0
      p.v.set(
        fx * (0.3 + Math.random() * 0.3) + (Math.random() - 0.5) * 2.5,
        3 + Math.random() * 3.5,
        fz * (0.3 + Math.random() * 0.3) + (Math.random() - 0.5) * 2.5,
      )
      p.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14)
    }
    for (const c of colliders) {
      if (Math.hypot(c.x - x, c.z - z) <= BREAK_REACH) c.off = true
    }
  }

  const _q = new THREE.Quaternion()
  const _fix = new THREE.Quaternion()
  const _a = new THREE.Vector3()
  const _h = new THREE.Vector3()

  return {
    meshes,
    get broken() { return pieces.some((p) => p.state !== 'ganz') },
    update(dt, s) {
      skier = s
      let dirty = false
      const dist = (x, z) => (s ? Math.hypot(s.position.x - x, s.position.z - z) : Infinity)

      for (const p of pieces) {
        if (p.state === 'ganz') continue
        dirty = true
        p.timer += dt
        if (p.state === 'kaputt') {
          p.v.y -= GRAVITY * dt
          p.pos.addScaledVector(p.v, dt)
          const floor = terrainHeight(p.pos.x, p.pos.z) + p.rest
          if (p.pos.y <= floor + 0.01) {
            // Wie an der Seebank: kaum Rueckprall, viel Reibung, und die
            // Laengsachse legt sich in die Waagerechte.
            p.pos.y = floor
            p.v.y = Math.abs(p.v.y) > 2 ? -p.v.y * 0.2 : 0
            p.v.x *= 1 - Math.min(1, 6 * dt)
            p.v.z *= 1 - Math.min(1, 6 * dt)
            p.spin.multiplyScalar(1 - Math.min(1, 8 * dt))
            _a.copy(p.kind === 'post' ? UP : RIGHT).applyQuaternion(p.q)
            _h.set(_a.x, 0, _a.z)
            if (_h.lengthSq() < 1e-4) _h.set(1, 0, 0)
            _fix.setFromUnitVectors(_a, _h.normalize())
            p.q.premultiply(_q.identity().slerp(_fix, Math.min(1, 6 * dt)))
          }
          _q.setFromEuler(_e.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt))
          p.q.multiply(_q)
          if (p.timer > REST_AFTER && dist(p.home.x, p.home.z) > AWAY) {
            p.state = 'baut'
            p.timer = 0
            p.from.copy(p.pos)
            p.fromQ.copy(p.q)
          }
          continue
        }
        // Rueckflug im Bogen an den alten Platz.
        const t = Math.min(1, p.timer / REBUILD)
        const k = t * t * (3 - 2 * t)
        p.pos.lerpVectors(p.from, p.home, k)
        p.pos.y += Math.sin(k * Math.PI) * 1.2
        p.q.slerpQuaternions(p.fromQ, p.homeQ, k)
        if (t >= 1) p.state = 'ganz'
      }

      // Die Kollision kommt erst zurueck, wenn das Feld wieder steht und der
      // Fahrer nicht gerade darin – sonst wuerde er herausgeschleudert.
      for (const c of colliders) {
        if (!c.off) continue
        const standing = pieces.every((p) => p.slot !== c.slot || p.state === 'ganz')
        if (standing && dist(c.x, c.z) > 2.2) c.off = false
      }
      if (dirty) write()
    },
  }
}
