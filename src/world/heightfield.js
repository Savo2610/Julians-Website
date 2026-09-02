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
  h += (fbm(x * 0.19, z * 0.19, 2) - 0.5) * 0.34

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
  // Sanfter Ruecken, der den mittleren Weg gliedert.
  h += bump(x, z, 4, -10, 28, 3.2)
  // Mulde, in der die Huette steht.
  h += bump(x, z, 33, 17, 19, -2.6)

  // Zugefrorener See. Bewusst flach: man soll hineinfahren koennen, ohne in
  // ein Loch zu fallen.
  h += basin(x, z, LAKE.x, LAKE.z, LAKE.radius, 2.4, 0.5)

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
