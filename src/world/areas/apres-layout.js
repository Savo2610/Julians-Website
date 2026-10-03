// Haus und Vorplatz teilen eine gedrehte Grundordnung: u laeuft im Bild nach
// rechts, v zur Kamera. Die Huette steht rechts am Hang; links liegt, eine
// Stufe tiefer, das Sonnendeck in der Senke zur Nordabfahrt.
//
// Das Haus selbst ist um `turn` gegen diese Ordnung gedreht – leicht schraeg,
// die linke hintere Ecke nach vorn. Wer von der Nordabfahrt geradeaus nach
// Osten haelt, fuhr bei −0,22 rad bei (21,3, −66,7) gegen diese Ecke und
// stand; bei +0,22 rad kommt er hinter dem Haus vorbei. Die Front zeigt
// dabei noch zu 98 % zur Kamera (cos 0,22).
export const APRES = {
  house: { x: 24, z: -65.5, height: 11.9, yaw: Math.PI / 4, turn: 0.22, width: 5, depth: 3.8 },
  // Kanten der Bohlen. Hinter der Hausfront liegt die Kontur unter dem Haus,
  // damit kein Schneestreifen zwischen Wand und Holz bleibt. Der linke Fluegel
  // endet gut fuenf Meter vor dem Einstieg des Funparks (10, −60,4) und
  // gut sechs neben seiner Mittellinie: die Durchfahrt Nordabfahrt → Park
  // bleibt Schnee, das Deck liegt daneben auf derselben Hoehe.
  outline: [[-2.3, -3.2], [-4, -6.2], [-7, -6.6], [-9, -4], [-9, 0.5], [-7.6, 3.4], [-5, 6.2], [-2.6, 7.6], [1, 8], [3.8, 6.8], [4.6, 4.4], [3.8, 2.4], [2.3, 1.2], [-2.2, 0]],
  // Zwei Ebenen: oben vor dem Haus, unten das Sonnendeck. Dazwischen keine
  // Stufe (die wuerfe ab), sondern eine Rampe ueber 2,6 m mit 0,4 m Fall –
  // im Mittel 9, steilstens 13 Grad, so viel wie die Park-Terrasse oben.
  // Bei `split` liegt die Stosskante zwischen den Ebenen.
  lower: { drop: 0.4, from: -6.2, to: -3.6 },
  split: -4.9,
}
const c = Math.cos(APRES.house.yaw), s = Math.sin(APRES.house.yaw)
export function terraceWorld(u, v) {
  return { x: APRES.house.x + u * c + v * s, z: APRES.house.z - u * s + v * c }
}
export function terraceLocal(x, z) {
  const dx = x - APRES.house.x, dz = z - APRES.house.z
  return { u: dx * c - dz * s, v: dx * s + dz * c }
}
// Vom Haus aus gesehen: x quer zur Front, z zur Front hinaus.
const tc = Math.cos(APRES.house.turn), ts = Math.sin(APRES.house.turn)
export function houseWorld(hx, hz) {
  return terraceWorld(hx * tc + hz * ts, -hx * ts + hz * tc)
}
export function houseLocal(x, z) {
  const { u, v } = terraceLocal(x, z)
  return { hx: u * tc - v * ts, hz: u * ts + v * tc }
}
// Signierter Abstand: dieselbe Kontur bestimmt Holz, Schnee und Boden.
export function terraceDistance(x, z) {
  const { u, v } = terraceLocal(x, z)
  let inside = false, distance = Infinity
  const p = APRES.outline
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [ax, az] = p[j], [bx, bz] = p[i]
    if ((az > v) !== (bz > v) && u < (bx - ax) * (v - az) / (bz - az) + ax) inside = !inside
    const dx = bx - ax, dz = bz - az
    const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - az) * dz) / (dx * dx + dz * dz)))
    distance = Math.min(distance, Math.hypot(u - ax - dx * t, v - az - dz * t))
  }
  return inside ? -distance : distance
}
const smooth = t => t * t * (3 - 2 * t)
const clamp01 = t => Math.max(0, Math.min(1, t))
export function terraceHeight(x, z) {
  const { u, v } = terraceLocal(x, z)
  const L = APRES.lower
  const up = smooth(clamp01((u - L.from) / (L.to - L.from)))
  return APRES.house.height - (1 - up) * L.drop - Math.max(0, v - 3.5) * 0.12
}
export function apresGround(x, z, height) {
  if (Math.abs(x - APRES.house.x) > 23 || Math.abs(z - APRES.house.z) > 23) return height
  const outside = Math.max(0, terraceDistance(x, z))
  if (outside < 4) height += (terraceHeight(x, z) - height) * smooth(1 - outside / 4)
  const { hx, hz } = houseLocal(x, z)
  const H = APRES.house
  const houseDistance = Math.hypot(Math.max(0, Math.abs(hx) - H.width / 2 - 0.3), Math.max(0, Math.abs(hz) - H.depth / 2 - 0.3))
  if (houseDistance < 1.8) height += (H.height - height) * smooth(1 - houseDistance / 1.8)
  return height
}
