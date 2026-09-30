import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CABLE_LENGTH, cableAt, nearestS, wrap } from '../src/world/cable-path.js'
import { lakeDistance, islandDistance, terrainHeight, waterDepth } from '../src/world/heightfield.js'
import { FEATURES, DOCK, BUOYS, RINGS, surfaceAt } from '../src/world/features.js'
import { CABLE } from '../src/config.js'

test('Kabelbahn ist geschlossen und gleichmaessig', () => {
  const a = cableAt(0)
  const b = cableAt(CABLE_LENGTH - 0.01)
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.1, 'Anfang und Ende treffen sich')
  let prev = cableAt(0)
  for (let s = 0.5; s < CABLE_LENGTH; s += 0.5) {
    const c = cableAt(s)
    const step = Math.hypot(c.x - prev.x, c.z - prev.z)
    assert.ok(step > 0.45 && step < 0.55, `Schritt bei s=${s} ist ${step}`)
    prev = c
  }
})

test('nearestS findet die Bogenlaenge wieder', () => {
  for (const s of [3, 120, 260, 400]) {
    const c = cableAt(s)
    const found = nearestS(c.x, c.z)
    const d = Math.abs(wrap(found - s + CABLE_LENGTH / 2) - CABLE_LENGTH / 2)
    assert.ok(d < 1, `s=${s} gefunden als ${found}`)
  }
})

// Der Fahrer haengt 17 m hinter dem Mitnehmer und kann gut 15 m nach aussen
// schwingen. Die Bahn muss also ueberall Wasser um sich haben.
test('Bahn hat Abstand zu Ufer und Insel', () => {
  for (let s = 0; s < CABLE_LENGTH; s += 1) {
    const c = cableAt(s)
    const nearDock = Math.hypot(c.x - DOCK.x, c.z - DOCK.z) < 14
    if (!nearDock) assert.ok(lakeDistance(c.x, c.z) > 16, `Ufer zu nah bei s=${s}`)
    assert.ok(islandDistance(c.x, c.z) < -24, `Insel zu nah bei s=${s}`)
    assert.ok(waterDepth(c.x, c.z) > 1.5, `zu flach bei s=${s}`)
  }
})

test('Hindernisse stehen im tiefen Wasser', () => {
  for (const f of FEATURES) {
    for (const u of [0, f.length / 2, f.length]) {
      const x = f.x + f.dx * u
      const z = f.z + f.dz * u
      assert.ok(waterDepth(x, z) > 1, `${f.id} steht im Flachen`)
    }
  }
})

test('Schanzen sind von der Bahn aus befahrbar', () => {
  for (const f of FEATURES) {
    const mid = { x: f.x + f.dx * f.length * 0.6, z: f.z + f.dz * f.length * 0.6 }
    const hit = surfaceAt(mid.x, mid.z)
    assert.equal(hit.feature, f)
    assert.ok(hit.h > 0)
  }
})

test('Sammelsachen liegen im Wasser, Ringe in der Luft', () => {
  assert.ok(BUOYS.length >= 30)
  for (const b of BUOYS) assert.ok(waterDepth(b.x, b.z) > 0.5, `Boje ${b.id} liegt auf dem Trockenen`)
  for (const r of RINGS) assert.ok(r.y > 2, `Ring ${r.id} haengt zu tief`)
})

test('Station und Steg: der Steg reicht bis kurz vor die Bahn', () => {
  const tip = { x: DOCK.x, z: DOCK.z }
  const s = nearestS(tip.x, tip.z)
  const c = cableAt(s)
  const d = Math.hypot(c.x - tip.x, c.z - tip.z)
  assert.ok(d > 3 && d < 8, `Stegspitze ${d.toFixed(1)} m von der Bahn`)
  assert.ok(terrainHeight(DOCK.x, DOCK.z - DOCK.length) > -0.6, 'Steg endet an Land')
  assert.ok(CABLE.ropeLength > d)
})
