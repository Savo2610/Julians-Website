import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { isSnowSurface } from '../src/world/surfaces.js'
import { APRES, terraceWorld, terraceDistance, terraceHeight } from '../src/world/areas/apres-layout.js'
import { LAKE, lakeRadius, terrainHeight, BADESTEG, BADESTEG_LAENGE, badestegLage } from '../src/world/heightfield.js'
import { Skier } from '../src/player/skier.js'
import { createApresTerrace } from '../src/world/areas/apres-terrace.js'

test('Eis, Holz und Schnee teilen eindeutige Oberflaechengrenzen', () => {
  assert.equal(isSnowSurface(LAKE.x, LAKE.z), false)
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const r = lakeRadius(a)
    assert.equal(isSnowSurface(LAKE.x + Math.cos(a) * (r - 0.1), LAKE.z + Math.sin(a) * (r - 0.1)), false)
    const ux = LAKE.x + Math.cos(a) * (r + 1), uz = LAKE.z + Math.sin(a) * (r + 1)
    // Am Badesteg liegt hinter dem Ufer Holz, siehe unten.
    if (badestegLage(ux, uz).quer < BADESTEG.halb + 1) continue
    assert.equal(isSnowSurface(ux, uz), true)
  }
  // Der Badesteg: Holz von der Boeschung bis zur Spitze, auf der ganzen
  // Breite eben und 45 cm ueber dem Eis; daneben wieder Schnee.
  for (let u = 0.2; u < BADESTEG_LAENGE; u += 0.5) {
    for (const q of [-BADESTEG.halb + 0.05, 0, BADESTEG.halb - 0.05]) {
      const r = { x: -BADESTEG.bis.z + BADESTEG.von.z, z: BADESTEG.bis.x - BADESTEG.von.x }
      const n = Math.hypot(r.x, r.z)
      const x = BADESTEG.von.x + (BADESTEG.bis.x - BADESTEG.von.x) * u / BADESTEG_LAENGE + r.x / n * q
      const z = BADESTEG.von.z + (BADESTEG.bis.z - BADESTEG.von.z) * u / BADESTEG_LAENGE + r.z / n * q
      assert.equal(isSnowSurface(x, z), false)
      if (u > 1.2) assert.ok(Math.abs(terrainHeight(x, z) - BADESTEG.hoehe) < 0.001, `Steg bei ${u.toFixed(1)} m`)
    }
  }
  assert.equal(isSnowSurface(BADESTEG.von.x + 4, BADESTEG.von.z - 2), true)

  // Vom Eis auf den Steg: nirgends steiler als 0,4. Mit dem Saum von 0,6 m
  // waren es 1,1, und das Fahrmodell warf Fahrer von der Seite 3,5 m hoch.
  const r = { x: (BADESTEG.bis.x - BADESTEG.von.x) / BADESTEG_LAENGE, z: (BADESTEG.bis.z - BADESTEG.von.z) / BADESTEG_LAENGE }
  const steilste = (x0, z0, dx, dz) => {
    let max = 0
    for (let t = 0; t < 4; t += 0.05) {
      const a = terrainHeight(x0 + dx * t, z0 + dz * t)
      const b = terrainHeight(x0 + dx * (t + 0.05), z0 + dz * (t + 0.05))
      max = Math.max(max, Math.abs(b - a) / 0.05)
    }
    return max
  }
  for (const u of [3, 4.5, 6]) {
    const mx = BADESTEG.von.x + r.x * u, mz = BADESTEG.von.z + r.z * u
    for (const s of [-1, 1]) {
      const qx = r.z * s, qz = -r.x * s
      assert.ok(steilste(mx + qx * 0.5, mz + qz * 0.5, qx, qz) < 0.4, `Seite ${s} bei ${u} m`)
    }
  }
  const sx = BADESTEG.von.x + r.x * (BADESTEG_LAENGE - 0.5), sz = BADESTEG.von.z + r.z * (BADESTEG_LAENGE - 0.5)
  assert.ok(steilste(sx, sz, r.x, r.z) < 0.4, 'vorn')
  for (const [u, v] of [[0, 2], [-6, 5], [1, 6]]) {
    const p = terraceWorld(u, v)
    assert.ok(terraceDistance(p.x, p.z) < 0)
    assert.equal(isSnowSurface(p.x, p.z), false)
    assert.ok(Math.abs(terrainHeight(p.x, p.z) - terraceHeight(p.x, p.z)) < 0.001)
  }
  assert.equal(terrainHeight(APRES.house.x, APRES.house.z), APRES.house.height)
  assert.equal(isSnowSurface(0, 30), true)
})

test('Keine Schneespuren auf Eis oder Holz; Wiedereintritt verbindet keine alte Spur', () => {
  const skier = new Skier({})
  const stamps = [], trail = { stamp: (...args) => stamps.push(args) }
  skier.speed = 8
  const move = (x, z) => { skier.position.set(x, terrainHeight(x, z), z); skier._stampTrail(trail) }
  move(0, 30); move(0, 29.8)
  assert.equal(stamps.length, 2)
  for (const p of [{x:LAKE.x,z:LAKE.z}, terraceWorld(-4, 5)]) {
    move(p.x, p.z); move(p.x + 0.1, p.z)
    assert.equal(stamps.length, 2)
  }
  move(0, 29.5)
  assert.equal(stamps.length, 2)
  move(0, 29.3)
  assert.equal(stamps.length, 4)
  assert.ok(stamps.every(([x0,z0,x1,z1]) => Math.hypot(x1-x0,z1-z0) < 0.3))
})

test('Neuer Terrassengrundriss behaelt neun bewegliche Moebel', () => {
  const terrace = createApresTerrace({ scene: new THREE.Scene(), addCollider() {} })
  assert.equal(terrace.bodies.length, 9)
  assert.ok(terrace.bodies.every(b => terraceDistance(b.x, b.z) < 0))
  const b = terrace.bodies[0]
  const skier = { position: new THREE.Vector3(b.x, terrainHeight(b.x,b.z), b.z), speed: 8, forward: new THREE.Vector3(0,0,1) }
  terrace.update(1/60, skier)
  assert.ok(terrace.hits > 0)
  skier.speed = 0
  for (let i=0;i<60;i++) terrace.update(1/60,skier)
  assert.ok(Math.hypot(b.x-b.home.x,b.z-b.home.z) > 0.1)
})
