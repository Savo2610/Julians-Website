import { LAKE, lakeRadius, BADESTEG, BADESTEG_LAENGE, badestegLage, klammAt, stegLage, DECK } from './heightfield.js'
import { APRES, terraceDistance } from './areas/apres-layout.js'

// Auch die Breite der Ski und der aufgeworfene Spurrand muessen auf Schnee
// liegen. Sonst hebt der Trail-Shader Schnee durch Eis und Holz hindurch.
// Gespruehte Linien im Schnee (Absprungkanten im Park, Weitenmarken der
// Klammschanze). Sie liegen drei Zentimeter auf dem Gelaende; der Wall der
// Spur hob den Schnee darueber, und nach ein paar Fahrten waren sie weg
// (Wunsch 04.10.). Dort wird nicht gestempelt. Je Linie die Punkte [x, z]
// und ihre halbe Breite.
const LINIEN = []
export function ohneSpur(punkte, halb) {
  const xs = punkte.map((p) => p[0]), zs = punkte.map((p) => p[1])
  LINIEN.push({
    punkte, halb,
    minX: Math.min(...xs) - halb, maxX: Math.max(...xs) + halb,
    minZ: Math.min(...zs) - halb, maxZ: Math.max(...zs) + halb,
  })
}
function aufLinie(x, z, margin) {
  for (const l of LINIEN) {
    if (x < l.minX - margin || x > l.maxX + margin || z < l.minZ - margin || z > l.maxZ + margin) continue
    const r = l.halb + margin
    for (let i = 1; i < l.punkte.length; i++) {
      const [ax, az] = l.punkte[i - 1], [bx, bz] = l.punkte[i]
      const dx = bx - ax, dz = bz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
      if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r) return true
    }
  }
  return false
}

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
  // Der Wall der Spur reicht 2,4 Spurbreiten zur Seite (snow-trail.js) und
  // um die Enden jedes Stempels herum. Mit nur der Spurbreite als Rand lag
  // er nach drei Fahrten trotzdem auf der 25-m-Linie. Die Spur setzt dafuer
  // an jeder Linie gut zwei Meter aus.
  if (LINIEN.length && aufLinie(x, z, Math.min(margin * 2.4, 1.2))) return false
  if (Math.abs(x - APRES.house.x) < 23 + margin && Math.abs(z - APRES.house.z) < 23 + margin && terraceDistance(x, z) <= margin) return false
  return true
}
