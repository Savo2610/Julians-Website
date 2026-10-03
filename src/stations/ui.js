import * as THREE from 'three'
import { TOUCH } from '../core/device.js'

// Zwei Einblendungen:
//
// - die Einladung, die ueber einer Station schwebt, solange man davor steht:
//   ein Wort in der Stationsfarbe, darunter der Name und die Enter-Taste.
//   Frosttext ohne Glas und ohne Rahmen; die Farbe allein bindet sie an die
//   Station. Antippen laesst sich auch die Station selbst (antippen.js) –
//   Freunde tippten am Handy auf die Huette statt auf die Pille;
// - die Auswahl unten im Bild, sobald man mit Enter herangezoomt hat: die
//   Ziele nebeneinander, damit ←/→ und A/D zum Bild passen; hinter dem
//   gewaehlten glimmt ein Schein in seiner Farbe.
//
// Vorher war die Einladung ein Pistenschild mit Ziffern fuer zwei Ziele.
// Das trug, solange es nur Tasten gab; auf dem Handy gibt es keine 1 und 2,
// und am Rechner war es die einzige Stelle, an der man etwas anderes als
// Enter lernen musste. Jetzt ist es ueberall dieselbe Taste – oder derselbe
// Finger.
//
// Das Glas der Auswahl ist bewusst hell getoent: der Hintergrund ist fast
// immer Schnee, und klares Glas auf Weiss ist unsichtbar.

const ENTER = TOUCH ? '' : '<kbd class="k-enter" aria-hidden="true">⏎</kbd>'

// Kleine Zeichen statt Markenlogos: sie sollen nur die beiden Ziele
// auseinanderhalten, die Farbe traegt den Rest.
const GLYPHS = {
  github: '<svg viewBox="0 0 24 24"><path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24"><rect x="4" y="9.5" width="3.2" height="10" rx=".6" fill="currentColor"/><circle cx="5.6" cy="5.6" r="1.9" fill="currentColor"/><path d="M10.4 19.5v-10h3v1.6c.7-1.2 1.9-1.9 3.4-1.9 2.4 0 3.6 1.5 3.6 4.3v6h-3.1v-5.5c0-1.4-.6-2.2-1.7-2.2-1.2 0-2 .9-2 2.4v5.3z" fill="currentColor"/></svg>',
  paypal: '<svg viewBox="0 0 24 24"><path d="M7.2 20.5 9.6 4h6.1c3.3 0 5 1.8 4.5 4.6-.6 3.3-3 4.9-6.3 4.9h-2.3l-1 7z" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/></svg>',
  signal: '<svg viewBox="0 0 24 24"><path d="M12 3.6a8.4 8.4 0 0 0-7.2 12.7L3.8 20.2l3.9-1a8.4 8.4 0 1 0 4.3-15.6z" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3.2 1.6" stroke-linejoin="round"/></svg>',
  instagram: '<svg viewBox="0 0 24 24"><rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="16.9" cy="7.1" r="1.2" fill="currentColor"/></svg>',
  // Ein Fahrschein mit Lochung, eine Drohne von oben, ein Doktorhut.
  ticket: '<svg viewBox="0 0 24 24"><path d="M3.5 7.5h17v3a1.6 1.6 0 0 0 0 3v3h-17v-3a1.6 1.6 0 0 0 0-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14.5 8v8" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1.6 1.6"/></svg>',
  drone: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7 7 17" stroke="currentColor" stroke-width="2"/><rect x="9.3" y="9.3" width="5.4" height="5.4" rx="1.2" fill="currentColor"/><g fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="18" r="2.6"/></g></svg>',
  uni: '<svg viewBox="0 0 24 24"><path d="M2.5 9.5 12 5l9.5 4.5L12 14z" fill="currentColor"/><path d="M6.5 11.6v4.2c1.4 1.5 3.3 2.2 5.5 2.2s4.1-.7 5.5-2.2v-4.2M20 10.3v5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  // Der Funkturm von broadcast.veerka.mp: Mast mit zwei Wellen.
  broadcast: '<svg viewBox="0 0 24 24"><path d="M12 10.5 8.2 21M12 10.5l3.8 10.5M9.4 17.6h5.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="8.6" r="1.9" fill="currentColor"/><path d="M8.3 5.2a5 5 0 0 0 0 6.8M15.7 5.2a5 5 0 0 1 0 6.8M5.6 2.8a8.6 8.6 0 0 0 0 11.6M18.4 2.8a8.6 8.6 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  // Stechuhr, Klemmbrett mit Haken, Blaulicht mit Strahlen.
  uhr: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3.4 2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  liste: '<svg viewBox="0 0 24 24"><rect x="5" y="4.5" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 3.5h6v2.6H9z" fill="currentColor"/><path d="m8 11 1.4 1.4L12 10M8 16l1.4 1.4L12 15M14 11.4h2.5M14 16.4h2.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  blaulicht: '<svg viewBox="0 0 24 24"><path d="M7.5 19v-5a4.5 4.5 0 0 1 9 0v5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 19.5h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M12 2.8v2.6M4.6 6l1.8 1.8M19.4 6l-1.8 1.8M2.8 12.6h2.4M18.8 12.6h2.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  // Wasserski: zwei Wellen und ein Seil, das von oben kommt.
  welle: '<svg viewBox="0 0 24 24"><path d="M3 15.5c1.5 0 1.5-1.4 3-1.4s1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4M3 19.5c1.5 0 1.5-1.4 3-1.4s1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4 1.5-1.4 3-1.4 1.5 1.4 3 1.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M19.5 3.5 10 11.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M8 10.2l3.6 3" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  // Zwei Gipfel mit Schneekappe, fuer das Gipfelbuch.
  berg: '<svg viewBox="0 0 24 24"><path d="M2.5 19.5 9 8l3.6 6.2L15.5 10l6 9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M7.2 11.2 9 8l1.8 3.2-1.8 1z" fill="currentColor"/></svg>',
  solana: '<svg viewBox="0 0 24 24"><path d="M6.5 6h13l-2 2.6h-13zM4.5 10.7h13l2 2.6h-13zM6.5 15.4h13l-2 2.6h-13z" fill="currentColor"/></svg>',
}

