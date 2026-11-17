import test from 'node:test'
import assert from 'node:assert/strict'
import { Skier } from '../src/player/skier.js'
import { terrainHeight, TRAMPOLIN, TRAMPOLINE, muldeTiefe, freiFlug } from '../src/world/heightfield.js'
import { Trampolin } from '../src/world/attractions/trampolin.js'

// Das Trampolin im Kinderland (09.10.): hineinfahren oder -fallen, einsinken,
// hochgeworfen werden; mit der Leertaste hoeher. Gefahren wird ohne Szene, in
// derselben Reihenfolge wie in main.js: Trampolin, Fahrer, Trampolin pruefen.

const welt = { resolve: (x, z) => ({ x, z, hit: false, pushX: 0, pushZ: 0 }), heightAt: terrainHeight }

function eingabe() {
  const t = new Set()
  const neu = new Set()
  return {
    t, neu,
    has: (a) => t.has(a),
    justPressed: (a) => neu.has(a),
    justReleased: () => false,
    get steer() { return (t.has('right') ? 1 : 0) - (t.has('left') ? 1 : 0) },
    get throttle() { return t.has('forward') ? 1 : 0 },
    get braking() { return false },
  }
}

// Laesst `bilder` Bilder laufen; `druecken(tr, s)` entscheidet je Bild, ob
// die Leertaste neu gedrueckt wird.
function lauf({ x = TRAMPOLIN.x, z = TRAMPOLIN.z, heading = 0, tempo = 0, bilder = 600, druecken = () => false, tasten = [] } = {}) {
  const tr = new Trampolin()
  // Allein: das zweite Tuch faengt hier nicht.
  const s = new Skier(welt)
  s.versetzen(x, z, heading)
  s.speed = tempo
  const inp = eingabe()
  for (const k of tasten) inp.t.add(k)
  const dt = 1 / 60
  const v = { tr, s, maxY: -Infinity, maxTiefe: 0, minUeberGrund: Infinity, spruenge: 0, weg: null, fang: 0 }
  for (let i = 0; i < bilder; i++) {
    inp.neu.clear()
    if (druecken(tr, s, i)) inp.neu.add('jump')
    tr.update(dt, s, inp)
    // Gemessen, wo das Tuch den Fahrer gestellt hat – im Bild des Fangens
    // steht er noch, wo er herkam.
    const getragen = s.tow === tr
    s.update(dt, inp, null)
    if (getragen) v.minUeberGrund = Math.min(v.minUeberGrund, s.position.y - terrainHeight(s.position.x, s.position.z))
    tr.pruefen(s)
    if (tr.fang) {
      v.fang++
      v.maxTiefe = Math.max(v.maxTiefe, tr.fang.p)
    }
    v.maxY = Math.max(v.maxY, s.position.y)
    if (v.weg === null && Math.hypot(s.position.x - TRAMPOLIN.x, s.position.z - TRAMPOLIN.z) > TRAMPOLIN.r + 1 && !s.airborne) v.weg = i
  }
  v.spruenge = tr.spruenge
  return v
}

// Auf dem Tuch: Leertaste, sobald es unten ist.
const unten = (tr) => tr.fang && !tr.fang.stehen && tr.fang.p > 0.2 && Math.abs(tr.fang.v) < 1.2

test('das Gelaende: ebener Platz, darunter eine Mulde mit flachem Boden', () => {
  assert.equal(terrainHeight(TRAMPOLIN.x + TRAMPOLIN.r + 0.3, TRAMPOLIN.z), TRAMPOLIN.h)
  assert.equal(terrainHeight(TRAMPOLIN.x, TRAMPOLIN.z + TRAMPOLIN.eben - 0.1), TRAMPOLIN.h)
  assert.ok(Math.abs(terrainHeight(TRAMPOLIN.x, TRAMPOLIN.z) - (TRAMPOLIN.h - TRAMPOLIN.mulde)) < 1e-9)
  // 1,5 m vor der Mitte noch ganz tief – dorthin wandert die Delle.
  assert.equal(muldeTiefe(1.5), TRAMPOLIN.mulde)
  assert.equal(muldeTiefe(TRAMPOLIN.r - 0.1), 0)
  // Ueber dem Tuch fliegt man frei, sonst saenke man mit der Mulde ab.
  assert.ok(freiFlug(TRAMPOLIN.x + 1, TRAMPOLIN.z))
  assert.ok(!freiFlug(TRAMPOLIN.x + TRAMPOLIN.r + 1, TRAMPOLIN.z))
})

