import { WORLD } from '../config.js'
import { fbm } from '../core/noise.js'

// Die Hoehenfunktion existiert nur einmal und wird sowohl fuer das Mesh als
// auch fuer jede Bodenabfrage (Spieler, Objekte, Kollision) benutzt. Damit
// koennen Geometrie und Kollision nie auseinanderlaufen.

// --- Gezielte Landschaftselemente -------------------------------------------
// Handgesetzt statt zufaellig, damit das Tal eine Form hat, die man wiedererkennt.

const smooth = (t) => t * t * (3 - 2 * t)

function bump(x, z, cx, cz, radius, amp) {
  const dx = (x - cx) / radius
  const dz = (z - cz) / radius
  const d2 = dx * dx + dz * dz
  if (d2 >= 1) return 0
  const f = 1 - d2
  return amp * f * f
}

// Weiche Senke mit flachem Boden – fuer den zugefrorenen See.
function basin(x, z, cx, cz, radius, depth, flat) {
  const dx = (x - cx) / radius
  const dz = (z - cz) / radius
  const d = Math.sqrt(dx * dx + dz * dz)
  if (d >= 1) return 0
  const edge = smooth(Math.min(1, Math.max(0, (1 - d) / (1 - flat))))
  return -depth * edge
}

export const LAKE = { x: -47, z: 41, radius: 17, level: -1.2 }

// Der Startplatz ist ein echtes Plateau: flach genug zum Abstecken, leicht
// erhoeht, damit man von dort in die drei Taeler blickt.
export const PLATEAU = { x: 0, z: 30, radius: 11, height: 2.4 }

// Der Gipfel des Bergarms. Von hier fuehrt die laengste Abfahrt zurueck ins
// Tal; hier endet spaeter auch der Lift.
export const SUMMIT = { x: -58, z: -64, height: 30 }

// Das Sportgelaende im Nordosten. Sein Scheitel liegt bewusst ausserhalb der
// Spielflaeche: im Spiel liegt damit nur die Flanke, und die faellt
// gleichmaessig zum Talkessel hin ab – ein Hang ohne Kuppe, auf dem sich
// Rennstrecke und Funpark unterbringen lassen.
// Der Scheitel liegt weit ausserhalb der Karte, der Radius ist gross: so
// beginnt die Flanke schon frueh im Tal und laeuft ueber eine lange Strecke
// aus, statt als Kegel am Kartenrand zu kleben.
export const SPORT_HILL = { x: 27, z: -87, radius: 68, height: 19 }

// --- Pistenbaender ----------------------------------------------------------
// Ein Band zieht das Gelaende entlang einer Linie auf ein gleichmaessiges
// Gefaelle. In der Mitte wirkt es voll, zu den Seiten und an beiden Enden
// laeuft es weich aus – so entsteht eine fahrbare Bahn, ohne dass eine Kante
// in den Hang geschnitten wird.
//
// Die Hoehen der Stuetzpunkte sind feste Zahlen und keine Abfragen: die
// Hoehenfunktion darf sich nicht selbst aufrufen. Anfangs- und Endhoehe sind
// dem natuerlichen Gelaende abgemessen, dazwischen liegen sie auf einer
// Geraden. Dadurch trifft das Band an seinen Enden das Gelaende von selbst
// und muss dort nichts mehr ausgleichen.
function makeLane(points, { width, feather, endFade, bank = 0, flat = 0.55 }) {
  const segments = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    segments.push({ x: a.x, z: a.z, dx, dz, len2: dx * dx + dz * dz, h0: a.h, h1: b.h, s0: total, len })
    total += len
  }
  const reach = width * 0.5 + feather
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
  }
  return {
    points, segments, total, width, feather, endFade, reach, bank,
    flatHalf: width * 0.5 * flat,
    minX: minX - reach, maxX: maxX + reach, minZ: minZ - reach, maxZ: maxZ + reach,
  }
}

