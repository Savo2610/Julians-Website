import { LAKE, lakeRadius, BACH, bachAt } from './heightfield.js'
import { APRES, terraceDistance } from './apres-layout.js'

// Auch die Breite der Ski und der aufgeworfene Spurrand muessen auf Schnee
// liegen. Sonst hebt der Trail-Shader Schnee durch Eis und Holz hindurch.
export function isSnowSurface(x, z, margin = 0) {
  const dx = x - LAKE.x, dz = z - LAKE.z
  if (Math.hypot(dx, dz) <= lakeRadius(Math.atan2(dz, dx)) + margin) return false
  // Das Eis im Bachbett (props/frozen-river.js) ist 1,3 m breit je Seite.
  if (x < -55 && x > -90 && z > 14 && z < 29 && bachAt(x, z).d <= BACH.halb + 0.3 + margin) return false
  if (Math.abs(x - APRES.house.x) < 23 + margin && Math.abs(z - APRES.house.z) < 23 + margin && terraceDistance(x, z) <= margin) return false
  return true
}
