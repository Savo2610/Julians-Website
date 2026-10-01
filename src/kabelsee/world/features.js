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

// ring: [Meter hinter der Lippe, Hoehe] des Rings darueber.
function kicker(id, name, s, offset, { length, width, height, ring }) {
  const p = place(s, offset)
  return {
    id, name, type: 'kicker', s, offset, ring,
    // Anfang der Rampe; die Kante liegt length Meter weiter in Fahrtrichtung.
    x: p.x - p.dx * length, z: p.z - p.dz * length,
    dx: p.dx, dz: p.dz, length, width, height,
    // Gekruemmter Anlauf: flach rein, steil raus. Mit Exponent 1,6 hat die
    // Kante 27 Grad beim grossen Kicker; 2 gab 33 Grad und katapultierte.
    profile: (u) => height * Math.pow(u / length, 1.6),
  }
}

// Box und Rail: kurze Auffahrt, dann flach. Befahren werden beide gleich;
// kind steht im Trickname, die Rail ist schmaler und gibt mehr je Meter.
function slider(id, name, s, offset, { ramp, length, width, height, kind = 'Box' }) {
  const p = place(s, offset)
  const total = ramp + length
  return {
    id, name, type: 'slider', kind, s, offset,
    x: p.x - p.dx * total, z: p.z - p.dz * total,
    dx: p.dx, dz: p.dz, length: total, ramp, width, height,
    profile: (u) => (u < ramp ? height * (u / ramp) : height),
  }
}

// Die Bahn in Bogenlaenge: Nordgerade 0–102 (nach Westen, mit dem Steg bei
// s = 15), Westgerade 126–196 (nach Sueden), Suedgerade 219–321 (nach
// Osten), Ostgerade 345–415 (nach Norden), dazwischen die Ecken.
export const FEATURES = [
  kicker('k1', 'Kleiner Kicker', 64, 0, { length: 5, width: 3.4, height: 1.1, ring: [9, 4.3] }),
  // 1,5 m breit statt 1,1: schraeg angefahren traf man sonst die Seite,
  // bevor man oben war.
  slider('box', 'Rail-Box', 172, 0, { ramp: 2.6, length: 12, width: 1.5, height: 0.75 }),
  kicker('k2', 'Kicker', 252, 5, { length: 6.5, width: 3.8, height: 1.7, ring: [11.5, 6.4] }),
  kicker('k3', 'Grosser Kicker', 304, -5, { length: 8, width: 4.2, height: 2.6, ring: [10.5, 6.5] }),
  // Auf der Ostgeraden liegt die Rail auf der Linie, der Kicker k4 5,5 m
  // innen daneben: wer geradeaus faehrt, slidet; wer springen will, zieht
  // vorher nach innen. Andersherum traf man die schmale Rail kaum.
  kicker('k4', 'Kicker', 392, -5.5, { length: 6.5, width: 3.8, height: 1.7, ring: [11.5, 6.2] }),
  // Die Breite ist die Fangbreite, gezeichnet wird ein duennes Rohr. Mit
  // 0,9 m fuhr man im Browser um eine Handbreite daneben; 1,3 m fangen
  // einen, der ungefaehr zielt.
  slider('rail', 'Rail', 392, 0, { ramp: 2.4, length: 11, width: 1.3, height: 0.9, kind: 'Rail' }),
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

// Auf West- und Suedgerade liegt der Slalom, dort gibt es keine Bojen. Es
// sind bewusst wenige: mit 29 lag ueberall etwas, und man sammelte nur noch,
// statt zu fahren.
export const BUOYS = [
  ...buoyArc(24, 30, 4, 11),           // Nordgerade gleich nach dem Start
  ...buoyArc(84, 20, 3, 7, -1),        // innen vor der Nordwestecke
  ...buoyArc(326, 16, 3, 6, -1),       // innen durch die Suedostecke
  ...buoyArc(352, 24, 4, 12),          // Ostgerade aussen
  ...buoyArc(402, 20, 3, 8, -1),       // Ostgerade innen nach dem Kicker
].map((b, i) => ({ ...b, id: `b${i}`, kind: 'buoy' }))

// --- Slalom -----------------------------------------------------------------
// Fahnen im Wechsel innen und aussen, alle auf den Geraden; jede muss man
// auf ihrer abgewandten Seite umfahren, also weit hinaus, bis das Seil
// straff ist. 10 m neben der Linie: bei 8 m kam man mit schlaffem Seil hin,
// weil man im Schwung den Mitnehmer einholte; bei 12 m schaffte der
// Testfahrer nur noch jede dritte Fahne. Sie stehen 26 m auseinander,
// vorher waren es 32 bis 50. Auf der Suedgeraden fuehrt der Slalom innen am
// Kicker k2 vorbei und laesst den grossen Kicker aussen liegen: wer Slalom
// faehrt, faehrt um die Rampen herum statt darueber. Die Fahnen zaehlen in
// jeder Runde neu, anders als die Bojen.
export const GATES = [
  [142, -10],    // Westgerade innen
  [168, 10],     // aussen an der Box vorbei
  [194, -10],    // Westgerade innen, vor der Ecke
  [226, 10],     // Suedgerade aussen, aus der Ecke heraus
  [252, -10],    // innen am Kicker k2 vorbei
  [278, 10],     // aussen, dann am grossen Kicker aussen vorbei
].map(([s, offset], i) => {
  const p = place(s, offset)
  // side: auf welcher Seite der Bahn die Fahne steht (+1 aussen); man muss
  // weiter aussen bzw. innen sein als sie.
  return { id: `g${i}`, index: i, s, offset, side: Math.sign(offset), x: p.x, z: p.z, dx: p.dx, dz: p.dz }
})

// Seitlicher Versatz eines Punktes zur Bahn bei s (positiv = aussen).
export function offsetAt(s, x, z) {
  const c = cableAt(s)
  return (x - c.x) * -c.dz + (z - c.z) * c.dx
}

// Ringe: ueber jeder Schanze dort, wo der Fahrer mit voll geladenem
// Absprung den hoechsten Punkt hat (gemessen mit dem Fahrmodell, Seiltempo,
// ohne Ausschwingen). An den drei grossen Kickern fliegt man ohne Laden
// darunter durch, der Ring ist der Lohn fuers Aufladen; am kleinen reicht
// zum Einstieg auch ein einfacher Sprung.
export const RINGS = FEATURES.filter((f) => f.type === 'kicker').map((f, i) => {
  const [ahead, y] = f.ring
  const lipX = f.x + f.dx * f.length
  const lipZ = f.z + f.dz * f.length
  return {
    id: `r${i}`, kind: 'ring',
    x: lipX + f.dx * ahead, z: lipZ + f.dz * ahead, y,
    dx: f.dx, dz: f.dz, radius: 1.7,
  }
})
