import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'

// Die Bank am See. Sie schaut auf das Eis und nicht zur Kamera – eine Bank
// am Ufer, die dem Wasser den Ruecken zukehrt, ist keine Aussichtsbank.
// Von oben sieht man sie dadurch schraeg von hinten, und genau so liest man
// sie auch: jemand koennte hier sitzen und aufs Eis schauen.
//
// Wer mit Tempo hineinfaehrt, zerlegt sie. Die zehn Bretter und Pfosten
// fliegen in Fahrtrichtung davon, rutschen im Schnee aus und bleiben
// liegen. Ist man weit genug weg, setzt sie sich von selbst wieder
// zusammen – im Spielzeugtal bleibt nichts kaputt, und eine Bank, die nur
// einmal zerbricht, hat der zweite Besucher schon verpasst.

const WOOD = 0x9b7150
const WOOD_DARK = 0x604737
const SNOW = 0xf8f4eb

// Unter 5 m/s schiebt man sich an der Bank vorbei, darueber zerbricht sie.
// Das Grundtempo ist 13: wer bremsend heranrutscht, laesst sie stehen.
const BREAK_SPEED = 5
const GRAVITY = 18
const REST_AFTER = 12       // s, bevor sie sich wieder aufbaut ...
const AWAY = 14             // ... und nur, wenn der Fahrer so weit weg ist
const REBUILD = 1.3         // s fuer den Rueckflug
const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)

