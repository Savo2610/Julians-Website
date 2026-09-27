import test from 'node:test'
import assert from 'node:assert/strict'
import { nameGlaetten, fahrtPruefen } from '../worker/slalom.js'

const sauber = { zeit: 4.21, fahrzeit: 4.21, verfehlt: 0, tore: [0.6, 1.8, 2.9, 3.9] }

test('Namen: Laenge, Zeichen und Sperrliste', () => {
  assert.deepEqual(nameGlaetten('  Jule  M. '), null) // Punkt ist nicht erlaubt
  assert.equal(nameGlaetten('Jule  Müller').name, 'Jule Müller')
  assert.equal(nameGlaetten('Jule Müller').schluessel, 'julemüller')
  assert.equal(nameGlaetten('J'), null)
  assert.equal(nameGlaetten('x'.repeat(17)), null)
  assert.equal(nameGlaetten('<script>'), null)
  assert.equal(nameGlaetten('F1ck-dich'), null)
  assert.equal(nameGlaetten('Sieg_Heil'), null)
  assert.ok(nameGlaetten("O'Neill-2"))
})

test('Fahrten: moeglich, stimmig und zur Serveruhr passend', () => {
  assert.equal(fahrtPruefen(sauber, 4400), null)
  assert.match(fahrtPruefen({ ...sauber, zeit: 3.2, fahrzeit: 3.2, tore: [0.5, 1.4, 2.2, 3.0] }), /schneller/)
  assert.match(fahrtPruefen({ ...sauber, zeit: 4.99 }), /Strafzeit/)
  // Jede Zeit darf hinein, auch mit Strafsekunden.
  assert.equal(fahrtPruefen({ ...sauber, zeit: 6.21, fahrzeit: 4.21, verfehlt: 1, tore: [0.6, 3.8, 4.9, 5.9] }, 4300), null)
  assert.equal(fahrtPruefen({ ...sauber, zeit: 4.95, fahrzeit: 2.95, verfehlt: 1, tore: [0.5, 2.9, 3.9, 4.8] }, 3000), 'Das ist schneller als möglich')
  assert.match(fahrtPruefen({ ...sauber, tore: [0.6, 2.9, 1.8, 3.9] }), /Zwischenzeiten/)
  assert.match(fahrtPruefen({ ...sauber, tore: [0.6, 1.8, 2.9] }), /Tore/)
  // Gemeldet 4,21, aber die Serveruhr sah neun Sekunden: geschummelt.
  assert.match(fahrtPruefen(sauber, 9000), /Uhr/)
  assert.match(fahrtPruefen(sauber, 2500), /Uhr/)
  // 4,9 s gefahren und 4,21 gemeldet: knapp, aber zu viel.
  assert.match(fahrtPruefen(sauber, 4900), /Uhr/)
})
