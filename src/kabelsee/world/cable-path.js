import { CABLE } from '../config.js'

// Die Bahn des Kabels als geschlossener Linienzug, gleichmaessig in Stuecke
// von einem halben Meter zerlegt. Alles, was mit dem Umlauf zu tun hat –
// Mitnehmer, Runden, wo die Schanzen liegen –, rechnet mit der Bogenlaenge s
// auf dieser Bahn. Kein three.js hier, damit die Tests ohne Browser laufen.

const STEP = 0.5

function build() {
  const { halfX: hx, halfZ: hz, cornerRadius: r } = CABLE
  const raw = []
  const line = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.25))
    for (let i = 0; i < n; i++) raw.push([ax + (bx - ax) * (i / n), az + (bz - az) * (i / n)])
  }
  const arc = (cx, cz, a0, a1) => {
    const n = Math.ceil((Math.abs(a1 - a0) * r) / 0.25)
    for (let i = 0; i < n; i++) {
      const a = a0 + (a1 - a0) * (i / n)
      raw.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r])
    }
  }
  // Beginn auf der Nordgeraden (z = -hz) in Richtung -x, dort liegt der
  // Startsteg. Von oben gesehen geht es im Uhrzeigersinn: so faehrt man vom
  // Steg aus von der Kamera weg ins Bild hinein und sieht den Fahrer von
  // hinten, wie im Skital.
  line(hx - r, -hz, -hx + r, -hz)
  arc(-hx + r, -hz + r, -Math.PI / 2, -Math.PI)
  line(-hx, -hz + r, -hx, hz - r)
  arc(-hx + r, hz - r, Math.PI, Math.PI / 2)
  line(-hx + r, hz, hx - r, hz)
  arc(hx - r, hz - r, Math.PI / 2, 0)
  line(hx, hz - r, hx, -hz + r)
  arc(hx - r, -hz + r, 0, -Math.PI / 2)

  // Gleichmaessig neu abtasten.
  const cum = [0]
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1], b = raw[i % raw.length]
    cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]))
  }
  const length = cum[raw.length]
  const count = Math.round(length / STEP)
  const xs = new Float32Array(count)
  const zs = new Float32Array(count)
  let j = 0
  for (let i = 0; i < count; i++) {
    const s = (i / count) * length
    while (cum[j + 1] < s) j++
    const a = raw[j], b = raw[(j + 1) % raw.length]
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1)
    xs[i] = a[0] + (b[0] - a[0]) * t
    zs[i] = a[1] + (b[1] - a[1]) * t
  }
  return { xs, zs, count, length }
}

const PATH = build()
export const CABLE_LENGTH = PATH.length

export function wrap(s) {
  const L = PATH.length
  return ((s % L) + L) % L
}

// Punkt und Richtung auf der Bahn bei Bogenlaenge s.
export function cableAt(s, out = {}) {
  const u = (wrap(s) / PATH.length) * PATH.count
  const i = Math.floor(u) % PATH.count
  const k = (i + 1) % PATH.count
  const t = u - Math.floor(u)
  const x = PATH.xs[i] + (PATH.xs[k] - PATH.xs[i]) * t
  const z = PATH.zs[i] + (PATH.zs[k] - PATH.zs[i]) * t
  let dx = PATH.xs[k] - PATH.xs[i]
  let dz = PATH.zs[k] - PATH.zs[i]
  const l = Math.hypot(dx, dz) || 1
  out.x = x
  out.z = z
  out.dx = dx / l
  out.dz = dz / l
  return out
}

// Naechste Bogenlaenge zu einem Punkt. Mit Startwert wird nur in der Naehe
// gesucht, das ist das, was die Rundenzaehlung jedes Bild braucht.
export function nearestS(x, z, hint = null, window = 40) {
  let best = 0
  let bestD = Infinity
  const n = PATH.count
  const from = hint === null ? 0 : Math.floor((wrap(hint - window) / PATH.length) * n)
  const steps = hint === null ? n : Math.ceil((2 * window) / STEP)
  for (let k = 0; k < steps; k++) {
    const i = (from + k) % n
    const d = (PATH.xs[i] - x) ** 2 + (PATH.zs[i] - z) ** 2
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return (best / n) * PATH.length
}

// Die Ecken, an denen die Masten stehen: Mittelpunkt jedes Bogens und die
// Richtung nach aussen.
export function cableCorners() {
  const { halfX: hx, halfZ: hz, cornerRadius: r } = CABLE
  return [
    [-1, 1], [-1, -1], [1, -1], [1, 1],
  ].map(([sx, sz]) => {
    const cx = sx * (hx - r)
    const cz = sz * (hz - r)
    const l = Math.SQRT2
    return { cx, cz, ox: sx / l, oz: sz / l, x: cx + (sx / l) * r, z: cz + (sz / l) * r }
  })
}

export function cableSamples() {
  return PATH
}
