import { TRICK } from '../config.js'
import { CABLE_LENGTH } from '../world/cable-path.js'
import { DOCK_S } from '../player/rider-physics.js'
import { Combo } from './tricks.js'
import { Slalom } from './slalom.js'

// Der Ablauf einer Session: Titel, Start am Steg, drei Runden, Auswertung.
// Gewertet werden Tricks, Bojen, Ringe und der Slalom.
// Hier landen die Ereignisse des Fahrmodells und werden zu Punkten,
// Meldungen und Effekten. Die Anzeige selbst macht hud.js.

export const LAPS = 3
// Slalom: jede Fahne mehr als die vorige in derselben Runde (150, 200 …
// 400), alle sechs dazu 1200. Zusammen knapp 3000 je Runde, so viel wie zwei
// gute Spruenge; dafuer laesst man auf der Suedgeraden beide Kicker liegen.
const GATE_POINTS = 100
const GATE_STEP = 50
const SLALOM_BONUS = 1200
const fmt = (n) => Math.round(n).toLocaleString('de-DE')

function loadBest() {
  try {
    return Number(localStorage.getItem('kabelsee.best')) || 0
  } catch {
    return 0
  }
}
function saveBest(v) {
  try {
    localStorage.setItem('kabelsee.best', String(v))
  } catch {
    // Privates Fenster: dann eben ohne Rekord.
  }
}

export class Session {
  // eingebettet: im Tal hinter dem Badesteg. Dann gibt es keinen Titel, und
  // onErgebnis bekommt die Auswertung (Bestenliste).
  constructor({ rider, cable, collectibles, hud, fx, eingebettet = false, onErgebnis = null }) {
    this.eingebettet = eingebettet
    this.onErgebnis = onErgebnis
    this.rider = rider
    this.cable = cable
    this.items = collectibles
    this.hud = hud
    this.fx = fx
    this.best = loadBest()
    this.state = 'title'
    this.combo = new Combo()
    this.fade = 0
    this._pending = null
    this.reset()
    if (!eingebettet) hud.showTitle(this.best)
  }

  // ankunft: Sekunden bis zum Buegel, siehe RiderPhysics.toDock().
  reset({ ankunft = null } = {}) {
    this.combo = new Combo()
    this.slalom = new Slalom()
    this.stats = { buoys: 0, rings: 0, crashes: 0, bestTrick: null, bestCombo: 0, topSpeed: 0 }
    this.finishTimer = 0
    this.items.reset()
    this.rider.toDock(ankunft)
    // Kommt man aus dem Tal, lief der Countdown schon am Badesteg: dann
    // zaehlt der Steg nicht noch einmal herunter. Nach einem verpatzten
    // Start (neuer Buegel) wieder wie gewohnt.
    this.ohneZaehlen = ankunft !== null
    this.lap = 1
  }

  // Enter / Antippen.
  confirm(opts) {
    if (this.state === 'title' || this.state === 'results') {
      this.reset(opts)
      this.state = 'play'
      this.hud.setMode('play')
      this.fx.snapCamera()
    }
  }

  // R: zurueck an den Steg, hinter der Blende.
  restart() {
    if (this.state !== 'play') return
    this.transition(() => {
      this.reset()
      this.fx.snapCamera()
    })
  }

  transition(fn) {
    this._pending = fn
  }

