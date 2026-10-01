import { test } from 'node:test'
import assert from 'node:assert/strict'
import { landingQuality, scoreJump, Combo } from '../src/kabelsee/game/tricks.js'
import { Slalom } from '../src/kabelsee/game/slalom.js'
import { CABLE_LENGTH, cableAt, wrap } from '../src/kabelsee/world/cable-path.js'
import { FEATURES, GATES, BUOYS, BUOY_ARCS, offsetAt } from '../src/kabelsee/world/features.js'
import { CABLE, TRICK } from '../src/kabelsee/config.js'
import { ride, dockStart, steerTo } from './kabelsee-helfer.js'
import { CableSystem } from '../src/kabelsee/game/cable-system.js'
import { RiderPhysics, DOCK_S } from '../src/kabelsee/player/rider-physics.js'
import { Session, sammelBonus } from '../src/kabelsee/game/session.js'

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

test('Bojen: wer den Boegen folgt, holt in der ersten Runde fast alle', () => {
  // Wie ein Fahrer, der den Bogen sieht: 5 m vorausschauend auf seine
  // Linie, in der Luft nicht lenken. Mit dem alten Ostbogen (12 m aussen) kam er
  // am Scheitel nur auf 9 bis 11 m und holte 10 bis 13 von 17.
  const ziel = (s) => {
    for (const [s0, span, , max, side = 1] of BUOY_ARCS) {
      const t = wrap(s - s0) / span
      if (t <= 1) return Math.sin(t * Math.PI) * max * side
    }
    return 0
  }
  const geholt = new Set()
  ride(45, (r) => {
    if (r.mode === 'dock') return dockStart(r)
    if (r.airborne) return {}
    return { steer: steerTo(r, ziel(r.s + 5)) }
  }, {
    onStep: (r) => {
      if (r.mode !== 'ride' || r.progress > CABLE_LENGTH + 20) return
      for (const b of BUOYS) if (Math.hypot(b.x - r.x, b.z - r.z) < 1.7 && r.y < 1.8) geholt.add(b.id)
    },
  })
  assert.equal(BUOYS.length, 15)
  assert.ok(geholt.size >= 13, `${geholt.size} von ${BUOYS.length}`)
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

test('Aus dem Tal: der Buegel kommt nach der vorgegebenen Zeit, sonst nach 2,6 bis 4,4 s', () => {
  // Am Badesteg lief der Countdown schon; dort gibt das Tal die Ankunft vor
  // (src/sommer/sommer.js, 2,8 s ab Beginn der Verwandlung).
  const cable = new CableSystem()
  const r = new RiderPhysics(cable)
  r.toDock(2.8)
  assert.ok(Math.abs(cable.nextArriving(DOCK_S).seconds - 2.8) < 0.05)
  for (let i = 0; i < 20; i++) {
    r.toDock()
    const s = cable.nextArriving(DOCK_S).seconds
    assert.ok(s >= 2.55 && s <= 4.45, `Ankunft ${s.toFixed(2)} s`)
  }
})

// Ein Session-Geruest ohne three.js: Anzeige und Effekte schreiben nur mit.
function session() {
  const hud = new Proxy({ touch: false }, { get: (t, k) => (k in t ? t[k] : () => {}) })
  const fx = new Proxy({}, { get: () => () => {} })
  const items = {
    buoys: [{ x: 10, z: 0 }, { x: 20, z: 0 }],
    rings: [0, 1, 2, 3].map((i) => ({ x: i * 10, z: 5, y: 1, radius: 1.5 })),
    gates: [],
    gesunken: 0,
    reset() {
      for (const b of this.buoys) b.taken = false
      for (const r of this.rings) r.taken = false
    },
    versenkeTore() { this.gesunken += 1 },
    setGate() {},
    resetGates() {},
  }
  const cable = new CableSystem()
  const rider = new RiderPhysics(cable)
  const s = new Session({ rider, cable, collectibles: items, hud, fx, eingebettet: true })
  s.starten()
  return { s, rider, items }
}

test('Wertung: Gesammeltes zaehlt unterwegs nichts, erst am Ende', () => {
  const { s, rider, items } = session()
  rider.mode = 'ride'
  for (const g of [...items.rings, ...items.buoys]) {
    Object.assign(rider, { x: g.x, z: g.z, y: (g.y ?? 0.9) - 0.9 })
    s.checkItems()
  }
  for (let i = 1; i <= 6; i++) s.slalomEvent({ type: 'gate', gate: { index: i - 1 }, n: i, of: 6, all: i === 6, streak: i })
  assert.equal(s.stats.rings, 4)
  assert.equal(s.stats.buoys, 2)
  assert.equal(s.combo.score, 0)
  assert.equal(s.combo.points, 0)
  // Alle sechs Tore einer Runde: einmal je Session, dann versinken sie.
  assert.equal(s.slalomFertig, true)
  assert.equal(items.gesunken, 1)
  s.starten()
  assert.equal(s.slalomFertig, false)
})

test('Wertung: am Ende Prozente auf die Fahrt, alle einer Sorte 50', () => {
  const z = (o) => sammelBonus({ buoysTotal: 15, ringsTotal: 4, gatesTotal: 6, buoys: 0, rings: 0, gates: 0, ...o }, 40000)
  const prozent = (o) => z(o).map((x) => x.prozent)
  assert.deepEqual(prozent({}), [0, 0, 0])
  // Ringe verdoppeln sich, der vierte macht alle.
  assert.deepEqual([1, 2, 3, 4].map((rings) => prozent({ rings })[1]), [5, 10, 20, 50])
  // Bojen und Tore anteilig bis 25, alle 50.
  assert.deepEqual(prozent({ buoys: 8, gates: 3 }), [13, 0, 13])
  assert.deepEqual(prozent({ buoys: 14, gates: 5 }), [23, 0, 21])
  assert.deepEqual(prozent({ buoys: 15, rings: 4, gates: 6 }), [50, 50, 50])
  // Punkte aus der Fahrt, auf zehn gerundet; alles zusammen das 2,5-Fache.
  assert.deepEqual(z({ buoys: 8, rings: 2, gates: 3 }).map((x) => x.punkte), [5200, 4000, 5200])
  const alles = z({ buoys: 15, rings: 4, gates: 6 })
  assert.equal(40000 + alles.reduce((n, x) => n + x.punkte, 0), 100000)
  assert.ok(alles.every((x) => x.alle))
})

test('Wertung: die Auswertung zaehlt die beste Slalomrunde', () => {
  const { s } = session()
  const ergebnisse = []
  s.onErgebnis = (e) => ergebnisse.push(e)
  s.slalom.beste = 4
  s.stats.rings = 2
  s.combo.bonus(10000, 'Runde')
  s.finish()
  const e = ergebnisse[0]
  assert.equal(e.fahrt, 10000)
  assert.deepEqual(e.sammeln.map((x) => [x.art, x.n, x.von, x.prozent]), [['Bojen', 0, 2, 0], ['Ringe', 2, 4, 10], ['Tore', 4, 6, 17]])
  assert.equal(e.score, 10000 + 1000 + 1700)
})

test('Abzeichen: alle Ringe, alle Bojen und der Slalom in einer Session', () => {
  const { s, rider, items } = session()
  const abzeichen = []
  s.onAbzeichen = (id) => abzeichen.push(id)
  rider.mode = 'ride'
  for (const g of items.rings) {
    Object.assign(rider, { x: g.x, z: g.z, y: g.y - 0.9 })
    s.checkItems()
  }
  for (const b of items.buoys) {
    Object.assign(rider, { x: b.x, z: 0, y: 0 })
    s.checkItems()
  }
  assert.deepEqual(abzeichen, [])
  for (let i = 1; i <= 6; i++) s.slalomEvent({ type: 'gate', gate: { index: i - 1 }, n: i, of: 6, all: i === 6, streak: i })
  assert.deepEqual(abzeichen, ['abgeraeumt'])
})

test('Hinweise: nach einem Sturz R, nach 30 s ohne Grab die Erinnerung', () => {
  const { s, rider } = session()
  const hinweise = []
  s.hud.setHint = (t) => hinweise.push(t)
  Object.assign(rider, { mode: 'ride', progress: 400, fakie: false })
  s.handle({ type: 'respawn' })
  s.updateHint(1 / 60)
  assert.match(hinweise.at(-1), /R<\/kbd> zurück an den Steg/)
  // Fuenf Sekunden spaeter ist er weg, dann zehn Sekunden Ruhe.
  for (let i = 0; i < 6 * 60; i++) s.updateHint(1 / 60)
  assert.equal(hinweise.at(-1), '')
  // Gelenkt, gesprungen und gesaltot wird laufend, gegriffen nie.
  for (let i = 0; i < 40 * 60; i++) {
    Object.assign(s.zuletzt, { lenken: s.fahrzeit, springen: s.fahrzeit, salto: s.fahrzeit })
    s.updateHint(1 / 60)
  }
  assert.ok(hinweise.some((t) => /Shift<\/kbd> an die Ski greifen/.test(t)))
  assert.ok(!hinweise.some((t) => /Salto vor und zurück/.test(t)))
})

test('Grab zaehlt nur, wenn man vor der Landung loslaesst', () => {
  // Wie beim 180: kurz nach dem Steg 0,4 s laden und abspringen. In der Luft
  // greifen – bis ins Wasser oder nur die erste halbe Sekunde.
  const sprung = (bisWann) => {
    let phase = 0
    let t0 = 0
    return ride(12, (r, t) => {
      if (r.mode === 'dock') return dockStart(r)
      if (phase === 0 && t > 5 && r.s > 25 && r.s < 45) { phase = 1; t0 = t }
      if (phase === 1) {
        if (t - t0 < 0.4) return { jump: true }
        phase = 2
      }
      if (phase === 2 && r.airborne) return { grab: r.air.time < bisWann }
      return {}
    // Die erste Landung ist der Huepfer vom Startsteg.
    }).events.filter((e) => e.type === 'land')[1]
  }
  const fest = sprung(Infinity)
  const los = sprung(0.5)
  assert.ok(fest && los, 'beide Spruenge gelandet')
  assert.equal(fest.air.grabZuSpaet, true)
  assert.ok(!/Grab/.test(fest.result?.name ?? ''), fest.result?.name)
  assert.ok(!los.air.grabZuSpaet)
  assert.match(los.result.name, /Mute Grab/)
})

test('Abwechslung: derselbe Trick gibt jedes Mal 30 Prozent weniger, nie unter 20', () => {
  const { s } = session()
  const q = { factor: 1, label: 'Sauber', key: 'clean' }
  const land = (name) => {
    const vorher = s.combo.points
    s.handle({ type: 'land', result: { name, points: 1000 }, quality: q })
    return s.combo.points - vorher
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(() => land('360')), [1000, 700, 490, 340, 240, 200, 200])
  // Ein anderer Trick zaehlt wieder voll – Grab und Switch machen ihn anders,
  // Big Air und die Laenge eines Slides nicht.
  assert.equal(land('360 Indy'), 1000)
  assert.equal(land('Switch 360'), 1000)
  assert.equal(land('360 Big Air'), 200)
  assert.equal(land('Box-Slide 12 m'), 1000)
  assert.equal(land('Box-Slide 9 m'), 700)
  // Neue Session: alles wieder voll.
  s.starten()
  assert.equal(land('360'), 1000)
})
