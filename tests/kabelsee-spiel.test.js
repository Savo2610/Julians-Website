import { test } from 'node:test'
import assert from 'node:assert/strict'
import { landingQuality, scoreJump, Combo } from '../src/kabelsee/game/tricks.js'
import { Slalom } from '../src/kabelsee/game/slalom.js'
import { CABLE_LENGTH, cableAt, wrap } from '../src/kabelsee/world/cable-path.js'
import { FEATURES, GATES, offsetAt } from '../src/kabelsee/world/features.js'
import { CABLE, TRICK } from '../src/kabelsee/config.js'
import { ride, dockStart, steerTo } from './kabelsee-helfer.js'
import { CableSystem } from '../src/kabelsee/game/cable-system.js'
import { RiderPhysics } from '../src/kabelsee/player/rider-physics.js'

const TAU = Math.PI * 2

test('Start am Steg: ohne Hocke ins Wasser, mit Hocke los', () => {
  const fail = ride(8, () => ({}))
  assert.ok(fail.events.some((e) => e.type === 'dockFail'))
  const ok = ride(8, (r) => dockStart(r))
  const start = ok.events.find((e) => e.type === 'start')
  assert.ok(start, 'Start erkannt')
  assert.equal(start.perfect, true)
  const early = ride(8, (r) => (r.mode === 'dock' ? { jump: true } : null))
  assert.equal(early.events.find((e) => e.type === 'start').perfect, false)
})

test('Katapult-Start: nach perfektem Start ein 180 vom Steg', () => {
  const { events, r } = ride(8, (r) => {
    if (r.mode === 'dock') return dockStart(r)
    return { steer: r.airborne && Math.abs(r.spin) < Math.PI - 0.4 ? 1 : 0 }
  })
  assert.equal(events.find((e) => e.type === 'start').perfect, true)
  const land = events.find((e) => e.type === 'land')
  assert.equal(land.result?.name, '180', JSON.stringify(events.map((e) => e.type)))
  assert.notEqual(land.quality.key, 'crash')
  assert.equal(r.fakie, true)
})

test('Der Buegel kommt nicht immer gleich schnell', () => {
  const cable = new CableSystem()
  const r = new RiderPhysics(cable)
  const waits = []
  for (let i = 0; i < 4; i++) {
    r.toDock()
    waits.push(cable.nextArriving(wrap(r.s)).seconds)
  }
  assert.ok(Math.max(...waits) - Math.min(...waits) > 0.4, waits.join(' '))
  assert.ok(Math.min(...waits) > 2.4 && Math.max(...waits) < 4.6, waits.join(' '))
})

test('Ohne Lenken faehrt man eine ganze Runde ohne Sturz', () => {
  const { r, events } = ride(50, (r) => dockStart(r))
  assert.ok(!events.some((e) => e.type === 'crash'), JSON.stringify(events.filter((e) => e.type === 'crash')))
  assert.ok(r.progress > CABLE_LENGTH, `nur ${r.progress.toFixed(0)} m`)
})

test('Ausschwingen macht schneller als das Seil', () => {
  let top = 0
  ride(16, (r, t) => {
    if (r.mode === 'dock') return dockStart(r)
    if (t > 6 && !r.airborne) top = Math.max(top, r.speed)
    return { steer: t > 6 && t < 8 ? 1 : 0 }
  })
  assert.ok(top > CABLE.speed * 1.3, `Spitze nur ${top.toFixed(1)} m/s`)
})

test('180 auf flachem Wasser: rueckwaerts weiter, auch ueber den Kicker', () => {
  // Kurz nach dem Steg 0,4 s laden, abspringen und mit D einen 180 drehen;
  // danach ohne Eingabe weiter, rueckwaerts ueber den kleinen Kicker.
  let phase = 0
  let t0 = 0
  let fakieTime = 0
  const { r, events } = ride(20, (r, t) => {
    if (r.mode === 'dock') return dockStart(r)
    if (phase === 0 && t > 5 && r.s > 25 && r.s < 45) {
      phase = 1
      t0 = t
    }
    if (phase === 1) {
      if (t - t0 < 0.4) return { jump: true }
      phase = 2
    }
    if (phase === 2 && r.airborne && Math.abs(r.spin) < Math.PI - 0.4) return { steer: 1 }
    if (phase === 2 && r.fakie) phase = 3
    return {}
  }, { onStep: (r) => { if (r.fakie && r.mode === 'ride') fakieTime += 1 / 120 } })
  const land = events.filter((e) => e.type === 'land' && e.result)
  assert.equal(land[0]?.result.name, '180', JSON.stringify(events.map((e) => e.type)))
  assert.equal(land[0].fakie, true)
  assert.ok(!events.some((e) => e.type === 'crash'), JSON.stringify(events.filter((e) => e.type === 'crash')))
  assert.ok(events.some((e) => e.type === 'launch' && e.feature === 'Kleiner Kicker'), 'rueckwaerts ueber den Kicker')
  assert.ok(fakieTime > 8, `nur ${fakieTime.toFixed(1)} s rueckwaerts`)
  assert.equal(r.fakie, true)
})

