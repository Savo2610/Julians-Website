import { TOUCH } from '../core/device.js'
import { MEDALS } from '../world/attractions/medaillen.js'

// Die Bestenliste des Slaloms – Gegenstueck zu worker/slalom.js.
//
// Ablauf: beim Durchfahren des Startbogens holt das Spiel still eine
// Startmarke, im Ziel eine Zielmarke. Nur bei einer neuen eigenen
// Bestzeit und wenn beides geklappt hat, steht
// unter der Zeitnahme acht Sekunden lang „⏎ In die Bestenliste“. Wer nicht
// will, faehrt einfach weiter – gefragt wird nie, eingetragen nur auf Enter.
//
// Ohne Netz oder auf einem Host ohne /api (vite ohne wrangler dev) passiert
// nichts: keine Marke, kein Angebot, der Reiter sagt, dass die Liste gerade
// nicht erreichbar ist.

const API = '/api/slalom'
// Der Name gilt fuer beide Listen: wer am Slalom „Jule“ heisst, heisst am
// Kabelsee auch so.
export const NAME_KEY = 'skiportfolio.slalom.name'
const EIGENE_KEY = 'skiportfolio.slalom.eigene'
const ANGEBOT_DAUER = 8

export const lesen = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
export const schreiben = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* privat */ } }

