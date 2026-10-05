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
//
// Gelesen wird gleich hier: ein Klick auf „Julian“ im Fuss fragt nach dem
// Einmalcode aus der Authenticator-App. Angemeldet stehen die wartenden
// Eintraege oben im Buch, jeder mit Freigeben und Loeschen. Kein Menue
// dafuer – fuer alle anderen bleibt das Buch, wie es war.

const API = '/api/gipfelbuch'
const EIGENE_KEY = 'skiportfolio.gipfelbuch.eigene'
const TEXT_MAX = 240
// Nur ein Merker, ob es sich lohnt, nach wartenden Eintraegen zu fragen –
// die Sitzung selbst ist ein HttpOnly-Cookie (worker/gipfelbuch.js).
const JULIAN_KEY = 'skiportfolio.gipfelbuch.julian'

let fenster = null

function datum(ms) {
  return new Date(ms).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Angemeldet ohne Cache: nach dem Freigeben soll der Eintrag nicht 30 s
// lang wieder als wartend auftauchen.
async function holen(pfad = 'liste', frisch = false) {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), 6000)
  try {
    const r = await fetch(`${API}/${pfad}`, { signal: ctl.signal, cache: frisch ? 'no-store' : 'default' })
    if (r.status === 401) throw Object.assign(new Error('abgemeldet'), { status: 401 })
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
    <p class="dialog-text gb-fuss">Einträge erscheinen für alle, sobald <button type="button" class="gb-julian">Julian</button> sie gelesen hat.</p>
    <form class="gb-anmelden" autocomplete="off" hidden>
      <input class="kz-feld gb-code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}"
             maxlength="6" required placeholder="Code aus der App" aria-label="Einmalcode" />
      <button type="submit" class="gb-knopf">Anmelden</button>
    </form>
    <p class="dialog-text gb-angemeldet" hidden>Angemeldet als Julian · <button type="button" class="gb-julian gb-ab">Abmelden</button></p>
  `
  document.body.appendChild(d)

  const buch = d.querySelector('.gb-buch')
  const form = d.querySelector('form')
  const textEl = d.querySelector('#gb-text')
  const nameEl = d.querySelector('#gb-name')
  const restEl = d.querySelector('.gb-rest')
  const statusEl = d.querySelector('.dialog-status')
  const knopf = form.querySelector('button')
  const fussEl = d.querySelector('.gb-fuss')
  const anmeldenEl = d.querySelector('.gb-anmelden')
  const codeEl = d.querySelector('.gb-code')
  const angemeldetEl = d.querySelector('.gb-angemeldet')

  const status = (text, art = '') => {
    statusEl.textContent = text
    statusEl.dataset.art = art
    statusEl.hidden = !text
  }
  const rest = () => { restEl.textContent = `${TEXT_MAX - [...textEl.value].length}` }
  textEl.addEventListener('input', rest)

  // Ein Eintrag auf der Seite: Text, darunter Name und Tag wie mit der Hand.
  const eintrag = (e, wartet = false, pruefen = false) => {
    const el = document.createElement('article')
    el.className = 'gb-eintrag' + (wartet ? ' gb-wartet' : '')
    const p = document.createElement('p')
    p.textContent = e.text
    const sig = document.createElement('footer')
    sig.textContent = `${e.name} · ${datum(e.erstellt)}${wartet && !pruefen ? ' · wird noch gelesen' : ''}`
    el.append(p, sig)
    if (pruefen) {
      const knoepfe = document.createElement('div')
      knoepfe.className = 'gb-pruefen'
      for (const [was, wort] of [['freigeben', 'Freigeben'], ['loeschen', 'Löschen']]) {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `gb-knopf gb-${was}`
        b.textContent = wort
        b.addEventListener('click', () => entscheiden(was, e, knoepfe))
        knoepfe.append(b)
      }
      el.append(knoepfe)
    }
    return el
  }

  // Wartende Eintraege, wenn Julian angemeldet ist; sonst null.
  let offen = null
  const julian = () => lesen(JULIAN_KEY, false)
  const anzeigen = () => {
    const an = offen !== null
    fussEl.hidden = an || !anmeldenEl.hidden
    angemeldetEl.hidden = !an
  }

  const entscheiden = async (was, e, knoepfe) => {
    if (was === 'loeschen' && !confirm(`Den Eintrag von ${e.name} löschen?`)) return
    for (const b of knoepfe.children) b.disabled = true
    try {
      await post(was, { id: e.id }, API)
      offen = offen.filter((o) => o.id !== e.id)
      if (was === 'freigeben') liste = [e, ...(liste ?? [])].sort((a, b) => b.erstellt - a.erstellt)
      zeichnen(liste)
      status(was === 'freigeben' ? `${e.name} steht jetzt im Buch.` : 'Gelöscht.', 'gut')
    } catch (err) {
      for (const b of knoepfe.children) b.disabled = false
      if (err.message === 'Nicht angemeldet') abgemeldet()
      status(err.message, 'fehler')
    }
  }

  const abgemeldet = () => {
    schreiben(JULIAN_KEY, false)
    offen = null
    anzeigen()
    zeichnen(liste)
  }

  const zeichnen = (oeffentlich, nichtDa = false) => {
    const eigene = lesen(EIGENE_KEY, [])
    const freiIds = new Set((oeffentlich ?? []).map((e) => e.id))
    const offenIds = new Set((offen ?? []).map((e) => e.id))
    // Angemeldet zeigt der Server, was wartet; die eigenen aus dem Browser
    // nur, solange es sie dort noch gibt (geloescht heisst: weg).
    const wartend = eigene.filter((e) => !freiIds.has(e.id) && (offen === null || offenIds.has(e.id))).reverse()
    buch.replaceChildren()
    for (const e of offen ?? []) buch.append(eintrag(e, true, true))
    for (const e of offen ? [] : wartend) buch.append(eintrag(e, true))
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
    if (julian()) {
      try {
        offen = (await holen('offen', true)).eintraege
      } catch (err) {
        if (err.status === 401) schreiben(JULIAN_KEY, false)
        offen = null
      }
      anzeigen()
    }
    try {
      liste = (await holen('liste', offen !== null)).eintraege
      zeichnen(liste)
    } catch {
      zeichnen(null, true)
    }
  }

  d.querySelector('.gb-fuss .gb-julian').addEventListener('click', () => {
    anmeldenEl.hidden = false
    anzeigen()
    codeEl.value = ''
    codeEl.focus()
  })
  anmeldenEl.addEventListener('submit', async (e) => {
    e.preventDefault()
    const b = anmeldenEl.querySelector('button')
    b.disabled = true
    status('Prüfe…')
    try {
      await post('anmelden', { code: codeEl.value }, API)
      schreiben(JULIAN_KEY, true)
      anmeldenEl.hidden = true
      status('')
      await laden()
      status(offen?.length ? `${offen.length} ${offen.length === 1 ? 'Eintrag wartet' : 'Einträge warten'}.` : 'Nichts zu lesen.', 'gut')
    } catch (err) {
      status(err.name === 'AbortError' ? 'Keine Verbindung – nochmal versuchen?' : err.message, 'fehler')
      codeEl.select()
    } finally {
      b.disabled = false
    }
  })
  d.querySelector('.gb-ab').addEventListener('click', async () => {
    await post('abmelden', {}, API).catch(() => {})
    abgemeldet()
    status('Abgemeldet.')
  })

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
      anmeldenEl.hidden = true
      anzeigen()
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
