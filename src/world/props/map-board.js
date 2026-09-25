import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust } from '../../core/geometry.js'

// Die Panoramatafel am Startplatz (frueher: das Kartenpult).
//
// Die alte Tafel war ein Brett mit Papier darauf und sah aus wie
// hingestellt. Dieses steht im Winter: auf dem Rahmen liegt eine dicke
// Schneehaube, an der Unterkante haengen Eiszapfen, an den Pfosten hat der
// Wind Schnee angeweht. Die Karte selbst ist das Relief aus valley-map.js.
//
// Neigung 0,9 rad: die Kamera schaut aus 36 Grad, eine Flaeche mit 0,63
// stuende ihr genau gegenueber. Ein Pult so steil sieht aber aus wie eine
// Wand; 0,9 ist der Kompromiss – die Karte ist aus 33 m lesbar und das Pult
// liegt noch wie ein Pult.

const WOOD = 0x6b4a35
const WOOD_DARK = 0x4a3326
const SNOW = 0xf7fbff
const SNOW_SHADE = 0xe2ecf6
const ICE = 0xd8ecfb

// Die Lawinenwarnstufe wechselt einmal am Tag, fuer alle Besucher gleich:
// gezogen aus dem Datum, nicht aus Math.random. Verteilt wie im echten
// Winter – meist gering, selten mehr: 1 zu 55 %, 2 zu 27 %, 3 zu 12 %,
// 4 zu 5 %, 5 zu 1 %. Zum Ansehen laesst sie sich mit ?lawine=4 erzwingen.
const STUFEN = [
  { bis: 0.55, farbe: '#4cae4c', schrift: '#ffffff' },
  { bis: 0.82, farbe: '#f2d21f', schrift: '#26323d' },
  { bis: 0.94, farbe: '#f28c1f', schrift: '#ffffff' },
  { bis: 0.99, farbe: '#e0322b', schrift: '#ffffff' },
  { bis: 1.00, farbe: '#e0322b', schrift: '#ffffff', schach: true },
]

export function lawinenstufe(date = new Date()) {
  const erzwungen = Number(new URLSearchParams(location.search).get('lawine'))
  if (erzwungen >= 1 && erzwungen <= 5) return erzwungen
  const tag = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
  // FNV-1a und ein Murmel-Nachmischer: aufeinanderfolgende Tage liegen
  // sonst zu dicht beieinander und die Stufe klebt tagelang.
  let h = 2166136261
  for (const c of tag) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16
  const r = (h >>> 0) / 4294967296
  return STUFEN.findIndex((s) => r < s.bis) + 1
}

