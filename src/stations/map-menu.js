import { CAMERA } from '../config.js'
import { TOUCH } from '../core/device.js'
import { TRAILS } from '../world/paths.js'
import { PLATEAU } from '../world/heightfield.js'
import { LINKS } from './links.js'

// Die Uebersicht: M ueberall, Enter an der Panoramatafel, am Handy der
// Kartenknopf. Zwei Reiter:
//
// - LINKS ist die Kachelseite von veerka.mp im Glas des Tals. Wer nicht
//   spielen will – und das sind gerade die, fuer die ein WASD-Tal eine Huerde
//   ist –, findet hier jede Adresse mit einem Klick. Jede Kachel sagt
//   ausserdem, *wo* im Tal sie liegt ("Werkstatt"), und bringt einen auf
//   Wunsch hin. Vorher stand LinkedIn nur hinter dem Wort "Werkstatt" in
//   einer Liste zwischen Gipfel und See; das musste man erraten.
// - KARTE ist die alte Talkarte mit Schnellreise zu Stationen und Orten.
//
// Unten steht die ganze Steuerung – die einzige Stelle ausser dem
// Tastenkreuz im Schnee, an der man sie nachlesen kann.
//
// Die Reise ist ein Versetzen hinter einer Glasblende, keine Fahrt: die
// Kamera dreht nie, und eine automatische Fahrt quer durchs Tal waere eine
// Kamerafahrt, die man nicht steuert. Man steht danach vor der Station,
// mit dem Ruecken zur Kamera, und die Einladung zum Enter ist schon da.
//
// Drohne und Loeschzug fehlen absichtlich, in beiden Reitern: sie liegen
// abseits, damit man sie findet – auf veerka.mp stehen sie auch nicht.

const VERSTECKT = new Set(['talplan', 'drone', 'firetruck'])

// Welche Station an welchem Weg liegt – fuer die Farbe in der Liste.
const WEG = {
  werkstatt: 'career',
  kontakt: 'social', kasse: 'social',
  worktime: 'tools', upload: 'tools', shortener: 'tools', packlist: 'tools',
}

// Die Kacheln, in der Reihenfolge und mit den Worten von veerka.mp. Die
// Adressen haengen an den Stationen (station + pick) und stehen nicht ein
// zweites Mal hier; nur Spotify und Komoot haben noch keinen Platz im Tal.
const KACHELN = [
  { titel: 'Karriere', weg: 'career', kacheln: [
    { icon: '💼', label: 'LinkedIn', sub: 'Meine Erfahrung', station: 'werkstatt', pick: 0 },
    { icon: '⚙️', label: 'GitHub', sub: 'Meine Projekte', station: 'werkstatt', pick: 1 },
  ] },
  { titel: 'Kontakt', weg: 'social', kacheln: [
    { icon: '💬', label: 'Signal', sub: 'Schreib mir', station: 'kontakt', pick: 0 },
    { icon: '📸', label: 'Instagram', sub: 'Schöne Fotos', station: 'kontakt', pick: 1 },
  ] },
  { titel: 'Unterstützen', weg: 'social', kacheln: [
    { icon: '💸', label: 'PayPal', sub: 'Geld senden', station: 'kasse', pick: 0 },
    { icon: '◎', label: 'Solana', sub: 'Echtes Geld', station: 'kasse', pick: 1 },
  ] },
  { titel: 'Meine Tools', weg: 'tools', kacheln: [
    { icon: '🔗', label: 'Kurzlink', sub: 'Links kürzen', station: 'shortener' },
    { icon: '🎒', label: 'Packliste', sub: 'Nichts vergessen', station: 'packlist' },
    { icon: '⏱️', label: 'Arbeitszeit', sub: 'Wie lange arbeitest du?', station: 'worktime' },
    { icon: '📤', label: 'File Uploader', sub: 'Sende mir Dateien', station: 'upload' },
  ] },
  { titel: 'Außerdem', kacheln: [
    { icon: '🎵', label: 'Spotify', sub: 'Höre was ich höre', url: LINKS.spotify },
    { icon: '🏔️', label: 'Komoot', sub: 'Wandern & Radfahren', url: LINKS.komoot },
  ] },
]