// Wieviel das Band an dieser Stelle zieht (0 = gar nicht) und auf welche
// Hoehe. Getrennt zurueckgegeben, damit die Hoehenfunktion das feine
// Schneerauschen behalten kann – eine glattgezogene Piste soll trotzdem
// Textur haben.
function laneAt(x, z, lane) {
  if (x < lane.minX || x > lane.maxX || z < lane.minZ || z > lane.maxZ) return null
  // Nicht den naechsten Abschnitt gewinnen lassen, sondern alle gewichtet
  // mitteln. An einem Knick treffen zwei Abschnitte mit verschiedenen
  // Zielhoehen aufeinander; wer nur den naechsten nimmt, bekommt genau auf
  // der Winkelhalbierenden eine Stufe ins Gelaende geschnitten. Das Gewicht
  // faellt mit der vierten Potenz, damit entfernte Abschnitte nichts ziehen.
  let bestD = Infinity
  let sumW = 0
  let sumT = 0
  let sumS = 0
  for (const g of lane.segments) {
    let t = ((x - g.x) * g.dx + (z - g.z) * g.dz) / g.len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = g.x + g.dx * t
    const pz = g.z + g.dz * t
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz)
    const d = Math.sqrt(d2)
    if (d < bestD) bestD = d
    const w = 1 / (d2 * d2 + 0.05)
    sumW += w
    sumT += w * (g.h0 + (g.h1 - g.h0) * t)
    sumS += w * (g.s0 + g.len * t)
  }
  const target = sumT / sumW
  const s = sumS / sumW
  if (bestD > lane.reach) return null
  const half = lane.width * 0.5
  // Bande: zur Mitte hin flach, nach aussen ansteigend. Sie macht aus der
  // Bahn eine Rinne, in der man die Kurve halten kann, statt oben hinaus zu
  // schiessen. Quadratisch, damit der Uebergang von Sohle zu Wand weich ist.
  // Wie hoch sie tatsaechlich wird, entscheidet erst die Hoehenfunktion:
  // aufgeschuettet wird nur, wo das Gelaende unter der Bahn liegt.
  let bank = 0
  if (lane.bank > 0 && bestD > lane.flatHalf) {
    const t = Math.min(1, (bestD - lane.flatHalf) / (half - lane.flatHalf))
    bank = lane.bank * t * t
  }
  const side = bestD <= half ? 1 : smooth((lane.reach - bestD) / lane.feather)
  const ends = smooth(Math.min(1, Math.min(s, lane.total - s) / lane.endFade))
  const weight = side * ends
  return weight <= 0.001 ? null : { weight, base: target, bank }
}

// Die Rodelbahn vom Gipfel nach Osten. Sie faengt dort an, wo der Lift den
// Fahrer absetzt – man steigt aus und ist im Start – holt dann nach Osten in
// den Wald aus und kommt in einer Schleife bis kurz vor den umgestuerzten
// Stamm im Tal. Zwischen ihr und der Lifttrasse bleibt die freie Abfahrt.
//
// Die Bahn ist bewusst kurvig gelegt und nicht die kuerzeste Linie: gerade
// nach unten ist die Falllinie, aber kein Vergnuegen. Ueber ihre Laenge
// dreht sie sich in Summe um gut 220 Grad.
//
// Sie endet dort, wo der Hang endet, und laeuft nicht mehr zwanzig Meter
// flach ins Tal aus. Das hat zwei Gruende: flaches Ausrollen ist keine
// Fahrt mehr, und die Querachse des Ziels zeigt hier ueber den Bildschirm
// statt in die Blickachse. Bei fester Kamera ist ein Bogen, dessen Achse in
// die Blickrichtung zeigt, nur ein senkrechter Strich.
//
// Die Hoehen sind nicht auf ein gleichmaessiges Gefaelle gerechnet, sondern
// ein geglaettetes, streng fallendes Abbild des natuerlichen Gelaendes: der
// Berg gibt sein Gefaelle nun einmal oben her und laeuft unten flach aus. So
// bleibt der groesste Auf- oder Abtrag unter anderthalb Metern – haette man
// eine Gerade erzwungen, waere unten ein fuenf Meter hoher Damm noetig
// gewesen. Oben 19 bis 31 Grad, unten Auslauf.
export const SLED_LANE = makeLane([
  { x: -53, z: -56, h: 27.50 },
  { x: -45, z: -61, h: 24.90 },
  { x: -36, z: -60, h: 20.23 },
  { x: -29, z: -54, h: 15.50 },
  { x: -26, z: -45, h: 10.79 },
  { x: -18, z: -41, h: 5.24 },
  { x: -11, z: -36, h: 2.34 },
  { x: -6, z: -30, h: 1.90 },
  { x: -2, z: -25, h: 1.55 },
], { width: 13, feather: 9, endFade: 8, bank: 1.35, flat: 0.5 })