const subText = (choice) => (typeof choice.sub === 'function' ? choice.sub() : choice.sub) ?? ''

export class StationUI {
  constructor(container, camera) {
    this.camera = camera
    this.current = null
    // Wird von der Interaktion gesetzt: Tippen auf die Einladung und die
    // Knoepfe der Auswahl laufen darueber – synchron im Klick, damit Safari
    // die Links nicht als Popup verwirft.
    this.onUse = null
    this.onPick = null
    this.onClose = null

    this.el = document.createElement('button')
    this.el.type = 'button'
    this.el.className = 'frost station-prompt'
    this.el.innerHTML = `
      ${ENTER}
      <span class="prompt-text">
        <span class="prompt-sub"></span>
        <span class="prompt-title"></span>
      </span>
    `
    this.el.tabIndex = -1
    this.el.addEventListener('click', (e) => {
      e.preventDefault()
      this.onUse?.()
    })
    container.appendChild(this.el)
    this.titleEl = this.el.querySelector('.prompt-title')
    this.subEl = this.el.querySelector('.prompt-sub')

    this.sheet = document.createElement('div')
    this.sheet.className = 'glass station-sheet'
    this.sheet.setAttribute('role', 'dialog')
    this.sheet.innerHTML = `
      <div class="sheet-head">
        <span class="sheet-name"><span class="sheet-sub"></span><span class="sheet-title"></span></span>
        <button type="button" class="sheet-close" aria-label="Zurück">×</button>
      </div>
      <div class="sheet-options"></div>
      <div class="sheet-keys">${TOUCH
        ? 'Antippen zum Öffnen'
        : '<span class="k-waehlen"><kbd>←</kbd><kbd>→</kbd> wählen <i></i></span> <kbd class="k-enter">⏎</kbd> öffnen <i></i> <kbd>esc</kbd> zurück'}</div>
    `
    this.sheet.querySelector('.sheet-close').addEventListener('click', () => this.onClose?.())
    container.appendChild(this.sheet)
    this.optionsEl = this.sheet.querySelector('.sheet-options')

    this._world = new THREE.Vector3()
    this._focused = false
  }

