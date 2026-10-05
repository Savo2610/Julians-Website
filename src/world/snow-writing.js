import * as THREE from 'three'
import { CAMERA } from '../config.js'
import { PLATEAU } from './heightfield.js'

// Statt eines HUD steht die Steuerung im Schnee. Der Text wird als Textur in
// die Spur-Karte gestempelt und vom Terrain-Shader zu einer echten Vertiefung
// mit aufgeworfenem Rand verformt – man liest sie wie eine Fussspur.
//
// Rot-Kanal = Rille, Gruen-Kanal = Wall. Deshalb wird jeder Buchstabe zweimal
// gezeichnet: breit umrandet in Gruen, gefuellt in Gelb (also Rot + Gruen).

function textTexture(lines, { fontSize = 96, lineGap = 1.25, rim = 15 } = {}) {
  const pad = fontSize * 0.55
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const font = (weight, size) =>
    `${weight} ${size}px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif`

  // Erst messen, dann in der richtigen Groesse zeichnen.
  ctx.font = font(800, fontSize)
  const widths = lines.map((l) => ctx.measureText(l.text).width * (l.scale ?? 1) * 1.08)
  const width = Math.ceil(Math.max(...widths) + pad * 2)
  const height = Math.ceil(lines.length * fontSize * lineGap + pad * 2)
  canvas.width = width
  canvas.height = height

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  lines.forEach((line, i) => {
    const size = fontSize * (line.scale ?? 1)
    const y = pad + fontSize * lineGap * (i + 0.5)
    ctx.font = font(line.weight ?? 900, size)
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.06)}px`

    // Wall: breiter Rand, nur Gruen.
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = rim * (line.scale ?? 1)
    ctx.strokeText(line.text, width / 2, y)

    // Rille: die Buchstabenflaeche selbst, Rot und Gruen.
    ctx.fillStyle = '#ffff00'
    ctx.fillText(line.text, width / 2, y)
  })

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return { texture: tex, aspect: width / height }
}

// Die vier Fahrtasten als Tastenkreuz, darunter die Leertaste. Umrandete
// Kaesten machen ohne ein einziges Wort klar, dass es sich um Tasten handelt.
// Die Leertaste ist dazugekommen, seit sie mehr tut als springen – ohne
// Hinweis findet niemand einen Trick, den es nirgends zu lesen gibt.
function keycapTexture({ cell = 150, gap = 18, radius = 28, rim = 15 } = {}) {
  const pad = 40
  const width = cell * 3 + gap * 2 + pad * 2
  const height = cell * 3 + gap * 2 + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, width, height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  const keys = [
    { text: 'W', col: 1, row: 0 },
    { text: 'A', col: 0, row: 1 },
    { text: 'S', col: 1, row: 1 },
    { text: 'D', col: 2, row: 1 },
  ]

  // Die Leertaste ist breit und flach – daran erkennt man sie, ohne dass
  // etwas darauf stehen muesste.
  keys.push({ text: 'SPACE', col: 0, row: 2, span: 3, flat: 0.62 })

  for (const key of keys) {
    const w = cell * (key.span ?? 1) + gap * ((key.span ?? 1) - 1)
    const h = cell * (key.flat ?? 1)
    const x = pad + key.col * (cell + gap)
    const y = pad + key.row * (cell + gap)
    const cx = x + w / 2
    const cy = y + h / 2

    // Gruen = aufgeworfener Wall: einmal breit um Kasten und Buchstabe.
    const font = `800 ${cell * (key.span ? 0.3 : 0.6)}px ui-rounded, "SF Pro Rounded", system-ui, sans-serif`
    ctx.strokeStyle = '#00ff00'
    ctx.lineWidth = rim * 2
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.stroke()
    ctx.font = font
    ctx.strokeText(key.text, cx, cy + cell * 0.02)

    // Gelb = Rille: der Kastenrand selbst und der Buchstabe.
    ctx.strokeStyle = '#ffff00'
    ctx.lineWidth = rim
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    ctx.stroke()
    ctx.fillStyle = '#ffff00'
    ctx.fillText(key.text, cx, cy + cell * 0.02)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return { texture: tex, aspect: width / height }
}

// Am Handy gibt es kein Tastenkreuz, also steht dort der Daumenstick im
// Schnee: ein Ring, ein Knopf darin und vier Pfeile nach aussen. Dieselbe
// Zeichensprache wie die Tasten – Wall in Gruen, Rille in Gelb.
function stickTexture({ size = 520, rim = 15 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, size, size)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const c = size / 2
  const ring = size * 0.3
  const knob = size * 0.11
  const draw = (color, extra) => {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = rim + extra
    ctx.beginPath()
    ctx.arc(c, c, ring, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(c, c, knob + extra / 2, 0, Math.PI * 2)
    ctx.fill()
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2
      const r0 = ring + size * 0.07
      const tip = ring + size * 0.14
      const w = size * 0.05
      const ux = Math.cos(a)
      const uy = Math.sin(a)
      ctx.beginPath()
      ctx.moveTo(c + ux * r0 - uy * w, c + uy * r0 + ux * w)
      ctx.lineTo(c + ux * tip, c + uy * tip)
      ctx.lineTo(c + ux * r0 + uy * w, c + uy * r0 - ux * w)
      ctx.stroke()
    }
  }
  draw('#00ff00', rim)
  draw('#ffff00', 0)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return { texture: tex, aspect: 1 }
}

// Der Text soll aus der festen Kameraperspektive waagerecht stehen. Die
// Textur-Achsen der Spurkarte entsprechen X und Z der Welt, also muss die
// Schrift um den Kamera-Azimut gedreht liegen.
const TEXT_ROTATION = -CAMERA.azimuth

export function writeInSnow(trail, lines, { x, z, width, rotation = TEXT_ROTATION, strength = 1, relief = 1 }) {
  const { texture, aspect } = textTexture(lines)
  const height = width / aspect
  trail.stampDecal(texture, x, z, width, height, rotation, strength, relief)
  return { width, height }
}

// Alles, was beim Start im Schnee steht.
export function writeIntro(trail, { touch = false } = {}) {
  // Signatur, gross ueber dem Plateau – zwei Zeilen, Nachname etwas kleiner.
  writeInSnow(trail, [
    { text: 'JULIAN', scale: 1 },
    { text: 'VEERKAMP', scale: 0.72 },
  ], {
    x: PLATEAU.x - 4,
    z: PLATEAU.z - 4,
    width: 17,
    strength: 1,
    // Im unberuehrten Schnee war der Name kaum zu lesen: Rille und Wall
    // warfen bei Licht von oben links Schatten in jeden Buchstaben, und die
    // Windrippen liefen quer hindurch. Erst platt gefahren wurde er lesbar –
    // weil dann nur noch die Farbe uebrig war. Also gleich so: wenig Relief,
    // viel Farbe.
    relief: 0.3,
  })

  // Steuerung: nur das Tastenkreuz, kein erklaerender Text.
  const { texture, aspect } = touch ? stickTexture() : keycapTexture()
  const width = touch ? 8 : 11
  trail.stampDecal(texture, PLATEAU.x + 4.5, PLATEAU.z + 4.5, width, width / aspect, TEXT_ROTATION, 0.95, 0.45)
}