// Der Funpark auf dem Nordosthang – 7 bis 14 Grad. Flach genug, dass man die
// Figuren trifft statt sie zu ueberfahren, steil genug, dass man ohne
// Nachdruecken durchkommt.
//
// Er ist naeher an die Mitte gerueckt: sein Ende liegt jetzt gut zwanzig
// Meter weiter innen als vorher. Der Berg dahinter ist mitgewandert, sonst
// muesste das Band Gelaende ausgleichen, das es nicht ausgleichen kann.
export const PARK_LANE = makeLane([
  { x: 10, z: -53, h: 8.93 },
  { x: 15, z: -49, h: 8.10 },
  { x: 21, z: -45, h: 6.70 },
  { x: 29, z: -40, h: 4.30 },
  { x: 37, z: -34, h: 2.30 },
  { x: 43, z: -27, h: 1.20 },
], { width: 18, feather: 8, endFade: 8 })

const LANES = globalThis.__noLanes ? [] : [SLED_LANE, PARK_LANE]

// --- Figuren im Funpark ------------------------------------------------------
// Schanzen, Wellen und Kanten sind Gelaende und keine Aufbauten. Nur so faehrt
// man wirklich darueber: Boden, Kollision und Kamera lesen alle dieselbe
// Funktion. Ein Aufbau waere ein Objekt, durch das man hindurchfaehrt.
//
// Alle Figuren rechnen in einem lokalen System: u laeuft in Fahrtrichtung,
// v quer dazu.
function local(x, z, f) {
  const ax = x - f.x
  const az = z - f.z
  return { u: ax * f.dx + az * f.dz, v: -ax * f.dz + az * f.dx }
}

// Absprung: steigt quadratisch an und bricht an der Kante ab.
function kicker(x, z, f) {
  const { u, v } = local(x, z, f)
  const hw = f.width * 0.5
  const av = Math.abs(v)
  // Hinter der Kante faellt die Schanze auf 1,5 Einheiten ab statt senkrecht.
  // Eine senkrechte Wand zerfaellt im Dreiecksnetz zu einer Zackenreihe – die
  // Aufloesung des Gelaendes liegt bei einer halben Einheit. Fuer den Abflug
  // aendert das nichts: massgeblich ist die Steigung *vor* der Kante.
  const drop = 1.5
  const flank = 3.0
  if (u > drop || u < -f.length || av > hw + flank) return 0
  const along = (u + f.length) / f.length
  const side = av <= hw ? 1 : smooth((hw + flank - av) / flank)
  const lip = u > 0 ? smooth(1 - u / drop) : 1
  // Kubisch statt quadratisch: der Fuss bleibt flach, die Steigung sammelt
  // sich an der Kante. Genau dort entscheidet sich der Absprung – bei einem
  // quadratischen Profil verteilt sie sich zu gleichmaessig und der Fahrer
  // rollt ueber die Kante, statt abzuheben.
  const a = Math.min(1, along)
  return f.height * a * a * a * side * lip
}

// Wellenbahn: eine Reihe weicher Buckel, die an beiden Enden ausklingt.
function rollers(x, z, f) {
  const { u, v } = local(x, z, f)
  const half = (f.spacing * f.count) * 0.5
  const av = Math.abs(v)
  const hw = f.width * 0.5
  if (Math.abs(u) > half || av > hw + 2) return 0
  const side = av <= hw ? 1 : smooth((hw + 2 - av) / 2)
  const wave = Math.cos((u / f.spacing) * Math.PI * 2) * 0.5 + 0.5
  const fade = smooth(Math.min(1, (half - Math.abs(u)) / (f.spacing * 0.6)))
  return f.height * wave * side * fade
}

// Schneekante zum Aufsteigen: flaches Dach, an den Enden angerampt.
function ledge(x, z, f) {
  const { u, v } = local(x, z, f)
  const half = f.length * 0.5
  const hw = f.width * 0.5
  const av = Math.abs(v)
  if (Math.abs(u) > half || av > hw + 1.2) return 0
  const ends = smooth(Math.min(1, (half - Math.abs(u)) / f.ramp))
  const side = av <= hw ? 1 : smooth((hw + 1.2 - av) / 1.2)
  return f.height * ends * side
}

