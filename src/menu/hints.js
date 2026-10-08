import { TOUCH } from '../core/device.js'
import { pathPreparation } from '../world/paths.js'
import { playAreaDistance, aufSee, SLED_LANE, NORTH_LANE, PARK_LANE, KINDER_LANE, SHOOT_LANE } from '../world/heightfield.js'

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

// Seit 08.10. schneller (Ansage): festgefahren nach 3 statt gut 5 s, und im
// Wald nach 4 s, auch wenn man faehrt. Vorher kam der Hinweis im Wald so gut
// wie nie: er verlangte bei jeder Probe drei Staemme im Umkreis von 4 m, sah
// nur die eigene 6-m-Zelle des Rasters, und eine einzige lichte Stelle setzte
// die Zeit auf null.
const SAMPLE = 0.5        // s zwischen zwei Positionsproben
const WINDOW = 6          // Proben = 3 s Rueckblick
const STUCK_DIST = 2.5    // m: weniger Weg in 3 s trotz Gas = festgefahren
const LOST_AFTER = 4      // s abseits der Wege im Wald = verfranzt
const WALD_RADIUS = 5     // m, in dem Staemme zaehlen
const WALD_STAEMME = 2
const LANES = [SLED_LANE, NORTH_LANE, PARK_LANE, KINDER_LANE, SHOOT_LANE]

// Auf einer Piste (bis zwei Meter neben dem Band) ist man nie verfranzt –
// die Nordabfahrt laeuft durch dichten Wald.
function aufPiste(x, z) {
  for (const lane of LANES) {
    for (const g of lane.segments) {
      const t = Math.max(0, Math.min(1, ((x - g.x) * g.dx + (z - g.z) * g.dz) / g.len2))
      const w = g.w0 + (g.w1 - g.w0) * t
      if (Math.hypot(x - g.x - g.dx * t, z - g.z - g.dz * t) < w / 2 + 2) return true
    }
  }
  return false
}

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

    // Verfranzt: abseits von Wegen und Pisten im Wald, auch wenn man sich
    // noch bewegt. Wald heisst: mindestens zwei Staemme oder Felsen der
    // Grenze im Umkreis von 5 m (aus den Nachbarzellen des Rasters mit), oder
    // schon im Waldguertel am Rand. Eine lichte Stelle zieht nur ab, statt
    // die Zeit zu loeschen.
    const { x, z } = s.position
    const imWald = pathPreparation(x, z) < 0.05 && !aufPiste(x, z) && !aufSee(x, z) &&
      (playAreaDistance(x, z) > -4 || this._staemme(x, z) >= WALD_STAEMME)
    this._lost = imWald ? this._lost + SAMPLE : Math.max(0, this._lost - 2 * SAMPLE)

    const show = this._stuck >= SAMPLE || this._lost >= LOST_AFTER
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

  // Staemme im Umkreis: Kreise ohne Daten (Baeume, Felsen), unendlich hoch,
  // nicht die duennen Pfosten. Das Raster liefert nur die eigene Zelle (6 m),
  // deshalb werden die Nachbarzellen mitgefragt.
  _staemme(x, z) {
    const gesehen = this._gesehen || (this._gesehen = new Set())
    gesehen.clear()
    let n = 0
    for (const dx of [-6, 0, 6]) {
      for (const dz of [-6, 0, 6]) {
        for (const c of this.world.nearby(x + dx, z + dz, this._near || (this._near = []))) {
          if (gesehen.has(c)) continue
          gesehen.add(c)
          if (c.data || c.off || c.h !== Infinity || c.r < 0.45) continue
          if (Math.hypot(c.x - x, c.z - z) < WALD_RADIUS) n++
        }
      }
    }
    return n
  }
}
