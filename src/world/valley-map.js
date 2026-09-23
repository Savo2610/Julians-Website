import { CAMERA, WORLD } from '../config.js'
import {
  terrainHeight, playAreaDistance, LAKE, lakeRadius,
  SLED_LANE, NORTH_LANE, PARK_LANE, KINDER_LANE, SHOOT_LANE,
} from './heightfield.js'
import { TRAILS, VALLEY_PATHS } from './paths.js'

// Die Talkarte, gemalt aus der Welt selbst.
//
// Die alte Tafel war ein weisses Blatt mit farbigen Strichen – sie stand im
// Schnee wie ein ausgedrucktes Formular. Diese hier ist ein Relief: jede
// Schattierung kommt aus terrainHeight(), der Wald aus den echten
// Baumstandorten, See und Pisten aus denselben Formen, die man befaehrt. Was
// auf der Karte ein Hang ist, ist im Tal ein Hang.
//
// Gedreht ist sie wie die feste Kamera: Bildschirm-rechts ist Karten-rechts,
// Bildschirm-unten ist Karten-unten. Nach unten ist sie um SQUASH gestaucht,
// weil man das Tal aus 36 Grad sieht und nicht senkrecht von oben – mit
// 1:1 wirkte der Talkessel auf der Karte doppelt so tief wie im Bild.
//
// Dieselbe Zeichnung liegt auf dem Pult im Tal (boardMap: mit Titel und
// Ortsnamen) und in der Uebersicht, die Enter oeffnet (ohne – dort
// beschriftet HTML).

const SQUASH = 0.72
const A = CAMERA.azimuth
const COS = Math.cos(A)
const SIN = Math.sin(A)

// Weltkoordinate -> Kartenachsen (rechts, unten), noch ohne Massstab.
const toUV = (x, z) => [x * COS - z * SIN, (x * SIN + z * COS) * SQUASH]
const fromUV = (u, v) => {
  const w = v / SQUASH
  return [u * COS + w * SIN, -u * SIN + w * COS]
}

// Ausschnitt: alle Spielkreise plus ein Saum, in dem der Gebirgsrand
// ausblendet.
function bounds(pad = 10) {
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
  for (const b of WORLD.basins) {
    const [u, v] = toUV(b.x, b.z)
    const r = b.radius + pad
    minU = Math.min(minU, u - r); maxU = Math.max(maxU, u + r)
    minV = Math.min(minV, v - r * SQUASH); maxV = Math.max(maxV, v + r * SQUASH)
  }
  return { minU, maxU, minV, maxV }
}

export function createMapProjection(width, height, margin = 0.04) {
  const b = bounds()
  const mw = width * (1 - margin * 2)
  const mh = height * (1 - margin * 2)
  const scale = Math.min(mw / (b.maxU - b.minU), mh / (b.maxV - b.minV))
  const ox = (width - (b.maxU - b.minU) * scale) / 2 - b.minU * scale
  const oy = (height - (b.maxV - b.minV) * scale) / 2 - b.minV * scale
  return {
    width, height, scale,
    project(x, z) {
      const [u, v] = toUV(x, z)
      return [ox + u * scale, oy + v * scale]
    },
    unproject(px, py) {
      return fromUV((px - ox) / scale, (py - oy) / scale)
    },
  }
}

const mix = (a, b, t) => a + (b - a) * t
const clamp01 = (t) => Math.max(0, Math.min(1, t))

