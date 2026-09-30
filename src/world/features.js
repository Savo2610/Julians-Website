import { cableAt } from './cable-path.js'

// Was im Wasser steht und befahren wird: Schanzen, Rail-Box und der Steg.
// Wie im Skital gilt: was man befaehrt, ist Rechnung; was man sieht, liegt
// in props/obstacles.js und folgt genau dieser Rechnung. Reine Funktionen,
// damit die Tests ohne Browser laufen.
//
// Lage auf der Bahn: s ist die Bogenlaenge auf dem Kabel, offset der
// seitliche Versatz nach aussen (positiv = vom Inselinneren weg). Der Fahrer
// haengt auf Geraden ohne Lenken genau auf der Kabellinie; eine Schanze mit
// offset 0 trifft man also von selbst, eine mit Versatz muss man anfahren.

function place(s, offset) {
  const c = cableAt(s)
  // Aussen ist rechts der Fahrtrichtung: die Bahn dreht an jeder Ecke nach links.
  return { x: c.x - c.dz * offset, z: c.z + c.dx * offset, dx: c.dx, dz: c.dz }
}

function kicker(id, name, s, offset, { length, width, height }) {
  const p = place(s, offset)
  return {
    id, name, type: 'kicker', s, offset,
    // Anfang der Rampe; die Kante liegt length Meter weiter in Fahrtrichtung.
    x: p.x - p.dx * length, z: p.z - p.dz * length,
    dx: p.dx, dz: p.dz, length, width, height,
    // Gekruemmter Anlauf: flach rein, steil raus. Mit Exponent 1,6 hat die
    // Kante 27 Grad beim grossen Kicker; 2 gab 33 Grad und katapultierte.
    profile: (u) => height * Math.pow(u / length, 1.6),
  }
}

function slider(id, name, s, offset, { ramp, length, width, height }) {
  const p = place(s, offset)
  const total = ramp + length
  return {
    id, name, type: 'slider', s, offset,
    x: p.x - p.dx * total, z: p.z - p.dz * total,
    dx: p.dx, dz: p.dz, length: total, ramp, width, height,
    profile: (u) => (u < ramp ? height * (u / ramp) : height),
  }
}

export const FEATURES = [
  kicker('k1', 'Kleiner Kicker', 64, 0, { length: 5, width: 3.4, height: 1.1 }),
  slider('box', 'Rail-Box', 172, 0, { ramp: 2.6, length: 12, width: 1.1, height: 0.75 }),
  kicker('k2', 'Kicker', 252, 5, { length: 6.5, width: 3.8, height: 1.7 }),
  kicker('k3', 'Grosser Kicker', 304, -5, { length: 8, width: 4.2, height: 2.6 }),
  kicker('k4', 'Kicker', 392, 0, { length: 6.5, width: 3.8, height: 1.7 }),
]

// Der Startsteg: ein Brett im Wasser, von allen Seiten eine Kante. Er ragt
// von der Landzunge bis kurz vor die Kabellinie.
export const DOCK = {
  id: 'dock', type: 'box',
  x: 36, z: -55, dx: 0, dz: -1, length: 11, width: 3.2, height: 0.55,
  profile: () => 0.55,
}

const ALL = [...FEATURES, DOCK]

// Lokale Koordinaten: u entlang der Fahrtrichtung ab Rampenanfang, v quer.
export function localUV(f, x, z) {
  const rx = x - f.x
  const rz = z - f.z
  return { u: rx * f.dx + rz * f.dz, v: rx * -f.dz + rz * f.dx }
}

// Hoehe der befahrbaren Flaeche unter einem Punkt: Wasser (0) oder die
// Oberseite eines Hindernisses. Liefert auch, welches es ist.
export function surfaceAt(x, z, out = {}) {
  out.h = 0
  out.feature = null
  for (const f of ALL) {
    const { u, v } = localUV(f, x, z)
    if (u < 0 || u > f.length || Math.abs(v) > f.width / 2) continue
    const h = f.profile(u)
    if (h > out.h) {
      out.h = h
      out.feature = f
    }
  }
  return out
}

// Neigung der Rampe in Fahrtrichtung der Rampe (dh/du), fuer den Absprung.
export function slopeAt(f, x, z) {
  const { u } = localUV(f, x, z)
  const e = 0.05
  return (f.profile(Math.min(f.length, u + e)) - f.profile(Math.max(0, u - e))) / (2 * e)
}

// --- Sammelsachen -------------------------------------------------------------
// Bojen schwimmen, Ringe haengen ueber den Schanzen. Die Bojen liegen in
// Boegen nach aussen: man holt sie nur, wenn man ausschwingt, und genau das
// macht schnell.

function buoyArc(s0, span, count, maxOffset, side = 1) {
  const list = []
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1)
    const off = Math.sin(t * Math.PI) * maxOffset * side
    const p = place(s0 + span * t, off)
    list.push({ x: p.x, z: p.z })
  }
  return list
}

export const BUOYS = [
  ...buoyArc(22, 34, 5, 11),           // Suedgerade gleich nach dem Start
  ...buoyArc(84, 22, 4, 7, -1),        // innen vor der Kurve
  ...buoyArc(132, 30, 5, 12),          // Westgerade aussen
  ...buoyArc(226, 20, 4, 9, -1),       // Nordgerade innen
  ...buoyArc(270, 26, 5, 13),          // aussen zwischen den Kickern
  ...buoyArc(350, 30, 5, 12),          // Ostgerade aussen
  ...buoyArc(400, 22, 4, 8, -1),       // Ostgerade innen nach dem Kicker
].map((b, i) => ({ ...b, id: `b${i}`, kind: 'buoy', points: 50 }))

// Ringe: ueber jeder Schanze dort, wo der Fahrer mit normalem Tempo und
// etwas Absprung den hoechsten Punkt hat.
export const RINGS = FEATURES.filter((f) => f.type === 'kicker').map((f, i) => {
  const ahead = 3 + f.height * 1.9
  const lipX = f.x + f.dx * f.length
  const lipZ = f.z + f.dz * f.length
  return {
    id: `r${i}`, kind: 'ring', points: 250,
    x: lipX + f.dx * ahead, z: lipZ + f.dz * ahead, y: f.height + 1.6 + f.height * 0.35,
    dx: f.dx, dz: f.dz, radius: 1.7,
  }
})