  update(dt) {
    const r = this.rider
    // Blende: zu, solange eine Aktion wartet oder der Sturz gleich in den
    // Wiedereinstieg uebergeht; sonst auf.
    const target = this._pending || (r.mode === 'crash' && r.crashTimer < 0.3 && !r.released) ? 1 : 0
    this.fade += Math.sign(target - this.fade) * Math.min(Math.abs(target - this.fade), dt * 4)
    if (this._pending && this.fade >= 1) {
      this._pending()
      this._pending = null
    }
    this.hud.setFade(this.fade)

    for (const e of r.events) this.handle(e)
    r.events.length = 0

    if (this.state === 'play') {
      this.checkItems()
      this.slalom.update(r)
      for (const e of this.slalom.events) this.slalomEvent(e)
      this.slalom.events.length = 0
      const banked = this.combo.update(dt)
      if (banked) this.stats.bestCombo = Math.max(this.stats.bestCombo, banked)
      for (const e of this.combo.events) this.comboEvent(e)
      this.combo.events.length = 0
      if (r.mode === 'ride' && !r.airborne) this.stats.topSpeed = Math.max(this.stats.topSpeed, r.speed)

      // Runden: gezaehlt wird der Weg auf der Bahn seit dem Steg.
      const lap = 1 + Math.floor(Math.max(0, r.progress) / CABLE_LENGTH)
      if (lap > this.lap && lap <= LAPS) {
        this.lap = lap
        this.hud.showToast(lap === LAPS ? 'Letzte Runde' : `Runde ${lap}`)
        this.combo.bonus(300, 'Runde')
      }
      if (lap > LAPS && !r.released && !r.airborne && r.mode === 'ride') {
        r.release()
        this.hud.showToast('Seil los – Session vorbei', 2)
        this.finishTimer = 2.4
      }
      if (this.finishTimer > 0) {
        this.finishTimer -= dt
        if (this.finishTimer <= 0) this.finish()
      }
    }

    this.hud.update(dt, {
      score: this.combo.score,
      combo: this.combo,
      comboWindow: TRICK.comboWindow,
      lap: this.lap,
      laps: LAPS,
      buoys: this.stats.buoys,
      buoysTotal: this.items.buoys.length,
      speed: r.mode === 'crash' ? 0 : r.speed,
      dock: this.state === 'play' ? this.dockState() : null,
    })
    this.updateHint()
  }

  dockState() {
    const r = this.rider
    if (r.mode !== 'dock') return null
    if (!r.hooked) {
      const next = this.cable.nextArriving(DOCK_S)
      const s = Math.max(0, next.seconds)
      if (this.ohneZaehlen) {
        return { text: 'Gleich kommt der Bügel', count: '', fill: 0, zone: 0.62, ready: r.crouch > 0.5 }
      }
      return {
        text: `Der Bügel kommt <strong>${s.toFixed(1)}</strong>`,
        // Countdown erst in den letzten drei Sekunden, vorher wartet man nur.
        // Aus der gerundeten Zahl, sonst stand bei „1.0“ noch die 2.
        count: s < 3 ? String(Math.max(1, Math.ceil(+s.toFixed(1)))) : '',
        fill: 0, zone: 0.62, ready: r.crouch > 0.5,
      }
    }
    this.ohneZaehlen = false
    const p = r.dockProgress
    return {
      text: r.crouch > 0.5 ? 'In der Hocke … gleich geht’s los' : 'Seil strafft sich – <strong>jetzt in die Hocke!</strong>',
      count: p >= 0.62 ? 'JETZT!' : '',
      fill: p, zone: 0.62, ready: r.crouch > 0.5,
    }
  }

  updateHint() {
    const r = this.rider
    if (this.state !== 'play') return this.hud.setHint('')
    const touch = this.hud.touch
    if (r.mode === 'dock') {
      this.hud.setHint(touch ? '<b>Sprung</b> halten, wenn sich das Seil strafft' : '<kbd class="k-wide">Leertaste</kbd> halten, wenn sich das Seil strafft')
    } else if (r.fakie && r.mode === 'ride') {
      this.hud.setHint(touch ? 'Rückwärts – <b>Sprung</b> und ◀ ▶: ein 180 dreht dich zurück' : 'Rückwärts – <kbd class="k-wide">Leertaste</kbd> und <kbd>A</kbd><kbd>D</kbd>: ein 180 dreht dich zurück')
    } else if (r.progress < 60 && r.mode === 'ride') {
      this.hud.setHint(touch ? '◀ ▶ kanten – nach außen schwingen macht schnell' : '<kbd>A</kbd><kbd>D</kbd> kanten – nach außen schwingen macht schnell')
    } else if (r.progress < 140 && r.mode === 'ride') {
      this.hud.setHint(touch ? 'Vor dem Kicker <b>Sprung</b> halten, an der Kante loslassen' : 'Vor dem Kicker <kbd class="k-wide">Leertaste</kbd> halten, an der Kante loslassen')
    } else if (r.progress < 260 && r.mode === 'ride') {
      this.hud.setHint(touch ? 'In der Luft: ◀ ▶ drehen · ▲ ▼ Salto · <b>Grab</b>' : 'In der Luft: <kbd>A</kbd><kbd>D</kbd> drehen · <kbd>W</kbd><kbd>S</kbd> Salto · <kbd class="k-wide">Shift</kbd> Grab')
    } else {
      this.hud.setHint('')
    }
  }

