import { TOUCH } from '../core/device.js'
import { pathPreparation } from '../world/paths.js'

// Zwei kleine Hinweise unten in der Mitte, Frosttext ohne Behaelter. Beide
// sind Knoepfe – wer mit Tasten nichts anfangen kann, klickt sie einfach an.
//
// - "M  Übersicht & alle Links": beim Start. Beobachtet wurde, dass gerade
//   aeltere Besucher mit WASD nicht zurechtkommen und dann gar nichts finden.
//   Das Tastenkreuz im Schnee sagt ihnen, wie man faehrt, aber nicht, dass
//   es einen Weg ohne Fahren gibt. Der Hinweis bleibt, bis die Uebersicht
//   einmal offen war oder man eine halbe Minute gefahren ist – zwei
//   Sekunden, wie bei den anderen Einblendungen, sind fuer genau diese
//   Besucher zu kurz.
// - "R  Zurück zum Start": erscheint nur, wenn es danach aussieht, als haette
//   man sich festgefahren (siehe update).
//
// Am Handy gibt es den Kartenknopf oben rechts; der Start-Hinweis entfaellt
// dort, der Rueckweg erscheint als Knopf ohne Taste.

const SAMPLE = 0.5        // s zwischen zwei Positionsproben
const WINDOW = 8          // Proben = 4 s Rueckblick
const STUCK_DIST = 3      // m: weniger Weg in 4 s trotz Gas = festgefahren
const LOST_AFTER = 7      // s abseits der Wege zwischen Baeumen = verfranzt

export class Hints {
  constructor({ map, input, skier, world, onReset }) {
    this.map = map
    this.input = input
    this.skier = skier
    this.world = world
    this.onReset = onReset

    this.start = this._hinweis(TOUCH ? null : 'M', 'Übersicht & alle Links', () => this.map.show('links'))
    this.reset = this._hinweis(TOUCH ? null : 'R', 'Zurück zum Start', () => this.onReset())
    this.start.classList.add('hint-start')

    this._startDone = TOUCH
    this._driven = 0
    this._samples = []
    this._acc = 0
    this._stuck = 0
    this._lost = 0
    this._clear = 0
    this._resetShown = false
    // Nach dem Laden kurz warten, sonst erscheint der Hinweis unter dem
    // abblendenden Ladebildschirm.
    if (!TOUCH) setTimeout(() => { if (!this._startDone) this.start.classList.add('visible') }, 1400)
  }

  _hinweis(key, text, onClick) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'frost hinweis'
    b.tabIndex = -1
    b.innerHTML = `${key ? `<kbd>${key}</kbd>` : ''}<span></span>`
    b.querySelector('span').textContent = text
    // Synchron im Klick, wie ueberall, wo danach etwas aufgehen kann.
    b.addEventListener('click', (e) => { e.preventDefault(); onClick() })
    document.body.appendChild(b)
    return b
  }

  // Die Uebersicht war offen: der Start-Hinweis hat seine Arbeit getan.
  seen() {
    this._startDone = true
    this.start.classList.remove('visible')
  }

  afterReset() {
    this._samples.length = 0
    this._stuck = this._lost = 0
    this._setReset(false)
  }

  _setReset(on) {
    if (on === this._resetShown) return
    this._resetShown = on
    this.reset.classList.toggle('visible', on)
    // Beide gleichzeitig waeren zwei Hinweise uebereinander; der Rueckweg ist
    // dann die dringendere Nachricht.
    if (!this._startDone) this.start.classList.toggle('visible', !on)
  }

  update(dt) {
    const s = this.skier
    const busy = this.map.open || this.input.locked || !!s.tow
    if (busy) return

    if (!this._startDone && s.speed > 1) {
      this._driven += dt
      if (this._driven > 30) this.seen()
    }

    this._acc += dt
    if (this._acc < SAMPLE) return
    this._acc = 0

    // Festgefahren: Gas oder Lenkung gedrueckt, aber in vier Sekunden keine
    // drei Meter vorangekommen – typisch zwischen Baeumen oder im Tiefschnee
    // am Talrand, wo jeder Stamm den Fahrer zurueckschiebt.
    const trying = this.input.throttle > 0 || this.input.steer !== 0
    this._samples.push({ x: s.position.x, z: s.position.z, trying, speed: s.speed })
    if (this._samples.length > WINDOW) this._samples.shift()
    const first = this._samples[0]
    const moved = Math.hypot(s.position.x - first.x, s.position.z - first.z)
    // Und langsam dabei: wer mit W und A im Kreis faehrt, kommt auch nicht
    // voran, ist aber nicht festgefahren.
    const allTrying = this._samples.length === WINDOW && this._samples.every((p) => p.trying && p.speed < 4)
    this._stuck = allTrying && moved < STUCK_DIST ? this._stuck + SAMPLE : 0

    // Verfranzt: weit weg von jedem Weg und mitten zwischen Baeumen, auch
    // wenn man sich noch bewegt. Gezaehlt wird, was im Umkreis von 4 m eine
    // unendlich hohe Kollision hat – Baeume, Waende; Steine nicht.
    const offPath = pathPreparation(s.position.x, s.position.z) < 0.05
    const near = this.world.nearby(s.position.x, s.position.z, this._near || (this._near = []))
      .filter((c) => c.h === Infinity && !c.off && Math.hypot(c.x - s.position.x, c.z - s.position.z) < 4).length
    this._lost = offPath && near >= 3 ? this._lost + SAMPLE : 0

    const show = this._stuck >= 1 || this._lost >= LOST_AFTER
    if (show) {
      this._clear = 0
      this._setReset(true)
    } else if (this._resetShown) {
      // Erst nach zwei Sekunden freier Fahrt wieder weg – sonst flackert es,
      // solange man sich zwischen zwei Staemmen herauswindet.
      this._clear += SAMPLE
      if (this._clear >= 2) this._setReset(false)
    }
  }
}
