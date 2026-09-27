import { LAKE, lakeRadius, BACH, bachAt } from './heightfield.js'
import { APRES, terraceDistance } from './apres-layout.js'

// Auch die Breite der Ski und der aufgeworfene Spurrand muessen auf Schnee
// liegen. Sonst hebt der Trail-Shader Schnee durch Eis und Holz hindurch.
export function isSnowSurface(x, z, margin = 0) {
  const dx = x - LAKE.x, dz = z - LAKE.z
  if (Math.hypot(dx, dz) <= lakeRadius(Math.atan2(dz, dx)) + margin) return false
  // Das Eis im Bachbett (props/frozen-river.js) reicht bis gut 2,5 m je Seite.
  // Das letzte Stueck ist die Eislippe ueber dem Fall – darunter liegt Schnee.
  if (x < -55 && x > -92 && z > 12 && z < 31) {
    const b = bachAt(x, z)
    if (b.d <= BACH.halb + 0.8 + margin && b.weg < b.laenge - 2) return false
  }
  if (Math.abs(x - APRES.house.x) < 23 + margin && Math.abs(z - APRES.house.z) < 23 + margin && terraceDistance(x, z) <= margin) return false
  return true
}
