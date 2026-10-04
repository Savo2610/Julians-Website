import test from 'node:test'
import assert from 'node:assert/strict'
import { Skier } from '../src/player/skier.js'
import { terrainHeight, SCHANZE, schanzeLage, klammAt, BRUECKE, KLAMM, DECK, stegLage, stegDeck } from '../src/world/heightfield.js'

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
// welchem Abstand zur Kante die Leertaste liegt (null = nie). `nach`: so
// viele Bilder nach dem Abheben wird gedrueckt.
function springe({ tempo = 13, gas = true, druck = null, nach = null } = {}) {
  const s = new Skier(welt)
  s.versetzen(SCHANZE.x - SCHANZE.dx * 14, SCHANZE.z - SCHANZE.dz * 14, Math.atan2(SCHANZE.dx, SCHANZE.dz))
  s.speed = tempo
  const inp = eingabe()
  let flog = false
  let luft = 0
  for (let i = 0; i < 900; i++) {
    const { u } = schanzeLage(s.position.x, s.position.z)
    const tasten = gas ? ['forward'] : []
    if (druck !== null && u >= druck && u < druck + 3) tasten.push('jump')
    if (nach !== null && luft === nach) tasten.push('jump')
    inp.setze(tasten)
    s.update(1 / 60, inp, null)
    if (s.airborne) { flog = true; luft++ }
    if (flog && !s.airborne) {
      return { weite: schanzeLage(s.position.x, s.position.z).u, klamm: klammAt(s.position.x, s.position.z), art: s.absprung?.art }
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

// Seit 04.10. traegt die Bruecke selbst: die Klamm laeuft unter ihr durch,
// und der Fahrer faehrt oben auf dem Deck (stegDeck).
function fahre(x, z, heading, bilder, pruefe) {
  const s = new Skier(welt)
  s.versetzen(x, z, heading)
  s.speed = 10
  const inp = eingabe()
  for (let i = 0; i < bilder; i++) {
    inp.setze(['forward'])
    s.update(1 / 60, inp, null)
    pruefe(s, i)
  }
  return s
}

test('ueber die Bruecke: auf dem Deck, ohne Sprung und ohne Absturz', () => {
  const e = BRUECKE.ebene
  let drauf = 0
  fahre(BRUECKE.x - e.ux * 12, BRUECKE.z - e.uz * 12, Math.atan2(e.ux, e.uz), 150, (s) => {
    assert.ok(!s.airborne, 'hebt nicht ab')
    const l = stegLage(s.position.x, s.position.z)
    if (Math.abs(l.laengs) < DECK.halbL - 0.5) {
      drauf++
      assert.ok(Math.abs(s.position.y - l.y) < 0.02, `bei ${l.laengs.toFixed(1)} m ${(s.position.y - l.y).toFixed(2)} neben dem Deck`)
    }
  })
  assert.ok(drauf > 40, `${drauf} Bilder auf dem Deck`)
})

test('am Gelaender der Bruecke faellt man nicht in die Klamm', () => {
  const e = BRUECKE.ebene
  // Schraeg auf das Gelaender zu, 40 Grad gegen die Laengsachse.
  const a = Math.atan2(e.ux, e.uz) + 0.7
  fahre(BRUECKE.x - e.ux * 9, BRUECKE.z - e.uz * 9, a, 120, (s) => {
    const l = stegLage(s.position.x, s.position.z)
    if (Math.abs(l.laengs) < DECK.halbL - 0.3) {
      assert.ok(Math.abs(l.quer) <= DECK.halbQ + 0.01, `quer ${l.quer.toFixed(2)}`)
      assert.ok(Math.abs(s.position.y - l.y) < 0.02, 'bleibt oben')
    }
  })
})

test('unten in der Klamm faehrt man unter der Bruecke durch', () => {
  const ax = KLAMM.bis.x - KLAMM.von.x, az = KLAMM.bis.z - KLAMM.von.z, la = Math.hypot(ax, az)
  const ux = ax / la, uz = az / la
  // Auf Hoehe der Bruecke laengs der Rinne, zehn Meter davor los.
  const t = (BRUECKE.x - KLAMM.von.x) * ux + (BRUECKE.z - KLAMM.von.z) * uz
  const x0 = KLAMM.von.x + ux * (t - 10), z0 = KLAMM.von.z + uz * (t - 10)
  let drunter = 0
  fahre(x0, z0, Math.atan2(ux, uz), 150, (s) => {
    assert.ok(!s.airborne, 'hebt nicht ab')
    assert.ok(Math.abs(s.position.y - terrainHeight(s.position.x, s.position.z)) < 0.02, 'auf dem Grund')
    if (stegDeck(s.position.x, s.position.z)) drunter++
  })
  assert.ok(drunter > 10, `${drunter} Bilder unter dem Deck`)
})

test('wer in der Klamm quer an die Bruecke faehrt, fliegt nicht (04.10.)', () => {
  const ax = KLAMM.bis.x - KLAMM.von.x, az = KLAMM.bis.z - KLAMM.von.z, la = Math.hypot(ax, az)
  const ux = ax / la, uz = az / la
  const t = (BRUECKE.x - KLAMM.von.x) * ux + (BRUECKE.z - KLAMM.von.z) * uz
  for (const seite of [-1, 1]) {
    const x0 = KLAMM.von.x + ux * (t + seite * 9), z0 = KLAMM.von.z + uz * (t + seite * 9)
    let hoch = 0
    fahre(x0, z0, Math.atan2(-seite * ux, -seite * uz), 150, (s) => {
      hoch = Math.max(hoch, s.position.y - terrainHeight(s.position.x, s.position.z))
    })
    assert.ok(hoch < 0.3, `von ${seite > 0 ? 'unten' : 'oben'}: ${hoch.toFixed(2)} m ueber dem Grund`)
  }
})

test('der Absprung genau an der Kante traegt am weitesten (04.10.)', () => {
  const ohne = springe()
  const perfekt = springe({ druck: -0.5 })
  const spaet = springe({ nach: 5 })
  const frueh = springe({ druck: -1.5 })
  assert.equal(ohne.art, 'ohne')
  assert.equal(perfekt.art, 'perfekt')
  assert.equal(spaet.art, 'spaet')
  assert.equal(frueh.art, 'frueh')
  // Gemessen: ohne 17,3 · zu spaet 20,4 · perfekt 24,6 Meter.
  assert.ok(perfekt.weite > spaet.weite + 2, `perfekt ${perfekt.weite.toFixed(1)} gegen spaet ${spaet.weite.toFixed(1)}`)
  assert.ok(spaet.weite > ohne.weite + 2, `spaet ${spaet.weite.toFixed(1)} gegen ohne ${ohne.weite.toFixed(1)}`)
  assert.ok(perfekt.weite < SCHANZE.drueben + SCHANZE.landung - 2, 'perfekt landet noch im Landehang')
  // Wer zu frueh drueckt, hopst auf der Rampe und verschenkt die Kante.
  assert.ok(frueh.weite < ohne.weite, `zu frueh ${frueh.weite.toFixed(1)}`)
})
