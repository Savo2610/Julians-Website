import test from 'node:test'
import assert from 'node:assert/strict'
import { terrainHeight, playAreaDistance, NORTH_LANE, SLED_LANE, PARK_LANE, KINDER_LANE, SHOOT_LANE } from '../src/world/heightfield.js'
import { VALLEY_PATHS } from '../src/world/paths.js'
import { SUEDZAUN, SEEZAUN, NETZ, KETTE_NORDWEST, KETTE_NORDOST, KETTE_SEE, aufLinie } from '../src/world/grenze.js'
import { createFence } from '../src/world/props/fence.js'
import { grenzeZiehen } from '../src/world/grenzkette.js'

// Die Grenzen des Tals (08.10.): Suedzaun, Fangnetz, Ketten aus Baeumen und
// Felsen. Ob sie im ganzen Tal dicht sind, misst die Flutfuellung im Browser
// (HANDOVER 4a¹¹); hier steht, was ohne Szene zu pruefen ist.

const FAHRER = 0.55
// Weicher Rand: ab hier schiebt skier.js zurueck.
const RAND = 9

function welt() {
  const colliders = []
  return {
    colliders,
    scene: { add() {} },
    heightAt: terrainHeight,
    addCollider(x, z, r, data = null, h = Infinity) { const c = { x, z, r, data, h }; colliders.push(c); return c },
  }
}

// Kommt die Mitte des Fahrers an `p` heran, ohne einen Kreis zu beruehren?
function frei(w, p) {
  return w.colliders.every((c) => Math.hypot(c.x - p.x, c.z - p.z) >= c.r + FAHRER)
}

function entlang(linie, schritt = 0.1) {
  const out = []
  for (let i = 0; i < linie.length - 1; i++) {
    const a = linie[i], b = linie[i + 1]
    const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / schritt)
    for (let k = 0; k <= n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n })
  }
  return out
}

test('der dichte Zaun laesst nirgends durch, der alte schon', () => {
  const dicht = welt()
  createFence(dicht, SUEDZAUN, { dicht: true })
  const loecher = entlang(SUEDZAUN).filter((p) => frei(dicht, p))
  assert.equal(loecher.length, 0, `frei bei ${JSON.stringify(loecher[0])}`)

  // Gegenprobe: ohne die Kreise zwischen den Pfosten kam man durch.
  const alt = welt()
  createFence(alt, SUEDZAUN)
  assert.ok(entlang(SUEDZAUN).some((p) => frei(alt, p)))
})

test('der Suedzaun bleibt im Wald und weg von Wegen und Pisten', () => {
  const lanes = [NORTH_LANE, SLED_LANE, PARK_LANE, KINDER_LANE, SHOOT_LANE].map((l) => l.points)
  const wege = VALLEY_PATHS.map((v) => v.path.map(([x, z]) => ({ x, z })))
  // Am naechsten kommt der Stichweg zur abgestuerzten Drohne (49, 21), der am
  // Waldrand endet – dort stand schon der alte Zaun.
  const drohne = (l) => l.at(-1).x === 49 && l.at(-1).z === 21
  for (const p of entlang(SUEDZAUN, 0.5)) {
    for (const linie of [...wege, ...lanes]) {
      const d = aufLinie(linie, p.x, p.z).d
      const mind = drohne(linie) ? 7.5 : 11
      assert.ok(d > mind, `${d.toFixed(1)} m an einem Weg bei (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`)
    }
  }
  // Im dichten Teil des Waldes, nicht an seinem Saum: bis auf die Enden – am
  // Seezaun und dort, wo er in den Gebirgsrand hinauslaeuft – liegt er zwei
  // bis siebeneinhalb Meter innerhalb.
  for (const p of SUEDZAUN.slice(2, -3)) {
    const e = playAreaDistance(p.x, p.z)
    assert.ok(e > -7.5 && e < -2, `Rand ${e.toFixed(1)} bei (${p.x}, ${p.z})`)
  }
})

test('die offenen Enden reichen bis hinter den weichen Rand', () => {
  for (const [name, p] of [['Suedzaun', SUEDZAUN.at(-1)], ['Kette Nordost', KETTE_NORDOST.at(-1)], ['Kette See', KETTE_SEE.at(-1)]]) {
    const e = playAreaDistance(p.x, p.z)
    // Zwischen Ende und Rand darf keine Luecke bleiben, durch die der Fahrer passt.
    assert.ok(e > RAND + 2 * FAHRER, `${name}: Rand ${e.toFixed(1)}`)
  }
  // Die Ketten setzen an Lawinenverbauung, Netz und Seezaun an.
  assert.ok(Math.hypot(KETTE_NORDWEST[0].x + 71, KETTE_NORDWEST[0].z + 70) < 0.6)
  assert.deepEqual(KETTE_NORDWEST.at(-1), NETZ.pfosten[0])
  assert.deepEqual(KETTE_NORDOST[0], NETZ.pfosten.at(-1))
  assert.deepEqual(KETTE_SEE[0], SEEZAUN.at(-1))
  assert.deepEqual(SUEDZAUN[0], SEEZAUN[1])
})

test('hinter dem Netz faellt der Hang ab – dafuer steht es da', () => {
  for (let i = 0; i < NETZ.pfosten.length - 1; i++) {
    const a = NETZ.pfosten[i], b = NETZ.pfosten[i + 1]
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    let nx = -(b.z - a.z) / len, nz = (b.x - a.x) / len
    if ((NETZ.innen.x - mx) * nx + (NETZ.innen.z - mz) * nz < 0) { nx = -nx; nz = -nz }
    const vorn = terrainHeight(mx, mz)
    const hinten = terrainHeight(mx - nx * 8, mz - nz * 8)
    assert.ok(vorn - hinten > 3, `Feld ${i}: nur ${(vorn - hinten).toFixed(1)} m tiefer`)
  }
})

test('die Kette verbindet Staemme, fuellt Luecken mit Felsen und macht sie dicht', () => {
  const w = welt()
  const linie = [{ x: 0, z: 0 }, { x: 30, z: 0 }]
  // Drei Baeume nah an der Linie, ein Stein (ueberspringbar), eine grosse Luecke.
  w.addCollider(4, 1, 0.8)
  w.addCollider(7, -1.2, 0.7)
  const stein = w.addCollider(10, 0.5, 1.0, null, 0.6)
  w.addCollider(24, 0, 0.9)
  // Etwas abseits: gehoert nicht dazu.
  const weit = w.addCollider(15, 6, 0.9)
  const { felsen, glieder } = grenzeZiehen(w, linie)
  assert.ok(felsen.length >= 3, `${felsen.length} Felsen in 12 m Luecke`)
  assert.equal(stein.h, Infinity, 'der Stein ist nicht mehr zu ueberspringen')
  assert.ok(!glieder.some((g) => g.c === weit), 'sechs Meter abseits ist kein Glied')
  const loecher = entlang(linie).filter((p) => frei(w, p))
  assert.equal(loecher.length, 0)
})