  update(station) {
    if (station !== this.current) {
      this.current = station
      if (station) {
        const wired = !!(station.url || station.onUse || station.map
          || station.choices?.some((c) => c.url || c.action))
        this.titleEl.textContent = station.label
        this.subEl.textContent = wired ? station.hint : 'noch nicht verlinkt'
        this.el.style.setProperty('--accent', station.color || '#4a6c93')
        this.el.classList.toggle('dead', !wired)
        this.el.classList.add('visible')
        this.el.classList.remove('pop')
        void this.el.offsetWidth
        this.el.classList.add('pop')
      } else {
        this.el.classList.remove('visible')
      }
    }
    this.el.classList.toggle('hidden', this._focused)
    if (!station || this._focused) return
    // Manche Hinweise haengen an einem Stand, der erst spaeter ankommt
    // (die Sendung der gefrorenen Quelle).
    if (!this.el.classList.contains('dead') && this.subEl.textContent !== station.hint) this.subEl.textContent = station.hint

    // labelAt: eigener Ort fuer die Einladung, wo sie sonst etwas verdeckt
    // (die gefrorene Quelle – dort stand sie mitten vor dem Bild).
    const at = station.labelAt ?? station.position
    this._world.set(at.x, station.labelHeight ?? 2.4, at.z)
    this._world.project(this.camera)
    const x = (this._world.x * 0.5 + 0.5) * window.innerWidth
    const y = (-this._world.y * 0.5 + 0.5) * window.innerHeight
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`
  }

  // Die Auswahl aufklappen. Jedes Ziel ist ein Knopf: am Handy tippt man
  // darauf, am Rechner zeigt der Rahmen, wohin Enter gleich fuehrt.
  openSheet(station, selected) {
    this._focused = true
    this.sheet.querySelector('.sheet-title').textContent = station.label
    this.sheet.querySelector('.sheet-sub').textContent = station.hint
    this.sheet.style.setProperty('--accent', station.color || '#4a6c93')
    // Mit nur einem Ziel gibt es nichts zu waehlen – dann fehlen die Pfeile.
    this.sheet.classList.toggle('einzeln', station.choices.length === 1)
    this.optionsEl.replaceChildren()
    station.choices.forEach((choice, i) => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'sheet-option'
      if (!(choice.url || choice.action)) b.classList.add('off')
      b.style.setProperty('--c', choice.color || '#35485e')
      b.innerHTML = `
        <span class="opt-glyph">${GLYPHS[choice.glyph] ?? ''}</span>
        <span class="opt-text"><span class="opt-label"></span><span class="opt-sub"></span></span>
        <span class="opt-go" aria-hidden="true">${TOUCH ? '↗' : '⏎'}</span>
      `
      b.querySelector('.opt-label').textContent = choice.label
      b.querySelector('.opt-sub').textContent = subText(choice)
      b.addEventListener('click', () => this.onPick?.(i))
      // Mit der Maus zeigen heisst auswaehlen – sonst stuende der Rahmen
      // woanders als der Zeiger.
      b.addEventListener('pointerenter', (e) => {
        if (e.pointerType === 'mouse') this.onHover?.(i)
      })
      this.optionsEl.appendChild(b)
    })
    this.select(selected)
    this.sheet.classList.add('visible')
  }

  // Nach dem Oeffnen: manche Untertitel sagen, was sich gerade geaendert hat.
  refresh(station) {
    station.choices.forEach((choice, i) => {
      const el = this.optionsEl.children[i]?.querySelector('.opt-sub')
      if (el) el.textContent = subText(choice)
    })
  }

  // Abgelehnt: kurz schuetteln statt aufleuchten. Ohne Index die Einladung
  // selbst (Badesteg ohne Ticket).
  nope(index = null) {
    const el = index === null ? this.el : this.optionsEl.children[index]
    if (!el) return
    el.classList.remove('nope')
    void el.offsetWidth
    el.classList.add('nope')
  }

  select(index) {
    ;[...this.optionsEl.children].forEach((b, i) => b.classList.toggle('selected', i === index))
  }

  closeSheet() {
    this._focused = false
    this.sheet.classList.remove('visible')
  }

  flash(index = null) {
    const el = index === null ? this.el : this.optionsEl.children[index]
    if (!el) return
    el.classList.remove('used')
    void el.offsetWidth
    el.classList.add('used')
  }
}