test('Erster Kicker mit 360: sauber gestanden und bewertet', () => {
  let phase = 0
  const { events } = ride(14, (r) => {
    if (r.mode === 'dock') return dockStart(r)
    if (phase === 0 && r.x < -2 && r.x > -12.4) return { jump: true }
    if (phase === 0 && r.x <= -12.4) phase = 1
    if (phase === 1 && r.airborne && Math.abs(r.spin) < TAU - 0.65) return { steer: -1 }
    return {}
  })
  const land = events.filter((e) => e.type === 'land' && e.result)
  assert.equal(land.length, 1, JSON.stringify(events.map((e) => e.type)))
  assert.equal(land[0].result.name, '360')
  assert.notEqual(land[0].quality.key, 'crash')
})

// Faehrt auf einen seitlichen Versatz und haelt ihn bis zum Hindernis.
function approach(f, offset, seconds, extra = () => null) {
  return ride(seconds, (r, t) => {
    if (r.mode === 'dock') return dockStart(r)
    const own = extra(r, t)
    if (own) return own
    const d = wrap(f.s - r.s)
    return { steer: r.airborne || r.feature ? 0 : steerTo(r, d < f.length + 18 ? offset(d) : 0) }
  })
}

test('Schraeg gegen den Kicker: abgleiten statt stuerzen', () => {
  const k4 = FEATURES.find((f) => f.id === 'k4')
  // Von innen schraeg auf die Innenseite zu: kurz vor der Lippe kreuzt die
  // Linie die Kante.
  const { events } = approach(k4, (d) => (d > 12 ? -10.5 : -4), 34)
  assert.ok(events.some((e) => e.type === 'glance' || e.type === 'launch'), JSON.stringify(events.map((e) => e.type)))
  const crashes = events.filter((e) => e.type === 'crash' && e.t > 26)
  assert.equal(crashes.length, 0, JSON.stringify(crashes))
})

test('Schraeg auf die Box und quer darueber sliden', () => {
  const box = FEATURES.find((f) => f.id === 'box')
  // Auf der Box kurz D: eine Vierteldrehung, dann rastet die Stellung quer ein.
  const { events } = approach(box, (d) => (d > box.length + 4 ? 3 : 0), 16, (r) => (r.feature === box ? { steer: Math.abs(r.spin) < Math.PI / 2 - 0.35 ? 1 : 0 } : null))
  const slide = events.find((e) => e.type === 'land' && e.result?.name.includes('Box-Slide'))
  assert.ok(slide, JSON.stringify(events.map((e) => e.type + (e.result ? ':' + e.result.name : ''))))
  assert.match(slide.result.name, /quer/)
  assert.ok(!events.some((e) => e.type === 'crash'))
})

test('Auf der Box einen 360 drehen und gerade abspringen', () => {
  const box = FEATURES.find((f) => f.id === 'box')
  // D halten, sobald man oben ist, und ueber das Ende hinaus weiterdrehen.
  let on = false
  const { events } = approach(box, () => 0, 16, (r) => {
    if (r.feature === box && r.y > 0.7) on = true
    if (on && !r.feature && !r.airborne) on = false
    return on ? { steer: Math.abs(r.spin) < 2 * Math.PI - 0.5 ? 1 : 0 } : null
  })
  const land = events.find((e) => e.type === 'land' && e.result?.name.includes('Box-Slide'))
  assert.ok(land, JSON.stringify(events.map((e) => e.type + (e.result ? ':' + e.result.name : ''))))
  assert.match(land.result.name, /360/)
  assert.ok(!events.some((e) => e.type === 'crash'))
})

test('Schraeg auf Box und Rail landen: kein Sturz', () => {
  // Aus der Luft mit 80 Grad Drehung auf eine Box: wackelig oder besser.
  for (const spin of [0.6, 1.4, -1.4, Math.PI + 1.3]) {
    const q = landingQuality(spin, 0, { slider: true })
    assert.notEqual(q.key, 'crash', `Drehung ${spin}`)
  }
  // Auf dem Wasser waere 80 Grad quer ein Sturz.
  assert.equal(landingQuality(1.4, 0).key, 'crash')
})

test('Rail auf der Linie: wer geradeaus faehrt, slidet', () => {
  const rail = FEATURES.find((f) => f.id === 'rail')
  const { events } = approach(rail, () => rail.offset, 34)
  const slide = events.find((e) => e.type === 'land' && e.result?.name.startsWith('Rail-Slide'))
  assert.ok(slide, JSON.stringify(events.map((e) => e.type + (e.result ? ':' + e.result.name : ''))))
  assert.ok(!events.some((e) => e.type === 'crash'))
})

