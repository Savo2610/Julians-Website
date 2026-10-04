import { LAKE, lakeRadius, BADESTEG, BADESTEG_LAENGE, badestegLage, klammAt, stegLage, DECK } from './heightfield.js'
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
  // Die Bruecke ist Holz. Vorher hob der Spurwall den Schnee darunter durch
  // die Bohlen, und hinter jedem Fahrer blieben weisse Flecken auf dem Deck.
  {
    const l = stegLage(x, z)
    if (Math.abs(l.laengs) < DECK.halbL + 0.3 + margin && Math.abs(l.quer) < 3.3 + margin) return false
  }
  // Der zugefrorene Bach in der Klamm (props/klamm-eis.js) liegt dort, wo
  // sie tiefer als 1,2 Meter ist, und ihre Sohle ist drei Meter breit.
  if (x > -30 && x < -5 && z < -58 && z > -104 && klammAt(x, z) < -1.1 - margin * 0.5) return false
  if (Math.abs(x - APRES.house.x) < 23 + margin && Math.abs(z - APRES.house.z) < 23 + margin && terraceDistance(x, z) <= margin) return false
  return true
}