export function createLakeBench(world, { x: bx, z: bz, yaw }) {
  const base = terrainHeight(bx, bz)
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  // Lokal -> Welt, genau wie rotation.y es rechnet.
  const toWorld = (lx, lz) => [bx + lx * cos + lz * sin, bz - lx * sin + lz * cos]

  const group = new THREE.Group()
  group.name = 'uferbank'
  group.position.set(bx, base, bz)
  group.rotation.y = yaw
  world.scene.add(group)

  const material = vertexColorMaterial({ roughness: 0.85 })
  const pieces = []
  const piece = (parts, home) => {
    const geo = assemble(parts)
    snowDust(geo, 0.3, 0.8)
    const mesh = new THREE.Mesh(geo, material)
    mesh.castShadow = true
    mesh.position.set(...home)
    group.add(mesh)
    // Halbe Hoehe fuer den Bodenkontakt nach dem Sturz; grob, aber ein
    // liegendes Brett ist nie hoeher als seine kuerzeste Kante.
    geo.computeBoundingBox()
    const size = geo.boundingBox.getSize(new THREE.Vector3())
    pieces.push({
      mesh, home: new THREE.Vector3(...home), rest: Math.min(size.x, size.y, size.z) / 2,
      // Pfosten sind hoch, Bretter breit – das entscheidet, wie sie liegen.
      standing: size.y > size.x,
      v: new THREE.Vector3(), spin: new THREE.Vector3(),
      from: new THREE.Vector3(), fromQ: new THREE.Quaternion(),
    })
  }

  // Alle vier Fuesse nehmen die lokale Hoehe ab; ein gemeinsamer Bodenwert
  // liess solche Aufbauten schweben.
  for (const lx of [-1, 1]) for (const lz of [-0.28, 0.28]) {
    const ground = terrainHeight(...toWorld(lx, lz)) - base
    const top = 0.8
    piece([{ geo: new THREE.BoxGeometry(0.14, top - ground, 0.15), color: WOOD_DARK }], [lx, (top + ground) / 2, lz])
  }
  for (const lz of [-0.22, 0, 0.22]) {
    piece([{ geo: new THREE.BoxGeometry(2.7, 0.12, 0.19), color: WOOD }], [0, 0.83, lz])
  }
  for (const lx of [-1, 1]) {
    piece([{ geo: new THREE.BoxGeometry(0.13, 0.95, 0.13), color: WOOD_DARK }], [lx, 1.05, -0.34])
  }
  piece([
    { geo: new THREE.BoxGeometry(2.7, 0.32, 0.12), color: WOOD },
    { geo: new THREE.BoxGeometry(2.72, 0.08, 0.16), color: SNOW, position: [0, 0.2, 0] },
  ], [0, 1.36, -0.34])

  // Die Kollision haengt an der Bank und faellt mit ihr weg.
  let state = 'ganz'          // ganz | kaputt | baut
  let timer = 0
  let skier = null
  const collider = world.addCollider(bx, bz, 1.4, {
    onHit: () => {
      if (state !== 'ganz' || !skier || skier.speed < BREAK_SPEED) return
      smash(skier)
    },
  })

  const _q = new THREE.Quaternion()
  const _fix = new THREE.Quaternion()
  const _e = new THREE.Euler()
  const _a = new THREE.Vector3()
  const _h = new THREE.Vector3()
  function smash(s) {
    state = 'kaputt'
    timer = 0
    collider.off = true
    // Fahrtrichtung ins lokale System der Bank drehen.
    const fx = s.forward.x * s.speed
    const fz = s.forward.z * s.speed
    const lvx = fx * cos - fz * sin
    const lvz = fx * sin + fz * cos
    for (const p of pieces) {
      const spread = p.home.x * 0.9
      p.v.set(
        lvx * (0.3 + Math.random() * 0.25) + spread + (Math.random() - 0.5) * 2,
        3 + Math.random() * 3.5 + p.home.y * 1.5,
        lvz * (0.3 + Math.random() * 0.25) + (Math.random() - 0.5) * 2,
      )
      p.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 14)
    }
  }

  return {
    get broken() { return state !== 'ganz' },
    smash: (s) => smash(s),
    update(dt, s) {
      skier = s
      const dist = s ? Math.hypot(s.position.x - bx, s.position.z - bz) : Infinity
      // Stand der Fahrer beim Wiederaufbau in der Bank, bleibt die Kollision
      // aus, bis er draussen ist – sonst wuerde er aus ihr herausgeschleudert.
      if (collider.off && state === 'ganz' && dist >= 2.2) collider.off = false
      if (state === 'ganz') return
      timer += dt

      if (state === 'kaputt') {
        for (const p of pieces) {
          const m = p.mesh
          p.v.y -= GRAVITY * dt
          m.position.addScaledVector(p.v, dt)
          const [wx, wz] = toWorld(m.position.x, m.position.z)
          const floor = terrainHeight(wx, wz) - base + p.rest
          if (m.position.y <= floor + 0.01) {
            // Aufprall im Schnee: kaum Rueckprall, viel Reibung, und die
            // Drehung legt das Brett flach statt es ewig kreiseln zu lassen.
            m.position.y = floor
            p.v.y = Math.abs(p.v.y) > 2 ? -p.v.y * 0.2 : 0
            p.v.x *= 1 - Math.min(1, 6 * dt)
            p.v.z *= 1 - Math.min(1, 6 * dt)
            p.spin.multiplyScalar(1 - Math.min(1, 8 * dt))
            // Die Laengsachse in die Waagerechte kippen, sonst steckt ein
            // Pfosten wie ein Zaunpfahl im Schnee. Ueber die Achse und nicht
            // ueber Eulerwinkel: die rasten bei schraegen Lagen nicht ein.
            _a.copy(p.standing ? UP : RIGHT).applyQuaternion(m.quaternion)
            _h.set(_a.x, 0, _a.z)
            if (_h.lengthSq() < 1e-4) _h.set(1, 0, 0)
            _fix.setFromUnitVectors(_a, _h.normalize())
            m.quaternion.premultiply(_q.identity().slerp(_fix, Math.min(1, 6 * dt)))
          }
          _q.setFromEuler(_e.set(p.spin.x * dt, p.spin.y * dt, p.spin.z * dt))
          m.quaternion.multiply(_q)
        }
        if (timer > REST_AFTER && dist > AWAY) {
          state = 'baut'
          timer = 0
          for (const p of pieces) {
            p.from.copy(p.mesh.position)
            p.fromQ.copy(p.mesh.quaternion)
          }
        }
        return
      }

      // Rueckflug: jedes Teil hebt im Bogen ab und landet an seinem Platz.
      const t = Math.min(1, timer / REBUILD)
      const k = t * t * (3 - 2 * t)
      for (const p of pieces) {
        p.mesh.position.lerpVectors(p.from, p.home, k)
        p.mesh.position.y += Math.sin(k * Math.PI) * 1.2
        p.mesh.quaternion.slerpQuaternions(p.fromQ, _q.identity(), k)
      }
      if (t >= 1) state = 'ganz'
    },
  }
}