export function createMapBoard(texture, { fuss = [0, 0], stufe = lawinenstufe() } = {}) {
  const group = new THREE.Group()
  group.name = 'talplan'

  const W = 4.4
  const H = 3.3
  const tilt = -0.9
  const cy = 1.5
  const postX = W / 2 - 0.35

  // Pfosten reichen bis zu ihrem eigenen Bodenpunkt (fuss), sonst steht das
  // Pult auf dem gewoelbten Plateau mit einem Bein in der Luft.
  const parts = []
  fuss.forEach((floor, i) => {
    const x = i === 0 ? -postX : postX
    const top = cy + 0.35
    const len = top - floor
    parts.push({ geo: new THREE.CylinderGeometry(0.12, 0.14, len, 8), color: WOOD, position: [x, floor + len / 2, -0.15] })
    // Schneewehe am Fuss: flach, auf der Windseite (hinten) hoeher.
    parts.push({ geo: new THREE.SphereGeometry(0.55, 10, 6), color: SNOW_SHADE, position: [x, floor + 0.02, -0.3], scale: [1.2, 0.38, 1] })
    parts.push({ geo: new THREE.SphereGeometry(0.38, 10, 6), color: SNOW, position: [x + 0.1, floor + 0.04, 0.1], scale: [1, 0.3, 1] })
  })
  const posts = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85 }))
  posts.castShadow = true
  posts.receiveShadow = true
  group.add(posts)

  // Die Platte mit Rahmen, geneigt.
  const panel = new THREE.Group()
  panel.position.set(0, cy, 0)
  panel.rotation.x = tilt
  const frame = []
  frame.push({ geo: new THREE.BoxGeometry(W, H, 0.1), color: WOOD_DARK, position: [0, 0, -0.05] })
  for (const sy of [-1, 1]) {
    frame.push({ geo: new THREE.BoxGeometry(W + 0.24, 0.16, 0.16), color: WOOD, position: [0, sy * (H / 2 + 0.04), 0.02] })
  }
  for (const sx of [-1, 1]) {
    frame.push({ geo: new THREE.BoxGeometry(0.16, H + 0.24, 0.16), color: WOOD, position: [sx * (W / 2 + 0.04), 0, 0.02] })
  }

  // Eiszapfen an der Unterkante, unregelmaessig, damit es kein Kamm wird.
  const lens = [0.2, 0.32, 0.14, 0.26, 0.38, 0.18, 0.3, 0.12, 0.24, 0.34, 0.16]
  lens.forEach((len, i) => {
    frame.push({
      geo: new THREE.ConeGeometry(0.035, len, 5),
      color: ICE,
      position: [-W / 2 + 0.2 + i * ((W - 0.4) / (lens.length - 1)), -H / 2 - 0.1 - len * 0.4, 0.1],
      rotation: [Math.PI + tilt, 0, 0],
    })
  })
  const frameMesh = new THREE.Mesh(assemble(frame), vertexColorMaterial({ roughness: 0.8 }))
  snowDust(frameMesh.geometry, 0.4, 0.75)
  frameMesh.castShadow = true
  frameMesh.receiveShadow = true
  panel.add(frameMesh)

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.06, H - 0.06),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }),
  )
  face.position.z = 0.012
  face.receiveShadow = true
  panel.add(face)
  group.add(panel)

  // --- Wie die Panoramatafel an einer Talstation --------------------------
  // Ein Vordach ueber der Oberkante, parallel zur Platte, damit es mit ihr
  // kippt und nicht als waagerechtes Brett in der Luft haengt. Es haelt die
  // Schneehaube, die vorher direkt auf dem Rahmen lag.
  const roof = []
  roof.push({ geo: new THREE.BoxGeometry(W + 0.7, 0.1, 0.9), color: WOOD_DARK, position: [0, H / 2 + 0.34, 0.3] })
  roof.push({ geo: new THREE.BoxGeometry(W + 0.8, 0.16, 1.0), color: SNOW, position: [0, H / 2 + 0.46, 0.3] })
  for (const sx of [-1, 1]) {
    roof.push({ geo: new THREE.BoxGeometry(0.08, 0.3, 0.08), color: WOOD, position: [sx * (W / 2 - 0.1), H / 2 + 0.18, 0.02] })
  }
  const roofMesh = new THREE.Mesh(assemble(roof), vertexColorMaterial({ roughness: 0.85 }))
  snowDust(roofMesh.geometry, 0.4, 0.75)
  roofMesh.castShadow = true
  panel.add(roofMesh)

  // Lawinenwarnung rechts oben: gelbe Rundumleuchte auf einem Kasten und
  // darunter die Warnstufe des Tages (lawinenstufe). Das Blinken ist das,
  // was man aus 33 m zuerst sieht; die Tafel ist Kleinkram fuer den, der
  // naeher kommt.
  const unit = new THREE.Group()
  unit.position.set(W / 2 + 0.55, H / 2 - 0.35, 0.05)
  panel.add(unit)
  const box = new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(0.7, 1.05, 0.14), color: 0x3a4652 },
      { geo: new THREE.CylinderGeometry(0.12, 0.14, 0.1, 10), color: 0x2a323b, position: [0, 0.57, 0.02], rotation: [Math.PI / 2 + 0.9, 0, 0] },
      { geo: new THREE.BoxGeometry(0.78, 0.1, 0.22), color: SNOW, position: [0, 0.56, -0.02] },
    ]),
    vertexColorMaterial({ roughness: 0.7 }),
  )
  box.castShadow = true
  unit.add(box)
  const plate = document.createElement('canvas')
  plate.width = 128
  plate.height = 192
  const ctx = plate.getContext('2d')
  ctx.fillStyle = '#f4f7fa'
  ctx.fillRect(0, 0, 128, 192)
  ctx.fillStyle = '#26323d'
  ctx.font = '800 21px ui-rounded, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('LAWINEN', 64, 30)
  ctx.font = '700 15px ui-rounded, system-ui, sans-serif'
  ctx.fillText('WARNSTUFE', 64, 50)
  const st = STUFEN[stufe - 1]
  ctx.fillStyle = st.farbe
  ctx.fillRect(22, 64, 84, 108)
  if (st.schach) {
    // Stufe 5 traegt im echten Schema ein rot-schwarzes Schachbrett.
    ctx.fillStyle = '#1b1b1b'
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) if ((x + y) % 2) ctx.fillRect(22 + x * 28, 64 + y * 27, 28, 27)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.fillRect(38, 84, 52, 72)
  }
  ctx.fillStyle = st.schrift
  ctx.font = '900 92px ui-rounded, system-ui, sans-serif'
  ctx.fillText(String(stufe), 64, 152)
  const plateTex = new THREE.CanvasTexture(plate)
  plateTex.colorSpace = THREE.SRGBColorSpace
  const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.87), new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.8 }))
  plateMesh.position.set(0, -0.02, 0.075)
  unit.add(plateMesh)
  // Die Leuchte sitzt auf dem Kasten, senkrecht zur Welt und nicht zur Platte.
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0xffa000, emissiveIntensity: 0.2, roughness: 0.3 })
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), lampMat)
  lamp.position.set(0, 0.62, 0.05)
  lamp.rotation.x = 0.9
  unit.add(lamp)
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(), color: 0xffb020, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0,
  }))
  glow.scale.setScalar(1.6)
  glow.position.copy(lamp.position)
  unit.add(glow)

  // Doppelblitz, wie eine echte Warnleuchte – ein gleichmaessiges Pulsieren
  // sah nach Weihnachtsdeko aus. Bei Stufe 1 bleibt sie aus; ab 4 schneller.
  const takt = stufe >= 4 ? 1.0 : 1.6
  group.userData.stufe = stufe
  group.userData.animate = (t) => {
    const p = t % takt
    const on = stufe >= 2 && (p < 0.12 || (p > 0.24 && p < 0.36))
    lampMat.emissiveIntensity = on ? 2.4 : 0.15
    glow.material.opacity = on ? 0.85 : 0
  }

  group.userData.footprint = { width: W + 0.6, depth: 2.4 }
  return group
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
