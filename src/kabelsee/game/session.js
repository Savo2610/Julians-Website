import { TRICK } from '../config.js'
import { CABLE_LENGTH } from '../world/cable-path.js'
import { DOCK_S } from '../player/rider-physics.js'
import { Combo, trickSchluessel } from './tricks.js'
import { Slalom } from './slalom.js'

// Der Ablauf einer Session: Titel, Start am Steg, drei Runden, Auswertung.
// Unterwegs zaehlen Tricks und Runden; Bojen, Ringe und der Slalom legen
// am Ende einen Aufschlag drauf (sammelBonus).
// Hier landen die Ereignisse des Fahrmodells und werden zu Punkten,
// Meldungen und Effekten. Die Anzeige selbst macht hud.js.

export const LAPS = 3

// Was auf dem See liegt, zaehlt erst am Ende (Ansage 01.10., dritte Runde):
// als Aufschlag in Prozent auf die gefahrenen Punkte, den die Auswertung
// Zeile fuer Zeile dazuzaehlt. So bleibt die Fahrt den Tricks, und wer
// gut faehrt UND einsammelt, bekommt das meiste – die Haelfte obendrauf
// je Sorte, alles zusammen das 2,5-Fache.
//
// Bojen: anteilig bis 25 %, alle 50 %. Ringe verdoppeln sich wie vorher
// die Punkte: 5, 10, 20 %, alle vier 50 %. Tore: die beste Runde anteilig
// bis 25 %, alle sechs in einer Runde 50 % – danach versinken die Fahnen,
// und die Geraden gehoeren wieder den Kickern.
const ANTEIL = 25
const ALLE = 50
export function sammelBonus({ buoys, buoysTotal, rings, ringsTotal, gates, gatesTotal }, basis) {
  const zeile = (art, n, von, prozent) => ({
    art, n, von, prozent, alle: n > 0 && n === von,
    punkte: Math.round((basis * prozent) / 1000) * 10,
  })
  const anteilig = (n, von) => (n >= von ? ALLE : Math.round((ANTEIL * n) / von))
  return [
    zeile('Bojen', buoys, buoysTotal, anteilig(buoys, buoysTotal)),
    zeile('Ringe', rings, ringsTotal, rings >= ringsTotal ? ALLE : rings ? 5 * 2 ** (rings - 1) : 0),
    zeile('Tore', gates, gatesTotal, anteilig(gates, gatesTotal)),
  ]
}
const fmt = (n) => Math.round(n).toLocaleString('de-DE')

// Neuer Schluessel mit der neuen Wertung (01.10.): Rekorde aus der alten
// sind nicht vergleichbar, und das Angebot fuer die Bestenliste haengt am
// Rekord in diesem Browser.
const REKORD = 'kabelsee.rekord'
function loadBest() {
  try {
    return Number(localStorage.getItem(REKORD)) || 0
  } catch {
    return 0
  }
}
function saveBest(v) {
  try {
    localStorage.setItem(REKORD, String(v))
  } catch {
    // Privates Fenster: dann eben ohne Rekord.
  }
}

