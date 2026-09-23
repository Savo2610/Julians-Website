import * as THREE from 'three'
import { LANDSCAPE_PATHS } from './landscape-layout.js'
import { CAMERA } from '../config.js'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { terrainHeight, NORTH_LANE, PARK_LANE } from './heightfield.js'
import { TRAILS, CONNECTIONS } from './paths.js'
import { createSignpost } from './props/signpost.js'

const WOOD = 0x6b4a35
const INK = '#294842'

// Pfeile meinen die sichtbare Richtung. Die Tafeln selbst bleiben zur Kamera
// gedreht; vier unterschiedlich gedrehte Tafeln waren teilweise nur Kanten.
function arrow(x, z, target) {
  const dx = target[0] - x, dz = target[1] - z
  const right = (dx - dz) / Math.SQRT2
  const down = (dx + dz) / Math.SQRT2
  const sector = Math.round(Math.atan2(down, right) / (Math.PI / 4))
  return ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'][(sector + 8) % 8]
}

function createValleyMap() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f5f1e5'
  ctx.fillRect(0, 0, 1024, 768)
  ctx.fillStyle = INK
  ctx.font = '700 72px system-ui, sans-serif'
  ctx.fillText('JULIANS TAL', 52, 85)
  ctx.font = '32px system-ui, sans-serif'
  ctx.fillText('Projekte entdecken. Eigene Spuren ziehen.', 54, 136)

  // Dieselbe Projektion wie die feste Kamera: links auf der Karte bedeutet
  // links im Tal. Der See und der Gipfel dienen auch ohne Text als Anker.
  const project = ([x, z]) => [490 + (x - z) * 3.65, 390 + (x + z) * 1.65]
  const line = (path, color, width) => {
    ctx.beginPath()
    path.forEach((p, i) => { const [x, y] = project(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) })
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }
  const [lx, ly] = project([-47, 41])
  ctx.fillStyle = '#c4dce0'
  ctx.beginPath(); ctx.ellipse(lx, ly, 46, 22, -0.15, 0, Math.PI * 2); ctx.fill()
  for (const path of [...CONNECTIONS, ...LANDSCAPE_PATHS]) line(path.path, '#b5c5bd', 6)
  for (const trail of Object.values(TRAILS)) line(trail.path, trail.color, 9)
  line([[-34, -8], [-63, -55], [-58, -64]], INK, 4)
  line([...NORTH_LANE.points, ...PARK_LANE.points].map(p => [p.x, p.z]), '#a8b7bb', 5)
  const label = (point, text, ox, oy) => {
    const [x, y] = project(point)
    ctx.fillStyle = INK
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill()
    ctx.font = '600 44px system-ui, sans-serif'
    ctx.fillText(text, x + ox, y + oy)
  }
  label([-58, -64], 'Gipfel', -86, -19)
  label([10, -59], 'Park', 14, -8)
  label([-34, -8], 'Lift', -51, -18)
  label([-32, 17], 'Tools', -75, -16)
  label([25, 21], 'Code & Profil', 15, 12)
  label([2, 0], 'Kontakt', 12, -16)
  ctx.font = '36px system-ui, sans-serif'
  ctx.fillText('See', lx - 19, ly + 44)
  const [hx, hy] = project([0, 30])
  ctx.fillStyle = '#bc713e'
  ctx.beginPath(); ctx.arc(hx, hy, 11, 0, Math.PI * 2); ctx.fill()
  ctx.font = '700 40px system-ui, sans-serif'
  ctx.fillText('START', hx - 65, hy + 80)
  ctx.fillStyle = INK
  ctx.fillRect(52, 585, 920, 2)
  ctx.font = '600 38px system-ui, sans-serif'
  ctx.fillText('Den Wegen folgen. Oder abbiegen.', 54, 638)
  ctx.font = '36px system-ui, sans-serif'
  ctx.fillText('An den Stationen: E · Bremsen: S / Shift', 54, 694)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function createWayfinding(world) {
  // Sechs Entscheidungen statt Beschriftung an jedem Gegenstand. Die Tafeln
  // stehen seitlich; ihr Ziel ist immer ein vorhandener Weg oder dessen Ende.
  const junctions = [
    { at: [-40, -12], rows: [['GIPFELBAHN', [-34, -8], INK], ['TOOLS · TAL', [-49, -4], TRAILS.tools.color]] },
    { at: [6, -6], rows: [['LIFT', [-9, -4], INK], ['WERKSTATT', [22, 0], TRAILS.career.color], ['STARTPLATZ', [1, 8], INK]] },
    { at: [33, 15], rows: [['KONTAKT · LIFT', [29, 9], INK], ['STARTPLATZ', [20, 23], INK]] },
    { at: [-25, 28], rows: [['ZUM SEE', [-26, 38], INK], ['TOOLS · LIFT', [-28, 21], TRAILS.tools.color]] },
    { at: [-67, -59], rows: [['AUSSICHT', [-61, -63], INK], ['TALABFAHRT', [-44, -52], TRAILS.sport.color]] },
    { at: [17, -53], rows: [['HÜTTE', [23, -61], TRAILS.sport.color], ['PARK', [20, -45], TRAILS.sport.color]] },
  ]
  for (const { at: [x, z], rows } of junctions) {
    const sign = createSignpost(rows.map(([text, target, background]) => ({
      text: `${arrow(x, z, target)} ${text}`, background, width: 3.5, height: 0.64,
    })), { height: 2.8 })
    world.place(sign, x, z, { rotation: CAMERA.azimuth })
    world.addCollider(x, z, 0.35)
  }

  // Das Pult am Platz ist Teil der Welt, keine dauerhafte Bedienoberflaeche.
  // Beide Beine reichen bis zu ihrem eigenen Bodenpunkt statt zu schweben.
  const x = 4, z = 24, yaw = CAMERA.azimuth
  const base = terrainHeight(x, z)
  const group = new THREE.Group()
  group.name = 'talplan'
  const parts = []
  for (const side of [-1, 1]) {
    const localX = side * 1.7
    const floor = terrainHeight(x + Math.cos(yaw) * localX, z - Math.sin(yaw) * localX) - base
    const height = 1.4 - floor
    parts.push({ geo: new THREE.BoxGeometry(0.19, height, 0.22), color: WOOD, position: [localX, floor + height / 2, 0] })
    world.addCollider(x + Math.cos(yaw) * localX, z - Math.sin(yaw) * localX, 0.2)
  }
  parts.push({ geo: new THREE.BoxGeometry(4.6, 3.5, 0.16), color: WOOD, position: [0, 1.5, 0], rotation: [-1.05, 0, 0] })
  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial())
  body.castShadow = true
  group.add(body)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(4.35, 3.26), new THREE.MeshStandardMaterial({ map: createValleyMap(), roughness: 0.9 }))
  face.rotation.x = -1.05
  face.position.set(0, 1.5 + Math.sin(1.05) * 0.09, Math.cos(1.05) * 0.09)
  group.add(face)
  world.place(group, x, z, { rotation: yaw })
  world.addCollider(x, z, 1.1)
}
