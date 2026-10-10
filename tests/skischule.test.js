import test from 'node:test'
import assert from 'node:assert/strict'
import { Skischulgruppe, skischulzeit } from '../src/world/areas/skischule.js'

// Die Skischule wohnt in ihrer Huette (10.10.): sie kommt nur zwischen 6 und
// 16 Uhr heraus, faehrt ein paar Runden und geht wieder hinein.

const welt = { scene: { add() {} } }
const tuer = () => {
  const t = { offen: 0, setzeTuer(w) { t.offen = w } }
  return t
}

// Eine kleine Runde im Flachen: Treffpunkt, ein Stueck gehen, zurueck.
const abschnitte = [
  { art: 'gehen', tempo: 1.3, halt: 'treffpunkt', punkte: [[0, 0], [6, 0], [6, 6]] },
  { art: 'gehen', tempo: 1.3, punkte: [[6, 6], [0, 6], [0, 0]] },
]
const hutweg = [[12, 6], [12, 3], [8, 1], [0, 0]]

const laufen = (g, s, schritt = (k) => {}) => {
  for (let k = 0, t = 0; t < s; t += 1 / 30, k++) {
    g.update(1 / 30, null)
    schritt(k)
  }
}

test('Skischulzeit: von 6 bis 16 Uhr', () => {
  const um = (h) => new Date(2026, 9, 10, h, 30)
  assert.equal(skischulzeit(um(5)), false)
  assert.equal(skischulzeit(um(6)), true)
  assert.equal(skischulzeit(um(15)), true)
  assert.equal(skischulzeit(um(16)), false)
  assert.equal(skischulzeit(um(23)), false)
})

test('nachts bleibt die Huette zu', () => {
  const bild = tuer()
  const g = new Skischulgruppe(welt, { abschnitte, huette: { bild, weg: hutweg }, tag: () => false })
  laufen(g, 600)
  assert.ok(g.drinnen)
  assert.equal(bild.offen, 0)
  assert.ok(g.figuren.every((f) => !f.model.visible))
})

test('am Tag: Tuer auf, heraus, Runden, zurueck hinein, Tuer zu', () => {
  const bild = tuer()
  const g = new Skischulgruppe(welt, { abschnitte, huette: { bild, weg: hutweg }, tag: () => true })
  const verlauf = []
  let vorher = null
  let zurueck = null
  laufen(g, 900, () => {
    const z = g.drinnen ? 'drinnen' : g.raus ? 'raus' : g.ende !== null ? 'rein' : 'runde'
    if (z !== vorher) verlauf.push(z)
    // Wieder drinnen: so sieht es dann aus.
    if (z === 'drinnen' && vorher === 'rein') zurueck = { tuer: bild.offen, sichtbar: g.figuren.filter((f) => f.model.visible).length }
    vorher = z
    if (g.raus && bild.offen > 0.5) verlauf.offen = true
  })
  // Der erste Ausflug, dann wieder drinnen.
  assert.deepEqual(verlauf.slice(0, 5), ['drinnen', 'raus', 'runde', 'rein', 'drinnen'], verlauf.join(' > '))
  assert.ok(verlauf.offen, 'die Tuer ging auf')
  assert.deepEqual(zurueck, { tuer: 0, sichtbar: 0 })
})

test('herbeigerufen (alle Schneemaenner liegen) kommt sie auch nachts, und bald', () => {
  const bild = tuer()
  const g = new Skischulgruppe(welt, { abschnitte, huette: { bild, weg: hutweg }, tag: () => false })
  laufen(g, 60)
  assert.ok(g.drinnen)
  g.herbeirufen()
  let raus = null
  laufen(g, 30, (k) => { if (raus === null && !g.drinnen) raus = k / 30 })
  assert.ok(raus !== null && raus <= 10.1, `nach ${raus} s`)
})