// Wie auf veerka.mp: ein Satz nach dem anderen, getippt und wieder geloescht.
// Im Menue und nicht im Tal – als Schild oder im Schnee waere es Laufschrift.
const SAETZE = [
  'Student E-Technik und IT. 👨‍💻',
  'Vibe Coder. ✨',
  'Freiwilliger Feuerwehrmann. 🚒',
  'Skilehrer. ⛷️',
  'Techno-Fan. 🪩',
  'Wanderer & Kletterer. 🏔️',
  'Aus Frankfurt. 🏢',
]

// Orte ohne Station. Die Punkte sind Ankunftsstellen, nicht Mittelpunkte:
// frei, flach genug zum Stehen und so gewaehlt, dass man sieht, wo man ist.
export const ORTE = [
  { id: 'start', label: 'Startplatz', sub: 'Plateau mit der Panoramatafel', x: PLATEAU.x + 1.5, z: PLATEAU.z + 0.5, color: '#bc713e' },
  { id: 'gipfel', label: 'Gipfel', sub: 'Oben am Lift, Einstieg Nordabfahrt', x: -61, z: -59, color: '#26323d' },
  { id: 'park', label: 'Funpark', sub: 'Kicker, Rail, Rennstrecke', x: 15, z: -43, color: TRAILS.sport.color },
  { id: 'huette', label: 'Après-Ski-Hütte', sub: 'Terrasse am Hang', x: 13.5, z: -55, color: TRAILS.sport.color },
  { id: 'see', label: 'Zugefrorener See', sub: 'Eis und Uferweg', x: -33, z: 38, color: '#4f8fa8' },
]

const STEUERUNG = TOUCH
  ? [
    ['👆', 'Daumen in den Schnee: fahren und lenken'],
    ['⏎', 'Station antippen: öffnen'],
    ['⤒', 'Sprungknopf im Funpark'],
  ]
  : [
    ['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', 'fahren, lenken, bremsen'],
    ['<kbd>⇧</kbd>', 'kanten'],
    ['<kbd class="k-space">Leertaste</kbd>', 'springen, im Park Tricks'],
    ['<kbd class="k-enter">⏎</kbd><kbd>E</kbd>', 'Station benutzen'],
    ['<kbd>M</kbd>', 'diese Übersicht'],
    ['<kbd>R</kbd>', 'zurück zum Start'],
  ]

