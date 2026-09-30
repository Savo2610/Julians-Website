import { TRICK } from '../config.js'

// Bewertung eines Sprungs und die Kombokette. Reine Rechnung ohne Anzeige,
// damit sie sich mit node --test pruefen laesst.
//
// Vorbild ist Steep: jede Figur zaehlt fuer sich, aber erst die Kette macht
// die grossen Zahlen. Wer innerhalb von TRICK.comboWindow nach der Landung
// den naechsten Trick steht oder eine Boje holt, haelt die Kette am Leben;
// jede neue Figur hebt den Faktor. Ein Sturz loescht die offene Kette.

const TAU = Math.PI * 2

// Wie weit eine Drehung von der naechsten vollen Umdrehung weg ist.
export function rotationError(angle) {
  return Math.abs(angle - Math.round(angle / TAU) * TAU)
}

export function landingQuality(spin, flip) {
  const err = Math.max(rotationError(spin), rotationError(flip))
  if (err <= TRICK.perfect) return { key: 'perfect', label: 'Perfekt', factor: 1.5, err }
  if (err <= TRICK.clean) return { key: 'clean', label: 'Sauber', factor: 1, err }
  if (err <= TRICK.sketchy) return { key: 'sketchy', label: 'Wackelig', factor: 0.55, err }
  return { key: 'crash', label: 'Sturz', factor: 0, err }
}

const SPIN_POINTS = { 1: 300, 2: 800, 3: 1500, 4: 2400 }
const FLIP_POINTS = { 1: 550, 2: 1500, 3: 3000 }

// air: { time, spin, flip, grab, height, slide, feature }
// Liefert null, wenn es nichts zu zaehlen gibt (ein kleiner Hopser).
export function scoreJump(air) {
  const spins = Math.round(Math.abs(air.spin) / TAU)
  const flips = Math.round(Math.abs(air.flip) / TAU)
  const parts = []
  let points = 0

  if (air.slide > 1.5) {
    parts.push(`Box-Slide ${Math.round(air.slide)} m`)
    points += Math.round(air.slide * 45)
  }
  if (flips > 0) {
    const kind = air.flip < 0 ? 'Backflip' : 'Frontflip'
    parts.push(flips === 1 ? kind : `${flips === 2 ? 'Doppel' : 'Dreifach'}-${kind}`)
    points += FLIP_POINTS[Math.min(3, flips)]
  }
  if (spins > 0) {
    parts.push(String(spins * 360))
    points += SPIN_POINTS[Math.min(4, spins)]
  }
  if (air.grab > 0.22) {
    let grab = 'Mute Grab'
    if (spins > 0) grab = 'Indy'
    if (flips > 0) grab = air.flip < 0 ? 'Method' : 'Nose Grab'
    parts.push(grab)
    points += 150 + Math.round(Math.min(air.grab, 1.5) * 300)
  }
  if (air.time > 1.25) {
    parts.push('Big Air')
    points += Math.round((air.time - 1.25) * 600) + 150
  } else if (parts.length && air.time > 0.4) {
    points += Math.round(air.time * 100)
  }
  if (!parts.length) return null
  return { name: parts.join(' '), points }
}

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
    return Math.min(5, Math.max(1, this.count))
  }

  // Ein gestandener Trick.
  trick(result, quality) {
    const pts = Math.round((result.points * quality.factor) / 10) * 10
    this.count += 1
    this.points += pts
    this.names.push(result.name)
    this.timer = TRICK.comboWindow
    this.events.push({ type: 'trick', name: result.name, points: pts, quality: quality.label, key: quality.key })
    return pts
  }

  // Sammelsachen fuellen die Kette, heben aber den Faktor nicht.
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
    const total = this.points * this.multiplier
    if (total > 0) {
      this.score += total
      this.events.push({ type: 'bank', points: total, multiplier: this.multiplier })
    }
    this.reset()
    return total
  }
}
