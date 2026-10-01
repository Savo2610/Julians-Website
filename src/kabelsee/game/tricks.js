import { TRICK } from '../config.js'

// Bewertung eines Sprungs und die Kombokette. Reine Rechnung ohne Anzeige,
// damit sie sich mit node --test pruefen laesst.
//
// Vorbild ist Steep: jede Figur zaehlt fuer sich, aber erst die Kette macht
// die grossen Zahlen. Wer innerhalb von TRICK.comboWindow nach der Landung
// den naechsten Trick steht, haelt die Kette am Leben; jede neue Figur hebt
// den Faktor um 0,5 (Ansage 01.10.: mit ganzen Schritten kamen 90 Prozent
// der Punkte aus der Kombo – vier Tricks zahlten ×4, jetzt ×2,5). Ein Sturz
// loescht die offene Kette.

const TAU = Math.PI * 2

// Wie weit eine Drehung von der naechsten vollen Umdrehung weg ist.
export function rotationError(angle) {
  return Math.abs(angle - Math.round(angle / TAU) * TAU)
}

// Dasselbe fuer die naechste halbe Umdrehung: nach einem 180 faehrt man
// rueckwaerts weiter, das ist kein Sturz mehr.
export function halfTurnError(angle) {
  return Math.abs(angle - Math.round(angle / Math.PI) * Math.PI)
}

// Und fuer die naechste Viertelstellung: auf Box und Rail darf man quer
// landen.
export function quarterTurnError(angle) {
  const q = Math.PI / 2
  return Math.abs(angle - Math.round(angle / q) * q)
}

const LEVELS = [
  { key: 'perfect', label: 'Perfekt', factor: 1.5 },
  { key: 'clean', label: 'Sauber', factor: 1 },
  { key: 'sketchy', label: 'Wackelig', factor: 0.55 },
  { key: 'crash', label: 'Sturz', factor: 0 },
]

function level(err, win) {
  if (err <= win.perfect) return 0
  if (err <= win.clean) return 1
  if (err <= win.sketchy) return 2
  return 3
}

// Drehung und Salto haben eigene Fenster; es zaehlt das schlechtere.
// `fakie`: die Landung dreht die Fahrtrichtung um (ungerade halbe Drehungen).
// Auf Box und Rail (slider) zaehlt die naechste Viertelstellung: schraeg
// aufsetzen ist dort hoechstens wackelig, nie ein Sturz.
export function landingQuality(spin, flip, { slider = false } = {}) {
  const spinErr = slider ? quarterTurnError(spin) : halfTurnError(spin)
  const flipErr = rotationError(flip)
  const ls = level(spinErr, TRICK.spinLand)
  const lf = level(flipErr, TRICK.flipLand)
  const q = LEVELS[Math.max(ls, lf)]
  return {
    ...q, err: Math.max(spinErr, flipErr),
    fakie: Math.abs(Math.round(spin / Math.PI)) % 2 === 1,
    // Was zum Sturz gefuehrt hat, fuer die Meldung.
    cause: lf >= ls ? 'flip' : 'spin',
  }
}

// Punkte je halber Umdrehung: 180, 360, 540 …
const SPIN_POINTS = [0, 150, 300, 550, 800, 1100, 1500, 1900, 2400]
const FLIP_POINTS = { 1: 550, 2: 1500, 3: 3000 }
const SLIDE_POINTS = { Box: 45, Rail: 55 }

