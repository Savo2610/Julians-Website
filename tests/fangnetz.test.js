import test from 'node:test'
import assert from 'node:assert/strict'
import { Skier } from '../src/player/skier.js'
import { terrainHeight } from '../src/world/heightfield.js'
import { Fangnetz } from '../src/world/attractions/fangnetz.js'
import { NETZ } from '../src/world/grenze.js'

// Das Fangnetz an der Nordabfahrt (08.10.): hineinfahren, einsinken,
// zurueckgeworfen werden. Gefahren wird ohne Szene und ohne Hindernisse, in
// derselben Reihenfolge wie in main.js: Netz, Fahrer, Netz pruefen.

const welt = { resolve: (x, z) => ({ x, z, hit: false, pushX: 0, pushZ: 0 }), heightAt: terrainHeight }

function eingabe(tasten = ['forward']) {
  const t = new Set(tasten)
  return {
    has: (a) => t.has(a),
    justPressed: () => false,
    justReleased: () => false,
    get steer() { return 0 },
    get throttle() { return t.has('forward') ? 1 : 0 },
    get braking() { return false },
  }
}

// Faehrt aus `abstand` Metern auf ein Feld zu, mit `winkel` gegen die
// Senkrechte. Gibt den Verlauf zurueck.
function fahre({ feld = 1, anteil = 0.5, tempo = 13, abstand = 4, winkel = 0, gas = true, bilder = 240 } = {}) {
  const netz = new Fangnetz(NETZ)
  const f = netz.felder[feld]
  const u = f.len * anteil
  const s = new Skier(welt)
  s.versetzen(f.a.x + f.tx * u + f.nx * abstand, f.a.z + f.tz * u + f.nz * abstand, Math.atan2(-f.nx, -f.nz) + winkel)
  s.speed = tempo
  const inp = eingabe(gas ? ['forward'] : [])
  const dt = 1 / 60
  const verlauf = { gefangen: null, losgelassen: null, tiefe: 0, rein: 0, raus: 0, netz, s, f, minD: Infinity }
  netz.gefangen = (g) => { verlauf.rein = g.v }
  netz.losgelassen = ({ raus }) => { verlauf.raus = raus }
  for (let i = 0; i < bilder; i++) {
    netz.update(dt, s)
    s.update(dt, inp, null)
    netz.pruefen(s)
    if (netz.fang && verlauf.gefangen === null) verlauf.gefangen = i
    if (!netz.fang && verlauf.gefangen !== null && verlauf.losgelassen === null) verlauf.losgelassen = i
    if (netz.fang) verlauf.tiefe = Math.max(verlauf.tiefe, netz.fang.p)
    const l = netz.lage(s.position.x, s.position.z)
    if (l) verlauf.minD = Math.min(verlauf.minD, l.d)
  }
  return verlauf
}

test('wer mit Grundtempo ins Netz faehrt, sinkt ein und wird zurueckgeworfen', () => {
  const v = fahre({ tempo: 13 })
  assert.ok(v.gefangen !== null, 'gefangen')
  assert.ok(v.losgelassen !== null, 'losgelassen')
  // Gut anderthalb Meter tief: sichtbar, aber nicht bis in die Felsen dahinter.
  assert.ok(v.tiefe > 1.2 && v.tiefe < 2.3, `Tiefe ${v.tiefe.toFixed(2)}`)
  // Zurueck mit gut drei Vierteln des Tempos, das hineinging.
  assert.ok(v.raus > v.rein * 0.6 && v.raus < v.rein, `rein ${v.rein.toFixed(1)}, raus ${v.raus.toFixed(1)}`)
  // Eine knappe halbe Sekunde im Netz.
  const dauer = (v.losgelassen - v.gefangen) / 60
  assert.ok(dauer > 0.3 && dauer < 0.8, `${dauer.toFixed(2)} s`)
  assert.equal(v.s.tow, null)
  // Danach faehrt er weg vom Netz, nicht hinein.
  const l = v.netz.lage(v.s.position.x, v.s.position.z)
  assert.ok(!l || l.d > 2, `danach ${l?.d.toFixed(2)} m vor dem Netz`)
  // Und steht nie weiter dahinter, als das Netz nachgibt.
  assert.ok(v.minD > -2.3, `hoechstens ${(-v.minD).toFixed(2)} m hinter der Linie`)
})

test('auch langsam wird man sichtbar zurueckgeschubst', () => {
  const v = fahre({ tempo: 3, gas: false, abstand: 1.6 })
  assert.ok(v.gefangen !== null, 'gefangen')
  assert.ok(v.raus >= 3.5, `raus ${v.raus.toFixed(1)}`)
})

test('schnell hinein: das Netz haelt, ohne zu reissen', () => {
  const v = fahre({ tempo: 24, abstand: 6 })
  assert.ok(v.gefangen !== null)
  assert.ok(v.tiefe < 2.9, `Tiefe ${v.tiefe.toFixed(2)}`)
  assert.ok(v.raus <= 15)
})

test('schraeg hinein: man wird schraeg zurueckgeworfen und bleibt im Feld', () => {
  const v = fahre({ tempo: 13, winkel: -0.5, anteil: 0.4 })
  assert.ok(v.gefangen !== null)
  assert.ok(v.losgelassen !== null)
  assert.ok(v.minD > -2.3)
})

test('nach dem Abwurf dreht sich die Figur in die Fahrtrichtung', () => {
  const v = fahre({ tempo: 13, bilder: 0 })
  const { netz, s } = v
  const inp = eingabe(['forward'])
  let abwurf = null
  for (let i = 0; i < 200; i++) {
    netz.update(1 / 60, s)
    s.update(1 / 60, inp, null)
    netz.pruefen(s)
    if (abwurf === null && netz.fang === null && s.spin !== 0 && Math.abs(s.spin) > 1) abwurf = i
  }
  assert.ok(abwurf !== null, 'beim Abwurf schaut er noch ins Netz (spin ≈ ±π)')
  assert.ok(Math.abs(s.spin) < 0.05, `spin danach ${s.spin.toFixed(2)}`)
})

test('ohne Fahrer schwingt das Netz aus und kommt zur Ruhe', () => {
  const netz = new Fangnetz(NETZ)
  netz.felder[0].tempo = -4
  let max = 0
  for (let i = 0; i < 60; i++) { netz.update(1 / 60, null); max = Math.max(max, Math.abs(netz.felder[0].tiefe)) }
  assert.ok(max > 0.1, 'es schwingt')
  for (let i = 0; i < 240; i++) netz.update(1 / 60, null)
  assert.ok(Math.abs(netz.felder[0].tiefe) < 0.01, 'und steht wieder')
})
