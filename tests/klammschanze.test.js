import test from 'node:test'
import assert from 'node:assert/strict'
import { Skier } from '../src/player/skier.js'
import { terrainHeight, SCHANZE, schanzeLage, klammAt, BRUECKE } from '../src/world/heightfield.js'

// Die Schanze ueber die Klamm auf der Nordabfahrt (04.10.). Gefahren wird ohne
// Szene und ohne Hindernisse, nur auf dem Gelaende – wie in sprung.test.js.

const welt = { resolve: (x, z) => ({ x, z, hit: false, pushX: 0, pushZ: 0 }), heightAt: terrainHeight }

function eingabe() {
  let jetzt = new Set()
  let vorher = new Set()
  return {
    setze(t) { vorher = jetzt; jetzt = new Set(t) },
    has: (a) => jetzt.has(a),
    justPressed: (a) => jetzt.has(a) && !vorher.has(a),
    justReleased: (a) => !jetzt.has(a) && vorher.has(a),
    get steer() { return 0 },
    get throttle() { return jetzt.has('forward') ? 1 : 0 },
    get braking() { return false },
  }
}

// Faehrt 14 m vor der Kante los, gerade auf die Schanze zu. `druck`: ab
// welchem Abstand zur Kante die Leertaste liegt (null = nie).
function springe({ tempo = 13, gas = true, druck = null } = {}) {
  const s = new Skier(welt)
  s.versetzen(SCHANZE.x - SCHANZE.dx * 14, SCHANZE.z - SCHANZE.dz * 14, Math.atan2(SCHANZE.dx, SCHANZE.dz))
  s.speed = tempo
  const inp = eingabe()
  let flog = false
  for (let i = 0; i < 900; i++) {
    const { u } = schanzeLage(s.position.x, s.position.z)
    const tasten = gas ? ['forward'] : []
    if (druck !== null && u >= druck && u < druck + 3) tasten.push('jump')
    inp.setze(tasten)
    s.update(1 / 60, inp, null)
    if (s.airborne) flog = true
    if (flog && !s.airborne) {
      return { weite: schanzeLage(s.position.x, s.position.z).u, klamm: klammAt(s.position.x, s.position.z) }
    }
  }
  return null
}

test('mit W kommt man ueber die Klamm, mit Pop an der Kante weiter', () => {
  const w = springe()
  const pop = springe({ druck: -0.6 })
  assert.ok(w.weite > SCHANZE.drueben + 2, `mit W ${w.weite.toFixed(1)} m`)
  assert.ok(pop.weite > w.weite + 2, `Pop ${pop.weite.toFixed(1)} gegen ${w.weite.toFixed(1)} m`)
  assert.ok(pop.weite < SCHANZE.drueben + SCHANZE.landung, 'landet noch auf dem Landehuegel')
})

test('wer ausrollt, landet in der Klamm', () => {
  const r = springe({ tempo: 7, gas: false })
  assert.ok(r, 'gelandet')
  assert.ok(r.klamm < -0.4, `in der Rinne (${r.klamm.toFixed(2)})`)
})

test('der Steg traegt: auf seiner Mittellinie schneidet die Klamm nicht', () => {
  const e = BRUECKE.ebene
  for (let o = -e.laenge / 2; o <= e.laenge / 2; o += 0.5) {
    const x = BRUECKE.x + e.ux * o
    const z = BRUECKE.z + e.uz * o
    assert.ok(Math.abs(klammAt(x, z)) < 1e-9, `bei ${o} m geschnitten`)
  }
})
