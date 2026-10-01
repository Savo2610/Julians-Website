// Die Anzeige. Wie im Skital gibt es keine Leiste: was nur kurz ueber dem
// See steht, ist Frosttext ohne Behaelter; Glas gibt es nur fuer das, was
// man bedient – Titel und Auswertung.

const fmt = (n) => Math.round(n).toLocaleString('de-DE')

function el(tag, cls, parent, html = '') {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html) e.innerHTML = html
  parent.appendChild(e)
  return e
}

export class Hud {
  constructor(root, { touch = false, eingebettet = false } = {}) {
    this.root = root
    this.touch = touch

    this.score = el('div', 'frost hud-score', root, '<span class="frost-art">Punkte</span><strong>0</strong>')
    this.scoreValue = this.score.querySelector('strong')
    this.combo = el('div', 'frost hud-combo', root, '<span class="combo-pts"></span><span class="combo-x"></span><i class="combo-bar"><b></b></i>')
    this.comboPts = this.combo.querySelector('.combo-pts')
    this.comboX = this.combo.querySelector('.combo-x')
    this.comboBar = this.combo.querySelector('.combo-bar b')

    this.stats = el('div', 'frost hud-stats', root,
      '<span><span class="frost-art">Runde</span><strong class="s-lap">1/3</strong></span>' +
      '<span><span class="frost-art">Bojen</span><strong class="s-buoy">0</strong></span>' +
      '<span><span class="frost-art">km/h</span><strong class="s-speed">0</strong></span>')
    this.sLap = this.stats.querySelector('.s-lap')
    this.sBuoy = this.stats.querySelector('.s-buoy')
    this.sSpeed = this.stats.querySelector('.s-speed')

    this.trick = el('div', 'frost see-trick', root, '<strong></strong><small></small>')
    this.trickName = this.trick.querySelector('strong')
    this.trickSub = this.trick.querySelector('small')
    this._trickTimer = 0

    this.toast = el('div', 'frost toast', root)
    this._toastTimer = 0

    this.dockCount = el('div', 'frost dock-count', root)
    this._count = ''
    this.dock = el('div', 'frost dock-hud', root,
      '<div class="dock-text"></div><div class="dock-meter"><i class="dock-zone"></i><b></b></div>')
    this.dockText = this.dock.querySelector('.dock-text')
    this.dockFill = this.dock.querySelector('.dock-meter b')

    this.hint = el('div', 'frost hint', root)

    this.fade = el('div', 'fade', root)

    const keys = touch
      ? `<div class="keys">
          <span>◀ ▶</span><em>kanten und ausschwingen, auf der Box und in der Luft drehen</em>
          <span>▲ ▼</span><em>ziehen / bremsen, in der Luft Salto vor / zurück</em>
          <span>Sprung</span><em>halten federt ein, loslassen springt</em>
          <span>Grab</span><em>in der Luft an die Ski greifen</em>
        </div>`
      : `<div class="keys">
          <span><kbd>A</kbd><kbd>D</kbd></span><em>kanten und ausschwingen, in der Luft drehen</em>
          <span><kbd>W</kbd><kbd>S</kbd></span><em>ziehen / bremsen, in der Luft Salto vor / zurück</em>
          <span><kbd class="k-wide">Leertaste</kbd></span><em>halten federt ein, loslassen springt</em>
          <span><kbd class="k-wide">Shift</kbd></span><em>Grab in der Luft</em>
          <span><kbd>R</kbd></span><em>zurück an den Steg</em>
          <span><kbd class="k-wide">Esc</kbd></span><em>${eingebettet ? 'zurück in den Winter' : 'Menü'}</em>
        </div>`
    const taste = (k, breit = false) => (touch ? '' : `<kbd${breit ? ' class="k-wide"' : ''}>${k}</kbd> `)
    // Allein (veerka.mp/kabelsee/) ist der Titel das Menue: losfahren,
    // Bestenliste, zurueck ins Skital. Im Tal gibt es ihn nicht.
    this.title = el('div', 'glass panel title-panel', root, `
      <div class="panel-kicker">Wasserski am Kabel</div>
      <h1>Kabelsee</h1>
      <p class="lead">Drei Runden um die Insel. Schwing nach außen, dann bist du schneller als das Seil. Spring über die Kicker oder slide die Rail und halte die Kombo am Leben. Bojen, Ringe und Fahnen legen am Ende Prozente auf deine Punkte – alle von einer Sorte die Hälfte obendrauf.</p>
      ${keys}
      <div class="best"></div>
      <button class="go" type="button">${taste('Enter', true)}Auf den Steg</button>
      <button class="liste" type="button">${taste('B')}Bestenliste</button>
      <a class="heim" href="/">Ins Skital – veerka.mp</a>
    `)
    this.titleBest = this.title.querySelector('.best')
    this.titleGo = this.title.querySelector('.go')
    this.titleListe = this.title.querySelector('.liste')

    this.results = el('div', 'glass panel results-panel', root, `
      <div class="panel-kicker">Session vorbei</div>
      <h2 class="r-score">0</h2>
      <div class="r-record"></div>
      <div class="r-abrechnung"></div>
      <dl class="r-list"></dl>
      <button class="go" type="button">${taste('Enter', true)}Noch eine Session</button>
      <button class="liste" type="button">${taste('B')}<span>Bestenliste</span></button>
      <button class="back" type="button">${taste('Esc', true)}${eingebettet ? 'Zurück in den Winter' : 'Menü'}</button>
    `)
    this.rScore = this.results.querySelector('.r-score')
    this.rRecord = this.results.querySelector('.r-record')
    this.rList = this.results.querySelector('.r-list')
    this.rAbrechnung = this.results.querySelector('.r-abrechnung')
    this._abrechnung = null
    this.resultsGo = this.results.querySelector('.go')
    this.resultsBack = this.results.querySelector('.back')
    this.resultsListe = this.results.querySelector('.liste')

    // Am Handy gibt es kein Esc. Im Tal sitzt dort oben rechts der
    // Kartenknopf; im Sommer fuehrt derselbe Platz zurueck in den Winter
    // (Schneeflocke), allein ins Menue (drei Striche).
    const SCHNEEFLOCKE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5M9.5 4l2.5 2.5L14.5 4M9.5 20l2.5-2.5 2.5 2.5M4.2 10.3l3.4.9-.9 3.4M19.8 13.7l-3.4-.9.9-3.4M4.2 13.7l3.4-.9-.9-3.4M19.8 10.3l-3.4.9.9 3.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    const MENUE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
    this.winter = touch ? el('button', 'glass t-winter', root, eingebettet ? SCHNEEFLOCKE : MENUE) : null
    if (this.winter) {
      this.winter.type = 'button'
      this.winter.setAttribute('aria-label', eingebettet ? 'Zurück in den Winter' : 'Menü')
    }
    // Darunter das R der Tastatur: zurueck an den Steg, neue Session.
    const NEU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.2 12a7.2 7.2 0 1 1-2.1-5.1M19.5 4.2v4.6h-4.6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    this.neu = touch ? el('button', 'glass t-winter t-neu', root, NEU) : null
    if (this.neu) {
      this.neu.type = 'button'
      this.neu.setAttribute('aria-label', 'Neu starten')
    }
  }

