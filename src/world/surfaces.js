import { LAKE, lakeRadius, BADESTEG, BADESTEG_LAENGE, badestegLage } from './heightfield.js'
import { APRES, terraceDistance } from './areas/apres-layout.js'

// Auch die Breite der Ski und der aufgeworfene Spurrand muessen auf Schnee
// liegen. Sonst hebt der Trail-Shader Schnee durch Eis und Holz hindurch.
export function isSnowSurface(x, z, margin = 0) {
  const dx = x - LAKE.x, dz = z - LAKE.z
  if (Math.hypot(dx, dz) <= lakeRadius(Math.atan2(dz, dx)) + margin) return false
  // Der Badesteg ragt mit dem Landende ueber die Uferlinie hinaus.
  if (Math.abs(x - BADESTEG.von.x) < 12 && Math.abs(z - BADESTEG.von.z) < 12) {
    const { laengs, quer } = badestegLage(x, z)
    if (quer <= BADESTEG.breite + margin && laengs >= -0.3 - margin && laengs <= BADESTEG_LAENGE + margin) return false
  }
  if (Math.abs(x - APRES.house.x) < 23 + margin && Math.abs(z - APRES.house.z) < 23 + margin && terraceDistance(x, z) <= margin) return false
  return true
}
