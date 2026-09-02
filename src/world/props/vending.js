import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Skikasse: ein Automat, wie er an Talstationen steht. Zwei beleuchtete Tasten
// fuehren zu zwei verschiedenen Zielen – rechts und links am Geraet.

const BODY = 0x3a4a5e
const BODY_DARK = 0x2a3849
const TRIM = 0xb9c2cc
const SNOW = 0xf7fbff
const SCREEN = 0x16202b

export function createVendingMachine({ leftColor = 0x2b8ce6, rightColor = 0x9945ff } = {}) {
  const group = new THREE.Group()
  const parts = []

  // Die Kamera blickt aus etwa 36 Grad von oben. Damit das Pult ihr flach
  // zugewandt ist, muss seine Normale genau so weit ueber dem Horizont stehen.
  // Alles Lesbare sitzt auf dieser Flaeche statt auf einer senkrechten Front.
  const TILT = 0.62          // rad, Neigung der Pultflaeche
  const PANEL_Y = 1.5
  const PANEL_Z = 0.16
  const PANEL_FACE = 0.26    // Vorderseite des Keils in Panel-Koordinaten

  // Fundament im Schnee
  parts.push({ geo: new THREE.BoxGeometry(1.5, 0.24, 1.1), color: 0x8e969f, position: [0, 0.12, 0] })

  // Korpus
  parts.push({ geo: new THREE.BoxGeometry(1.28, 1.15, 0.78), color: BODY, position: [0, 0.8, 0] })
  parts.push({ geo: new THREE.BoxGeometry(1.32, 0.1, 0.82), color: BODY_DARK, position: [0, 0.3, 0] })

  // Pultaufsatz: Keil, dessen Oberseite dem Betrachter zugeneigt ist.
  parts.push({
    geo: new THREE.BoxGeometry(1.28, 0.62, 0.5),
    color: BODY_DARK,
    position: [0, PANEL_Y, PANEL_Z],
    rotation: [-TILT, 0, 0],
  })
  // Seitenwangen schliessen den Keil.
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.06, 0.55, 0.6),
      color: BODY,
      position: [sx * 0.63, 1.42, 0.1],
    })
  }

  // Schmale Blende oben, damit kein Schnee auf das Pult faellt.
  parts.push({ geo: new THREE.BoxGeometry(1.36, 0.09, 0.22), color: TRIM, position: [0, 1.76, -0.16] })
  parts.push({ geo: new THREE.BoxGeometry(1.36, 0.08, 0.24), color: SNOW, position: [0, 1.83, -0.17] })

  // Muenzschlitz und Ausgabefach an der Front
  parts.push({ geo: new THREE.BoxGeometry(0.5, 0.22, 0.06), color: 0x11161c, position: [0, 0.62, 0.4] })
  parts.push({ geo: new THREE.BoxGeometry(0.56, 0.05, 0.09), color: TRIM, position: [0, 0.51, 0.41] })
  parts.push({ geo: new THREE.BoxGeometry(0.04, 0.16, 0.05), color: 0x11161c, position: [0.46, 1.0, 0.4] })

  // Fuesse
  for (const sx of [-0.52, 0.52]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.2, 6), color: 0x555f6b, position: [sx, 0.22, 0.26] })
  }

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.55, metalness: 0.15 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Pultflaeche: Display oben, Tasten unten ----------------------------
  // Die Gruppe traegt bereits die Neigung. Alles darin liegt deshalb in ihrer
  // XY-Ebene, +Z ist die Flaechennormale – keine zweite Rotation noetig.
  const panel = new THREE.Group()
  panel.position.set(0, PANEL_Y, PANEL_Z)
  panel.rotation.x = -TILT
  group.add(panel)

  const screenTex = labelTexture('SKIKASSE', {
    width: 512, height: 200, background: '#16202b', color: '#8fe3ff',
    sub: 'bitte waehlen', subColor: '#5f93ad',
    font: '700 92px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.94, 0.34),
    new THREE.MeshStandardMaterial({
      map: screenTex,
      emissive: 0xffffff,
      emissiveMap: screenTex,
      emissiveIntensity: 0.6,
      roughness: 0.25,
      color: SCREEN,
    }),
  )
  screen.position.set(0, 0.13, PANEL_FACE + 0.005)
  panel.add(screen)

  // Rahmen um das Display
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.02, 0.42, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x10161d, roughness: 0.5, flatShading: true }),
  )
  bezel.position.set(0, 0.13, PANEL_FACE - 0.012)
  panel.add(bezel)

  const buttons = []
  const buttonGeo = new THREE.CylinderGeometry(0.115, 0.125, 0.075, 14)
  const ringGeo = new THREE.TorusGeometry(0.145, 0.02, 6, 16)
  for (const [i, color] of [leftColor, rightColor].entries()) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.5,
      roughness: 0.35,
      flatShading: true,
    })
    const btn = new THREE.Mesh(buttonGeo, mat)
    // Zylinderachse senkrecht auf die Pultflaeche stellen.
    btn.rotation.x = Math.PI / 2
    btn.position.set(i === 0 ? -0.3 : 0.3, -0.15, PANEL_FACE + 0.03)
    btn.castShadow = true
    panel.add(btn)
    buttons.push({ mesh: btn, material: mat, base: 0.5 })

    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshStandardMaterial({ color: TRIM, roughness: 0.4, metalness: 0.5, flatShading: true }),
    )
    ring.position.set(btn.position.x, -0.15, PANEL_FACE + 0.01)
    panel.add(ring)
  }

  group.userData.animate = (t) => {
    // Die Tasten atmen abwechselnd – lockt den Blick, ohne zu blinken.
    buttons.forEach((b, i) => {
      b.material.emissiveIntensity = b.base + Math.sin(t * 1.7 + i * Math.PI) * 0.35
    })
  }
  group.userData.buttons = buttons

  return group
}
