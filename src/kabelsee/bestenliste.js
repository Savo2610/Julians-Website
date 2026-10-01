import { TOUCH } from '../core/device.js'
import { post, lesen, schreiben, listeZeichnen, NAME_KEY, LISTEN } from '../menu/bestenliste.js'

// Die Bestenliste des Kabelsees – Gegenstueck zu worker/kabelsee.js, gebaut
// wie die des Slaloms (menu/bestenliste.js):
//
// Am Steg holt das Spiel still eine Startmarke, nach der dritten Runde eine
// Zielmarke. Nur bei einem neuen eigenen Rekord (in diesem Browser) und wenn
// beides geklappt hat, steht in der Auswertung „In die Bestenliste“. Gefragt
// wird nie; wer nicht will, faehrt noch eine Session oder geht.
// Anschauen geht immer (zeigen): auf veerka.mp/kabelsee/ aus dem Menue,
// im Tal aus der Uebersicht. Beide Seiten benutzen diese Klasse.
// Ohne Netz oder ohne /api (vite ohne wrangler dev) erscheint kein Angebot.

const API = '/api/kabelsee'
const fmt = (n) => Math.round(n).toLocaleString('de-DE')

export class KabelseeListe {
  constructor() {
    this._lauf = null
    this._session = null
    this.onAngebot = null
    this._fenster()
  }

  start() {
    this._session = null
    this.onAngebot?.(false)
    this._lauf = post('start', {}, API).then((d) => d.lauf).catch(() => null)
  }

  // Aus der Auswertung: e.score, e.record (siehe kabelsee/game/session.js).
  async ziel(e) {
    const lauf = await this._lauf
    this._lauf = null
    if (!lauf || !e.record || !(e.score > 0)) return
    try {
      const { ziel } = await post('ziel', { lauf }, API)
      this._session = { punkte: Math.round(e.score), ziel }
      this.onAngebot?.(true)
    } catch { /* ohne Marke kein Eintrag */ }
  }

  get angebotOffen() {
    return !!this._session
  }

  _fenster() {
    const d = document.createElement('dialog')
    d.id = 'kb-dialog'
    d.className = 'dialog sb-dialog'
    d.setAttribute('aria-labelledby', 'kb-titel')
    d.innerHTML = `
      <button type="button" class="dialog-zu" aria-label="Schließen">×</button>
      <div class="dialog-kopf">
        <span class="dialog-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4.5a2.5 2.5 0 0 0 2.8 3.4M17 6h2.5a2.5 2.5 0 0 1-2.8 3.4M12 13v4M8.5 20h7l-1-3h-5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>
        <span class="dialog-name"><span class="dialog-ort">Kabelsee</span><strong id="kb-titel">In die Bestenliste</strong></span>
      </div>
      <form class="sb-form" autocomplete="off">
        <div class="sb-lauf"><span class="sb-lauf-zeit"></span><span class="sb-lauf-sub">Punkte aus drei Runden</span></div>
        <label class="dialog-label" for="kb-name">Dein Name</label>
        <input id="kb-name" class="kz-feld" maxlength="16" minlength="2" required
               placeholder="z. B. Jule" enterkeyhint="send" spellcheck="false" />
        <button type="submit" class="dialog-los">Eintragen</button>
      </form>
      <p class="dialog-status" role="status" aria-live="polite" hidden></p>
      <div class="sb-ergebnis" hidden>
        <p class="sb-platz"></p>
        <div class="sb-liste"></div>
      </div>
      <p class="dialog-text sb-fuss">Name und Punkte sind öffentlich. Es zählt die beste Session je Name der letzten 30 Tage.</p>
    `
    document.body.appendChild(d)
    this.dialog = d
    this.form = d.querySelector('form')
    this.nameEl = d.querySelector('#kb-name')
    this.statusEl = d.querySelector('.dialog-status')
    this.ergebnisEl = d.querySelector('.sb-ergebnis')
    d.querySelector('.dialog-zu').addEventListener('click', () => d.close())
    d.addEventListener('click', (e) => { if (e.target === d) d.close() })
    d.addEventListener('close', () => document.activeElement?.blur())
    this.form.addEventListener('submit', (e) => {
      e.preventDefault()
      this._senden()
    })
  }

  // Taste B: eintragen, wenn es etwas einzutragen gibt, sonst anschauen.
  bOderListe() {
    return this.angebotOffen ? this.oeffnen() : this.zeigen()
  }

  // Nur die Liste, ohne Formular.
  async zeigen() {
    if (this.dialog.open) return false
    this.form.hidden = true
    this.statusEl.hidden = true
    this.ergebnisEl.hidden = false
    this.dialog.querySelector('#kb-titel').textContent = 'Bestenliste'
    const platz = this.ergebnisEl.querySelector('.sb-platz')
    platz.textContent = ''
    platz.hidden = true
    const ziel = this.ergebnisEl.querySelector('.sb-liste')
    ziel.innerHTML = '<p class="sb-leer">Lade die Bestenliste…</p>'
    this.dialog.showModal()
    document.activeElement?.blur()
    try {
      listeZeichnen(ziel, await this.laden(), { art: 'kabelsee' })
    } catch {
      ziel.innerHTML = '<p class="sb-leer">Die Bestenliste ist gerade nicht erreichbar.</p>'
    }
    return true
  }

  oeffnen() {
    const s = this._session
    if (!s || this.dialog.open) return false
    this.form.hidden = false
    this.ergebnisEl.querySelector('.sb-platz').hidden = false
    this.ergebnisEl.hidden = true
    this.statusEl.hidden = true
    this.dialog.querySelector('#kb-titel').textContent = 'In die Bestenliste'
    this.dialog.querySelector('.sb-lauf-zeit').textContent = `${fmt(s.punkte)} Punkte`
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
    const s = this._session
    if (!s) return
    const knopf = this.form.querySelector('button')
    knopf.disabled = true
    this._status('Trage ein…')
    try {
      const d = await post('eintragen', { ziel: s.ziel, name: this.nameEl.value, punkte: s.punkte }, API)
      schreiben(NAME_KEY, d.name)
      const key = LISTEN.kabelsee.eigeneKey
      schreiben(key, [...lesen(key, []), d.id].slice(-50))
      this._session = null
      this.onAngebot?.(false)
      this.statusEl.hidden = true
      this.form.hidden = true
      this.dialog.querySelector('#kb-titel').textContent = 'Eingetragen'
      this.ergebnisEl.querySelector('.sb-platz').textContent = d.bestwert
        ? `Platz ${d.platz} von ${d.fahrer} mit ${fmt(s.punkte)} Punkten.`
        : `Deine frühere Session war besser – sie hält Platz ${d.platz} von ${d.fahrer}.`
      listeZeichnen(this.ergebnisEl.querySelector('.sb-liste'), d, { hervor: d.id, art: 'kabelsee' })
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

  async laden() {
    const r = await fetch(`${API}/top`)
    if (!r.ok) throw new Error(`Fehler ${r.status}`)
    return r.json()
  }
}