export class MapMenu {
  constructor({ registry, input, skier, world, camera }) {
    this.registry = registry
    this.input = input
    this.skier = skier
    this.world = world
    this.camera = camera
    this.open = false
    this.view = 'links'
    this.selected = 0
    this.items = []
    this.tiles = []
    this.tileSel = 0
    this._painted = null
    // Wird von aussen gesetzt: die Uebersicht wurde einmal geoeffnet – der
    // Hinweis am Start hat seine Arbeit getan.
    this.onShow = null

    this.el = document.createElement('div')
    this.el.className = 'map-overlay'
    this.el.innerHTML = `
      <div class="glass map-panel" role="dialog" aria-label="Übersicht">
        <header class="ov-head">
          <div class="ov-name">
            <strong>Julian Veerkamp</strong>
            <span class="ov-typed" aria-live="off"><span></span><i></i></span>
          </div>
          <div class="ov-tabs" role="tablist">
            <button type="button" role="tab" data-view="links">Links</button>
            <button type="button" role="tab" data-view="karte">Talkarte</button>
          </div>
          <button type="button" class="sheet-close" aria-label="Schließen">×</button>
        </header>
        <section class="ov-links"></section>
        <section class="ov-karte">
          <div class="map-view"><div class="map-pins"></div></div>
          <div class="map-side">
            <div class="map-list"></div>
          </div>
        </section>
        <footer class="ov-keys">
          ${STEUERUNG.map(([k, t]) => `<span class="ov-key"><span class="ov-kbd">${k}</span>${t}</span>`).join('')}
        </footer>
        <div class="sheet-keys ov-hint"></div>
      </div>
    `
    document.body.appendChild(this.el)
    this.panel = this.el.querySelector('.map-panel')
    this.mapView = this.el.querySelector('.map-view')
    this.pins = this.el.querySelector('.map-pins')
    this.list = this.el.querySelector('.map-list')
    this.linksEl = this.el.querySelector('.ov-links')
    this.hintEl = this.el.querySelector('.ov-hint')
    this.typedEl = this.el.querySelector('.ov-typed span')
    this.el.querySelector('.sheet-close').addEventListener('click', () => this.close())
    for (const b of this.el.querySelectorAll('.ov-tabs button')) {
      b.addEventListener('click', () => this._setView(b.dataset.view))
    }
    // Ein Klick neben das Glas schliesst, wie ein Tipp in den Schnee.
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close() })

    this.veil = document.createElement('div')
    this.veil.className = 'travel-veil'
    document.body.appendChild(this.veil)
  }

  // --- Links ------------------------------------------------------------

  // Gebaut beim ersten Oeffnen und nicht beim Start: die Stationen rutschen
  // beim Aufbau noch auf flache Plaetze, und ihre Namen stehen erst dann fest.
  _buildLinks() {
    if (this.tiles.length) return
    const byId = (id) => this.registry.stations.find((s) => s.id === id)
    for (const gruppe of KACHELN) {
      const sec = document.createElement('div')
      sec.className = 'ov-group'
      sec.style.setProperty('--c', TRAILS[gruppe.weg]?.color ?? '#5f6f80')
      sec.innerHTML = '<h3></h3><div class="ov-grid"></div>'
      sec.querySelector('h3').textContent = gruppe.titel
      const grid = sec.querySelector('.ov-grid')
      for (const k of gruppe.kacheln) {
        const station = k.station ? byId(k.station) : null
        const i = this.tiles.length
        const el = document.createElement('div')
        el.className = 'ov-tile'
        el.innerHTML = `
          <button type="button" class="ov-open">
            <span class="ov-icon"></span>
            <span class="ov-text"><span class="ov-label"></span><span class="ov-sub"></span></span>
            <span class="ov-go" aria-hidden="true">↗</span>
          </button>
          ${station ? '<button type="button" class="ov-where"><span class="ov-pin" aria-hidden="true"></span><span></span></button>' : ''}
        `
        el.querySelector('.ov-icon').textContent = k.icon
        el.querySelector('.ov-label').textContent = k.label
        el.querySelector('.ov-sub').textContent = k.sub
        el.querySelector('.ov-open').addEventListener('click', () => this._openTile(i))
        el.addEventListener('pointermove', (e) => this._hover(e, () => this._selectTile(i)))
        if (station) {
          const where = el.querySelector('.ov-where')
          where.lastElementChild.textContent = `im Tal: ${station.label}`
          where.title = `Hinfahren: ${station.label}`
          where.addEventListener('click', () => this._travelTile(i))
        }
        grid.appendChild(el)
        this.tiles.push({ ...k, el, station })
      }
      this.linksEl.appendChild(sec)
    }
  }

  _selectTile(i) {
    this.tileSel = Math.max(0, Math.min(this.tiles.length - 1, i))
    this.tiles.forEach((t, k) => t.el.classList.toggle('selected', k === this.tileSel))
    this.tiles[this.tileSel]?.el.scrollIntoView({ block: 'nearest' })
  }

  // Pfeiltasten gehen im Raster so, wie man es sieht: die naechste Kachel in
  // der Richtung, schraeg daneben zaehlt zweieinhalbfach. Ein fester Index
  // passte nicht, weil die Gruppen verschieden viele Spalten haben.
  _moveTile(dx, dy) {
    const cur = this.tiles[this.tileSel].el.getBoundingClientRect()
    const cx = cur.left + cur.width / 2, cy = cur.top + cur.height / 2
    let best = -1, bestScore = Infinity
    this.tiles.forEach((t, i) => {
      if (i === this.tileSel) return
      const r = t.el.getBoundingClientRect()
      const ox = r.left + r.width / 2 - cx, oy = r.top + r.height / 2 - cy
      const along = dx ? ox * dx : oy * dy
      if (along < 8) return
      const score = along + Math.abs(dx ? oy : ox) * 2.5
      if (score < bestScore) { bestScore = score; best = i }
    })
    if (best >= 0) this._selectTile(best)
  }

  // Oeffnet im Klick- oder Tastenereignis selbst – Safari laesst window.open
  // nur waehrend einer Nutzergeste zu. Fenster statt Link (Solana, Upload,
  // Kurzlink) bekommen die Buehne allein, die Uebersicht geht zu.
  _openTile(i) {
    const t = this.tiles[i]
    if (!t) return
    this._selectTile(i)
    t.el.classList.remove('used')
    void t.el.offsetWidth
    t.el.classList.add('used')
    if (t.url) {
      window.open(t.url, '_blank', 'noopener,noreferrer')
      return
    }
    const choice = t.pick !== undefined ? t.station.choices?.[t.pick] : null
    const isLink = choice ? !!choice.url : !!t.station.url
    if (!isLink) this.close()
    this.registry.open(t.station, t.pick ?? null)
  }

  _travelTile(i) {
    const t = this.tiles[i]
    if (!t?.station) return
    this._selectTile(i)
    this.travelTo({ x: t.station.position.x, z: t.station.position.z, station: t.station })
  }

  // --- Karte ------------------------------------------------------------

  _collect() {
    const stations = this.registry.stations
      .filter((s) => !VERSTECKT.has(s.id))
      .map((s) => ({
        id: s.id,
        label: s.label,
        sub: s.hint,
        x: s.position.x,
        z: s.position.z,
        color: TRAILS[WEG[s.id]]?.color ?? s.color,
        station: s,
      }))
    return [
      { group: 'Stationen', items: stations },
      { group: 'Orte', items: ORTE.map((o) => ({ ...o })) },
    ]
  }

  // Die Karte malt die Panoramatafel beim Aufbau; hier wird sie nur
  // eingehaengt.
  _paint() {
    if (this._painted) return this._painted
    const talplan = this.registry.stations.find((s) => s.id === 'talplan')
    this._painted = talplan.map
    this._painted.canvas.className = 'map-canvas'
    this.mapView.prepend(this._painted.canvas)
    return this._painted
  }

  _buildMap() {
    const { projection } = this._paint()
    const groups = this._collect()
    this.items = groups.flatMap((g) => g.items)

    this.list.replaceChildren()
    this.pins.replaceChildren()
    let index = 0
    for (const g of groups) {
      const h = document.createElement('div')
      h.className = 'map-group'
      h.textContent = g.group
      this.list.appendChild(h)
      for (const item of g.items) {
        const i = index++
        const b = document.createElement('button')
        b.type = 'button'
        b.className = 'map-item'
        b.style.setProperty('--c', item.color)
        b.innerHTML = '<span class="map-item-dot"></span><span class="opt-text"><span class="opt-label"></span><span class="opt-sub"></span></span><span class="opt-go" aria-hidden="true"></span>'
        b.querySelector('.opt-label').textContent = item.label
        b.querySelector('.opt-sub').textContent = item.sub ?? ''
        b.querySelector('.opt-go').textContent = TOUCH ? '→' : '⏎'
        b.addEventListener('click', () => this.travel(i))
        b.addEventListener('pointermove', (e) => this._hover(e, () => this._select(i)))
        this.list.appendChild(b)
        item.button = b

        const [px, py] = projection.project(item.x, item.z)
        const pin = document.createElement('button')
        pin.type = 'button'
        pin.className = 'map-pin'
        pin.style.setProperty('--c', item.color)
        pin.style.left = `${(px / projection.width) * 100}%`
        pin.style.top = `${(py / projection.height) * 100}%`
        pin.innerHTML = '<span class="map-pin-label"></span>'
        pin.firstElementChild.textContent = item.label
        pin.setAttribute('aria-label', item.label)
        pin.addEventListener('click', () => this.travel(i))
        pin.addEventListener('pointermove', (e) => this._hover(e, () => this._select(i)))
        this.pins.appendChild(pin)
        item.pin = pin
      }
    }
    // Hier bist du.
    const [hx, hy] = projection.project(this.skier.position.x, this.skier.position.z)
    const here = document.createElement('span')
    here.className = 'map-here'
    here.style.left = `${(hx / projection.width) * 100}%`
    here.style.top = `${(hy / projection.height) * 100}%`
    here.innerHTML = '<span>Du</span>'
    this.pins.appendChild(here)

    // Vorausgewaehlt ist das naechstgelegene Ziel, das nicht das ist, an dem
    // man gerade steht – wer die Karte oeffnet, will woandershin.
    let best = 0, bestD = Infinity
    this.items.forEach((it, i) => {
      const d = Math.hypot(it.x - this.skier.position.x, it.z - this.skier.position.z)
      if (d > 9 && d < bestD) { bestD = d; best = i }
    })
    this.selected = -1
    this._select(best)
  }

  _select(i) {
    if (i === this.selected) return
    this.selected = i
    this.items.forEach((it, k) => {
      it.button.classList.toggle('selected', k === i)
      it.pin.classList.toggle('selected', k === i)
    })
    this.items[i]?.button.scrollIntoView({ block: 'nearest' })
  }

  // --- Oeffnen und Schliessen ---------------------------------------------

  show(view = 'links') {
    if (this.open || this.skier.tow) return false
    this._buildLinks()
    this._buildMap()
    this._selectTile(this.tileSel)
    this._setView(view)
    this.open = true
    this.input.locked = true
    this.el.classList.add('visible')
    this._type()
    this.onShow?.()
    return true
  }

  close() {
    if (!this.open) return
    this.open = false
    this.input.locked = false
    this.el.classList.remove('visible')
    clearTimeout(this._typing)
  }

  _setView(view) {
    this.view = view
    this.panel.dataset.view = view
    for (const b of this.el.querySelectorAll('.ov-tabs button')) {
      b.setAttribute('aria-selected', String(b.dataset.view === view))
    }
    this.hintEl.innerHTML = TOUCH
      ? (view === 'links' ? 'Kachel antippen öffnet · „im Tal“ bringt dich hin' : 'Ziel antippen zum Hinreisen')
      : view === 'links'
        ? '<kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd> wählen <i></i> <kbd class="k-enter">⏎</kbd> öffnen <i></i> <kbd class="k-space">Leertaste</kbd> hinfahren <i></i> <kbd>tab</kbd> Talkarte <i></i> <kbd>esc</kbd> zurück'
        : '<kbd>↑</kbd><kbd>↓</kbd> wählen <i></i> <kbd class="k-enter">⏎</kbd> hinreisen <i></i> <kbd>tab</kbd> Links <i></i> <kbd>esc</kbd> zurück'
  }

  // Getippt wird nur, solange die Uebersicht offen ist.
  _type() {
    let satz = 0, pos = 0, weg = false
    const zeichen = (s) => [...s]
    const tick = () => {
      if (!this.open) return
      const z = zeichen(SAETZE[satz])
      if (!weg) {
        pos++
        this.typedEl.textContent = z.slice(0, pos).join('')
        if (pos >= z.length) { weg = true; this._typing = setTimeout(tick, 1900); return }
        this._typing = setTimeout(tick, 55 + Math.random() * 45)
      } else {
        pos--
        this.typedEl.textContent = z.slice(0, pos).join('')
        if (pos <= 0) { weg = false; satz = (satz + 1) % SAETZE.length; this._typing = setTimeout(tick, 350); return }
        this._typing = setTimeout(tick, 28)
      }
    }
    clearTimeout(this._typing)
    this.typedEl.textContent = ''
    this._typing = setTimeout(tick, 250)
  }

  // Die Maus waehlt nur, wenn sie sich bewegt hat. Mit pointerenter sprang
  // die Auswahl mit den Pfeiltasten am Listenende wieder nach oben: die
  // Liste scrollt unter dem ruhenden Zeiger weg, der Browser meldet das
  // Ziel darunter als neu betreten, und das lag weiter oben.
  _hover(e, pick) {
    if (e.pointerType !== 'mouse') return
    const wo = `${e.screenX},${e.screenY}`
    if (wo === this._zeiger) return
    this._zeiger = wo
    pick()
  }

  // true = verbraucht. Solange die Uebersicht offen ist, gehoert ihr jede
  // Taste. In der Karte bleibt die Auswahl am Listenende stehen, statt nach
  // oben zu springen: bei fuenfzehn Zielen sah der Umlauf aus, als haette die
  // Liste sich verschluckt, weil der Sprung ausserhalb des Sichtbaren lag.
  press(action) {
    if (!this.open) return false
    if (action === 'tab') {
      this._setView(this.view === 'links' ? 'karte' : 'links')
      return true
    }
    if (action === 'back' || action === 'map') {
      this.close()
      return true
    }
    if (this.view === 'links') {
      switch (action) {
        case 'forward': this._moveTile(0, -1); break
        case 'brake': this._moveTile(0, 1); break
        case 'left': this._moveTile(-1, 0); break
        case 'right': this._moveTile(1, 0); break
        case 'use': this._openTile(this.tileSel); break
        case 'jump': this._travelTile(this.tileSel); break
        default: break
      }
      return true
    }
    const last = this.items.length - 1
    switch (action) {
      case 'forward': case 'left': this._select(Math.max(0, this.selected - 1)); break
      case 'brake': case 'right': this._select(Math.min(last, this.selected + 1)); break
      case 'use': this.travel(this.selected); break
      default: break
    }
    return true
  }

  // --- Reisen -------------------------------------------------------------

  // Ankunft: vor dem Ziel, von der Kamera aus gesehen, damit man mit dem
  // Ruecken zur Kamera davor steht. Liegt dort etwas im Weg (die Werkbank
  // vor der Werkstatt), wird weiter aussen und seitlich gesucht.
  _arrival(item) {
    if (!item.station) return { x: item.x, z: item.z, heading: CAMERA.azimuth + Math.PI }
    const r = item.station.radius ?? 6
    for (const dist of [r * 0.5, r * 0.65, r * 0.8]) {
      for (const turn of [0, 0.45, -0.45, 0.9, -0.9]) {
        const a = CAMERA.azimuth + turn
        const x = item.x + Math.sin(a) * dist
        const z = item.z + Math.cos(a) * dist
        const frei = this.world.colliders.every((c) => Math.hypot(c.x - x, c.z - z) > c.r + 0.8)
        if (frei) return { x, z, heading: a + Math.PI }
      }
    }
    return { x: item.x + Math.sin(CAMERA.azimuth) * r * 0.6, z: item.z + Math.cos(CAMERA.azimuth) * r * 0.6, heading: CAMERA.azimuth + Math.PI }
  }

  travel(i) {
    const item = this.items[i]
    if (!item) return
    this._select(i)
    this.travelTo(item)
  }

  // Auch der Weg fuer R: zurueck zum Start ist nur ein weiteres Reiseziel.
  travelTo(item) {
    if (this._reisend) return
    this._reisend = true
    this.veil.classList.add('on')
    // Erst wenn die Blende deckt, wird versetzt – sonst sieht man das Tal
    // springen.
    setTimeout(() => {
      const { x, z, heading } = this._arrival(item)
      this.skier.versetzen(x, z, heading)
      this.camera.snap()
      this.close()
      setTimeout(() => {
        this.veil.classList.remove('on')
        this._reisend = false
      }, 120)
    }, 280)
  }
}
