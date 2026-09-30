import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CableSystem } from '../src/game/cable-system.js'
import { RiderPhysics } from '../src/player/rider-physics.js'
import { landingQuality, scoreJump, Combo } from '../src/game/tricks.js'
import { CABLE_LENGTH } from '../src/world/cable-path.js'
import { CABLE, TRICK } from '../src/config.js'

const DT = 1 / 120
const TAU = Math.PI * 2

// Kleiner Fahrer fuer die Tests: plan(r, t) liefert die Eingabe je Schritt.
function ride(seconds, plan) {
  const cable = new CableSystem()
  const r = new RiderPhysics(cable)
  const events = []
  let prevJump = false
  for (let i = 0; i < seconds / DT; i++) {
    const t = i * DT
    const o = plan(r, t) || {}
    const jump = !!o.jump
    r.update(DT, { steer: o.steer || 0, throttle: !!o.throttle, brake: !!o.brake, jump, jumpReleased: prevJump && !jump, grab: !!o.grab })
    prevJump = jump
    cable.update(DT)
    for (const e of r.events) events.push({ ...e, t })
    r.events.length = 0
    if (o.stop?.(r)) break
  }
  return { r, events }
}

// Hocke erst, wenn das Seil schon halb gestrafft ist: der perfekte Start.
const dockStart = (r) => (r.mode === 'dock' ? { jump: r.hooked && r.dockProgress > 0.55 } : null)

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

test('Landung: Winkelfenster', () => {
  assert.equal(landingQuality(TAU + 0.1, 0).key, 'perfect')
  assert.equal(landingQuality(TAU + 0.4, 0).key, 'clean')
  assert.equal(landingQuality(TAU - 0.8, 0).key, 'sketchy')
  assert.equal(landingQuality(Math.PI, 0).key, 'crash')
  assert.equal(landingQuality(0, TAU * 0.5).key, 'crash')
})

test('Trickname setzt sich zusammen', () => {
  assert.equal(scoreJump({ time: 0.3, spin: 0, flip: 0, grab: 0, slide: 0 }), null)
  assert.equal(scoreJump({ time: 0.9, spin: TAU, flip: 0, grab: 0.5, slide: 0 }).name, '360 Indy')
  assert.equal(scoreJump({ time: 1.4, spin: 0, flip: -TAU, grab: 0, slide: 0 }).name, 'Backflip Big Air')
  assert.equal(scoreJump({ time: 1.0, spin: 0, flip: 2 * TAU, grab: 0.4, slide: 0 }).name, 'Doppel-Frontflip Nose Grab')
  assert.equal(scoreJump({ time: 0.2, spin: 0, flip: 0, grab: 0, slide: 12 }).name, 'Box-Slide 12 m')
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
