import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { isSnowSurface } from '../src/world/surfaces.js'
import { APRES, terraceWorld, terraceDistance, terraceHeight } from '../src/world/areas/apres-layout.js'
import { LAKE, lakeRadius, terrainHeight } from '../src/world/heightfield.js'
import { Skier } from '../src/player/skier.js'
import { createApresTerrace } from '../src/world/areas/apres-terrace.js'

test('Eis, Holz und Schnee teilen eindeutige Oberflaechengrenzen', () => {
  assert.equal(isSnowSurface(LAKE.x, LAKE.z), false)
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const r = lakeRadius(a)
    assert.equal(isSnowSurface(LAKE.x + Math.cos(a) * (r - 0.1), LAKE.z + Math.sin(a) * (r - 0.1)), false)
    assert.equal(isSnowSurface(LAKE.x + Math.cos(a) * (r + 1), LAKE.z + Math.sin(a) * (r + 1)), true)
  }
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
