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
  const widths = lines.map((l) => ctx.measureText(l.text).width * (l.scale ?? 1))
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
    ctx.font = font(line.weight ?? 800, size)

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

// Der Text soll aus der festen Kameraperspektive waagerecht stehen. Die
// Textur-Achsen der Spurkarte entsprechen X und Z der Welt, also muss die
// Schrift um den Kamera-Azimut gedreht liegen.
const TEXT_ROTATION = -CAMERA.azimuth

export function writeInSnow(trail, lines, { x, z, width, rotation = TEXT_ROTATION, strength = 1 }) {
  const { texture, aspect } = textTexture(lines)
  const height = width / aspect
  trail.stampDecal(texture, x, z, width, height, rotation, strength)
  return { width, height }
}

// Alles, was beim Start im Schnee steht.
export function writeIntro(trail) {
  // Signatur, gross ueber dem Plateau – zwei Zeilen, Nachname etwas kleiner.
  writeInSnow(trail, [
    { text: 'JULIAN', scale: 1 },
    { text: 'VEERKAMP', scale: 0.72 },
  ], {
    x: PLATEAU.x - 4,
    z: PLATEAU.z - 4,
    width: 17,
    strength: 1,
  })

  // Steuerung: nur das Tastenkreuz, kein erklaerender Text.
  const { texture, aspect } = keycapTexture()
  const width = 11
  trail.stampDecal(texture, PLATEAU.x + 4.5, PLATEAU.z + 4.5, width, width / aspect, TEXT_ROTATION, 0.95)
}

// --- Wildspuren ---------------------------------------------------------------
// Auf der Rueckseite des Berges ist ausser einer Piste nichts. Eine Fahrt durch
// leeren Wald sagt aber nur, dass dort nichts ist; zwei Reihen Klauenabdruecke,
// die quer ueber die Bahn in den Bestand ziehen, sagen, dass hier jemand war,
// bevor man selbst kam. Das ist der ganze Unterschied zwischen unbebaut und
// unberuehrt.
//
// Die Spur liegt als eine einzige lange Textur im Schnee und nicht als vierzig
// einzelne Stempel. Jeder Stempel ist ein eigener Renderdurchgang, und der
// Ladebalken ist ohnehin lang genug.
function spurTextur({ paare = 16, breite = 96, abstand = 74 } = {}) {
  const hoehe = paare * abstand + 60
  const canvas = document.createElement('canvas')
  canvas.width = breite
  canvas.height = hoehe
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, breite, hoehe)

  // Ein Schalenpaar: zwei Ballen nebeneinander, leicht nach vorn gespreizt.
  // Erst breit in Gruen – das ist der Schnee, den der Huf zur Seite drueckt –
  // dann in Gelb gefuellt, das ist die Vertiefung.
  const abdruck = (cx, cy, dreh, farbe, wachs) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(dreh)
    ctx.fillStyle = farbe
    for (const s of [-1, 1]) {
      ctx.beginPath()
      ctx.ellipse(s * 5.5, 0, 4.6 + wachs, 8.5 + wachs, s * 0.16, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  for (let i = 0; i < paare; i++) {
    const y = 30 + i * abstand
    // Das Tier laeuft nicht schnurgerade – eine leichte Schlangenlinie, und die
    // beiden Seiten versetzt, wie beim Gehen.
    const wander = Math.sin(i * 0.7) * 9
    const dreh = Math.sin(i * 0.7 + 1.2) * 0.12
    for (const [seite, versatz] of [[-1, 0], [1, abstand * 0.42]]) {
      const cx = breite / 2 + wander + seite * 13
      const cy = y + versatz
      if (cy > hoehe - 14) continue
      abdruck(cx, cy, dreh, '#00ff00', 2.6)
      abdruck(cx, cy, dreh, '#ffff00', 0)
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return { texture: tex, breite, hoehe }
}

// Die Textur-Y-Achse zeigt in der Welt nach (-sin r, cos r) – deshalb diese
// Umrechnung und nicht das naheliegende atan2(dz, dx).
export function stampTrack(trail, von, nach, { breite = 1.7, staerke = 0.5 } = {}) {
  const dx = nach[0] - von[0]
  const dz = nach[1] - von[1]
  const laenge = Math.hypot(dx, dz)
  const { texture } = spurTextur({ paare: Math.max(6, Math.round(laenge / 1.3)) })
  trail.stampDecal(
    texture,
    (von[0] + nach[0]) / 2, (von[1] + nach[1]) / 2,
    breite, laenge,
    Math.atan2(-dx / laenge, dz / laenge),
    staerke,
  )
}
