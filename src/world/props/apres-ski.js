import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { APRES } from '../areas/apres-layout.js'
import { createSmoke } from './smoke.js'

const WOOD = 0x7b5236, WOOD_DARK = 0x54382a, WOOD_LIGHT = 0x9a6b42
const STONE = 0x6e7178, STONE_LIGHT = 0x8a8e95
const SNOW = 0xf7fbff, SNOW_SHADE = 0xdfe9f5, ICE = 0xdff3ff
const WHITE = 0xf1ede4, SHUTTER = 0x2f6b4a, GERANIUM = [0xd7263d, 0xe8452c, 0xf25c8a]

// Blockhuette auf Steinsockel nach der „Gipfelstube“-Vorlage, aber im Mass-
// stab des Tals: 5 × 3,8 m statt 12 × 9. Behalten ist, was aus 33 m Hoehe
// traegt – Giebel mit Schild, das verschneite Dach mit Wechte und Eiszapfen,
// gruene Laeden mit Geranien, Kamin mit Rauch. Krueglein, Speisekarte und
// Zapfhaehne liest man von oben nicht und sind weggelassen.
//
// Der Giebel zeigt zur Kamera, nicht die Traufe wie in der Vorlage: bei 36°
// Blick von oben verdeckte eine Traufe mit 0,55 m Ueberstand die Wand bis
// 1,78 m herab, Schild und Tuerkopf waren weg. Unter dem Giebel bleibt die
// ganze Front sichtbar.
//
// Nur das Haus: die befahrbare Terrasse und ihre beweglichen Moebel werden
// getrennt gesetzt, damit keine grosse Kollisionsscheibe den Zugang sperrt.
export function createApresSki() {
  const group = new THREE.Group()
  const parts = [], glow = [], cones = [], zapfen = []
  const { width: W, depth: D } = APRES.house
  const WALL = 2.3, PITCH = 0.52, FRONT = D / 2 + 0.17

  // --- Sockel und Blockwaende ----------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W + 0.35, 0.6, D + 0.35), color: STONE, position: [0, 0, 0] })
  for (let i = 0; i < 12; i++) {
    // Einzelne hellere Steine in der Sockelfront, sonst liest er sich als Kiste.
    const x = -W / 2 + 0.2 + i * (W - 0.4) / 11
    parts.push({ geo: new THREE.BoxGeometry(0.3 + (i % 3) * 0.08, 0.14, 0.06), color: i % 2 ? STONE_LIGHT : 0x7d8087, position: [x, 0.12 + (i % 2) * 0.1, D / 2 + 0.18] })
  }
  for (let i = 0; i < 8; i++) {
    const y = 0.45 + i * 0.26
    // Front- und Rueckwand mit vorstehenden Balkenkoepfen an den Ecken –
    // das macht aus der Kiste ein Blockhaus.
    for (const sz of [-1, 1]) {
      parts.push({ geo: new THREE.CylinderGeometry(0.15, 0.15, W + 0.5, 7), color: i % 2 ? WOOD : WOOD_LIGHT, position: [0, y, sz * (D / 2)], rotation: [0, 0, Math.PI / 2] })
    }
    for (const sx of [-1, 1]) {
      parts.push({ geo: new THREE.CylinderGeometry(0.15, 0.15, D + 0.5, 7), color: i % 2 ? WOOD_LIGHT : WOOD, position: [sx * (W / 2), y + 0.13, 0], rotation: [Math.PI / 2, 0, 0] })
    }
  }

  // --- Giebel und Dach -----------------------------------------------------
  const rise = (W / 2) * Math.tan(PITCH)
  const gable = new THREE.Shape()
  gable.moveTo(-W / 2, 0)
  gable.lineTo(W / 2, 0)
  gable.lineTo(0, rise)
  gable.closePath()
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false }), color: WOOD_DARK, position: [0, WALL, sz * (D / 2) - 0.06] })
  }
  // Senkrechte Bretter im Giebel, damit er nicht als flaches Dreieck liest.
  for (let i = -3; i <= 3; i++) {
    const x = i * 0.34, h = rise * (1 - Math.abs(x) / (W / 2)) - 0.08
    if (h > 0.15) parts.push({ geo: new THREE.BoxGeometry(0.05, h, 0.03), color: 0x46301f, position: [x, WALL + h / 2, D / 2 + 0.08] })
  }
  const run = W / 2 + 0.45, len = D + 0.7
  const slope = Math.hypot(run, run * Math.tan(PITCH))
  for (const sx of [-1, 1]) {
    const nx = sx * Math.sin(PITCH), ny = Math.cos(PITCH)
    const cx = sx * run / 2, cy = WALL + rise - (run / 2) * Math.tan(PITCH)
    parts.push({ geo: new THREE.BoxGeometry(slope, 0.14, len), color: WOOD_DARK, position: [cx + nx * 0.07, cy + ny * 0.07, 0], rotation: [0, 0, -sx * PITCH] })
    // Dicke Schneeauflage – die Flaeche, an der man das Haus von oben erkennt.
    parts.push({ geo: new THREE.BoxGeometry(slope - 0.05, 0.3, len - 0.06), color: sx > 0 ? SNOW : SNOW_SHADE, position: [cx + nx * 0.29, cy + ny * 0.29, 0], rotation: [0, 0, -sx * PITCH] })
    // Wechte an der Traufe und Eiszapfen darunter.
    const ex = sx * run * 0.98, ey = WALL + rise - run * 0.98 * Math.tan(PITCH)
    parts.push({ geo: new THREE.CylinderGeometry(0.17, 0.17, len - 0.1, 8), color: SNOW, position: [ex + nx * 0.2, ey + ny * 0.2, 0], rotation: [Math.PI / 2, 0, 0] })
    // Auf der rechten Seite, die man sieht, haengen sie fuer sich
    // (props/eiszapfen.js): wer an der Wand entlangfaehrt, bricht sie ab.
    if (sx > 0) {
      for (let i = 0; i < 16; i++) {
        if (i % 5 === 3) continue
        zapfen.push({ x: ex, y: ey + 0.02, z: -len / 2 + 0.2 + i * (len - 0.4) / 15, l: 0.28 + ((i * 37) % 11) / 22 })
      }
      continue
    }
    for (let i = 0; i < 13; i++) {
      if ((i * 7 + (sx > 0 ? 3 : 0)) % 5 === 0) continue
      const l = 0.18 + ((i * 37) % 11) / 30
      const cone = new THREE.ConeGeometry(0.045, l, 5)
      cone.rotateX(Math.PI)
      parts.push({ geo: cone, color: ICE, position: [ex, ey - l / 2 + 0.02, -len / 2 + 0.25 + i * (len - 0.5) / 12] })
    }
  }
  // Firstbalken mit vorstehenden Enden.
  parts.push({ geo: new THREE.CylinderGeometry(0.13, 0.13, len + 0.4, 8), color: WOOD_DARK, position: [0, WALL + rise + 0.24, 0], rotation: [Math.PI / 2, 0, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.15, 0.15, len - 0.1, 8), color: SNOW, position: [0, WALL + rise + 0.36, 0], rotation: [Math.PI / 2, 0, 0] })

  // Steinkamin hinten auf der rechten Dachseite.
  const chimney = [1.05, -0.9]
  const roofAt = WALL + rise - chimney[0] * Math.tan(PITCH)
  parts.push({ geo: new THREE.BoxGeometry(0.5, 1.3, 0.5), color: STONE, position: [chimney[0], roofAt + 0.45, chimney[1]] })
  parts.push({ geo: new THREE.BoxGeometry(0.66, 0.1, 0.66), color: WOOD_DARK, position: [chimney[0], roofAt + 1.13, chimney[1]] })
  parts.push({ geo: new THREE.BoxGeometry(0.6, 0.14, 0.6), color: SNOW, position: [chimney[0], roofAt + 1.25, chimney[1]] })

  // --- Front: Tuer, zwei Fenster mit Laeden und Geranien ------------------
  parts.push({ geo: new THREE.BoxGeometry(0.92, 1.72, 0.08), color: 0x5b3a20, position: [0, 0.3 + 0.86, FRONT] })
  for (const x of [-0.24, 0, 0.24]) parts.push({ geo: new THREE.BoxGeometry(0.03, 1.6, 0.03), color: WOOD_DARK, position: [x, 1.16, FRONT + 0.05] })
  parts.push({ geo: new THREE.BoxGeometry(1.12, 0.12, 0.12), color: WOOD_DARK, position: [0, 2.08, FRONT + 0.02] })
  for (const sx of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.1, 1.8, 0.12), color: WOOD_DARK, position: [sx * 0.52, 1.18, FRONT + 0.02] })
  parts.push({ geo: new THREE.SphereGeometry(0.045, 6, 4), color: 0xd7b678, position: [0.3, 1.15, FRONT + 0.07] })
  for (const sx of [-1, 1]) {
    const x = sx * 1.6, y = 1.32
    glow.push({ geo: new THREE.BoxGeometry(0.66, 0.66, 0.04), color: 0xffc46e, position: [x, y, FRONT] })
    for (const [w, h, dx, dy] of [[0.8, 0.08, 0, 0.37], [0.8, 0.08, 0, -0.37], [0.08, 0.82, 0.37, 0], [0.08, 0.82, -0.37, 0], [0.05, 0.7, 0, 0], [0.7, 0.05, 0, 0.04]]) {
      parts.push({ geo: new THREE.BoxGeometry(w, h, 0.06), color: WHITE, position: [x + dx, y + dy, FRONT + 0.04] })
    }
    for (const side of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.34, 0.82, 0.05), color: SHUTTER, position: [x + side * 0.6, y, FRONT + 0.03] })
      parts.push({ geo: new THREE.BoxGeometry(0.05, 0.62, 0.02), color: WHITE, position: [x + side * 0.6, y, FRONT + 0.065], rotation: [0, 0, side * 0.45] })
    }
    // Blumenkasten: eine Reihe roter Geranien, von oben ein Farbtupfer unter
    // jedem Fenster.
    parts.push({ geo: new THREE.BoxGeometry(0.86, 0.18, 0.24), color: WOOD, position: [x, y - 0.5, FRONT + 0.14] })
    for (let i = 0; i < 6; i++) {
      parts.push({ geo: new THREE.SphereGeometry(0.075 + (i % 2) * 0.02, 6, 4), color: GERANIUM[(i + (sx > 0 ? 1 : 0)) % 3], position: [x - 0.34 + i * 0.136, y - 0.36 + (i % 2) * 0.03, FRONT + 0.15 + (i % 3 - 1) * 0.04] })
      parts.push({ geo: new THREE.SphereGeometry(0.06, 5, 3), color: SHUTTER, position: [x - 0.3 + i * 0.12, y - 0.42, FRONT + 0.25] })
    }
  }
  // Laterne neben der Tuer.
  parts.push({ geo: new THREE.BoxGeometry(0.2, 0.28, 0.2), color: 0x18191c, position: [0.78, 1.95, FRONT + 0.14] })
  glow.push({ geo: new THREE.BoxGeometry(0.13, 0.18, 0.21), color: 0xffcf7a, position: [0.78, 1.95, FRONT + 0.14] })

  // Holzstapel an der linken Seitenwand, unter dem Vordach – zum Sonnendeck.
  for (let i = 0; i < 15; i++) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.11, 0.11, 0.7, 6),
      color: i % 3 === 0 ? WOOD_LIGHT : 0x6a4630,
      position: [-W / 2 - 0.42, 0.42 + Math.floor(i / 5) * 0.21, -1.2 + (i % 5) * 0.23 + (Math.floor(i / 5) % 2) * 0.1],
      rotation: [0, 0, Math.PI / 2],
    })
  }
  parts.push({ geo: new THREE.BoxGeometry(0.7, 0.07, 1.15), color: SNOW, position: [-W / 2 - 0.42, 0.98, -0.6] })

  // Zwei Boxen an den vorderen Ecken. Sie pumpen sachte – zu hoeren ist
  // nichts, das Tal bleibt still. Seit 04.10. groesser (0,9 × 1,7 statt
  // 0,62 × 1,15) und mit leuchtendem Ring um den Bass: aus 33 m waren sie
  // zwei dunkle Kisten neben der Tuer.
  const BOX = { w: 0.9, h: 1.7, d: 0.7 }
  const boxZ = D / 2 + 0.2 + BOX.d / 2 - 0.25
  for (const sx of [-1, 1]) {
    const x = sx * (W / 2 + 0.6)
    parts.push({ geo: new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d), color: 0x262c2f, position: [x, 0.3 + BOX.h / 2, boxZ] })
    // Kanten in Metall, damit die Kiste von oben eine Form hat.
    for (const y of [0.3 + 0.03, 0.3 + BOX.h - 0.03]) {
      parts.push({ geo: new THREE.BoxGeometry(BOX.w + 0.04, 0.06, BOX.d + 0.04), color: 0x8c979c, position: [x, y, boxZ] })
    }
    parts.push({ geo: new THREE.BoxGeometry(BOX.w + 0.02, 0.08, BOX.d + 0.02), color: SNOW, position: [x, 0.3 + BOX.h + 0.07, boxZ] })
    for (const [y, r] of [[0.3 + 0.55, 0.32], [0.3 + 1.28, 0.15]]) {
      parts.push({ geo: new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.04, 18), color: 0x616c70, position: [x, y, boxZ + BOX.d / 2 + 0.01], rotation: [Math.PI / 2, 0, 0] })
      cones.push({ geo: new THREE.CylinderGeometry(r, r * 0.45, 0.08, 18), color: 0x11191d, position: [x, y, 0.04], rotation: [Math.PI / 2, 0, 0] })
    }
    // Leuchtring um den Bass und ein Streifen oben – die Farbe der Lichterkette.
    const ring = new THREE.TorusGeometry(0.39, 0.035, 6, 24)
    glow.push({ geo: ring, color: sx > 0 ? 0xff4fa3 : 0x3fd6ff, position: [x, 0.3 + 0.55, boxZ + BOX.d / 2 + 0.03] })
    glow.push({ geo: new THREE.BoxGeometry(BOX.w - 0.16, 0.05, 0.02), color: sx > 0 ? 0xff4fa3 : 0x3fd6ff, position: [x, 0.3 + BOX.h - 0.15, boxZ + BOX.d / 2 + 0.01] })
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.8 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  // Fensterlicht und Laterne unbeleuchtet: ein Punktlicht kostete jedes Pixel.
  group.add(new THREE.Mesh(assemble(glow), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })))
  // Die Membranen liegen ab z = 0 ihres eigenen Meshes, damit ein Skalieren
  // in z sie aus der Schallwand drueckt, ohne sie zu verschieben.
  const membranes = new THREE.Mesh(assemble(cones), vertexColorMaterial({ roughness: 0.6 }))
  membranes.position.z = boxZ + BOX.d / 2 - 0.02
  group.add(membranes)

  group.add(createSign(WALL))
  // Lokale Lage der abbrechbaren Eiszapfen (Oberkante, Laenge).
  group.userData.zapfen = zapfen

  const smoke = createSmoke({ scale: 0.8, rate: 0.4 })
  smoke.position.set(chimney[0], roofAt + 1.5, chimney[1])
  group.add(smoke)
  group.userData.animate = t => {
    smoke.userData.animate(t)
    // 2 Schlaege pro Sekunde, wie ein langsamer Bass.
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 4)), 6)
    membranes.scale.z = 1 + beat * 0.8
  }
  return group
}

// Grosses Schild im Giebel. Es haengt unterhalb der Dachkante: bei 0,35 m
// Giebelueberstand verdeckt das Dach aus der Spielkamera die Wand erst
// 0,25 m unter der Dachlinie, die oberen Ecken bleiben damit frei.
function createSign(wall) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 144
  const g = canvas.getContext('2d')
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#432a17' : '#3d2614'
    g.fillRect(0, i * 36, 512, 36)
  }
  g.strokeStyle = '#d9c39a'
  g.lineWidth = 7
  g.strokeRect(10, 10, 492, 124)
  g.fillStyle = '#f4e4c2'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 78px Rockwell, "Roboto Slab", "Courier New", Georgia, serif'
  g.fillText('APRÈS-SKI', 256, 78, 460)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.62), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }))
  sign.position.set(0, wall + 0.2, APRES.house.depth / 2 + 0.17)
  return sign
}
