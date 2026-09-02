import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Kleine Helfer, um aus Primitiven ein einziges Mesh mit Vertex-Farben zu
// bauen. Ein Objekt = eine Geometrie = ein Draw Call, egal wie viele Teile es
// hat. Das erlaubt viel Detail, ohne die Framerate zu verlieren.

export function tint(geometry, color) {
  const c = new THREE.Color(color)
  const count = geometry.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

// Faerbt nach oben zeigende Flaechen weiss ein – so bekommt jedes Objekt eine
// Schneeauflage, ohne dass man sie modellieren muss.
export function snowDust(geometry, amount = 0.85, threshold = 0.35, snow = 0xf6fbff) {
  const normal = geometry.attributes.normal
  const color = geometry.attributes.color
  if (!normal || !color) return geometry
  const s = new THREE.Color(snow)
  for (let i = 0; i < normal.count; i++) {
    const ny = normal.getY(i)
    if (ny <= threshold) continue
    const t = Math.min(1, (ny - threshold) / (1 - threshold)) * amount
    color.setXYZ(
      i,
      color.getX(i) * (1 - t) + s.r * t,
      color.getY(i) * (1 - t) + s.g * t,
      color.getZ(i) * (1 - t) + s.b * t,
    )
  }
  color.needsUpdate = true
  return geometry
}

export function transformed(geometry, { position, rotation, scale } = {}) {
  const g = geometry.clone()
  if (scale) g.scale(scale[0] ?? scale, scale[1] ?? scale, scale[2] ?? scale)
  if (rotation) {
    if (rotation[0]) g.rotateX(rotation[0])
    if (rotation[1]) g.rotateY(rotation[1])
    if (rotation[2]) g.rotateZ(rotation[2])
  }
  if (position) g.translate(position[0], position[1], position[2])
  return g
}

// part: { geo, color, position, rotation, scale }
export function assemble(parts) {
  let list = parts.map((p) => transformed(p.geo, p))

  // ExtrudeGeometry und toNonIndexed()-Ergebnisse haben keinen Index,
  // Primitive schon. mergeGeometries verlangt Einheitlichkeit – im Zweifel
  // loesen wir alle auf. Bei flat shading kostet das ohnehin nichts.
  if (list.some((g) => !g.index)) {
    list = list.map((g) => {
      if (!g.index) return g
      const flat = g.toNonIndexed()
      g.dispose()
      return flat
    })
  }

  list.forEach((g, i) => tint(g, parts[i].color))
  const merged = mergeGeometries(list, false)
  list.forEach((g) => g.dispose())
  if (!merged) throw new Error('assemble(): Geometrien liessen sich nicht zusammenfuehren')
  merged.computeVertexNormals()
  return merged
}

export function vertexColorMaterial(opts = {}) {
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.82,
    metalness: 0,
    ...opts,
  })
}

// Verzieht eine Geometrie mit Rauschen – aus einer Kugel wird so ein Findling.
export function jitter(geometry, amount, rng, along = null) {
  const pos = geometry.attributes.position
  const seen = new Map()
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`
    let off = seen.get(key)
    if (!off) {
      off = [
        (rng() - 0.5) * amount * (along ? along[0] : 1),
        (rng() - 0.5) * amount * (along ? along[1] : 1),
        (rng() - 0.5) * amount * (along ? along[2] : 1),
      ]
      seen.set(key, off)
    }
    pos.setXYZ(i, pos.getX(i) + off[0], pos.getY(i) + off[1], pos.getZ(i) + off[2])
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

// Beschriftete Flaeche als Canvas-Textur. Damit lassen sich Schilder, Displays
// und Aufkleber beschriften, ohne externe Assets zu laden.
export function labelTexture(text, {
  width = 512,
  height = 256,
  background = '#ffffff',
  color = '#1b2430',
  font = '700 84px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif',
  padding = 0.12,
  sub = null,
  subColor = null,
  align = 'center',
} = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, width, height)
  } else {
    ctx.clearRect(0, 0, width, height)
  }

  ctx.fillStyle = color
  ctx.font = font
  ctx.textAlign = align
  ctx.textBaseline = 'middle'

  const x = align === 'center' ? width / 2 : width * padding
  const y = sub ? height * 0.4 : height / 2

  // Bei Bedarf schrumpfen, damit nichts ueber den Rand laeuft.
  const maxWidth = width * (1 - padding * 2)
  ctx.fillText(text, x, y, maxWidth)

  if (sub) {
    ctx.font = font.replace(/\d+px/, (m) => `${Math.round(parseInt(m) * 0.45)}px`).replace('700', '500')
    ctx.fillStyle = subColor || color
    ctx.globalAlpha = 0.75
    ctx.fillText(sub, x, height * 0.72, maxWidth)
    ctx.globalAlpha = 1
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}