export class Session {
  // eingebettet: im Tal hinter dem Badesteg. Dann gibt es keinen Titel, und
  // onErgebnis bekommt die Auswertung (Bestenliste).
  constructor({ rider, cable, collectibles, hud, fx, eingebettet = false, onErgebnis = null, onStart = null, onAbzeichen = null }) {
    this.eingebettet = eingebettet
    this.onAbzeichen = onAbzeichen
    this.onErgebnis = onErgebnis
    this.onStart = onStart
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
    this.stats = { buoys: 0, rings: 0, crashes: 0, bestTrick: null, bestCombo: 0, topSpeed: 0, abgeraeumt: false }
    this.slalomFertig = false
    // Wie oft welcher Trick in dieser Session schon stand (Abwechslung).
    this.gestanden = new Map()
    // Hinweise: Fahrzeit, letzte Benutzung je Taste, laufende Erinnerung.
    this.fahrzeit = 0
    this.zuletzt = { lenken: 0, springen: 0, salto: 0, grab: 0 }
    this._erinnerung = null
    this._ruhe = 0
    this._nachSturz = false
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
  confirm() {
    if (this.state === 'title' || this.state === 'results') this.starten()
  }

  // Allein (veerka.mp/kabelsee/): Esc fuehrt ins Menue. Die Session ist dann
  // vorbei, der Fahrer wartet am Steg, die Anlage faehrt leer weiter.
  zumMenue() {
    if (this.state === 'title') return
    this.reset()
    this.state = 'title'
    this.hud.showTitle(this.best)
    this.fx.snapCamera()
  }

  // Neue Session am Steg, gleich aus welchem Zustand.
  starten(opts) {
    this.reset(opts)
    this.state = 'play'
    this.hud.setMode('play')
    this.fx.snapCamera()
    this.onStart?.()
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
    // Haengt der Buegel, ist der Start aus dem Tal vorbei; ein verpatzter
    // Start zaehlt dann wieder wie gewohnt herunter.
    if (r.hooked) this.ohneZaehlen = false

    if (this.state === 'play') {
      this.checkItems()
      if (!this.slalomFertig) this.slalom.update(r)
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
    this.updateHint(dt)
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
    const p = r.dockProgress
    return {
      text: r.crouch > 0.5 ? 'In der Hocke … gleich geht’s los' : 'Seil strafft sich – <strong>jetzt in die Hocke!</strong>',
      count: p >= 0.62 ? 'JETZT!' : '',
      fill: p, zone: 0.62, ready: r.crouch > 0.5,
    }
  }

  // Was der Fahrer zuletzt benutzt hat, in Fahrzeit. Aus see.js, je Bild mit
  // der Eingabe, die auch das Fahrmodell bekommt.
  merke(inp) {
    const r = this.rider
    if (this.state !== 'play' || r.mode !== 'ride') return
    const t = this.fahrzeit
    if (Math.abs(inp.steer) > 0.3) this.zuletzt.lenken = t
    if (inp.jump) this.zuletzt.springen = t
    if (r.airborne && (inp.throttle || inp.brake)) this.zuletzt.salto = t
    if (r.airborne && inp.grab) this.zuletzt.grab = t
  }

  // Unten ein Hinweis, nie mehr als einer. In der ersten Runde der Reihe nach
  // (lenken, springen, in der Luft), danach nur noch, wenn er etwas sagt:
  // nach einem Sturz einmal R (Ansage 01.10.), und wer eine Taste 30 s
  // nicht benutzt hat, bekommt ihre Erinnerung fuer 5 s – hoechstens alle
  // 10 s eine, damit unten nicht dauernd etwas steht.
  updateHint(dt = 0) {
    const r = this.rider
    if (this.state !== 'play') return this.hud.setHint('')
    const touch = this.hud.touch
    const k = (taste, breit = false) => `<kbd${breit ? ' class="k-wide"' : ''}>${taste}</kbd>`
    const TEXT = {
      lenken: touch ? '◀ ▶ kanten – nach außen schwingen macht schnell' : `${k('A')}${k('D')} kanten – nach außen schwingen macht schnell`,
      springen: touch ? 'Vor dem Kicker <b>Sprung</b> halten, an der Kante loslassen' : `Vor dem Kicker ${k('Leertaste', true)} halten, an der Kante loslassen`,
      salto: touch ? 'In der Luft: ▲ ▼ Salto vor und zurück' : `In der Luft: ${k('W')}${k('S')} Salto vor und zurück`,
      grab: touch ? 'In der Luft: <b>Grab</b> an die Ski greifen' : `In der Luft: ${k('Shift', true)} an die Ski greifen`,
      neu: touch ? '↻ oben rechts: zurück an den Steg – neue Session' : `${k('R')} zurück an den Steg – neue Session`,
    }
    if (r.mode === 'ride') this.fahrzeit += dt
    this._ruhe = Math.max(0, this._ruhe - dt)
    if (this._erinnerung) {
      this._erinnerung.bis -= dt
      if (this._erinnerung.bis <= 0) {
        this._erinnerung = null
        this._ruhe = 10
      }
    }

    if (r.mode === 'dock') {
      return this.hud.setHint(touch ? '<b>Sprung</b> halten, wenn sich das Seil strafft' : `${k('Leertaste', true)} halten, wenn sich das Seil strafft`)
    }
    if (r.mode !== 'ride') return this.hud.setHint('')
    if (r.fakie) {
      return this.hud.setHint(touch ? 'Rückwärts – <b>Sprung</b> und ◀ ▶: ein 180 dreht dich zurück' : `Rückwärts – ${k('Leertaste', true)} und ${k('A')}${k('D')}: ein 180 dreht dich zurück`)
    }
    // Nach einem Sturz gleich, auch mitten in der ersten Runde.
    if (this._nachSturz && !this._erinnerung) {
      this._erinnerung = { text: TEXT.neu, bis: 5 }
      this._nachSturz = false
    }
    if (this._erinnerung) return this.hud.setHint(this._erinnerung.text)

    // Erste Runde: die Grundlagen der Reihe nach.
    if (r.progress < 60) return this.hud.setHint(TEXT.lenken)
    if (r.progress < 140) return this.hud.setHint(TEXT.springen)
    if (r.progress < 260) return this.hud.setHint(touch ? 'In der Luft: ◀ ▶ drehen · ▲ ▼ Salto · <b>Grab</b>' : `In der Luft: ${k('A')}${k('D')} drehen · ${k('W')}${k('S')} Salto · ${k('Shift', true)} Grab`)

    const alt = this._ruhe <= 0 && Object.entries(this.zuletzt).find(([, t]) => this.fahrzeit - t > 30)
    if (alt) {
      this._erinnerung = { text: TEXT[alt[0]], bis: 5 }
      // Erinnert ist erinnert: dieselbe Taste fruehestens in 30 s wieder,
      // auch wenn sie bis dahin nicht benutzt wurde.
      this.zuletzt[alt[0]] = this.fahrzeit
    }
    this.hud.setHint(this._erinnerung?.text ?? '')
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
        if (e.air?.grabZuSpaet) this.hud.showToast('Grab zu spät losgelassen', 1.4)
        if (e.result) {
          const key = trickSchluessel(e.result.name)
          const mal = (this.gestanden.get(key) ?? 0) + 1
          this.gestanden.set(key, mal)
          const pts = this.combo.trick(e.result, e.quality, mal)
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
        // Es geht weiter – jetzt ist der Moment fuer „R: neue Session“.
        if (this.state === 'play') this._nachSturz = true
        break
      case 'glance':
        this.hud.showToast('An der Kante abgeglitten', 1)
        fx.glance?.(e)
        break
    }
  }

  comboEvent(e) {
    if (e.type === 'trick') {
      this.hud.showTrick(e.name, `${e.quality} +${fmt(e.points)}${e.mal > 1 ? ` · ${e.mal}. Mal` : ''}`, e.key)
    } else if (e.type === 'bank' && e.multiplier > 1) {
      this.hud.showToast(`Kombo ×${e.multiplier.toLocaleString('de-DE')}  +${fmt(e.points)}`, 1.6)
    } else if (e.type === 'lost') {
      this.hud.showToast(`Kombo verloren (${fmt(e.points)})`, 1.4)
    } else if (e.type === 'bonus' && e.label === 'Runde') {
      // Slalom und Bojen melden sich selbst, gross in der Mitte.
      this.hud.showToast(`Runde geschafft +${fmt(e.points)}`, 1.4)
    }
  }

  slalomEvent(e) {
    if (e.type === 'lap') {
      this.items.resetGates?.()
    } else if (e.type === 'gate') {
      this.items.setGate?.(e.gate.index, true)
      this.fx.gate?.(e.gate)
      if (e.all) {
        this.slalomFertig = true
        this.hud.showTrick('Slalom', `alle ${e.of} Tore · +${ALLE} % am Ende`, 'perfect')
        this.items.versenkeTore?.()
        this.abgeraeumt()
      } else {
        this.hud.showToast(`Tor ${e.n}/${e.of}`, 1)
      }
    } else if (e.type === 'miss') {
      this.hud.showToast('Tor verpasst', 1.2)
    }
  }

  // Alle Ringe, alle Bojen und alle Tore einer Runde in derselben Session:
  // das Abzeichen „Abgeraeumt“ (Pistenpass). Einmal je Session gemeldet.
  abgeraeumt() {
    const alles = this.stats.rings === this.items.rings.length
      && this.stats.buoys === this.items.buoys.length && this.slalomFertig
    if (!alles || this.stats.abgeraeumt) return
    this.stats.abgeraeumt = true
    this.hud.showToast('Alles abgeräumt – neues Abzeichen', 2.4)
    this.onAbzeichen?.('abgeraeumt')
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
        this.fx.collect(b)
        if (this.stats.buoys === this.items.buoys.length) {
          this.hud.showTrick('Alle Bojen', `+${ALLE} % am Ende`, 'perfect')
          this.abgeraeumt()
        }
      }
    }
    for (const g of this.items.rings) {
      if (g.taken) continue
      const d = Math.hypot(g.x - r.x, g.z - r.z, g.y - (r.y + 0.9))
      if (d < g.radius + 0.4) {
        g.taken = true
        g.pop = 0.4
        this.stats.rings += 1
        if (this.stats.rings === this.items.rings.length) {
          this.hud.showTrick('Alle Ringe', `+${ALLE} % am Ende`, 'perfect')
          this.abgeraeumt()
        } else {
          this.hud.showToast(`Ring ${this.stats.rings}/${this.items.rings.length}`, 1.2)
        }
        this.fx.collect(g)
      }
    }
  }

  finish() {
    this.combo.bank()
    for (const e of this.combo.events) this.comboEvent(e)
    this.combo.events.length = 0
    const fahrt = this.combo.score
    const sammeln = sammelBonus({
      buoys: this.stats.buoys, buoysTotal: this.items.buoys.length,
      rings: this.stats.rings, ringsTotal: this.items.rings.length,
      gates: this.slalom.beste, gatesTotal: this.slalom.gates.length,
    }, fahrt)
    const score = fahrt + sammeln.reduce((n, z) => n + z.punkte, 0)
    const bisher = this.best
    const record = score > this.best && score > 0
    if (record) {
      this.best = score
      saveBest(score)
    }
    this.state = 'results'
    const ergebnis = {
      score, fahrt, sammeln, record, best: this.best, bisher,
      bestTrick: this.stats.bestTrick,
      bestCombo: this.stats.bestCombo,
      verschiedene: this.gestanden.size,
      topSpeed: this.stats.topSpeed, crashes: this.stats.crashes,
    }
    this.hud.showResults(ergebnis)
    this.onErgebnis?.(ergebnis)
  }
}

