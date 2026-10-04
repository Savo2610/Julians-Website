import test from 'node:test'
import assert from 'node:assert/strict'
import { Skier } from '../src/player/skier.js'
import { terrainHeight, PARK_FEATURES, PLATEAU, inFunpark, freiFlug, parkFlug } from '../src/world/heightfield.js'
import { SPRUNG, TRICK } from '../src/config.js'

// Springen (03.10.): Druecken springt sofort, im Funpark zaehlt an der Kante
// der Moment wie am Kabelsee. Seit 04.10. fliegt man im Park leichter und
// frei ueber dem Landehang, und die Boxen sind eine Fahrt. Gefahren wird
// ohne three.js-Szene und ohne Hindernisse – nur Gelaende.

const welt = { resolve: (x, z) => ({ x, z, hit: false, pushX: 0, pushZ: 0 }), heightAt: terrainHeight }
const KICKER = PARK_FEATURES.filter((f) => f.kind === 'kicker')
const BOXEN = PARK_FEATURES.filter((f) => f.kind === 'box')
const GROSS = 0
const KLEIN = 1

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

// Faehrt auf einen Kicker zu; `plan(u, luft, t)` liefert die Tasten.
// u ist der Abstand zur Kante (negativ davor), t die Zeit seit dem Absprung.
function kicker(plan, { welcher = GROSS, tempo = 13 } = {}) {
  const f = KICKER[welcher]
  const s = new Skier(welt)
  s.versetzen(f.x - f.dx * 9, f.z - f.dz * 9, Math.atan2(f.dx, f.dz))
  s.speed = tempo
  const inp = eingabe()
  let ab = null
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
    if (war && !s.airborne) {
      // Wo und auf welchem Gefaelle er aufsetzt – gemessen um den Punkt herum.
      const { x, z } = s.position
      const d = 0.4
      const hang = (terrainHeight(x - f.dx * d, z - f.dz * d) - terrainHeight(x + f.dx * d, z + f.dz * d)) / (2 * d)
      const landU = (x - f.x) * f.dx + (z - f.z) * f.dz
      inp.setze(['forward'])
      s.update(1 / 60, inp, null)
      if (s.trick) tricks.push(s.trick.text)
      return { flug: t - ab, tricks, tempo: s.speed, hang, landU }
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

test('Der grosse Kicker traegt einen 720, der kleine einen 540', () => {
  // Gemessen bei Tempo 13 mit Pop: gross 2,13 s, klein 1,75 s (seit dem
  // 04.10. 1,5 m hoch statt 1,1 – vorher 1,53 s). Fuer einen 720 braucht es
  // gut 1,75 s Luft, fuer einen 540 gut 1,4 s.
  assert.ok(kicker(anDerKante).flug > 1.9)
  assert.ok(kicker(anDerKante, { welcher: KLEIN }).flug > 1.65)
  const dreh = (welcher, dauer) => kicker((u, luft, t) =>
    luft ? (t < dauer ? ['right'] : []) : anDerKante(u, luft), { welcher }).tricks
  assert.deepEqual(dreh(GROSS, 1.4), ['720° · PERFEKT'])
  assert.deepEqual(dreh(KLEIN, 1.2), ['540° · PERFEKT'])
})

test('Gelandet wird auf dem Landehang, nicht im Flachen dahinter', () => {
  // Fuer jedes Tempo von 11 bis 15, mit und ohne Pop: der Aufsetzpunkt liegt
  // vor dem Knick und faellt in Fahrtrichtung.
  for (const welcher of [GROSS, KLEIN]) {
    const f = KICKER[welcher]
    for (const tempo of [11, 13, 15]) {
      for (const plan of [nurW, anDerKante]) {
        const r = kicker(plan, { welcher, tempo })
        assert.ok(r.landU < f.landing * f.knuckle, `Kicker ${welcher} Tempo ${tempo}: u ${r.landU}`)
        assert.ok(r.hang > 0.1, `Kicker ${welcher} Tempo ${tempo}: Gefaelle ${r.hang}`)
      }
    }
  }
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
  // S bis zum Aufsetzen gehalten, am kleinen Kicker mit Pop: knapp
  // anderthalb Saltos, die Landehilfe kommt nicht zum Zug.
  const quer = kicker((u, luft) => (luft ? ['brake'] : anDerKante(u, luft)), { welcher: KLEIN })
  const sauber = kicker(anDerKante, { welcher: KLEIN })
  assert.deepEqual(quer.tricks, ['STURZ'])
  assert.ok(quer.tempo < sauber.tempo * 0.5, `${quer.tempo} gegen ${sauber.tempo}`)
})

test('Ausserhalb des Parks springt die Leertaste sofort den alten Hopser', () => {
  assert.equal(inFunpark(PLATEAU.x, PLATEAU.z + 2), false)
  assert.equal(freiFlug(PLATEAU.x, PLATEAU.z + 2), false)
  const s = new Skier(welt)
  s.versetzen(PLATEAU.x, PLATEAU.z + 2)
  s.speed = 8
  const inp = eingabe()
  inp.setze(['jump'])
  s.update(1 / 60, inp, null)
  assert.equal(s.airborne, true)
  // Schwerkraft 18 wie immer, nicht die des Parks.
  assert.ok(Math.abs(s.vy - (SPRUNG.hopser - 18 / 60)) < 1e-9, `vy ${s.vy}`)
})

test('Parkregeln gelten nur im Kern des Bandes, nicht auf der Leuchtstrecke', () => {
  for (const f of PARK_FEATURES) assert.equal(parkFlug(f.x, f.z), true, f.kind)
  // Kopf der Leuchtstrecke und Ende der Nordabfahrt: im Saum von
  // inFunpark, aber ohne Parkflug.
  for (const [x, z] of [[34, -9.9], [6.3, -63.8]]) {
    assert.equal(inFunpark(x, z), true)
    assert.equal(parkFlug(x, z), false)
  }
})

// Faehrt die Boxenlinie entlang; `plan(s)` liefert die Tasten.
function boxen(plan = () => ['forward'], { tempo = 10 } = {}) {
  const f = BOXEN[0]
  const s = new Skier(welt)
  const vor = f.length / 2 + 3
  s.versetzen(f.x - f.dx * vor, f.z - f.dz * vor, Math.atan2(f.dx, f.dz))
  s.speed = tempo
  const inp = eingabe()
  const meldungen = []
  let aufDeck = null
  let bilder = 0
  for (let i = 0; i < 240; i++) {
    inp.setze(plan(s))
    s.update(1 / 60, inp, null)
    if (s.trick) { meldungen.push(s.trick.text); s.trick = null }
    // Gemessen im zweiten Bild auf der Box: im ersten rastet er erst ein.
    bilder = s._box ? bilder + 1 : 0
    if (bilder === 2 && aufDeck === null) aufDeck = s.position.y - terrainHeight(s.position.x, s.position.z)
  }
  return { meldungen, aufDeck }
}

test('Auf der Box rastet man ein, slidet und wird am Ende abgeworfen', () => {
  const r = boxen()
  // Ohne Taste: 50-50 auf beiden Boxen, der Hopser von der ersten traegt
  // auf die zweite.
  assert.ok(r.meldungen.includes('50-50'), r.meldungen.join(' | '))
  assert.ok(r.meldungen.some((m) => /^50-50 \d+ m · PERFEKT$/.test(m)), r.meldungen.join(' | '))
  // Der Fahrer steht auf dem Holz, nicht darin.
  assert.ok(Math.abs(r.aufDeck - TRICK.boxDeck) < 1e-9, `Hoehe ${r.aufDeck}`)
})

test('D stellt auf der Box quer, und der Name kommt mit in die Landung', () => {
  let gedrueckt = false
  const r = boxen((s) => {
    if (s._box && !gedrueckt) { gedrueckt = true; return ['forward', 'right'] }
    return ['forward']
  })
  assert.ok(r.meldungen.includes('BOARDSLIDE'), r.meldungen.join(' | '))
  assert.ok(r.meldungen.some((m) => /^BOARDSLIDE \d+ m/.test(m)), r.meldungen.join(' | '))
})

test('Mit der Leertaste am Ende der Box springt man ab und dreht noch', () => {
  // Auf der zweiten Box kurz vor dem Ende springen, dann D halten.
  const f = BOXEN[1]
  let ab = null
  let t = 0
  const r = boxen((s) => {
    t += 1 / 60
    const u = (s.position.x - f.x) * f.dx + (s.position.z - f.z) * f.dz
    if (s._box?.f === f && u > f.length / 2 - f.ramp - 0.6) { ab = t; return ['forward', 'jump'] }
    if (ab !== null && s.airborne && t - ab < 0.75) return ['forward', 'right']
    return ['forward']
  })
  assert.ok(r.meldungen.some((m) => /^50-50 \d+ m · 360°/.test(m)), r.meldungen.join(' | '))
})