// Das Relief: Hoehen auf einem groben Raster, schattiert mit Licht von oben
// links. 1/4 der Aufloesung reicht, weil die Schattierung weich sein soll –
// voll aufgeloest waeren es 790 000 Aufrufe von terrainHeight(), so 49 000.
function paintRelief(ctx, proj) {
  const step = 4
  const w = Math.ceil(proj.width / step)
  const h = Math.ceil(proj.height / step)
  const heights = new Float32Array(w * h)
  const inside = new Float32Array(w * h)
  const lake = new Uint8Array(w * h)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const [x, z] = proj.unproject(i * step + step / 2, j * step + step / 2)
      const k = j * w + i
      heights[k] = terrainHeight(x, z)
      // Innerhalb der Spielflaeche voll, auf dem Gebirgsrand ueber zwoelf
      // Meter ausblendend – die Karte ist eine Insel, kein Rechteck.
      inside[k] = clamp01(1 - playAreaDistance(x, z) / 12)
      const dx = x - LAKE.x, dz = z - LAKE.z
      lake[k] = Math.hypot(dx, dz) < lakeRadius(Math.atan2(dz, dx)) ? 1 : 0
    }
  }
  const low = document.createElement('canvas')
  low.width = w
  low.height = h
  const lctx = low.getContext('2d')
  const img = lctx.createImageData(w, h)
  const texel = step / proj.scale
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      const hl = heights[j * w + Math.max(0, i - 1)]
      const hr = heights[j * w + Math.min(w - 1, i + 1)]
      const hu = heights[Math.max(0, j - 1) * w + i]
      const hd = heights[Math.min(h - 1, j + 1) * w + i]
      // Gefaelle je Meter; Licht von oben links, wie auf gedruckten
      // Pistenplaenen.
      const gx = (hr - hl) / (2 * texel)
      const gy = (hd - hu) / (2 * texel)
      // Mit Faktor 0,55 lag alles zwischen 0,5 und 0,75 – ein weisses Blatt.
      // 1,5 macht die Flanken und Ruecken lesbar, ohne dass die flachen
      // Pisten grau werden.
      const light = clamp01(0.66 - gx * 1.5 - gy * 1.5)
      const alt = clamp01((heights[k] + 2) / 30)
      // Hoehenlinien alle 2,5 m: ein Kartenzeichen, das jeder kennt, und das
      // flache Stellen von Hangen trennt, wo das Licht allein nichts sagt.
      const band = Math.floor(heights[k] / 2.5)
      const contour = band !== Math.floor(hr / 2.5) || band !== Math.floor(hd / 2.5)
      let r, g, b
      if (lake[k]) {
        r = mix(128, 188, light); g = mix(184, 224, light); b = mix(206, 238, light)
      } else {
        // Schatten kuehl-blau, Licht warm-weiss, oben etwas kaelter.
        r = mix(128, 252, light) - alt * 12
        g = mix(150, 250, light) - alt * 5
        b = mix(200, 244, light) + alt * 8
        if (contour) { r -= 22; g -= 16; b -= 8 }
      }
      const o = k * 4
      img.data[o] = r
      img.data[o + 1] = g
      img.data[o + 2] = b
      img.data[o + 3] = 255 * inside[k]
    }
  }
  lctx.putImageData(img, 0, 0)
  ctx.save()
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(low, 0, 0, proj.width, proj.height)
  ctx.restore()
}

function strokePath(ctx, proj, pts, width, color, dash = null) {
  ctx.beginPath()
  pts.forEach(([x, z], i) => {
    const [px, py] = proj.project(x, z)
    if (i) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
  })
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash(dash ?? [])
  ctx.stroke()
  ctx.setLineDash([])
}

