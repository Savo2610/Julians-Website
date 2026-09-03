import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'
import { createSmoke } from './smoke.js'

// Die Apres-Ski-Huette am Kopf des Funparks: ein kleines Haus mit einer
// grossen Sonnenterrasse davor.
//
// Von oben sieht man von einem Haus fast nur das Dach – ein Haus allein waere
// hier ein brauner Fleck. Die Terrasse ist deshalb das eigentliche Objekt:
// eine offene Holzflaeche mit Tischen, Baenken, zwei Schirmen und einer
// Lichterkette. Alles daran liegt flach und ist damit lesbar.
//
// Der Ort ist bewusst der einzige in der Umgebung, an dem nichts passiert.
// Oben am Park, direkt neben der Einfahrt, soll man stehenbleiben duerfen.

const WOOD = 0x7b5236
const WOOD_DARK = 0x54382a
const WOOD_LIGHT = 0x9a6b42
const PLANK = 0x8a6039
const STONE = 0x6e7178
const SNOW = 0xf7fbff
const SNOW_SHADE = 0xdfe9f5
const RED = 0xc8402f
const CREAM = 0xf2e9d8
const GREEN = 0x2f7a52

export function createApresSki({ label = 'APRES-SKI' } = {}) {
  const group = new THREE.Group()
  const parts = []

  const W = 4.0    // Breite des Hauses
  const D = 3.0    // Tiefe
  const H = 2.05   // Wandhoehe
  const DECK_D = 4.6   // Tiefe der Terrasse vor dem Haus
  const DECK_W = 6.2
  const DECK_Y = 0.55  // Hoehe der Terrassenflaeche ueber dem Ansatzpunkt

  // --- Terrasse -----------------------------------------------------------
  // Sie steht auf Stuetzen, weil der Hang unter ihr weiterlaeuft. Ohne die
  // Stuetzen schwebt eine waagerechte Platte ueber schraegem Boden, und das
  // sieht man sofort.
  const deckFront = D / 2 + DECK_D
  for (let i = 0; i < 13; i++) {
    // Einzelne Bohlen statt einer Platte: die Fugen geben der Flaeche von
    // oben eine Richtung.
    parts.push({
      geo: new THREE.BoxGeometry(DECK_W, 0.1, DECK_D / 13 - 0.03),
      color: i % 2 ? PLANK : WOOD_LIGHT,
      position: [0, DECK_Y, D / 2 + (i + 0.5) * (DECK_D / 13)],
    })
  }
  // Traeger und Stuetzen
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.16, 0.26, DECK_D),
      color: WOOD_DARK,
      position: [sx * (DECK_W / 2 - 0.08), DECK_Y - 0.16, D / 2 + DECK_D / 2],
    })
    for (const dz of [D / 2 + 0.8, deckFront - 0.4]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.11, 0.13, 1.5, 7),
        color: WOOD_DARK,
        position: [sx * (DECK_W / 2 - 0.25), DECK_Y - 0.9, dz],
      })
    }
  }
  parts.push({
    geo: new THREE.BoxGeometry(DECK_W, 0.2, 0.18),
    color: WOOD_DARK,
    position: [0, DECK_Y - 0.14, deckFront - 0.09],
  })

  // Gelaender: Pfosten und zwei Riegel, an drei Seiten. Vorn bleibt eine
  // Luecke, damit man mit Ski hinaufkommt.
  const railPost = (x, z) => {
    parts.push({ geo: new THREE.BoxGeometry(0.12, 0.9, 0.12), color: WOOD_DARK, position: [x, DECK_Y + 0.5, z] })
  }
  for (const sx of [-1, 1]) {
    for (let i = 0; i <= 3; i++) railPost(sx * (DECK_W / 2 - 0.1), D / 2 + 0.3 + (i * (DECK_D - 0.6)) / 3)
    for (const y of [0.35, 0.78]) {
      parts.push({
        geo: new THREE.BoxGeometry(0.08, 0.1, DECK_D - 0.5),
        color: WOOD_LIGHT,
        position: [sx * (DECK_W / 2 - 0.1), DECK_Y + y, D / 2 + DECK_D / 2],
      })
    }
  }
  // Vordere Bruestung nur an den Aussenseiten – in der Mitte der Aufgang.
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(1.9, 0.1, 0.08),
      color: WOOD_LIGHT,
      position: [sx * (DECK_W / 2 - 1.05), DECK_Y + 0.78, deckFront - 0.12],
    })
    railPost(sx * (DECK_W / 2 - 2.0), deckFront - 0.12)
  }
  // Zwei Stufen in der Luecke
  for (let i = 0; i < 2; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(1.5, 0.12, 0.45),
      color: WOOD_DARK,
      position: [0, DECK_Y - 0.16 - i * 0.22, deckFront + 0.2 + i * 0.42],
    })
  }

  // --- Haus ---------------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W + 0.4, 0.4, D + 0.4), color: STONE, position: [0, DECK_Y - 0.2, 0] })
  for (let i = 0; i < 7; i++) {
    const y = DECK_Y + 0.2 + i * ((H - 0.2) / 7)
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.15, 0.15, W, 7),
        color: i % 2 ? WOOD : WOOD_LIGHT,
        position: [0, y, sz * (D / 2)],
        rotation: [0, 0, Math.PI / 2],
      })
    }
    for (const sx of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.15, 0.15, D, 7),
        color: i % 2 ? WOOD_LIGHT : WOOD,
        position: [sx * (W / 2), y + 0.08, 0],
        rotation: [Math.PI / 2, 0, 0],
      })
    }
  }

  // Giebel und Satteldach mit dicker Schneeauflage – das ist die Flaeche,
  // an der man das Haus von oben erkennt.
  const rise = 1.15
  const gable = new THREE.Shape()
  gable.moveTo(-W / 2 - 0.05, 0)
  gable.lineTo(W / 2 + 0.05, 0)
  gable.lineTo(0, rise)
  gable.closePath()
  for (const sz of [-1, 1]) {
    parts.push({
      geo: new THREE.ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false }),
      color: WOOD_DARK,
      position: [0, DECK_Y + H, sz * (D / 2) - 0.06],
    })
  }
  const roofLen = Math.hypot(W / 2 + 0.45, rise)
  const roofAngle = Math.atan2(rise, W / 2 + 0.45)
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(roofLen, 0.13, D + 0.9),
      color: WOOD_DARK,
      position: [sx * (W / 4 + 0.2), DECK_Y + H + rise / 2, 0],
      rotation: [0, 0, sx * -roofAngle],
    })
    parts.push({
      geo: new THREE.BoxGeometry(roofLen - 0.12, 0.24, D + 0.82),
      color: sx > 0 ? SNOW : SNOW_SHADE,
      position: [sx * (W / 4 + 0.2), DECK_Y + H + rise / 2 + 0.18, 0],
      rotation: [0, 0, sx * -roofAngle],
    })
  }

  // Fenster mit warmem Licht und eine Tuer zur Terrasse.
  parts.push({ geo: new THREE.BoxGeometry(1.5, 0.95, 0.1), color: 0xffce7a, position: [-0.9, DECK_Y + 1.3, D / 2 + 0.03] })
  parts.push({ geo: new THREE.BoxGeometry(1.62, 1.07, 0.06), color: WOOD_DARK, position: [-0.9, DECK_Y + 1.3, D / 2 - 0.01] })
  parts.push({ geo: new THREE.BoxGeometry(0.95, 1.75, 0.1), color: WOOD_DARK, position: [1.1, DECK_Y + 0.9, D / 2 + 0.03] })

  // Schornstein
  parts.push({
    geo: new THREE.BoxGeometry(0.42, 1.0, 0.42),
    color: STONE,
    position: [-1.3, DECK_Y + H + 0.75, -0.6],
  })

  // Holzstapel an der Seitenwand
  for (let i = 0; i < 9; i++) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6),
      color: i % 3 === 0 ? WOOD_LIGHT : WOOD_DARK,
      position: [-W / 2 - 0.28, DECK_Y + 0.12 + Math.floor(i / 3) * 0.19, -0.5 + (i % 3) * 0.2],
      rotation: [0, 0, Math.PI / 2],
    })
  }

  // --- Moebel auf der Terrasse ---------------------------------------------
  // Drei Tische mit Baenken. Runde Platten lesen sich von oben sofort als
  // Tisch; ein Quadrat waere hier nur ein weiterer Kasten.
  const tables = [
    [-1.9, D / 2 + 1.5], [1.9, D / 2 + 1.4], [0.0, D / 2 + 3.3],
  ]
  for (const [tx, tz] of tables) {
    parts.push({ geo: new THREE.CylinderGeometry(0.62, 0.62, 0.09, 12), color: CREAM, position: [tx, DECK_Y + 0.78, tz] })
    parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.13, 0.72, 8), color: WOOD_DARK, position: [tx, DECK_Y + 0.4, tz] })
    for (const sx of [-1, 1]) {
      parts.push({
        geo: new THREE.BoxGeometry(1.25, 0.09, 0.34),
        color: WOOD_LIGHT,
        position: [tx, DECK_Y + 0.45, tz + sx * 0.95],
      })
      for (const px of [-0.45, 0.45]) {
        parts.push({
          geo: new THREE.BoxGeometry(0.09, 0.42, 0.09),
          color: WOOD_DARK,
          position: [tx + px, DECK_Y + 0.24, tz + sx * 0.95],
        })
      }
    }
  }

  // Zwei Sonnenschirme. Sie sind das Erkennungszeichen der Terrasse: zwei
  // kraeftige Scheiben in einer sonst weissen Gegend.
  const parasols = [[-1.9, D / 2 + 1.5], [0.0, D / 2 + 3.3]]
  for (const [px, pz] of parasols) {
    parts.push({ geo: new THREE.CylinderGeometry(0.055, 0.055, 2.5, 7), color: CREAM, position: [px, DECK_Y + 1.25, pz] })
    // Der Schirm als Kegel mit acht Bahnen abwechselnd rot und creme.
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2
      parts.push({
        geo: new THREE.CylinderGeometry(0.05, 1.35, 0.42, 3, 1, false, a0, Math.PI / 4),
        color: i % 2 ? RED : CREAM,
        position: [px, DECK_Y + 2.32, pz],
      })
    }
  }

  // Ein paar angelehnte Ski und Stoecke am Gelaender.
  for (const [i, sx] of [-2.4, -2.1, 2.2, 2.5].entries()) {
    parts.push({
      geo: new THREE.BoxGeometry(0.1, 1.6, 0.03),
      color: [RED, 0xf2c53d, GREEN, 0x2f6bd8][i],
      position: [sx, DECK_Y + 0.85, deckFront - 0.35],
      rotation: [0.22, 0, i % 2 ? 0.1 : -0.1],
    })
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.76 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  // --- Lichterkette --------------------------------------------------------
  // Zwei Ketten ueber die Terrasse. Sie sind unbeleuchtet gezeichnet, damit
  // sie wirklich leuchten, und haengen in einer Kettenlinie durch.
  const bulbs = []
  const dummy = new THREE.Object3D()
  const bulbGeo = new THREE.SphereGeometry(0.075, 6, 5)
  const chain = new THREE.InstancedMesh(
    bulbGeo,
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    30,
  )
  chain.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(30 * 3), 3)
  const warm = new THREE.Color(0xffc46b)
  const cool = new THREE.Color(0xff8a5c)
  let n = 0
  for (const [az, height] of [[D / 2 + 1.0, 2.5], [D / 2 + 3.6, 2.35]]) {
    for (let i = 0; i < 15; i++) {
      const u = i / 14
      const x = -(DECK_W / 2 - 0.2) + u * (DECK_W - 0.4)
      const sag = Math.sin(u * Math.PI) * 0.32
      dummy.position.set(x, DECK_Y + height - sag, az)
      dummy.updateMatrix()
      chain.setMatrixAt(n, dummy.matrix)
      const c = i % 2 ? warm : cool
      chain.instanceColor.setXYZ(n, c.r, c.g, c.b)
      n++
    }
  }
  chain.instanceMatrix.needsUpdate = true
  chain.instanceColor.needsUpdate = true
  group.add(chain)
  // Die Traegerpfosten der Ketten
  const poles = []
  for (const sx of [-1, 1]) {
    poles.push({
      geo: new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6),
      color: WOOD_DARK,
      position: [sx * (DECK_W / 2 - 0.1), DECK_Y + 1.3, deckFront - 0.4],
    })
  }
  group.add(new THREE.Mesh(assemble(poles), vertexColorMaterial({ roughness: 0.7 })))

  const lamp = new THREE.PointLight(0xffb066, 7, 14, 2)
  lamp.position.set(0, DECK_Y + 2.2, D / 2 + 2.2)
  group.add(lamp)

  // --- Rauch ---------------------------------------------------------------
  const smoke = createSmoke({ scale: 1.0, rate: 0.4 })
  smoke.position.set(-1.3, DECK_Y + H + 1.5, -0.6)
  group.add(smoke)

  // --- Schild --------------------------------------------------------------
  // Nicht an der Wand ueber der Tuer: der Dachueberstand liegt bei diesem
  // Kamerawinkel genau davor und verdeckt jede Schrift, die dort haengt.
  // Stattdessen eine Tafel vorn auf der Terrasse, zur Kamera geneigt – so
  // steht der Name frei im Bild.
  const SIGN_X = 2.15
  const SIGN_Z = D / 2 + 3.95
  const stand = []
  for (const sx of [-1, 1]) {
    stand.push({
      geo: new THREE.CylinderGeometry(0.055, 0.055, 1.25, 6),
      color: WOOD_DARK,
      position: [SIGN_X + sx * 0.72, DECK_Y + 0.62, SIGN_Z],
    })
  }
  stand.push({
    geo: new THREE.BoxGeometry(1.9, 0.72, 0.09),
    color: WOOD_DARK,
    position: [SIGN_X, DECK_Y + 1.32, SIGN_Z],
    rotation: [-0.5, 0, 0],
  })
  const board = new THREE.Mesh(assemble(stand), vertexColorMaterial({ roughness: 0.8 }))
  board.castShadow = true
  group.add(board)

  const tex = labelTexture(label, {
    width: 512, height: 160, background: null, color: '#f7e6c8',
    font: '700 84px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 0.56),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  plate.position.set(SIGN_X, DECK_Y + 1.34, SIGN_Z + 0.07)
  plate.rotation.x = -0.5
  group.add(plate)

  group.userData.animate = (t) => {
    smoke.userData.animate(t)
    // Die Lichterkette atmet leicht – sonst sieht sie aus wie aufgemalt.
    const g = 0.75 + 0.25 * Math.sin(t * 1.4)
    chain.material.color.setScalar(g)
  }

  return group
}
