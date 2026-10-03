import test from 'node:test'
import assert from 'node:assert/strict'
import { Skier } from '../src/player/skier.js'
import { terrainHeight, PARK_FEATURES, PLATEAU, inFunpark } from '../src/world/heightfield.js'
import { SPRUNG } from '../src/config.js'

// Springen (03.10.): Druecken springt sofort, im Funpark zaehlt an der Kante
// der Moment wie am Kabelsee. Gefahren wird ohne three.js-Szene und ohne
// Hindernisse – nur Gelaende.

const welt = { resolve: (x, z) => ({ x, z, hit: false, pushX: 0, pushZ: 0 }), heightAt: terrainHeight }

function eingabe() {
  let jetzt = new Set()
  let vorher = new Set()
  return {
    setze(tasten) { vorher = jetzt; jetzt = new Set(tasten) },
    has: (a) => jetzt.has(a),
    justPressed: (a) => jetzt.has(a) && !vorher.has(a),
    justReleased: (a) => !jetzt.has(a) && vorher.has(a),
    get steer() { return (jetzt.has('right') ? 1 : 0) - (jetzt.has('left') ? 1 : 0) },
    get throttle() { return jetzt.has('forward') ? 1 : 0 },
    get braking() { return jetzt.has('brake') },
  }
}

// Faehrt auf den kleinen Kicker zu; `plan(u, luft, t)` liefert die Tasten.
// u ist der Abstand zur Kante (negativ davor), t die Zeit seit dem Absprung.
function kicker(plan) {
  const f = PARK_FEATURES.find((k) => k.kind === 'kicker')
  const s = new Skier(welt)
  s.versetzen(f.x - f.dx * 9, f.z - f.dz * 9, Math.atan2(f.dx, f.dz))
  s.speed = 13
  const inp = eingabe()
  let ab = null
  let scheitel = 0
  let t = 0
  const tricks = []
  for (let i = 0; i < 600; i++) {
    const u = (s.position.x - f.x) * f.dx + (s.position.z - f.z) * f.dz
    inp.setze(plan(u, s.airborne, ab === null ? 0 : t - ab))
    const war = s.airborne
    s.update(1 / 60, inp, null)
    t += 1 / 60
    if (s.trick) { tricks.push(s.trick.text); s.trick = null }
    if (!war && s.airborne && ab === null) ab = t
    if (s.airborne) scheitel = Math.max(scheitel, s.height)
    if (war && !s.airborne) {
      inp.setze(['forward'])
      s.update(1 / 60, inp, null)
      if (s.trick) tricks.push(s.trick.text)
      return { flug: t - ab, scheitel, tricks, tempo: s.speed }
    }
  }
  throw new Error('nicht gelandet')
}

const nurW = () => ['forward']
// Drueckt die Leertaste, sobald die Kante u0 Meter nah ist, und haelt sie.
const druckAb = (u0) => (u, luft) => (!luft && u >= u0 ? ['forward', 'jump'] : ['forward'])
const anDerKante = druckAb(-0.25)

test('Druck an der Kante springt hoeher als durchfahren oder zu frueh', () => {
  const ohne = kicker(nurW)
  const pop = kicker(anDerKante)
  const danach = kicker((u, luft, t) => (luft && t < 0.06 ? ['forward', 'jump'] : ['forward']))
  const frueh = kicker(druckAb(-4))
  assert.ok(pop.flug > ohne.flug + 0.2, `Pop ${pop.flug} ohne ${ohne.flug}`)
  // Nachsicht: kurz hinter der Kante zaehlt der Druck noch.
  assert.ok(danach.flug > ohne.flug + 0.15, `danach ${danach.flug} ohne ${ohne.flug}`)
  assert.ok(frueh.flug < ohne.flug, `zu frueh ${frueh.flug}`)
})

test('Im Park drehen A/D und W/S in der Luft, die Landehilfe richtet gerade', () => {
  const springe = (taste, dauer) => kicker((u, luft, t) =>
    luft ? (t < dauer ? [taste] : []) : anDerKante(u, luft))
  assert.deepEqual(springe('right', 0.8).tricks, ['360° · PERFEKT'])
  assert.deepEqual(springe('brake', 0.95).tricks, ['BACKFLIP · PERFEKT'])
  // Was beim Absprung schon liegt, dreht nicht: W haelt man beim Fahren.
  assert.deepEqual(kicker(anDerKante).tricks, [])
})

test('Wer kopfueber landet, stuerzt und verliert sein Tempo', () => {
  // S bis zum Aufsetzen gehalten: gut anderthalb Saltos, die Landehilfe
  // kommt nicht zum Zug, der Fahrer setzt kopfueber auf.
  const quer = kicker((u, luft) => (luft ? ['brake'] : anDerKante(u, luft)))
  const sauber = kicker(anDerKante)
  assert.deepEqual(quer.tricks, ['STURZ'])
  assert.ok(quer.tempo < sauber.tempo * 0.5, `${quer.tempo} gegen ${sauber.tempo}`)
})

test('Ausserhalb des Parks springt die Leertaste sofort den alten Hopser', () => {
  assert.equal(inFunpark(PLATEAU.x, PLATEAU.z + 2), false)
  const s = new Skier(welt)
  s.versetzen(PLATEAU.x, PLATEAU.z + 2)
  s.speed = 8
  const inp = eingabe()
  inp.setze(['jump'])
  s.update(1 / 60, inp, null)
  assert.equal(s.airborne, true)
  assert.ok(Math.abs(s.vy - (SPRUNG.hopser - 18 / 60)) < 1e-9, `vy ${s.vy}`)
})
