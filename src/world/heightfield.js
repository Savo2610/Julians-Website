import { LAKE, ISLAND } from '../config.js'
import { fbm } from '../core/noise.js'

// Die einzige Hoehenquelle der Welt: Gelaende-Mesh, Wassertiefe im Shader,
// Ufer-Kollision und das Setzen von Baeumen fragen alle hier. Wasserspiegel
// ist y = 0; alles darunter ist Seegrund.

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Superellipse mit leicht welligem Rand. Liefert den Abstand zum Rand in
// Metern entlang des Strahls vom Mittelpunkt, positiv innen, negativ aussen.
// Die Superellipse ist homogen (q(t*p) = t*q(p)), der Rand liegt auf dem
// Strahl also bei r/q. Das ist nicht der kuerzeste Abstand, aber anders als
// (1 - q) * Radius stimmt er auch an der langen Seite: vorher war die Insel
// laengs nur mit einem Drittel ihrer Breite gerechnet.
function shapeDistance(x, z, s, wobble) {
  const dx = x - s.x
  const dz = z - s.z
  const r = Math.hypot(dx, dz)
  const a = Math.atan2(dz, dx)
  const w = 1 + wobble(a)
  const qx = Math.abs(dx) / (s.rx * w)
  const qz = Math.abs(dz) / (s.rz * w)
  const q = Math.pow(Math.pow(qx, s.power) + Math.pow(qz, s.power), 1 / s.power)
  if (q < 1e-6) return Math.min(s.rx, s.rz) * w
  return r / q - r
}

// Zwei grosse Buchten und eine Landnase, dazu feinere Wellen. Die Amplituden
// sind so gewaehlt, dass die Bahn ueberall mindestens 16 m Wasser nach aussen
// behaelt (ausser an der Landzunge mit dem Steg); der Test prueft das.
const lakeWobble = (a) => 0.05 * Math.sin(2 * a + 2.4) + 0.035 * Math.sin(3 * a + 0.7) + 0.025 * Math.sin(7 * a + 2.1) + 0.015 * Math.sin(11 * a)
const islandWobble = (a) => 0.09 * Math.sin(2 * a + 1.3) + 0.06 * Math.sin(5 * a + 0.4) + 0.03 * Math.sin(9 * a + 2)

// Die Landzunge mit Station und Startsteg im Norden: dort steht das Haus mit
// der Schauseite zur Kamera. Eine Kapsel, die vom
// Ufer bis kurz vor die Kabelbahn reicht; den Rest ueberbrueckt der Steg.
export const PENINSULA = { x: 36, z0: -86, z1: -72, radius: 9 }
// Der Platz vor der Station wird eingeebnet, damit Haus und Terrasse nicht
// auf einem Buckel stehen.
export const PLAZA = { x: 36, z: -82, radius: 17, height: 0.75 }

function segmentDistance(x, z, ax, az, bx, bz) {
  const vx = bx - ax, vz = bz - az
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)))
  return Math.hypot(x - ax - vx * t, z - az - vz * t)
}

// Abstand zum Ufer des Sees in Metern: positiv im Wasser, negativ an Land.
// Die Insel zaehlt hier nicht, dafuer gibt es islandDistance().
export function lakeDistance(x, z) {
  const d = shapeDistance(x, z, LAKE, lakeWobble)
  const p = PENINSULA
  const pen = segmentDistance(x, z, p.x, p.z0, p.x, p.z1) - p.radius
  return Math.min(d, pen)
}

// Abstand zum Inselufer: positiv auf der Insel.
export function islandDistance(x, z) {
  return shapeDistance(x, z, ISLAND, islandWobble)
}

// Seegrund: ein flacher Guertel am Ufer, dann faellt es ab. Der Guertel ist
// es, der im Wasser tuerkis leuchtet; ohne ihn war der See ein blauer Teller.
function bottom(d, shelf) {
  return -(0.04 * d + LAKE.depth * smooth(shelf * 0.35, shelf, d))
}

export function terrainHeight(x, z) {
  const d = lakeDistance(x, z)
  let y
  if (d >= 0) {
    y = bottom(d, 18)
  } else {
    const e = -d
    // Flacher Strand, dann Wiese, dann die Huegel ringsum. Die Huegel steigen
    // erst ab 30 m an: die Kamera sieht bei 34 m Abstand gut 25 m ueber das
    // Ufer hinaus, dort soll noch Wiese sein und keine Wand.
    const n = fbm(x * 0.018 + 3.1, z * 0.018 - 7.4, 4)
    y = e * 0.07 * (1 - smooth(4, 14, e)) + smooth(4, 14, e) * 0.7
    y += smooth(8, 45, e) * 2.4 * (0.5 + n)
    y += Math.pow(smooth(28, 120, e), 1.35) * 34 * (0.55 + 0.9 * n)
    y += (fbm(x * 0.07, z * 0.07, 3) - 0.5) * 0.9 * smooth(6, 20, e)
  }

  // Insel: eigener Huegel mit Sandsaum, darum herum ein eigener Flachwasser-
  // guertel. max() verbindet beides ohne Naht.
  const di = islandDistance(x, z)
  let yi
  if (di >= 0) {
    const n = fbm(x * 0.05 + 40, z * 0.05 - 12, 3)
    yi = di * 0.09 * (1 - smooth(3, 8, di)) + smooth(3, 8, di) * 0.5
    yi += smooth(5, 19, di) * ISLAND.height * (0.75 + 0.5 * n)
  } else {
    yi = bottom(-di, 14)
  }
  y = Math.max(y, yi)

  // Stationsplatz einebnen.
  const pd = Math.hypot(x - PLAZA.x, z - PLAZA.z)
  if (pd < PLAZA.radius && d < 0) {
    // Zum Wasser hin auslaufen lassen, sonst stuende am Ufer eine Mauer.
    const k = (1 - smooth(PLAZA.radius * 0.55, PLAZA.radius, pd)) * smooth(0.5, 5, -d)
    y += (Math.max(PLAZA.height, Math.min(y, PLAZA.height + 0.4)) - y) * k
  }
  return y
}

const EPS = 0.35
export function terrainNormal(x, z, out) {
  const hx = terrainHeight(x + EPS, z) - terrainHeight(x - EPS, z)
  const hz = terrainHeight(x, z + EPS) - terrainHeight(x, z - EPS)
  out.set(-hx, 2 * EPS, -hz).normalize()
  return out
}

// Wassertiefe unter einem Punkt (0 an Land).
export function waterDepth(x, z) {
  return Math.max(0, -terrainHeight(x, z))
}