// Die Figuren liegen der Reihe nach im Band, von oben nach unten immer
// groesser. Richtung ist jeweils die Fahrtrichtung des Bandes an der Stelle.
// Die Hoehe einer Schanze ist nicht ihr Absprungwinkel: das Band faellt
// darunter mit knapp 10 Grad weiter, das frisst rund ein Sechstel der Rampe
// pro Einheit Laenge. Massgeblich ist die Steigung an der Kante, und die ist
// beim quadratischen Profil 2*Hoehe/Laenge minus dem Gefaelle des Bandes.
// Bei Tempo 13 ergibt das hier Abfluege von rund einer halben bis zwei
// Dritteln Sekunde.
// Die Figuren duerfen sich nicht ueberlappen: eine Wellenbahn ist so lang wie
// Anzahl mal Abstand, eine Schanze so lang wie ihre Rampe, eine Kante wie ihre
// Laenge. Aneinandergereiht braucht das mehr Platz, als man denkt – deshalb
// reicht das Band bis ganz hinauf.
export const PARK_FEATURES = [
  { kind: 'rollers', x: 17.2, z: -47.6, dx: 0.832, dz: 0.555, count: 3, spacing: 4.2, height: 0.7, width: 9 },
  { kind: 'kicker', x: 26.4, z: -41.6, dx: 0.848, dz: 0.530, length: 4.5, width: 7.5, height: 1.15 },
  { kind: 'ledge', x: 33.0, z: -37.0, dx: 0.800, dz: 0.600, length: 7, width: 2.6, height: 0.85, ramp: 2.2 },
  { kind: 'kicker', x: 39.6, z: -31.0, dx: 0.651, dz: 0.759, length: 5.0, width: 8.5, height: 2.30 },
]

function parkFeatures(x, z) {
  let add = 0
  for (const f of PARK_FEATURES) {
    if (f.kind === 'kicker') add += kicker(x, z, f)
    else if (f.kind === 'rollers') add += rollers(x, z, f)
    else add += ledge(x, z, f)
  }
  return add
}


// Signierter Abstand zum Rand der Spielflaeche: negativ innerhalb, positiv
// ausserhalb. Weil die Flaeche aus mehreren Kreisen besteht, gewinnt der
// naechstgelegene – so entsteht eine weiche Acht statt harter Kanten.
export function playAreaDistance(x, z) {
  let best = Infinity
  for (const b of WORLD.basins) {
    const d = Math.hypot(x - b.x, z - b.z) - b.radius
    if (d < best) best = d
  }
  return best
}

