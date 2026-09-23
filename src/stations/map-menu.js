import { CAMERA } from '../config.js'
import { TOUCH } from '../core/device.js'
import { TRAILS } from '../world/paths.js'

// Die Talkarte als Menue: Enter am Kartenpult (oder M ueberall) oeffnet sie.
// Links die Karte – dasselbe Relief wie auf dem Pult, nur ohne Titel –, mit
// einem Punkt fuer jedes Ziel und einem fuer "hier bist du". Rechts die
// Ziele als Liste. Pfeile waehlen, Enter reist hin, Esc schliesst.
//
// Die Reise ist ein Versetzen hinter einer Glasblende, keine Fahrt: die
// Kamera dreht nie, und eine automatische Fahrt quer durchs Tal waere eine
// Kamerafahrt, die man nicht steuert. Man steht danach vor der Station,
// mit dem Ruecken zur Kamera, und die Einladung zum Enter ist schon da.
//
// Drohne und Loeschzug fehlen absichtlich: sie liegen abseits, damit man sie
// findet, und ein Menue, das sie auflistet, haette sie nur noch versteckt.

const VERSTECKT = new Set(['talplan', 'drone', 'firetruck'])

// Welche Station an welchem Weg liegt – fuer die Farbe in der Liste.
const WEG = {
  werkstatt: 'career',
  kontakt: 'social', kasse: 'social',
  worktime: 'tools', upload: 'tools', shortener: 'tools', packlist: 'tools',
}

// Orte ohne Station. Die Punkte sind Ankunftsstellen, nicht Mittelpunkte:
// frei, flach genug zum Stehen und so gewaehlt, dass man sieht, wo man ist.
const ORTE = [
  { id: 'start', label: 'Startplatz', sub: 'Plateau mit dem Kartenpult', x: 1.5, z: 30.5, color: '#bc713e' },
  { id: 'gipfel', label: 'Gipfel', sub: 'Oben am Lift, Einstieg Nordabfahrt', x: -61, z: -59, color: '#26323d' },
  { id: 'park', label: 'Funpark', sub: 'Kicker, Rail, Rennstrecke', x: 15, z: -43, color: TRAILS.sport.color },
  { id: 'huette', label: 'Après-Ski-Hütte', sub: 'Terrasse am Hang', x: 13.5, z: -55, color: TRAILS.sport.color },
  { id: 'see', label: 'Zugefrorener See', sub: 'Eis und Uferweg', x: -33, z: 38, color: '#4f8fa8' },
]

export class MapMenu {
  constructor({ registry, input, skier, world, camera }) {
    this.registry = registry
    this.input = input
    this.skier = skier
    this.world = world
    this.camera = camera
    this.open = false
    this.selected = 0
    this.items = []
    this._painted = null

    this.el = document.createElement('div')
    this.el.className = 'map-overlay'
    this.el.innerHTML = `
      <div class="glass map-panel" role="dialog" aria-label="Talkarte">
        <div class="map-view"><div class="map-pins"></div></div>
        <div class="map-side">
          <div class="sheet-head">
            <span class="sheet-dot" style="--accent:#346782"></span>
            <span class="sheet-title">Talkarte</span>
            <span class="sheet-sub">Schnellreise</span>
            <button type="button" class="sheet-close" aria-label="Schließen">×</button>
          </div>
          <div class="map-list"></div>
          <div class="sheet-keys">${TOUCH
            ? 'Ziel antippen zum Hinreisen'
            : '<kbd>↑</kbd><kbd>↓</kbd> wählen <i></i> <kbd class="k-enter">⏎</kbd> hinreisen <i></i> <kbd>esc</kbd> zurück'}</div>
        </div>
      </div>
    `
    document.body.appendChild(this.el)
    this.view = this.el.querySelector('.map-view')
    this.pins = this.el.querySelector('.map-pins')
    this.list = this.el.querySelector('.map-list')
    this.el.querySelector('.sheet-close').addEventListener('click', () => this.close())
    // Ein Klick neben das Glas schliesst, wie ein Tipp in den Schnee.
    this.el.addEventListener('click', (e) => { if (e.target === this.el) this.close() })

    this.veil = document.createElement('div')
    this.veil.className = 'travel-veil'
    document.body.appendChild(this.veil)
  }

  // Ziele werden beim Oeffnen gesammelt und nicht beim Start: die Stationen
  // rutschen beim Aufbau noch auf flache Plaetze.
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

  // Die Karte malt das Pult beim Aufbau; hier wird sie nur eingehaengt.
  _paint() {
    if (this._painted) return this._painted
    const talplan = this.registry.stations.find((s) => s.id === 'talplan')
    this._painted = talplan.map
    this._painted.canvas.className = 'map-canvas'
    this.view.prepend(this._painted.canvas)
    return this._painted
  }

  show() {
    if (this.open || this.skier.tow) return false
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
        b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this._select(i) })
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
        pin.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this._select(i) })
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

    this.open = true
    this.input.locked = true
    this.el.classList.add('visible')
    return true
  }

  close() {
    if (!this.open) return
    this.open = false
    this.input.locked = false
    this.el.classList.remove('visible')
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

  // true = verbraucht. Solange die Karte offen ist, gehoert ihr jede Taste.
  // Am Ende der Liste bleibt die Auswahl stehen, statt nach oben zu springen:
  // bei fuenfzehn Zielen sah der Umlauf aus, als haette die Liste sich
  // verschluckt, weil der Sprung ausserhalb des sichtbaren Teils passiert.
  press(action) {
    if (!this.open) return false
    const last = this.items.length - 1
    switch (action) {
      case 'forward': case 'left': this._select(Math.max(0, this.selected - 1)); break
      case 'brake': case 'right': this._select(Math.min(last, this.selected + 1)); break
      case 'use': this.travel(this.selected); break
      case 'back': case 'map': this.close(); break
      default: break
    }
    return true
  }

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
    if (!item || this._reisend) return
    this._select(i)
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
