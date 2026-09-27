// Ein einziges Rauschen fuer die ganze Welt – Terrain, Waldverteilung,
// Schneeverwehungen greifen darauf zu. Deterministisch, damit die Welt bei
// jedem Laden identisch ist.

export function hash2(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const smooth = (t) => t * t * (3 - 2 * t)

export function valueNoise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = smooth(x - ix)
  const fz = smooth(z - iz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz
}

export function fbm(x, z, octaves = 4) {
  let sum = 0
  let amp = 1
  let norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, z) * amp
    norm += amp
    amp *= 0.5
    x = x * 2.03 + 11.7
    z = z * 2.03 - 7.3
  }
  return sum / norm
}