test('hineingefahren: es gibt nach, wirft einen Hopser und man gleitet hinunter', () => {
  // Von oben die Westabfahrt herunter, mit 6 m/s auf die Mitte zu.
  const h = Math.atan2(-0.539, 0.842)
  const v = lauf({ x: TRAMPOLIN.x + 0.539 * 5, z: TRAMPOLIN.z - 0.842 * 5, heading: h, tempo: 6, bilder: 600 })
  assert.ok(v.fang > 0, 'aufgefangen')
  assert.ok(v.spruenge >= 1, `${v.spruenge} Spruenge`)
  assert.ok(v.maxTiefe > 0.3, `Tiefe ${v.maxTiefe.toFixed(2)}`)
  // Ohne Taste bleibt man nicht ewig: man gleitet vom Tuch.
  assert.ok(v.weg !== null, 'wieder herunter')
  assert.equal(v.s.tow, null)
  assert.equal(v.tr.fang, null)
})

test('mit der Leertaste schaukelt man sich hoch, bis zum Deckel', () => {
  const v = lauf({ bilder: 1500, druecken: (tr, s, i) => unten(tr) || (tr.fang?.stehen && i % 20 === 0) })
  const ueber = v.maxY - TRAMPOLIN.h
  // Deckel 14 m/s bei g 13: 7,5 m Scheitel (Ansage 10.10.: hoeher).
  assert.ok(ueber > 6.8 && ueber < 7.8, `Scheitel ${ueber.toFixed(2)} m`)
  assert.ok(v.spruenge >= 8, `${v.spruenge} Spruenge`)
  // Man bleibt dabei auf dem Tuch: die Delle zieht zur Mitte.
  const d = Math.hypot(v.s.position.x - TRAMPOLIN.x, v.s.position.z - TRAMPOLIN.z)
  assert.ok(d < TRAMPOLIN.r, `${d.toFixed(2)} m von der Mitte`)
  // Und sinkt nie bis auf den Grund der Mulde.
  assert.ok(v.minUeberGrund > 0.05, `${v.minUeberGrund.toFixed(2)} m ueber dem Grund`)
  assert.ok(v.maxTiefe < TRAMPOLIN.mulde, `Tiefe ${v.maxTiefe.toFixed(2)}`)
})

test('ohne Taste wird jeder Sprung kleiner, bis man steht', () => {
  const tr = new Trampolin()
  const s = new Skier(welt)
  s.versetzen(TRAMPOLIN.x, TRAMPOLIN.z, 0)
  // Aus 3 m Hoehe auf das Tuch fallen lassen.
  s.airborne = true
  s.figurFlug = true
  s.height = 3 + TRAMPOLIN.mulde
  s.vy = 0
  const inp = eingabe()
  const raus = []
  tr.losgelassen = ({ vy }) => raus.push(vy)
  for (let i = 0; i < 900; i++) {
    tr.update(1 / 60, s, inp)
    s.update(1 / 60, inp, null)
    tr.pruefen(s)
  }
  assert.ok(raus.length >= 3, `${raus.length} Spruenge`)
  for (let i = 1; i < raus.length; i++) assert.ok(raus[i] < raus[i - 1], `${raus.map((r) => r.toFixed(1)).join(' > ')}`)
})

test('Figuren auf dem Tuch werden gewertet, zaehlen aber nicht fuer den Pass', () => {
  const tr = new Trampolin()
  const s = new Skier(welt)
  s.versetzen(TRAMPOLIN.x, TRAMPOLIN.z, 0)
  const inp = eingabe()
  const figuren = []
  let gedreht = false
  for (let i = 0; i < 1800; i++) {
    inp.neu.clear()
    if (unten(tr) || (tr.fang?.stehen && i % 20 === 0)) inp.neu.add('jump')
    // Hoch genug: im Steigen D halten, im Fallen loslassen.
    if (!tr.fang && s.airborne && s.vy > 4 && tr.spruenge >= 5 && !gedreht) { inp.t.add('right'); gedreht = true }
    if (gedreht && s.vy < -1) { inp.t.delete('right'); gedreht = false }
    tr.update(1 / 60, s, inp)
    s.update(1 / 60, inp, null)
    tr.pruefen(s)
    if (s.trick) { figuren.push({ text: s.trick.text, imSpiel: tr.imSpiel }); s.trick = null }
  }
  assert.ok(figuren.some((f) => /\d+°/.test(f.text)), figuren.map((f) => f.text).join(', '))
  assert.ok(figuren.every((f) => f.imSpiel), 'alle Figuren im Spiel')
})

// Beide Tuecher, wie im Kinderland: jedes kennt das andere.
function zwei() {
  const tt = TRAMPOLINE.map((t) => new Trampolin(t))
  for (const t of tt) t.nachbarn = tt.filter((n) => n !== t)
  return tt
}