// air: { time, spin, flip, grab, height, slide, slideQuer, slideKind, fakie }
// Liefert null, wenn es nichts zu zaehlen gibt (ein kleiner Hopser).
export function scoreJump(air) {
  const halves = Math.min(8, Math.round(Math.abs(air.spin) / Math.PI))
  const flips = Math.round(Math.abs(air.flip) / TAU)
  const parts = []
  let points = 0

  if (air.slide > 1.5) {
    const kind = air.slideKind || 'Box'
    // Mehr als die Haelfte mit quer gestellten Ski zaehlt als Quer-Slide.
    const quer = (air.slideQuer || 0) > air.slide * 0.5
    parts.push(`${kind}-Slide${quer ? ' quer' : ''} ${Math.round(air.slide)} m`)
    points += Math.round(air.slide * SLIDE_POINTS[kind] * (quer ? 1.5 : 1))
  }
  // Salto mit Drehung ist ein Cork (rueckwaerts) oder Rodeo (vorwaerts):
  // schwerer als beides einzeln, darum ein Aufschlag von 20 Prozent.
  if (flips > 0 && halves > 0) {
    const kind = air.flip < 0 ? 'Cork' : 'Rodeo'
    const n = flips === 1 ? '' : flips === 2 ? 'Doppel-' : 'Dreifach-'
    parts.push(`${n}${kind} ${halves * 180}`)
    points += Math.round((FLIP_POINTS[Math.min(3, flips)] + SPIN_POINTS[halves]) * 1.2)
  } else if (flips > 0) {
    const kind = air.flip < 0 ? 'Backflip' : 'Frontflip'
    parts.push(flips === 1 ? kind : `${flips === 2 ? 'Doppel' : 'Dreifach'}-${kind}`)
    points += FLIP_POINTS[Math.min(3, flips)]
  } else if (halves > 0) {
    parts.push(String(halves * 180))
    points += SPIN_POINTS[halves]
  }
  if (air.grab > 0.22) {
    let grab = 'Mute Grab'
    if (halves > 0) grab = 'Indy'
    if (flips > 0) grab = air.flip < 0 ? 'Method' : 'Nose Grab'
    parts.push(grab)
    points += 150 + Math.round(Math.min(air.grab, 1.5) * 300)
  }
  if (air.time > 1.6) {
    parts.push('Big Air')
    points += Math.round((air.time - 1.6) * 600) + 150
  } else if (parts.length && air.time > 0.4) {
    points += Math.round(air.time * 100)
  }
  if (!parts.length) return null
  // Wer rueckwaerts abspringt, faehrt Switch: 25 Prozent mehr.
  if (air.fakie && (halves > 0 || flips > 0)) {
    parts.unshift('Switch')
    points = Math.round(points * 1.25)
  }
  return { name: parts.join(' '), points }
}

// Abwechslung (Ansage 01.10.): derselbe Trick gibt in einer Session beim
// ersten Mal alles, danach je 30 Prozent weniger – 70, 49, 34 … und nie unter
// 20 Prozent. Wer immer nur den sicheren 360 springt, kommt so nicht weit.
// Derselbe Trick heisst: gleicher Name ohne Laenge eines Slides und ohne
// „Big Air“ – ein hoeherer 360 ist kein anderer 360. Grab und Switch machen
// ihn dagegen zu einem anderen.
export const trickSchluessel = (name) => name.replace(/ \d+ m\b/, '').replace(/ Big Air$/, '')
export const wiederholung = (mal) => Math.max(0.2, 0.7 ** (mal - 1))

export class Combo {
  constructor() {
    this.score = 0
    this.reset()
    // Rueckmeldungen fuer die Anzeige; der Hauptteil holt sie ab.
    this.events = []
  }

  reset() {
    this.points = 0
    this.count = 0
    this.timer = 0
    this.names = []
  }

  get active() {
    return this.timer > 0 && this.points > 0
  }

  get multiplier() {
    return Math.min(5, 1 + 0.5 * Math.max(0, this.count - 1))
  }

  // Ein gestandener Trick.
  // mal: das wievielte Mal dieser Trick in der Session (siehe oben).
  trick(result, quality, mal = 1) {
    const pts = Math.round((result.points * quality.factor * wiederholung(mal)) / 10) * 10
    this.count += 1
    this.points += pts
    this.names.push(result.name)
    this.timer = TRICK.comboWindow
    this.events.push({ type: 'trick', name: result.name, points: pts, quality: quality.label, key: quality.key, mal })
    return pts
  }

  // Fuellt die Kette, ohne den Faktor zu heben – nur noch der Katapult-Start.
  // Gesammeltes geht seit 01.10. direkt aufs Konto (bonus).
  collect(points, label) {
    this.points += points
    this.timer = Math.max(this.timer, 1.6)
    this.events.push({ type: 'collect', points, label })
  }

  bonus(points, label) {
    this.score += points
    this.events.push({ type: 'bonus', points, label })
  }

  crash() {
    if (this.points > 0) this.events.push({ type: 'lost', points: this.points })
    this.reset()
  }

  // Gibt die ausgezahlte Summe zurueck, wenn die Kette gerade endet.
  update(dt) {
    if (this.timer <= 0) return 0
    this.timer -= dt
    if (this.timer > 0) return 0
    return this.bank()
  }

  bank() {
    const total = Math.round((this.points * this.multiplier) / 10) * 10
    if (total > 0) {
      this.score += total
      this.events.push({ type: 'bank', points: total, multiplier: this.multiplier })
    }
    this.reset()
    return total
  }
}