export function terrainHeight(x, z) {
  let h = 0

  // Grosse, traege Wellen – das Grundrelief des Tals.
  h += (fbm(x * 0.0125 + 40, z * 0.0125 + 40, 4) - 0.5) * 11.0
  // Feinere Buckel, damit die Fahrt nie ganz glatt wird.
  h += (fbm(x * 0.055 + 8, z * 0.055 + 8, 3) - 0.5) * 1.9
  // Sehr feines Rauschen fuer Schneeverwehungen.
  const grain = (fbm(x * 0.19, z * 0.19, 2) - 0.5) * 0.34
  h += grain

  // Der Bergarm im Nordwesten: ein breiter Kegel, der zum Gipfel ansteigt.
  // Er traegt die laengste Abfahrt der Karte.
  h += bump(x, z, SUMMIT.x, SUMMIT.z, 52, SUMMIT.height)
  // Zwei vorgelagerte Schultern, damit der Berg nicht wie ein Kegelhut wirkt.
  h += bump(x, z, -34, -44, 26, 7.5)
  h += bump(x, z, -74, -40, 24, 6.0)
  // Eine Mulde als natuerliche Leitlinie der Abfahrt.
  h += bump(x, z, -44, -34, 17, -3.2)

  // Kuppe im Osten – dort steht das Fernrohr.
  h += bump(x, z, 48, -8, 27, 7.2)

  // Sportgelaende im Nordosten: die Flanke eines weit ausserhalb liegenden
  // Schildes. Dazu eine flache Mulde an der Taille zum Talkessel, damit der
  // Uebergang als Senke gelesen wird und nicht als Kante.
  h += bump(x, z, SPORT_HILL.x, SPORT_HILL.z, SPORT_HILL.radius, SPORT_HILL.height)
  h += bump(x, z, 26, -34, 20, -1.4)
  // Sanfter Ruecken, der den mittleren Weg gliedert.
  h += bump(x, z, 4, -10, 28, 3.2)
  // Mulde, in der die Huette steht.
  h += bump(x, z, 33, 17, 19, -2.6)

  // Zugefrorener See. Bewusst flach: man soll hineinfahren koennen, ohne in
  // ein Loch zu fallen.
  h += basin(x, z, LAKE.x, LAKE.z, LAKE.radius, 2.4, 0.5)

  // Renn- und Funparkband: ziehen ihren Streifen auf gleichmaessiges Gefaelle.
  // Das feine Rauschen kommt danach wieder drauf, damit die Bahn nicht wie
  // gebuegelt aussieht.
  for (const lane of LANES) {
    const hit = laneAt(x, z, lane)
    if (!hit) continue
    let target = hit.base
    if (hit.bank > 0) {
      // Auf der Bergseite ist der Anschnitt selbst schon die Wand. Eine Bande
      // davor ergaebe eine zweite Kante und dazwischen einen Graben – deshalb
      // waechst sie nur dort, wo das Gelaende unter der Bahnsohle liegt.
      const fill = Math.min(1, Math.max(0, (hit.base + hit.bank - h) / hit.bank))
      target += hit.bank * fill
    }
    h = h * (1 - hit.weight) + (target + grain) * hit.weight
  }

  // Die Figuren im Funpark sitzen auf dem geglaetteten Band – deshalb erst
  // hier, nach der Bandformung.
  h += parkFeatures(x, z)

  // Startplateau: eine flache Terrasse, die sich weich ins Gelaende einfuegt.
  {
    const dx = x - PLATEAU.x
    const dz = z - PLATEAU.z
    const d = Math.sqrt(dx * dx + dz * dz) / (PLATEAU.radius * 1.55)
    if (d < 1) {
      const blend = smooth(Math.min(1, Math.max(0, (1 - d) / 0.42)))
      // Auf das Zielniveau ueberblenden statt addieren – so wird es wirklich flach.
      h = h * (1 - blend) + PLATEAU.height * blend
    }
  }

  // Gebirgsrand: steigt an, sobald man die Spielflaeche verlaesst. Bewusst
  // niedrig – er soll die Karte schliessen, aber nicht den Himmel wegnehmen.
  const edge = playAreaDistance(x, z)
  if (edge > 0) {
    const t = Math.min(1, edge / WORLD.rimWidth)
    const ridge = 0.6 + 0.85 * fbm(x * 0.06, z * 0.06, 3)
    h += t * t * 17 * ridge
  }

  return h
}

export function terrainNormal(x, z, out) {
  const e = 0.45
  const hL = terrainHeight(x - e, z)
  const hR = terrainHeight(x + e, z)
  const hD = terrainHeight(x, z - e)
  const hU = terrainHeight(x, z + e)
  const nx = hL - hR
  const nz = hD - hU
  const ny = 2 * e
  const len = Math.hypot(nx, ny, nz)
  if (out) return out.set(nx / len, ny / len, nz / len)
  return { x: nx / len, y: ny / len, z: nz / len }
}

// Gefaelle in eine bestimmte Fahrtrichtung: positiv = es geht bergab.
export function slopeAlong(x, z, dirX, dirZ) {
  const step = 1.2
  const here = terrainHeight(x, z)
  const ahead = terrainHeight(x + dirX * step, z + dirZ * step)
  return (here - ahead) / step
}

// Sucht in der Umgebung die flachste Stelle. Gebaeude und Automaten sollen
// nicht am Hang kleben – statt Koordinaten von Hand zu justieren, laesst man
// jede Station selbst den besten Standplatz in ihrer Naehe finden.
export function findFlatSpot(x, z, search = 9, footprint = 2) {
  const relief = (px, pz) => {
    let min = Infinity
    let max = -Infinity
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2
      for (const r of [footprint * 0.5, footprint]) {
        const h = terrainHeight(px + Math.cos(angle) * r, pz + Math.sin(angle) * r)
        if (h < min) min = h
        if (h > max) max = h
      }
    }
    return max - min
  }

  let best = { x, z, relief: relief(x, z) }
  // Goldener-Winkel-Spirale: gleichmaessige Abdeckung ohne Raster-Artefakte.
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 1; i <= 160; i++) {
    const r = search * Math.sqrt(i / 160)
    const a = i * golden
    const px = x + Math.cos(a) * r
    const pz = z + Math.sin(a) * r
    const value = relief(px, pz)
    // Naeher am Wunschort ist besser – kleine Strafe fuer weite Wege.
    const penalty = (r / search) * 0.22
    if (value + penalty < best.relief) best = { x: px, z: pz, relief: value + penalty }
  }
  return best
}