  setMode(mode) {
    this.root.dataset.mode = mode
  }

  showTitle(best) {
    this.titleBest.innerHTML = best > 0 ? `Rekord <strong>${fmt(best)}</strong>` : ''
    this.setMode('title')
  }

  // Die Auswertung zaehlt vor: erst steht, was gefahren wurde, dann kommen
  // Bojen, Ringe und Tore Zeile fuer Zeile dazu und die grosse Zahl laeuft
  // mit (Ansage 01.10.). Getaktet ueber update(dt), damit es im Test und mit
  // __kabel.step genauso laeuft wie im Bild.
  showResults(r) {
    const zeile = (z) => `
      <div class="r-zeile${z.alle ? ' alle' : ''}${z.punkte ? '' : ' leer'}">
        <span>${z.art} <small>${z.n} von ${z.von}</small></span>
        <b>+${z.prozent} %</b><strong>+${fmt(z.punkte)}</strong>
      </div>`
    this.rAbrechnung.innerHTML = `
      <div class="r-zeile r-fahrt da"><span>Gefahren</span><b></b><strong>${fmt(r.fahrt)}</strong></div>
      ${r.sammeln.map(zeile).join('')}`
    this.rList.innerHTML = `
      <dt>Bester Trick</dt><dd>${r.bestTrick ? `${r.bestTrick.name} <small>${fmt(r.bestTrick.points)}</small>` : '–'}</dd>
      <dt>Größte Kombo</dt><dd>${r.bestCombo ? fmt(r.bestCombo) : '–'}</dd>
      <dt>Verschiedene Tricks</dt><dd>${r.verschiedene || '–'}</dd>
      <dt>Spitze</dt><dd>${Math.round(r.topSpeed * 3.6)} km/h</dd>
      <dt>Stürze</dt><dd>${r.crashes}</dd>`
    // Den alten Rekord sieht man gleich; ein neuer kommt erst am Schluss.
    this.rRecord.textContent = r.bisher ? `Rekord ${fmt(r.bisher)}` : ''
    this.rRecord.classList.remove('new')
    this.rScore.textContent = fmt(r.fahrt)
    this._abrechnung = {
      t: 0, stand: r.fahrt, schritt: -1, r,
      zeilen: [...this.rAbrechnung.querySelectorAll('.r-zeile:not(.r-fahrt)')],
    }
    if (globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) this.abrechnen(Infinity)
    this.setMode('results')
  }