  handle(e) {
    const fx = this.fx
    switch (e.type) {
      case 'hook':
        fx.hook()
        break
      case 'start':
        if (e.perfect) {
          this.hud.showTrick('Katapult-Start', `+250 · jetzt drehen!`, 'perfect')
          this.combo.collect(250, 'Start')
        } else {
          this.hud.showTrick('Los geht’s', '', 'clean')
        }
        fx.start()
        break
      case 'launch':
        fx.launch(e)
        break
      case 'land': {
        fx.land(e)
        if (e.result) {
          const pts = this.combo.trick(e.result, e.quality)
          if (!this.stats.bestTrick || pts > this.stats.bestTrick.points) this.stats.bestTrick = { name: e.result.name, points: pts }
        }
        break
      }
      case 'crash':
        this.stats.crashes += 1
        this.combo.crash()
        this.hud.showTrick(e.reason, 'Sturz', 'crash')
        fx.crash(e)
        break
      case 'respawn':
        fx.snapCamera()
        break
      case 'glance':
        this.hud.showToast('An der Kante abgeglitten', 1)
        fx.glance?.(e)
        break
    }
  }

  comboEvent(e) {
    if (e.type === 'trick') {
      this.hud.showTrick(e.name, `${e.quality} +${fmt(e.points)}`, e.key)
    } else if (e.type === 'bank' && e.multiplier > 1) {
      this.hud.showToast(`Kombo ×${e.multiplier}  +${fmt(e.points)}`, 1.6)
    } else if (e.type === 'lost') {
      this.hud.showToast(`Kombo verloren (${fmt(e.points)})`, 1.4)
    } else if (e.type === 'bonus') {
      this.hud.showToast(`Runde geschafft +${fmt(e.points)}`, 1.4)
    }
  }

  slalomEvent(e) {
    if (e.type === 'lap') {
      this.items.resetGates?.()
    } else if (e.type === 'gate') {
      this.items.setGate?.(e.gate.index, true)
      const pts = GATE_POINTS + GATE_STEP * e.streak
      this.combo.collect(pts, 'Tor')
      this.fx.gate?.(e.gate)
      if (e.all) {
        this.combo.collect(SLALOM_BONUS, 'Slalom')
        this.hud.showTrick('Slalom', `alle ${e.of} Tore +${SLALOM_BONUS}`, 'perfect')
      } else {
        this.hud.showToast(`Tor ${e.n}/${e.of}  +${pts}`, 1)
      }
    } else if (e.type === 'miss') {
      this.hud.showToast('Tor verpasst', 1.2)
    }
  }

  checkItems() {
    const r = this.rider
    if (r.mode !== 'ride') return
    for (const b of this.items.buoys) {
      if (b.taken) continue
      if (Math.hypot(b.x - r.x, b.z - r.z) < 1.7 && r.y < 1.8) {
        b.taken = true
        b.pop = 0.35
        this.stats.buoys += 1
        this.combo.collect(b.points, 'Boje')
        this.fx.collect(b)
      }
    }
    for (const g of this.items.rings) {
      if (g.taken) continue
      const d = Math.hypot(g.x - r.x, g.z - r.z, g.y - (r.y + 0.9))
      if (d < g.radius + 0.4) {
        g.taken = true
        g.pop = 0.4
        this.stats.rings += 1
        this.combo.collect(g.points, 'Ring')
        this.hud.showToast(`Ring +${g.points}`, 1)
        this.fx.collect(g)
      }
    }
  }

  finish() {
    this.combo.bank()
    for (const e of this.combo.events) this.comboEvent(e)
    this.combo.events.length = 0
    const score = this.combo.score
    const record = score > this.best && score > 0
    if (record) {
      this.best = score
      saveBest(score)
    }
    this.state = 'results'
    const ergebnis = {
      score, record, best: this.best,
      bestTrick: this.stats.bestTrick,
      bestCombo: this.stats.bestCombo,
      buoys: this.stats.buoys, buoysTotal: this.items.buoys.length,
      rings: this.stats.rings, ringsTotal: this.items.rings.length,
      topSpeed: this.stats.topSpeed, crashes: this.stats.crashes,
      gates: this.slalom.total, gatesTotal: this.slalom.gates.length * LAPS, slaloms: this.slalom.runs,
    }
    this.hud.showResults(ergebnis)
    this.onErgebnis?.(ergebnis)
  }
}

