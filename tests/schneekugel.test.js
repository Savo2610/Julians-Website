import test from 'node:test'
import assert from 'node:assert/strict'
import { Schneekugel } from '../src/world/schneekugel.js'
import { KINDER_LANE, terrainHeight } from '../src/world/heightfield.js'

// Die Kugeln eines umgefahrenen Schneemanns (10.10.): sie rollen bergab,
// nehmen Schnee auf und bleiben im Flachen liegen.

const laufen = (k, s, welt = null) => { for (let t = 0; t < s && !k.ruht; t += 1 / 60) k.update(1 / 60, welt) }

test('auf dem Uebungshang rollt sie bergab, wird groesser und bleibt unten liegen', () => {
  // Mitten auf dem Hang, angestossen quer zum Gefaelle.
  const g = KINDER_LANE.segments[1]
  const x = g.x + g.dx * 0.5
  const z = g.z + g.dz * 0.5
  const k = new Schneekugel({ x, z, r: 0.3, hoehe: terrainHeight })
  const oben = terrainHeight(x, z)
  k.stossen(2, 0)
  let schnellste = 0
  for (let t = 0; t < 40 && !k.ruht; t += 1 / 60) {
    k.update(1 / 60)
    schnellste = Math.max(schnellste, k.tempo)
  }
  assert.ok(k.ruht, 'liegt still')
  assert.ok(terrainHeight(k.x, k.z) < oben - 2, `nur ${(oben - terrainHeight(k.x, k.z)).toFixed(1)} m tiefer`)
  assert.ok(k.r > 0.4 && k.r <= k.rMax, `Halbmesser ${k.r.toFixed(2)}`)
  // Zum Zuschauen und Nachfahren, nicht davonschiessen.
  assert.ok(schnellste < 4.5, `${schnellste.toFixed(1)} m/s`)
})

test('im Flachen rollt sie aus und waechst nicht ueber rMax', () => {
  const k = new Schneekugel({ x: 0, z: 0, r: 0.4, rMax: 0.6, hoehe: () => 0 })
  k.stossen(5, 0)
  laufen(k, 20)
  assert.ok(k.ruht)
  assert.ok(k.x > 2 && k.x < 12, `${k.x.toFixed(1)} m weit`)
  assert.ok(k.r <= 0.6)
  // Ohne Gefaelle bleibt sie liegen, wie man sie hinlegt.
  const still = new Schneekugel({ x: 0, z: 0, r: 0.4, hoehe: () => 0 })
  laufen(still, 2)
  assert.equal(still.x, 0)
})

test('an einem Hindernis prallt sie ab statt hindurchzurollen', () => {
  const welt = {
    resolve(x, z, r) {
      // Eine Wand bei x = 3.
      if (x + r <= 3) return { x, z, hit: false, pushX: 0, pushZ: 0 }
      return { x: 3 - r, z, hit: true, pushX: 3 - r - x, pushZ: 0 }
    },
  }
  const k = new Schneekugel({ x: 0, z: 0, r: 0.3, hoehe: () => 0 })
  k.stossen(4, 0)
  let weitest = 0
  for (let t = 0; t < 10 && !k.ruht; t += 1 / 60) {
    k.update(1 / 60, welt)
    weitest = Math.max(weitest, k.x + k.r * 0.8)
  }
  assert.ok(weitest <= 3.001, `bis ${weitest.toFixed(2)}`)
  assert.ok(k.x < 3 - 0.3, 'zurueckgeprallt')
})

test('ein Stoss nach oben fliegt erst und rollt dann', () => {
  const k = new Schneekugel({ x: 0, z: 0, r: 0.3, hoehe: () => 0 })
  k.stossen(2, 0, 3)
  assert.ok(k.luft)
  k.update(1 / 60)
  assert.ok(k.y > 0.3)
  laufen(k, 5)
  assert.ok(!k.luft)
  assert.ok(Math.abs(k.y - k.r) < 1e-9, 'liegt auf dem Boden')
})
