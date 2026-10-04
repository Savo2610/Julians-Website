import test from 'node:test'
import assert from 'node:assert/strict'
import { Kippreihe, Wurfteil, AUFSTEHEN } from '../src/world/areas/umstossen.js'

const laufen = (r, s, opt) => { for (let t = 0; t < s; t += 1 / 60) r.update(1 / 60, opt) }

test('Skistaender: ein Stoss am Rand nimmt die ganze Reihe mit', () => {
  const r = new Kippreihe(7)
  r.stoss(0, 1, 2.5)
  // Es dauert: nach einer Zehntelsekunde liegt noch keines.
  laufen(r, 0.1, { aufstellen: false })
  assert.equal(r.gefallen, 0)
  laufen(r, 4, { aufstellen: false })
  assert.equal(r.gefallen, 7, `gefallen: ${r.gefallen}`)
  assert.ok(r.teile.every((t) => t.winkel > 0), 'alle in Stossrichtung')
})

test('Skistaender: nacheinander, nicht alle zugleich', () => {
  const r = new Kippreihe(7)
  r.stoss(0, 1, 2.5)
  let erst = null
  let letzt = null
  for (let t = 0; t < 5; t += 1 / 60) {
    r.update(1 / 60, { aufstellen: false })
    if (erst === null && r.teile[0].winkel > 1) erst = t
    if (letzt === null && r.teile[6].winkel > 1) letzt = t
  }
  assert.ok(letzt - erst > 0.6, `Kette dauert ${(letzt - erst).toFixed(2)} s`)
})

test('Skistaender: ein Stoss in der Mitte faellt nur zu einer Seite', () => {
  const r = new Kippreihe(7)
  r.stoss(3, -1, 3)
  laufen(r, 4, { aufstellen: false })
  assert.ok(r.teile.slice(0, 4).every((t) => t.winkel < -1))
  assert.ok(r.teile.slice(4).every((t) => t.winkel === 0), 'rechts bleibt stehen')
})

test('Skistaender: ein Antippen richtet sich wieder auf', () => {
  const r = new Kippreihe(7)
  r.teile[2].w = 0.4
  laufen(r, 2, { aufstellen: false })
  assert.ok(Math.abs(r.teile[2].winkel) < 0.01)
  assert.equal(r.gefallen, 0)
})

test('Skistaender: nach einer Weile steht alles wieder', () => {
  const r = new Kippreihe(7)
  r.stoss(0, 1, 2.5)
  laufen(r, AUFSTEHEN + 3)
  assert.ok(r.steht)
})

test('Becher: fliegt, springt auf und bleibt auf der Seite liegen', () => {
  const b = new Wurfteil()
  b.werfen(0, 1, 0, 3, 2, 0, 0.5)
  let sprung = 0
  let vorher = b.vy
  for (let t = 0; t < 4 && !b.liegt; t += 1 / 60) {
    b.update(1 / 60, () => 0)
    if (vorher < 0 && b.vy > 0) sprung++
    vorher = b.vy
  }
  assert.ok(b.liegt, 'liegt')
  assert.ok(sprung >= 1, 'mindestens ein Aufspringen')
  assert.ok(b.x > 1.5 && b.x < 5, `flog ${b.x.toFixed(2)} m`)
  assert.ok(Math.abs((b.kipp % Math.PI) - Math.PI / 2) < 0.2, 'auf der Seite')
})
