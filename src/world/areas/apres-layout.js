// Haus und Vorplatz teilen eine gedrehte Grundordnung. Die Huette steht
// rechts am Hang; der breite linke Terrassenfluegel oeffnet sich zur Piste.
export const APRES = {
  house: { x: 23, z: -64, height: 11.9, yaw: Math.PI / 4 },
  outline: [[-3, 1.45], [2.5, 1.45], [4, 3.5], [4, 6], [1, 8], [-6, 9], [-9, 7], [-9, 4], [-6, 2]],
}
const c = Math.cos(APRES.house.yaw), s = Math.sin(APRES.house.yaw)
export function terraceWorld(u, v) {
  return { x: APRES.house.x + u * c + v * s, z: APRES.house.z - u * s + v * c }
}
export function terraceLocal(x, z) {
  const dx = x - APRES.house.x, dz = z - APRES.house.z
  return { u: dx * c - dz * s, v: dx * s + dz * c }
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
export function terraceHeight(x, z) {
  return APRES.house.height - Math.max(0, terraceLocal(x, z).v - 3.5) * 0.14
}
const smooth = t => t * t * (3 - 2 * t)
export function apresGround(x, z, height) {
  if (Math.abs(x - APRES.house.x) > 23 || Math.abs(z - APRES.house.z) > 23) return height
  const outside = Math.max(0, terraceDistance(x, z))
  if (outside < 4) height += (terraceHeight(x, z) - height) * smooth(1 - outside / 4)
  const { u, v } = terraceLocal(x, z)
  const houseDistance = Math.hypot(Math.max(0, Math.abs(u) - 2.3), Math.max(0, Math.abs(v) - 1.7))
  if (houseDistance < 1.8) height += (APRES.house.height - height) * smooth(1 - houseDistance / 1.8)
  return height
}
