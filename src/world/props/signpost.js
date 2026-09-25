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
