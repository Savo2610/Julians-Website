import test from 'node:test'
import assert from 'node:assert/strict'
import { Skier } from '../src/player/skier.js'
import { terrainHeight, TRAMPOLIN, muldeTiefe, freiFlug } from '../src/world/heightfield.js'
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
  // Deckel 11,5 m/s bei g 13: gut 5 m Scheitel.
  assert.ok(ueber > 4 && ueber < 5.4, `Scheitel ${ueber.toFixed(2)} m`)
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
