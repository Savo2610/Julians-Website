import { TOUCH } from '../core/device.js'
import { NAME_KEY, lesen, schreiben, post } from './bestenliste.js'

// Das Gipfelbuch ueber der Nordabfahrt – Gegenstueck zu worker/gipfelbuch.js.
//
// Erst stand an der Station nur "Eintragen", und dahinter oeffnete sich
// Komoot: man wollte etwas hineinschreiben und landete auf einer fremden
// Seite. Jetzt ist es ein Buch. Oben die Eintraege der anderen, darunter
// zwei Felder fuer den eigenen. Komoot (Julians Touren) bleibt die zweite
// Wahl an der Station.
//
// Oeffentlich steht ein Eintrag erst, wenn Julian ihn gelesen hat. Damit das
// nicht wie ein verschluckter Eintrag aussieht, merkt sich der Browser die
// eigenen und zeigt sie oben mit dem Vermerk dazu.

const API = '/api/gipfelbuch'
const EIGENE_KEY = 'skiportfolio.gipfelbuch.eigene'
const TEXT_MAX = 240

let fenster = null

function datum(ms) {
  return new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

async function holen() {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 6000)
  try {
    const r = await fetch(`${API}/liste`, { signal: ctl.signal })
    if (!r.ok) throw new Error()
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

function bauen() {
  const d = document.createElement('dialog')
  d.className = 'dialog gb-dialog'
  d.setAttribute('aria-labelledby', 'gb-titel')
  d.innerHTML = `
    <button type="button" class="dialog-zu" aria-label="Schließen">×</button>
    <div class="dialog-kopf">
      <span class="dialog-symbol"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.6 3.5 5v13c3.5-.4 6.5 0 8.5 1.5 2-1.5 5-1.9 8.5-1.5V5c-3.5-.4-6.5 0-8.5 1.5zM12 6.5v13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span>
      <span class="dialog-name"><span class="dialog-ort">Nordabfahrt</span><strong id="gb-titel">Gipfelbuch</strong></span>
    </div>
    <div class="gb-buch" tabindex="0" aria-label="Einträge"></div>
    <form class="gb-form" autocomplete="off">
      <label class="dialog-label" for="gb-text">Dein Eintrag</label>
      <textarea id="gb-text" class="up-notiz gb-text" maxlength="${TEXT_MAX}" required
                placeholder="Wie war die Abfahrt? Ein Gruß, ein Gedanke, ein Wunsch …"></textarea>
      <div class="gb-zeile">
        <input id="gb-name" class="kz-feld" maxlength="16" minlength="2" required
               placeholder="Dein Name" aria-label="Dein Name" spellcheck="false" />
        <span class="gb-rest" aria-hidden="true"></span>
      </div>
      <button type="submit" class="dialog-los">Eintragen</button>
    </form>
    <p class="dialog-status" role="status" aria-live="polite" hidden></p>
    <p class="dialog-text gb-fuss">Einträge erscheinen für alle, sobald Julian sie gelesen hat.</p>
  `
  document.body.appendChild(d)

  const buch = d.querySelector('.gb-buch')
  const form = d.querySelector('form')
  const textEl = d.querySelector('#gb-text')
  const nameEl = d.querySelector('#gb-name')
  const restEl = d.querySelector('.gb-rest')
  const statusEl = d.querySelector('.dialog-status')
  const knopf = form.querySelector('button')

  const status = (text, art = '') => {
    statusEl.textContent = text
    statusEl.dataset.art = art
    statusEl.hidden = !text
  }
  const rest = () => { restEl.textContent = `${TEXT_MAX - [...textEl.value].length}` }
  textEl.addEventListener('input', rest)

  // Ein Eintrag auf der Seite: Text, darunter Name und Tag wie mit der Hand.
  const eintrag = (e, wartet = false) => {
    const el = document.createElement('article')
    el.className = 'gb-eintrag' + (wartet ? ' gb-wartet' : '')
    const p = document.createElement('p')
    p.textContent = e.text
    const sig = document.createElement('footer')
    sig.textContent = `${e.name} · ${datum(e.erstellt)}${wartet ? ' · wird noch gelesen' : ''}`
    el.append(p, sig)
    return el
  }

  const zeichnen = (oeffentlich, nichtDa = false) => {
    const eigene = lesen(EIGENE_KEY, [])
    const freiIds = new Set((oeffentlich ?? []).map((e) => e.id))
    const wartend = eigene.filter((e) => !freiIds.has(e.id)).reverse()
    buch.replaceChildren()
    for (const e of wartend) buch.append(eintrag(e, true))
    for (const e of oeffentlich ?? []) buch.append(eintrag(e))
    if (!buch.children.length) {
      const leer = document.createElement('p')
      leer.className = 'gb-leer'
      leer.textContent = nichtDa
        ? 'Das Buch ist gerade nicht zu lesen – vielleicht fehlt das Netz.'
        : 'Noch leer. Die erste Seite gehört dir.'
      buch.append(leer)
    }
  }

  let liste = null
  const laden = async () => {
    try {
      liste = (await holen()).eintraege
      zeichnen(liste)
    } catch {
      zeichnen(null, true)
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    knopf.disabled = true
    status('Trage ein…')
    try {
      const neu = await post('eintragen', { name: nameEl.value, text: textEl.value }, API)
      schreiben(NAME_KEY, neu.name)
      schreiben(EIGENE_KEY, [...lesen(EIGENE_KEY, []), neu].slice(-20))
      textEl.value = ''
      rest()
      zeichnen(liste)
      buch.scrollTop = 0
      status('Eingetragen – danke!', 'gut')
    } catch (err) {
      status(err.name === 'AbortError' ? 'Keine Verbindung – nochmal versuchen?' : err.message, 'fehler')
    } finally {
      knopf.disabled = false
    }
  })

  d.querySelector('.dialog-zu').addEventListener('click', () => d.close())
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  // Den Fokus abgeben, sonst loest das naechste Enter im Spiel den Knopf aus.
  d.addEventListener('close', () => document.activeElement?.blur())

  return {
    oeffnen() {
      status('')
      nameEl.value = lesen(NAME_KEY, '')
      rest()
      zeichnen(liste)
      laden()
      d.showModal()
      // Auf dem Telefon nicht gleich die Tastatur hochholen: erst lesen.
      if (!TOUCH) textEl.focus()
      else document.activeElement?.blur()
    },
  }
}

export function gipfelbuchOeffnen() {
  fenster ??= bauen()
  fenster.oeffnen()
}
