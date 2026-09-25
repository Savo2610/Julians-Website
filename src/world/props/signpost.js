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

// --- Wegweiserpfeile -------------------------------------------------------
// Die Tafeln wie an einer Kreuzung im Skigebiet: jede ist ein Pfeil, dessen
// Spitze in die Richtung ihres Weges zeigt, in der Wegfarbe mit weissem
// Rand, weisser Schrift und einer Schneehaube auf der Oberkante. Der Mast ist
// derselbe Holzpfosten wie beim alten Schild.
//
// Ein Versuch dazwischen waren moderne Leitsystem-Tafeln (Anthrazit-Mast,
// abgerundet, Pfeil im weissen Kreis). Sie passten nicht in die Landschaft –
// im Spielzeugtal ist alles Holz, Schnee und Filz, und ein Stahlmast mit
// glatter Tafel sah aus wie aus einem Buerogebaeude.

function arrowShape(w, h) {
  // Spitze um 0,28·h vorgezogen, das stumpfe Ende gerade.
  const tip = h * 0.42
  const x0 = -w / 2, x1 = w / 2 - tip
  const s = new THREE.Shape()
  s.moveTo(x0, -h / 2)
  s.lineTo(x1, -h / 2)
  s.lineTo(w / 2, 0)
  s.lineTo(x1, h / 2)
  s.lineTo(x0, h / 2)
  s.lineTo(x0, -h / 2)
  return s
}

function arrowFace({ text, arrow, background, side }, w, h) {
  const px = 200
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * px)
  canvas.height = Math.round(h * px)
  const ctx = canvas.getContext('2d')
  const W = canvas.width, H = canvas.height
  const tip = H * 0.42
  // Die Flaeche selbst in Wegfarbe, mit weissem Innenrand, der der
  // Pfeilform folgt – das macht aus einem farbigen Brett ein Schild.
  ctx.save()
  if (side < 0) { ctx.translate(W, 0); ctx.scale(-1, 1) }
  const inset = H * 0.09
  ctx.fillStyle = background
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.92)'
  ctx.lineWidth = H * 0.05
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(inset, inset)
  ctx.lineTo(W - tip - inset * 0.4, inset)
  ctx.lineTo(W - inset * 1.3, H / 2)
  ctx.lineTo(W - tip - inset * 0.4, H - inset)
  ctx.lineTo(inset, H - inset)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const label = arrow ? (side < 0 ? `${arrow} ${text}` : `${text} ${arrow}`) : text
  let size = H * 0.5
  const font = () => `800 ${size}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
  ctx.font = font()
  const room = W - tip - inset * 3
  while (ctx.measureText(label).width > room && size > 10) { size -= 2; ctx.font = font() }
  const mid = side < 0 ? (tip + W - inset) / 2 : (inset + W - tip) / 2
  ctx.fillText(label, mid, H / 2 + size * 0.05)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function createMarkerSign(boards, { height = 2.6 } = {}) {
  const group = new THREE.Group()
  // Pfosten, Fuss und Kappe wie beim alten Schild.
  const body = new THREE.Mesh(assemble([
    { geo: new THREE.CylinderGeometry(0.45, 0.52, 0.24, 8), color: 0x8e969f, position: [0, 0.1, 0] },
    { geo: new THREE.CylinderGeometry(0.075, 0.085, height, 8), color: POST, position: [0, height / 2, 0] },
    { geo: new THREE.SphereGeometry(0.09, 8, 5), color: POST, position: [0, height, 0] },
    { geo: new THREE.SphereGeometry(0.1, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), color: SNOW, position: [0, height + 0.02, 0], scale: [1, 0.6, 1] },
  ]), vertexColorMaterial({ roughness: 0.85, metalness: 0 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const snowMat = new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.95, flatShading: true })
  boards.forEach((board, i) => {
    const w = board.width ?? 2.6
    const h = board.height ?? 0.6
    const side = board.side ?? 1
    const y = height - 0.38 - i * (h * Math.cos(BOARD_TILT) + 0.16)
    const panel = new THREE.Group()
    panel.position.set(side * (w / 2 + 0.06), y, 0.06)
    panel.rotation.set(BOARD_TILT, 0, 0, 'YXZ')
    group.add(panel)

    const geo = new THREE.ExtrudeGeometry(arrowShape(w, h), { depth: 0.05, bevelEnabled: false })
    // Nach links zeigende Pfeile sind gespiegelt; gespiegelt kehrt sich der
    // Umlaufsinn der Dreiecke um, deshalb beidseitig.
    if (side < 0) geo.scale(-1, 1, 1)
    const plate = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: board.background, roughness: 0.75, side: THREE.DoubleSide }))
    plate.position.z = -0.025
    plate.castShadow = true
    panel.add(plate)

    // Die Schrift: Textur in Pfeilform zugeschnitten, damit die Spitze
    // nicht als Rechteck ueber die Tafel ragt.
    const faceGeo = new THREE.ShapeGeometry(arrowShape(w, h))
    if (side < 0) faceGeo.scale(-1, 1, 1)
    const uv = faceGeo.attributes.uv
    const pos = faceGeo.attributes.position
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k) / w + 0.5, pos.getY(k) / h + 0.5)
    const face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: arrowFace({ ...board, side }, w, h), roughness: 0.7, side: THREE.DoubleSide }))
    face.position.z = 0.027
    panel.add(face)

    // Schneehaube auf der Oberkante, liegend und nicht mitgekippt.
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.06, 0.11), snowMat)
    cap.position.set(side * (w / 2 + 0.06) - side * w * 0.06, y + (h / 2) * Math.cos(BOARD_TILT) + 0.03, 0.06 + (h / 2) * Math.sin(BOARD_TILT))
    group.add(cap)
  })
  return group
}