  // Takt der Auswertung: 0,6 s Ruhe, dann je Zeile 0,9 s – sie erscheint,
  // und 0,15 bis 0,8 s danach laeuft ihr Aufschlag in die grosse Zahl.
  abrechnen(dt) {
    const a = this._abrechnung
    if (!a) return
    a.t += dt
    const PAUSE = 0.6
    const TAKT = 0.9
    const i = Math.min(a.zeilen.length, Math.floor((a.t - PAUSE) / TAKT))
    while (a.schritt < i) {
      // Abgeschlossene Zeile: ihr Aufschlag steht ganz in der Zahl.
      if (a.schritt >= 0) a.stand += a.r.sammeln[a.schritt].punkte
      a.schritt += 1
      const z = a.zeilen[a.schritt]
      if (z) {
        z.classList.add('da')
        if (a.r.sammeln[a.schritt].punkte) this.pochen(this.rScore)
      }
    }
    if (a.schritt >= a.zeilen.length) {
      this.rScore.textContent = fmt(a.r.score)
      if (a.r.record) {
        this.rRecord.textContent = 'Neuer Rekord!'
        this.rRecord.classList.add('new')
        this.pochen(this.rRecord)
      }
      this._abrechnung = null
      return
    }
    if (i < 0) return
    const k = Math.min(1, Math.max(0, (a.t - PAUSE - i * TAKT - 0.15) / 0.65))
    const weich = 1 - (1 - k) ** 3
    this.rScore.textContent = fmt(a.stand + a.r.sammeln[i].punkte * weich)
  }

  pochen(e) {
    e.classList.remove('poch')
    void e.offsetWidth
    e.classList.add('poch')
  }

  // Neuer eigener Rekord mit gueltigen Marken: dann traegt B ein, sonst
  // zeigt es nur die Liste (kabelsee/bestenliste.js).
  angebot(an) {
    this.resultsListe.querySelector('span').textContent = an ? 'In die Bestenliste' : 'Bestenliste'
    this.resultsListe.classList.toggle('neu', an)
  }

  showTrick(name, sub, key = '') {
    this.trickName.textContent = name
    this.trickSub.textContent = sub
    this.trick.dataset.q = key
    this.trick.classList.remove('visible')
    void this.trick.offsetWidth
    this.trick.classList.add('visible')
    this._trickTimer = 1.8
  }

  showToast(text, time = 1.4) {
    this.toast.textContent = text
    this.toast.classList.add('visible')
    this._toastTimer = time
  }

  setHint(text) {
    if (this._hint === text) return
    this._hint = text
    this.hint.innerHTML = text || ''
    this.hint.classList.toggle('visible', !!text)
  }

  setFade(v) {
    this.fade.style.opacity = v.toFixed(3)
  }

  update(dt, s) {
    if (this.root.dataset.mode === 'results') this.abrechnen(dt)
    this.scoreValue.textContent = fmt(s.score)
    const c = s.combo
    const on = c.points > 0
    this.combo.classList.toggle('visible', on)
    if (on) {
      this.comboPts.textContent = `+${fmt(c.points)}`
      this.comboX.textContent = c.multiplier > 1 ? `×${c.multiplier.toLocaleString('de-DE')}` : ''
      this.comboBar.style.transform = `scaleX(${Math.max(0, c.timer / s.comboWindow).toFixed(3)})`
    }
    this.sLap.textContent = `${Math.min(s.laps, s.lap)}/${s.laps}`
    this.sBuoy.textContent = `${s.buoys}/${s.buoysTotal}`
    this.sSpeed.textContent = Math.round(s.speed * 3.6)

    // Start am Steg.
    const d = s.dock
    this.dock.classList.toggle('visible', !!d)
    // Grosse Zahl in der Mitte: 3 · 2 · 1, dann JETZT. Jeder Wechsel pocht
    // einmal, damit man den Takt im Augenwinkel mitbekommt.
    const count = d?.count || ''
    if (count !== this._count) {
      this._count = count
      this.dockCount.textContent = count
      this.dockCount.classList.remove('beat')
      void this.dockCount.offsetWidth
      if (count) this.dockCount.classList.add('beat')
      this.dockCount.dataset.now = count === 'JETZT!' ? '1' : ''
    }
    if (d) {
      this.dockText.innerHTML = d.text
      this.dockFill.style.transform = `scaleX(${d.fill.toFixed(3)})`
      this.dock.dataset.ready = d.ready ? '1' : ''
      this.dock.style.setProperty('--zone', `${(d.zone * 100).toFixed(1)}%`)
    }

    if (this._trickTimer > 0) {
      this._trickTimer -= dt
      if (this._trickTimer <= 0) this.trick.classList.remove('visible')
    }
    if (this._toastTimer > 0) {
      this._toastTimer -= dt
      if (this._toastTimer <= 0) this.toast.classList.remove('visible')
    }
  }
}
