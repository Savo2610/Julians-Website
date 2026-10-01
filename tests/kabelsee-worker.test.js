import test from 'node:test'
import assert from 'node:assert/strict'
import { sessionPruefen } from '../worker/kabelsee.js'
import { CABLE_LENGTH } from '../src/kabelsee/world/cable-path.js'
import { CABLE } from '../src/kabelsee/config.js'

test('Kabelsee: Session muss drei Runden lang gedauert haben', () => {
  // Die Grenze von 80 s muss unter drei Runden am Seil liegen, sonst faellt
  // eine echte, schnelle Session durch.
  assert.ok(3 * CABLE_LENGTH / CABLE.speed > 80 + 5)
  assert.equal(sessionPruefen({ punkte: 7690 }, 95000), null)
  assert.match(sessionPruefen({ punkte: 7690 }, 60000), /drei Runden/)
  assert.match(sessionPruefen({ punkte: 7690 }, 30 * 60000), /zu lange/)
})

test('Kabelsee: Punkte ganzzahlig, positiv und moeglich', () => {
  assert.match(sessionPruefen({ punkte: 0 }, 95000), /Ohne Punkte/)
  assert.match(sessionPruefen({ punkte: -5 }, 95000), /fehlen/)
  assert.match(sessionPruefen({ punkte: 12.5 }, 95000), /fehlen/)
  assert.match(sessionPruefen({ punkte: '9000' }, 95000), /fehlen/)
  // 2 500 je Sekunde: in 95 s hoechstens 237 500.
  assert.equal(sessionPruefen({ punkte: 230000 }, 95000), null)
  assert.match(sessionPruefen({ punkte: 240000 }, 95000), /gehen nicht/)
  assert.match(sessionPruefen({ punkte: 260000 }, 600000), /gehen nicht/)
})