test('zwei Tuecher: mit W springt man vom oberen aufs untere und zurueck', () => {
  const [a, b] = zwei()
  const s = new Skier(welt)
  const zuB = Math.atan2(b.x - a.x, b.z - a.z)
  s.versetzen(a.x, a.z, zuB)
  const inp = eingabe()
  const wege = []
  let auf = null
  for (let i = 0; i < 3000 && wege.length < 2; i++) {
    inp.neu.clear()
    const tr = a.fang ? a : b.fang ? b : null
    if (tr && (unten(tr) || (tr.fang.stehen && i % 20 === 0))) inp.neu.add('jump')
    // Hoch genug geschaukelt: W halten und hinueber.
    inp.t.delete('forward')
    if (tr && tr.spruenge >= 4 && !tr.fang.stehen) inp.t.add('forward')
    for (const t of [a, b]) t.update(1 / 60, s, inp)
    s.update(1 / 60, inp, null)
    for (const t of [a, b]) if (t.pruefen(s)) break
    const jetzt = a.fang ? 'a' : b.fang ? 'b' : auf
    if (auf && jetzt !== auf) {
      wege.push(jetzt)
      // Umdrehen: auf dem Tuch zeigt man zum anderen zurueck.
      const ziel = jetzt === 'b' ? a : b
      const g = (jetzt === 'b' ? b : a).fang
      g.heading = Math.atan2(ziel.x - g.x, ziel.z - g.z)
    }
    auf = jetzt
  }
  assert.deepEqual(wege, ['b', 'a'])
})

test('ohne W bleibt man beim Hochschaukeln auf dem Tuch, mit W kommt man herunter', () => {
  const v = lauf({ bilder: 1500, druecken: (tr, s, i) => unten(tr) || (tr.fang?.stehen && i % 20 === 0) })
  assert.ok(Math.hypot(v.s.position.x - TRAMPOLIN.x, v.s.position.z - TRAMPOLIN.z) < 1)
  // Quer zum anderen Tuch, W gehalten: nach dem ersten Sprung ist man unten.
  const w = lauf({ heading: Math.PI / 2, tasten: ['forward'], bilder: 400, druecken: (tr, s, i) => tr.fang?.stehen && i === 30 })
  assert.ok(w.weg !== null, 'vom Tuch herunter')
})

test('auf dem Trampolin schlaegt W in der Luft keinen Salto', () => {
  const tr = new Trampolin()
  const s = new Skier(welt)
  s.versetzen(TRAMPOLIN.x, TRAMPOLIN.z, 0)
  const inp = eingabe()
  let flip = 0
  for (let i = 0; i < 1200; i++) {
    inp.neu.clear()
    if (unten(tr) || (tr.fang?.stehen && i % 20 === 0)) inp.neu.add('jump')
    // Erst in der Luft druecken, sonst ist die Taste gesperrt.
    if (!tr.fang && s.airborne && s.vy > 2) inp.t.add('forward')
    else inp.t.delete('forward')
    tr.update(1 / 60, s, inp)
    s.update(1 / 60, inp, null)
    tr.pruefen(s)
    flip = Math.max(flip, Math.abs(s.flip))
  }
  assert.ok(tr.spruenge >= 5)
  assert.ok(flip < 0.01, `Salto ${flip.toFixed(2)} rad`)
})

// Die Plaetze der beiden Tuecher ueberlappen. Bis 17.11. sprang der Boden
// dort, wo der Saum des oberen begann, um 0,22 m, und wer bergauf darueber
// fuhr, flog mit bis zu 13,5 m/s hoch. Abgetastet in 5 cm: ausserhalb der
// Mulden steigt der Boden nirgends steiler als 1 : 1.
test('zwischen den Tuechern hat der Boden keine Kante', () => {
  const schritt = 0.05
  const [a, b] = TRAMPOLINE
  let steilste = 0
  for (let x = Math.min(a.x, b.x) - 7; x <= Math.max(a.x, b.x) + 7; x += 0.25) {
    for (let z = Math.min(a.z, b.z) - 7; z <= Math.max(a.z, b.z) + 7; z += schritt) {
      const inMulde = TRAMPOLINE.some((T) => Math.hypot(x - T.x, z - T.z) < T.r + 0.1 || Math.hypot(x - T.x, z + schritt - T.z) < T.r + 0.1)
      if (inMulde) continue
      steilste = Math.max(steilste, Math.abs(terrainHeight(x, z + schritt) - terrainHeight(x, z)) / schritt)
    }
  }
  assert.ok(steilste < 1, `steilste Stelle ${steilste.toFixed(2)}`)
})

test('wer zwischen den Tuechern bergauf faehrt, hebt nicht ab', () => {
  // Die Stelle der Meldung: vom unteren Tuch her auf das obere zu.
  for (const tempo of [5, 9, 13]) {
    const s = new Skier(welt)
    s.versetzen(27.54, 8.2, Math.PI)
    s.speed = tempo
    const inp = eingabe()
    let hoch = 0
    // Bis vor das Tuch – ohne Trampolin faengt hier keins, und in der Mulde
    // wuerde man sonst am Rand wieder herausgeworfen.
    for (let i = 0; i < 90 && Math.hypot(s.position.x - TRAMPOLIN.x, s.position.z - TRAMPOLIN.z) > TRAMPOLIN.r + 0.3; i++) {
      s.update(1 / 60, inp, null)
      if (s.airborne) hoch = Math.max(hoch, s.vy)
    }
    assert.ok(hoch < 3, `mit ${tempo} m/s abgehoben, vy ${hoch.toFixed(1)}`)
  }
})
