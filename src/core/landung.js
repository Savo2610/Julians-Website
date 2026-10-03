// Wie gut eine Landung steht – fuer den Kabelsee und den Funpark im Tal.
// Reine Rechnung ohne three.js; die Fenster bringt jeder Ort selbst mit
// (TRICK.spinLand und TRICK.flipLand in seiner config.js).

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
export function landeStufe(spin, flip, fenster, { slider = false } = {}) {
  const spinErr = slider ? quarterTurnError(spin) : halfTurnError(spin)
  const flipErr = rotationError(flip)
  const ls = level(spinErr, fenster.spinLand)
  const lf = level(flipErr, fenster.flipLand)
  const q = LEVELS[Math.max(ls, lf)]
  return {
    ...q, err: Math.max(spinErr, flipErr),
    fakie: Math.abs(Math.round(spin / Math.PI)) % 2 === 1,
    // Was zum Sturz gefuehrt hat, fuer die Meldung.
    cause: lf >= ls ? 'flip' : 'spin',
  }
}