export async function post(pfad, body, api = API) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 6000)
  try {
    const r = await fetch(`${api}/${pfad}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    })
    const daten = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(daten.fehler || `Fehler ${r.status}`)
    return daten
  } finally {
    clearTimeout(t)
  }
}

export const zeitText = (z) => z.toFixed(2).replace('.', ',')

function wann(ms) {
  const tage = Math.floor((Date.now() - ms) / 86400000)
  const heute = new Date().toDateString() === new Date(ms).toDateString()
  if (heute) return 'heute'
  if (tage <= 1) return 'gestern'
  return `vor ${tage} Tagen`
}

const medaille = (zeit) => MEDALS.find((m) => zeit <= m.time)?.name.toLowerCase() ?? null
const punkteText = (p) => Math.round(p).toLocaleString('de-DE')

// Zwei Listen, eine Darstellung: der Slalom zaehlt Zeit (kleiner ist
// besser), der Kabelsee Punkte (siehe src/sommer/bestenliste.js).
export const LISTEN = {
  slalom: {
    titel: 'Slalom',
    unter: (t) => `Bestzeiten der letzten ${t} Tage`,
    zahl: (d) => `${d.fahrten} ${d.fahrten === 1 ? 'Fahrt' : 'Fahrten'}`,
    leer: 'Noch niemand eingetragen. Fahr die Rodelbahn durch die vier Tore und sei die erste Zeit hier.',
    wert: (f) => zeitText(f.zeit),
    eigeneKey: EIGENE_KEY,
  },
  kabelsee: {
    titel: 'Kabelsee',
    unter: (t) => `Beste Session der letzten ${t} Tage`,
    zahl: (d) => `${d.sessions} ${d.sessions === 1 ? 'Session' : 'Sessions'}`,
    leer: 'Noch niemand eingetragen. Vom Badesteg am Eissee geht es in den Sommer – drei Runden, und die erste Punktzahl steht hier.',
    wert: (f) => punkteText(f.punkte),
    eigeneKey: 'skiportfolio.kabelsee.eigene',
  },
}

// Die Liste selbst – im Fenster nach dem Eintragen und im Reiter der
// Uebersicht dieselbe. Die ersten drei stehen auf einem Treppchen, der Rest
// darunter in Zeilen; eigene Eintraege tragen einen Rahmen.
export function listeZeichnen(el, daten, { hervor = null, art = 'slalom' } = {}) {
  const L = LISTEN[art]
  const eigene = new Set(lesen(L.eigeneKey, []))
  const ist = (f) => f.id === hervor || eigene.has(f.id)
  el.replaceChildren()

  const kopf = document.createElement('div')
  kopf.className = 'sb-kopf'
  kopf.innerHTML = '<span class="sb-titel"><strong></strong><small></small></span><span class="sb-zahlen"></span>'
  kopf.querySelector('strong').textContent = L.titel
  kopf.querySelector('small').textContent = L.unter(daten.tage)
  kopf.querySelector('.sb-zahlen').textContent = `${daten.fahrer} Fahrer · ${L.zahl(daten)}`
  el.appendChild(kopf)

  if (!daten.liste.length) {
    const leer = document.createElement('p')
    leer.className = 'sb-leer'
    leer.textContent = L.leer
    el.appendChild(leer)
    return
  }

  // Treppchen: Zweiter, Erster, Dritter – der Erste in der Mitte und oben.
  const podest = document.createElement('div')
  podest.className = 'sb-podest'
  for (const platz of [2, 1, 3]) {
    const f = daten.liste[platz - 1]
    const stufe = document.createElement('div')
    stufe.className = `sb-stufe p${platz}` + (f && ist(f) ? ' eigen' : '') + (f ? '' : ' frei')
    stufe.innerHTML = '<span class="sb-rang"></span><span class="sb-name"></span><span class="sb-zeit"></span><span class="sb-wann"></span><span class="sb-sockel"></span>'
    stufe.querySelector('.sb-rang').textContent = platz
    stufe.querySelector('.sb-name').textContent = f ? f.name : '–'
    stufe.querySelector('.sb-zeit').textContent = f ? L.wert(f) : ''
    stufe.querySelector('.sb-wann').textContent = f ? wann(f.erstellt) : ''
    podest.appendChild(stufe)
  }
  el.appendChild(podest)

  const rest = daten.liste.slice(3)
  if (rest.length) {
    const ol = document.createElement('ol')
    ol.className = 'sb-zeilen'
    ol.start = 4
    rest.forEach((f, i) => {
      const li = document.createElement('li')
      li.className = 'sb-zeile' + (ist(f) ? ' eigen' : '')
      const m = art === 'slalom' ? medaille(f.zeit) : null
      li.innerHTML = '<span class="sb-rang"></span><span class="sb-punkt"></span><span class="sb-name"></span><span class="sb-straf"></span><span class="sb-wann"></span><span class="sb-zeit"></span>'
      li.querySelector('.sb-rang').textContent = i + 4
      if (m) li.querySelector('.sb-punkt').dataset.m = m
      li.querySelector('.sb-name').textContent = f.name
      li.querySelector('.sb-straf').textContent = f.verfehlt ? `+${f.verfehlt * 2} s` : ''
      li.querySelector('.sb-wann').textContent = wann(f.erstellt)
      li.querySelector('.sb-zeit').textContent = L.wert(f)
      ol.appendChild(li)
    })
    el.appendChild(ol)
  }
}

export class Bestenliste {
  constructor() {
    this._lauf = null      // Promise auf die Startmarke
    this._fahrt = null     // die letzte fertige Fahrt samt Zielmarke
    this._angebot = 0

    this.angebotEl = document.createElement('button')
    this.angebotEl.type = 'button'
    this.angebotEl.className = 'frost sb-angebot'
    this.angebotEl.innerHTML = `${TOUCH ? '' : '<kbd class="k-enter">⏎</kbd>'}<span>In die Bestenliste</span>`
    this.angebotEl.addEventListener('click', () => this.oeffnen())
    document.body.appendChild(this.angebotEl)

    this._fenster()
  }

  // --- aus der Zeitnahme ----------------------------------------------------

  start() {
    this._fahrt = null
    this._zeigeAngebot(false)
    this._lauf = post('start', {}).then((d) => d.lauf).catch(() => null)
  }

  abbruch() {
    this._lauf = null
  }

  // Die Zielmarke sofort holen – die Serveruhr soll so nah am Zielbogen
  // stehen wie moeglich. Das Angebot erscheint erst, wenn sie da ist.
  async ziel(run) {
    const lauf = await this._lauf
    this._lauf = null
    // Angeboten wird nur eine neue eigene Bestzeit (in diesem Browser) –
    // jede Zeit darf hinein, aber nach jedem Lauf zu fragen, waere laestig.
    // Die Marke wird trotzdem nur dann geholt.
    if (!lauf || !run.bestzeit) return
    try {
      const { ziel } = await post('ziel', { lauf })
      this._fahrt = { ...run, ziel }
      this._zeigeAngebot(true)
    } catch { /* ohne Marke kein Eintrag */ }
  }

  get angebotOffen() {
    return this._angebot > 0 && !!this._fahrt
  }

  _zeigeAngebot(an) {
    this._angebot = an ? ANGEBOT_DAUER : 0
    this.angebotEl.classList.toggle('visible', an)
  }

  update(dt) {
    if (this._angebot <= 0) return
    this._angebot -= dt
    if (this._angebot <= 0) this._zeigeAngebot(false)
  }

  // --- Fenster ----------------------------------------------------------------

  _fenster() {
    const d = document.createElement('dialog')
    d.id = 'sb-dialog'
    d.className = 'dialog sb-dialog'
    d.setAttribute('aria-labelledby', 'sb-titel')
    d.innerHTML = `
      <button type="button" class="dialog-zu" aria-label="Schließen">×</button>
      <div class="dialog-kopf">
        <span class="dialog-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4.5a2.5 2.5 0 0 0 2.8 3.4M17 6h2.5a2.5 2.5 0 0 1-2.8 3.4M12 13v4M8.5 20h7l-1-3h-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>
        <span class="dialog-name"><span class="dialog-ort">Slalom</span><strong id="sb-titel">In die Bestenliste</strong></span>
      </div>
      <form class="sb-form" autocomplete="off">
        <div class="sb-lauf"><span class="sb-lauf-zeit"></span><span class="sb-lauf-sub"></span></div>
        <label class="dialog-label" for="sb-name">Dein Name</label>
        <input id="sb-name" class="kz-feld" maxlength="16" minlength="2" required
               placeholder="z. B. Jule" enterkeyhint="send" spellcheck="false" />
        <button type="submit" class="dialog-los">Eintragen</button>
      </form>
      <p class="dialog-status" role="status" aria-live="polite" hidden></p>
      <div class="sb-ergebnis" hidden>
        <p class="sb-platz"></p>
        <div class="sb-liste"></div>
      </div>
      <p class="dialog-text sb-fuss">Name und Zeit sind öffentlich. Es zählt die beste Zeit je Name der letzten 30 Tage.</p>
    `
    document.body.appendChild(d)
    this.dialog = d
    this.form = d.querySelector('form')
    this.nameEl = d.querySelector('#sb-name')
    this.statusEl = d.querySelector('.dialog-status')
    this.ergebnisEl = d.querySelector('.sb-ergebnis')
    d.querySelector('.dialog-zu').addEventListener('click', () => d.close())
    d.addEventListener('click', (e) => { if (e.target === d) d.close() })
    // Den Fokus abgeben, sonst loest das naechste Enter im Spiel den Knopf aus.
    d.addEventListener('close', () => document.activeElement?.blur())
    this.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this._senden()
    })
  }

  oeffnen() {
    const f = this._fahrt
    if (!f || this.dialog.open) return false
    this._zeigeAngebot(false)
    this.form.hidden = false
    this.ergebnisEl.hidden = true
    this.statusEl.hidden = true
    this.dialog.querySelector('#sb-titel').textContent = 'In die Bestenliste'
    this.dialog.querySelector('.sb-lauf-zeit').textContent = `${zeitText(f.total)} s`
    const m = MEDALS.find((x) => f.total <= x.time)
    this.dialog.querySelector('.sb-lauf-sub').textContent = [
      m?.name, f.missed ? `${f.missed} Tor${f.missed > 1 ? 'e' : ''} verfehlt, +${f.missed * 2} s` : 'alle Tore',
    ].filter(Boolean).join(' · ')
    this.nameEl.value = lesen(NAME_KEY, '')
    this.dialog.showModal()
    if (!TOUCH) {
      this.nameEl.focus()
      this.nameEl.select()
    } else {
      document.activeElement?.blur()
    }
    return true
  }

  async _senden() {
    const f = this._fahrt
    if (!f) return
    const knopf = this.form.querySelector('button')
    knopf.disabled = true
    this._status('Trage ein…')
    try {
      const d = await post('eintragen', {
        ziel: f.ziel,
        name: this.nameEl.value,
        zeit: f.total,
        fahrzeit: f.time,
        verfehlt: f.missed,
        tore: f.splits,
      })
      schreiben(NAME_KEY, d.name)
      schreiben(EIGENE_KEY, [...lesen(EIGENE_KEY, []), d.id].slice(-50))
      this._fahrt = null
      this.statusEl.hidden = true
      this.form.hidden = true
      this.dialog.querySelector('#sb-titel').textContent = 'Eingetragen'
      this.ergebnisEl.querySelector('.sb-platz').textContent = d.bestzeit
        ? `Platz ${d.platz} von ${d.fahrer} mit ${zeitText(f.total)} s.`
        : `Deine frühere Zeit war besser – sie hält Platz ${d.platz} von ${d.fahrer}.`
      listeZeichnen(this.ergebnisEl.querySelector('.sb-liste'), d, { hervor: d.id })
      this.ergebnisEl.hidden = false
      this.dialog.querySelector('.dialog-zu').focus()
    } catch (e) {
      this._status(e.name === 'AbortError' ? 'Keine Verbindung – nochmal versuchen?' : e.message, 'fehler')
    } finally {
      knopf.disabled = false
    }
  }

  _status(text, art = '') {
    this.statusEl.textContent = text
    this.statusEl.dataset.art = art
    this.statusEl.hidden = false
  }

  // --- fuer den Reiter der Uebersicht ---------------------------------------

  async laden() {
    const r = await fetch(`${API}/top`)
    if (!r.ok) throw new Error(`Fehler ${r.status}`)
    return r.json()
  }
}
