import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Das Kassenhaeuschen an der Talstation: ein Holzhaus mit Schalterfenster,
// rotem Vordach und einer Absperrgasse davor.
//
// Von oben sieht man vor allem das Dach. Deshalb traegt das Dach die Farbe
// und die Form – ein Satteldach mit Schneeauflage und ein weit
// vorgezogenes rotes Vordach ueber dem Schalter. Die Waende darunter sind
// fast Nebensache; sie muessen nur da sein, damit das Dach nicht schwebt.
//
// Der Automat daneben allein war zu wenig: ein Ort, an dem man bezahlt,
// braucht eine Front, hinter der jemand sitzen koennte.

const WOOD = 0x7b5236
const WOOD_DARK = 0x54382a
const WOOD_LIGHT = 0x94663f
const SNOW = 0xf7fbff
const SNOW_SHADE = 0xdfe9f5
const METAL = 0x99a1ab
const RED = 0xc8402f
const WARM = 0xffc46b

export function createTicketBooth({ label = 'KASSE' } = {}) {
  const group = new THREE.Group()
  const parts = []

  const W = 2.8   // Breite
  const D = 2.2   // Tiefe
  const H = 2.2   // Wandhoehe
  const front = D / 2

  // --- Sockel -------------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W + 0.4, 0.3, D + 0.4), color: WOOD_DARK, position: [0, 0.15, 0] })

  // --- Waende --------------------------------------------------------------
  // Drei geschlossene Seiten, die vierte bekommt den Schalter. Vorn ist +Z:
  // das Haus wird spaeter zur Kamera gedreht.
  parts.push({ geo: new THREE.BoxGeometry(W, H, 0.16), color: WOOD, position: [0, 0.3 + H / 2, -front] })
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.16, H, D), color: WOOD_LIGHT, position: [sx * (W / 2), 0.3 + H / 2, 0] })
  }
  // Waagerechte Bohlen auf der Vorderseite, damit die Wand nicht als Platte
  // liest.
  for (let i = 0; i < 4; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(W - 0.1, 0.22, 0.2),
      color: i % 2 ? WOOD : WOOD_LIGHT,
      position: [0, 0.42 + i * 0.25, front],
    })
  }
  // Sturz ueber dem Schalter
  parts.push({ geo: new THREE.BoxGeometry(W, 0.5, 0.16), color: WOOD, position: [0, 0.3 + H - 0.25, front] })
  // Dunkler Innenraum – ohne ihn schaut man durch das Haus hindurch.
  parts.push({ geo: new THREE.BoxGeometry(W - 0.24, 1.0, D - 0.3), color: 0x2b2f36, position: [0, 1.35, -0.15] })

  // Schalterbrett, das ein Stueck heraussteht, mit zwei Konsolen darunter.
  parts.push({ geo: new THREE.BoxGeometry(W - 0.05, 0.12, 0.55), color: WOOD_LIGHT, position: [0, 1.42, front + 0.2] })
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.1, 0.4, 0.32),
      color: WOOD_DARK,
      position: [sx * (W / 2 - 0.35), 1.2, front + 0.18],
      rotation: [0.55, 0, 0],
    })
  }

  // --- Satteldach ----------------------------------------------------------
  // Der Firstbalken laeuft quer, das Dach faellt nach vorn und hinten.
  const rise = 0.8
  const slopeLen = Math.hypot(D / 2 + 0.5, rise)
  const slopeAngle = Math.atan2(rise, D / 2 + 0.5)
  const gable = new THREE.Shape()
  gable.moveTo(-D / 2 - 0.2, 0)
  gable.lineTo(D / 2 + 0.2, 0)
  gable.lineTo(0, rise)
  gable.closePath()
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.ExtrudeGeometry(gable, { depth: 0.14, bevelEnabled: false }),
      color: WOOD_DARK,
      position: [sx * (W / 2) - 0.07, 0.3 + H, 0],
      rotation: [0, Math.PI / 2, 0],
    })
  }
  for (const sz of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(W + 0.55, 0.14, slopeLen),
      color: WOOD_DARK,
      position: [0, 0.3 + H + rise / 2, sz * (D / 4 + 0.25)],
      rotation: [sz * slopeAngle, 0, 0],
    })
    // Dicke Schneeauflage – das ist die Flaeche, die man von oben sieht.
    parts.push({
      geo: new THREE.BoxGeometry(W + 0.48, 0.22, slopeLen - 0.18),
      color: sz > 0 ? SNOW : SNOW_SHADE,
      position: [0, 0.3 + H + rise / 2 + 0.16, sz * (D / 4 + 0.25)],
      rotation: [sz * slopeAngle, 0, 0],
    })
  }

  // --- Rotes Vordach ueber dem Schalter ------------------------------------
  // Das ist das Zeichen, an dem man das Haeuschen von weitem erkennt: eine
  // kraeftige Farbflaeche, quer zur Blickrichtung, direkt vor der Tuerhoehe.
  parts.push({
    geo: new THREE.BoxGeometry(W + 0.7, 0.12, 1.5),
    color: RED,
    position: [0, 0.3 + H - 0.02, front + 0.62],
    rotation: [0.3, 0, 0],
  })
  // Zackenkante am Vordach
  for (let i = 0; i < 7; i++) {
    parts.push({
      geo: new THREE.BoxGeometry((W + 0.7) / 7 - 0.06, 0.26, 0.1),
      color: i % 2 ? RED : 0xf2f5f9,
      position: [-(W + 0.7) / 2 + ((i + 0.5) * (W + 0.7)) / 7, 0.3 + H - 0.28, front + 1.32],
    })
  }
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.075, 0.075, 2.1, 7),
      color: WOOD_LIGHT,
      position: [sx * (W / 2 + 0.2), 1.25, front + 1.2],
    })
  }

  // --- Details -------------------------------------------------------------
  // Preistafel an der Seitenwand, ein Kasten und ein Besen an der anderen.
  parts.push({ geo: new THREE.BoxGeometry(0.08, 0.9, 0.66), color: 0x2f6bd8, position: [W / 2 + 0.09, 1.5, -0.3] })
  parts.push({ geo: new THREE.BoxGeometry(0.6, 0.44, 0.5), color: WOOD_LIGHT, position: [-W / 2 - 0.45, 0.52, -0.5], rotation: [0, 0.3, 0] })
  parts.push({
    geo: new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6),
    color: WOOD_LIGHT,
    position: [-W / 2 - 0.2, 0.9, 0.4],
    rotation: [0.18, 0, -0.24],
  })

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.72 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  // --- Absperrgasse davor --------------------------------------------------
  // Zwei kurze Gitter fuehren auf den Schalter zu. Sie machen aus dem Haus
  // einen Ort, an dem man ansteht, statt eines Hauses, an dem man vorbeifaehrt.
  const rails = []
  for (const sx of [-1, 1]) {
    const bx = sx * 1.9
    for (const dz of [2.6, 4.4]) {
      rails.push({ geo: new THREE.CylinderGeometry(0.055, 0.07, 1.05, 6), color: METAL, position: [bx, 0.52, dz] })
    }
    for (const y of [0.6, 0.95]) {
      rails.push({
        geo: new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6),
        color: METAL,
        position: [bx, y, 3.5],
        rotation: [Math.PI / 2, 0, 0],
      })
    }
  }
  const railMesh = new THREE.Mesh(assemble(rails), vertexColorMaterial({ roughness: 0.5, metalness: 0.25 }))
  railMesh.castShadow = true
  group.add(railMesh)

  // --- Beschriftung ---------------------------------------------------------
  // Auf dem Vordach, nicht an der Wand: von oben liest man nur, was flach
  // liegt.
  const tex = labelTexture(label, {
    width: 512, height: 128, background: null, color: '#ffffff',
    font: '700 74px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 0.4, 0.86),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  plate.position.set(0, 0.3 + H + 0.06, front + 0.62)
  plate.rotation.x = -Math.PI / 2 + 0.3
  group.add(plate)

  // Warmes Licht im Schalter – man sieht von weitem, dass besetzt ist.
  const lamp = new THREE.PointLight(WARM, 5.5, 11, 2)
  lamp.position.set(0, 1.7, front - 0.1)
  group.add(lamp)

  return group
}
