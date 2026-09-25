import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Pistenschild an einem Stahlpfosten. Ein bis drei beschriftete Tafeln, wie
// die Wegweiser an Kreuzungen im Skigebiet.

const POST = 0x6b4a35
const SNOW = 0xf7fbff

// Die Tafeln sind leicht nach oben geneigt. Aus der Draufsicht der Kamera
// sind senkrechte Schilder sonst nur als Kante zu sehen.
const BOARD_TILT = -0.5

export function createSignpost(boards, { height = 2.3 } = {}) {
  const group = new THREE.Group()
  const parts = []

  parts.push({ geo: new THREE.CylinderGeometry(0.45, 0.52, 0.24, 8), color: 0x8e969f, position: [0, 0.1, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.065, 0.075, height, 8), color: POST, position: [0, height / 2, 0] })
  // Kappe mit Schneehaeubchen
  parts.push({ geo: new THREE.SphereGeometry(0.08, 8, 5), color: POST, position: [0, height, 0] })
  parts.push({
    geo: (() => {
      const g = new THREE.SphereGeometry(0.085, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)
      g.scale(1, 0.6, 1)
      return g
    })(),
    color: SNOW,
    position: [0, height + 0.02, 0],
  })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85, metalness: 0 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Tafeln ------------------------------------------------------------
  boards.forEach((board, i) => {
    const w = board.width ?? 1.5
    const h = board.height ?? 0.44
    // side -1: die Tafel ragt nach links vom Pfosten weg – fuer Wege, die im
    // Bild nach links fuehren. Eine Tafel zeigt mit ihrem freien Ende.
    const side = board.side ?? 1
    const y = height - 0.4 - i * (h * Math.cos(BOARD_TILT) + 0.2)

    const tex = labelTexture(board.text, {
      width: 640,
      height: Math.round((640 * h) / w),
      background: board.background ?? '#1c64c4',
      color: board.color ?? '#ffffff',
      sub: board.sub ?? null,
      font: `700 ${Math.round(120 * (0.44 / h))}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`,
    })

    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.05),
      // Eine Texturmaterial-Gruppe statt sechs: jede neue Wegtafel kostete
      // sonst sechs Draw Calls, obwohl nur ihre Vorderseite gelesen wird.
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }),
    )
    plate.position.set(side * w * 0.42, y, 0)
    plate.rotation.set(BOARD_TILT, board.rotation ?? 0, 0, 'YXZ')
    plate.castShadow = true
    group.add(plate)

    // Schneekante auf der Oberseite der Tafel
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.01, 0.05, 0.09),
      new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.95, flatShading: true }),
    )
    cap.position.set(side * w * 0.42, y + h / 2 * Math.cos(BOARD_TILT) + 0.03, -h / 2 * Math.sin(BOARD_TILT) * -1)
    cap.rotation.set(BOARD_TILT, board.rotation ?? 0, 0, 'YXZ')
    group.add(cap)
  })

  return group
}

// --- Moderne Markierung --------------------------------------------------
// Statt Holzbrett mit Schneekante: ein schlanker Mast in Anthrazit und eine
// abgerundete Tafel in der Farbe des Weges, Schrift weiss, der Pfeil in einem
// weissen Kreis am freien Ende – wie die Leitsysteme neuerer Skigebiete.
// Die Tafel ist echte Geometrie mit Dicke (abgerundetes Rechteck,
// extrudiert), die Schrift liegt als eigene Flaeche davor; ein Rechteck mit
// ausgeschnittenen Ecken in der Textur haette von der Seite eckig gewirkt.

const MAST = 0x2f3842

function roundedShape(w, h, r) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2 + r, -h / 2)
  s.lineTo(w / 2 - r, -h / 2)
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  s.lineTo(w / 2, h / 2 - r)
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  s.lineTo(-w / 2 + r, h / 2)
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  s.lineTo(-w / 2, -h / 2 + r)
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)
  return s
}

function markerFace({ text, arrow, background, side }, w, h) {
  const px = 200
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * px)
  canvas.height = Math.round(h * px)
  const ctx = canvas.getContext('2d')
  const H = canvas.height
  const pad = H * 0.16
  const circle = H * 0.36
  // Pfeil am freien Ende: links bei side -1, sonst rechts.
  const cx = side < 0 ? pad + circle : canvas.width - pad - circle
  if (arrow) {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, H / 2, circle, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = background
    ctx.font = `800 ${Math.round(circle * 1.25)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(arrow, cx, H / 2 + circle * 0.06)
  }
  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  let size = H * 0.5
  ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
  const room = canvas.width - pad * 2 - (arrow ? circle * 2 + pad : 0)
  while (ctx.measureText(text).width > room && size > 10) {
    size -= 2
    ctx.font = `800 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.04)}px`
  const textLeft = side < 0 && arrow ? pad * 2 + circle * 2 : pad
  ctx.textAlign = 'left'
  ctx.fillText(text, textLeft + (room - ctx.measureText(text).width) / 2, H / 2 + size * 0.04)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function createMarkerSign(boards, { height = 2.6 } = {}) {
  const group = new THREE.Group()
  const body = new THREE.Mesh(assemble([
    { geo: new THREE.CylinderGeometry(0.3, 0.34, 0.12, 12), color: MAST, position: [0, 0.04, 0] },
    { geo: new THREE.CylinderGeometry(0.045, 0.045, height, 10), color: MAST, position: [0, height / 2, 0] },
    { geo: new THREE.CylinderGeometry(0.06, 0.045, 0.06, 10), color: MAST, position: [0, height + 0.02, 0] },
  ]), vertexColorMaterial({ roughness: 0.45, metalness: 0.35, flatShading: false }))
  body.castShadow = true
  group.add(body)

  boards.forEach((board, i) => {
    const w = board.width ?? 2.6
    const h = board.height ?? 0.6
    const side = board.side ?? 1
    const y = height - 0.35 - i * (h * Math.cos(BOARD_TILT) + 0.14)
    const panel = new THREE.Group()
    panel.position.set(side * (w / 2 + 0.02), y, 0)
    panel.rotation.set(BOARD_TILT, 0, 0, 'YXZ')
    group.add(panel)

    const plate = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedShape(w, h, h * 0.3), { depth: 0.05, bevelEnabled: false, curveSegments: 6 }),
      new THREE.MeshStandardMaterial({ color: board.background, roughness: 0.55 }),
    )
    plate.position.z = -0.025
    plate.castShadow = true
    panel.add(plate)
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: markerFace({ ...board, side }, w, h), transparent: true, roughness: 0.6 }),
    )
    face.position.z = 0.027
    panel.add(face)
  })
  return group
}
