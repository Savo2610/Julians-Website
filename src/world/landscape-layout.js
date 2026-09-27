// Die kleinen Fahrlandschaften liegen zwischen den bestehenden Anlagen.
// Ihre Formen bleiben unter drei Metern: genug fuer Schatten und Schwung,
// ohne einen zweiten Berg in das kompakte Tal zu stellen.
export const SNOW_FORMS = [
  { x: -15, z: 10, rx: 7, rz: 10, height: 2.8, angle: -0.3 },
  { x: -17, z: -3, rx: 7, rz: 9, height: 2.5, angle: 0.25 },
  { x: -4, z: -13, rx: 6, rz: 9, height: 1.9, angle: -0.5 },
  { x: 21, z: 40, rx: 9, rz: 6, height: 2.7, angle: 0.4 },
  { x: 15, z: 44, rx: 8, rz: 6, height: 1.8, angle: -0.3 },
  { x: -57, z: 22, rx: 10, rz: 6, height: 2.8, angle: -0.65 },
]

export const LANDSCAPE_PATHS = [
  { path: [[-6, 21], [-5, 15], [-8, 7], [-7, 0], [-10, -8], [-11, -16], [-9, -23]], width: 3.6 },
  { path: [[31, 19], [35, 27], [31, 34], [23, 39], [14, 39], [8, 39]], width: 3.8 },
  { path: [[-26, 38], [-31, 32], [-39, 26], [-48, 23], [-55, 27]], width: 3.2 },
]

// Sanfte Wellen sind in beide Richtungen befahrbar. Anders als ein Kicker
// haben sie weder Abrisskante noch tiefe Landemulde.
export const MEADOW_ROLLERS = [
  { x: -9, z: -6, rx: 4.8, rz: 2.6, height: 0.55, angle: -0.2 },
  { x: -10.5, z: -12, rx: 4.8, rz: 2.7, height: 0.7, angle: 0.15 },
  { x: -10, z: -18, rx: 4.8, rz: 2.8, height: 0.6, angle: 0.2 },
]

export const GROVES = [
  { x: -15, z: 11, radius: 5.0, count: 7 },
  { x: -18, z: -5, radius: 4.5, count: 6 },
  { x: -2, z: -12, radius: 4.0, count: 5 },
  { x: 20, z: 38, radius: 4.2, count: 6 },
  { x: 15, z: 45, radius: 3.8, count: 5 },
  { x: -57, z: 21, radius: 4.5, count: 6 },
  // Um den Loeschzug (-16,4 / 41,9): hinter ihm, von der Kamera weg, und an
  // beiden Seiten. Vorn bleibt frei, damit man ihn zwischen den Staemmen sieht.
  { x: -21, z: 37, radius: 4.2, count: 7 },
  { x: -22, z: 46, radius: 3.4, count: 4 },
  { x: -12, z: 36.5, radius: 3.0, count: 3 },
]

const forms = [...SNOW_FORMS, ...MEADOW_ROLLERS].map(f => ({
  ...f, cos: Math.cos(f.angle), sin: Math.sin(f.angle),
}))

export function landscapeHeight(x, z) {
  let height = 0
  for (const f of forms) {
    const dx = x - f.x, dz = z - f.z
    if (Math.abs(dx) > f.rx + f.rz || Math.abs(dz) > f.rx + f.rz) continue
    const u = (dx * f.cos + dz * f.sin) / f.rx
    const v = (-dx * f.sin + dz * f.cos) / f.rz
    const d = u * u + v * v
    if (d < 1) height += f.height * (1 - d) ** 3
  }
  return height
}