test('Slalom: mit grossen Boegen alle Tore, ohne Lenken keines', () => {
  const run = (steer) => {
    const sl = new Slalom()
    const jumps = []
    const { events } = ride(34, (r) => {
      if (r.mode === 'dock') return dockStart(r)
      const g = GATES.find((g) => wrap(g.s - r.s) < 40 && wrap(g.s - r.s) > 0)
      return { steer: steer && g && r.s > 120 ? steerTo(r, g.offset + g.side * 2) : 0 }
    }, {
      onStep: (r) => {
        sl.update(r)
        if (r.airborne && r.air?.time === 1 / 120 && r.s > 120 && r.s < 310) jumps.push(r.air.feature)
      },
    })
    return { sl, events, jumps }
  }
  const good = run(true)
  assert.equal(good.sl.runs, 1, JSON.stringify(good.sl.events.map((e) => e.type)))
  assert.ok(!good.events.some((e) => e.type === 'crash'))
  // Die Fahnen stehen jenseits der Kicker: wer den Slalom faehrt, springt nicht.
  assert.deepEqual(good.jumps.filter((f) => /Kicker/.test(f || '')), [])
  const lazy = run(false)
  assert.equal(lazy.sl.total, 0)
  assert.ok(!lazy.sl.events.some((e) => e.type === 'miss'), 'wer gar nicht mitfaehrt, bekommt keine Meldung')
})

test('Landung: Winkelfenster', () => {
  assert.equal(landingQuality(TAU + 0.1, 0).key, 'perfect')
  assert.equal(landingQuality(TAU + 0.4, 0).key, 'clean')
  assert.equal(landingQuality(TAU - 0.8, 0).key, 'sketchy')
  // 50 Grad daneben ist wackelig, erst wirklich quer (70 und mehr) Sturz.
  assert.equal(landingQuality(0.87, 0).key, 'sketchy')
  assert.equal(landingQuality(1.25, 0).key, 'crash')
  assert.equal(landingQuality(0, 0.87).key, 'sketchy')
  assert.equal(landingQuality(0, 1.25).key, 'crash')
  assert.equal(landingQuality(0, TAU * 0.5).key, 'crash')
  // Ein 180 landet rueckwaerts und ist kein Sturz.
  const half = landingQuality(Math.PI + 0.1, 0)
  assert.equal(half.key, 'perfect')
  assert.equal(half.fakie, true)
  assert.equal(landingQuality(TAU, 0).fakie, false)
})

test('Trickname setzt sich zusammen', () => {
  assert.equal(scoreJump({ time: 0.3, spin: 0, flip: 0, grab: 0, slide: 0 }), null)
  assert.equal(scoreJump({ time: 0.9, spin: TAU, flip: 0, grab: 0.5, slide: 0 }).name, '360 Indy')
  assert.equal(scoreJump({ time: 1.8, spin: 0, flip: -TAU, grab: 0, slide: 0 }).name, 'Backflip Big Air')
  assert.equal(scoreJump({ time: 1.0, spin: 0, flip: 2 * TAU, grab: 0.4, slide: 0 }).name, 'Doppel-Frontflip Nose Grab')
  assert.equal(scoreJump({ time: 0.2, spin: 0, flip: 0, grab: 0, slide: 12 }).name, 'Box-Slide 12 m')
  assert.equal(scoreJump({ time: 0.6, spin: Math.PI, flip: 0, grab: 0, slide: 0 }).name, '180')
  assert.equal(scoreJump({ time: 1.5, spin: 3 * Math.PI, flip: -TAU, grab: 0, slide: 0 }).name, 'Cork 540')
  assert.equal(scoreJump({ time: 1.5, spin: -TAU, flip: TAU, grab: 0.5, slide: 0 }).name, 'Rodeo 360 Nose Grab')
  assert.equal(scoreJump({ time: 0.9, spin: TAU, flip: 0, grab: 0, slide: 0, fakie: true }).name, 'Switch 360')
  assert.equal(scoreJump({ time: 0.2, spin: 0, flip: 0, grab: 0, slide: 10, slideQuer: 7, slideKind: 'Rail' }).name, 'Rail-Slide quer 10 m')
})

test('Kombo: Faktor steigt, Sturz loescht, Zeit zahlt aus', () => {
  const c = new Combo()
  const q = landingQuality(0, 0)
  c.trick({ name: 'a', points: 100 }, q)
  c.trick({ name: 'b', points: 100 }, q)
  c.collect(50)
  assert.equal(c.multiplier, 2)
  c.crash()
  assert.equal(c.points, 0)
  assert.equal(c.score, 0)
  c.trick({ name: 'a', points: 200 }, q)
  c.trick({ name: 'b', points: 200 }, q)
  let banked = 0
  for (let i = 0; i < 600 && !banked; i++) banked = c.update(1 / 60)
  assert.equal(banked, (300 + 300) * 2)
  assert.equal(c.score, banked)
  assert.ok(TRICK.comboWindow > 2)
})