// Kleine Tannen als Dreiecke mit Schneespitze. Einzeln gezeichnet, nicht
// als Flaeche: ein Wald aus Punkten liest sich als Wald, ein gruener Fleck
// als Wiese.
function paintTrees(ctx, proj, trees) {
  const s = Math.max(2.6, proj.scale * 1.05)
  const sorted = [...trees].sort((a, b) => (a.x + a.z) - (b.x + b.z))
  for (const t of sorted) {
    if (playAreaDistance(t.x, t.z) > 6) continue
    const [px, py] = proj.project(t.x, t.z)
    const k = s * (0.8 + (t.scale ?? 1) * 0.3)
    ctx.fillStyle = 'rgba(30, 60, 70, 0.18)'
    ctx.beginPath()
    ctx.ellipse(px + k * 0.35, py + k * 0.15, k * 0.55, k * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = (t.shade ?? 0.5) > 0.5 ? '#2f5b52' : '#3a6a5c'
    ctx.beginPath()
    ctx.moveTo(px, py - k * 1.5)
    ctx.lineTo(px + k * 0.62, py + k * 0.1)
    ctx.lineTo(px - k * 0.62, py + k * 0.1)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.beginPath()
    ctx.moveTo(px, py - k * 1.5)
    ctx.lineTo(px + k * 0.24, py - k * 0.9)
    ctx.lineTo(px - k * 0.24, py - k * 0.9)
    ctx.closePath()
    ctx.fill()
  }
}

// Das Grundbild: Relief, Pisten, Wege, Wald, Lift. Teuer (rund 450 ms bei
// 1200 × 900), deshalb genau einmal gemalt und fuer Pult und Uebersicht
// geteilt.
export function paintValleyMap({ width = 1200, height = 900, trees = [], lift = null } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const proj = createMapProjection(width, height, 0.03)

  paintRelief(ctx, proj)

  // Pisten: breite, weiche Baender – praepariert, nicht gemalt.
  for (const lane of [SLED_LANE, NORTH_LANE, PARK_LANE, KINDER_LANE, SHOOT_LANE]) {
    strokePath(ctx, proj, lane.points.map((p) => [p.x, p.z]), lane.width * proj.scale * 0.9, 'rgba(255,255,255,0.55)')
  }
  // Nebenwege zart gestrichelt, die vier Hauptwege in ihrer Farbe mit
  // weissem Saum.
  for (const p of VALLEY_PATHS) strokePath(ctx, proj, p.path, Math.max(1.5, proj.scale * 0.5), 'rgba(90,110,130,0.45)', [proj.scale * 1.2, proj.scale * 1.1])
  for (const t of Object.values(TRAILS)) {
    strokePath(ctx, proj, t.path, proj.scale * 1.9, 'rgba(255,255,255,0.9)')
    strokePath(ctx, proj, t.path, proj.scale * 1.05, t.color)
  }
  paintTrees(ctx, proj, trees)
  if (lift) {
    strokePath(ctx, proj, [[lift.base.x, lift.base.z], [lift.top.x, lift.top.z]], Math.max(1.5, proj.scale * 0.35), '#26323d', [proj.scale * 2, proj.scale * 1.2])
    for (const p of [lift.base, lift.top]) {
      const [px, py] = proj.project(p.x, p.z)
      ctx.fillStyle = '#26323d'
      ctx.fillRect(px - proj.scale, py - proj.scale, proj.scale * 2, proj.scale * 2)
    }
  }
  return { canvas, projection: proj }
}

// Die Fassung fuer das Pult: Papiergrund (sonst scheint um die Insel das
// dunkle Holz durch), darauf das Grundbild, Ortsnamen und Titel.
export function boardMap(base, { paper, labels = [], title = null }) {
  const { canvas: src, projection: proj } = base
  const width = src.width
  const height = src.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(width / 2, height / 2, width * 0.1, width / 2, height / 2, width * 0.7)
  g.addColorStop(0, paper[0])
  g.addColorStop(1, paper[1])
  ctx.fillStyle = g
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(src, 0, 0)

  ctx.textBaseline = 'middle'
  for (const l of labels) {
    const [px, py] = proj.project(l.x, l.z)
    const r = Math.max(4, proj.scale * 1.1)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.arc(px, py, r + 2.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = l.color ?? '#26323d'
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill()
    ctx.font = `700 ${Math.round(proj.scale * 4.2)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.lineWidth = proj.scale * 1.1
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    const tx = px + r + proj.scale * 1.2
    ctx.strokeText(l.text, tx, py)
    ctx.fillStyle = '#1d2c3a'
    ctx.fillText(l.text, tx, py)
  }

  if (title) {
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#1d2c3a'
    ctx.font = `800 ${Math.round(height * 0.075)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.fillText(title.text, width * 0.05, height * 0.12)
    if (title.sub) {
      ctx.font = `600 ${Math.round(height * 0.038)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
      ctx.fillStyle = '#4a5f75'
      ctx.fillText(title.sub, width * 0.052, height * 0.12 + height * 0.058)
    }
  }
  return canvas
}
