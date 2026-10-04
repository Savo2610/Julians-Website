import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Aufbauten im Funpark. Die Schanzen und Wellen selbst sind Gelaende – hier
// stehen nur die Dinge, die aus Metall und Holz sind: das Rail auf der
// Schneekante, das Eingangsschild, die Polster an den Figuren und an den
// Absprungkanten die blauen Linien mit je zwei Beachflags.

const STEEL = 0x9aa4ae
const STEEL_DARK = 0x5d666f
const WOOD = 0x7a5636
const PAD_A = 0xe0662f
const PAD_B = 0x2f6bd8

// Rail: ein Rohr auf zwei Boecken. Es steht auf der Schneekante, laeuft also
// laengs zur Fahrtrichtung.
export function createRail({ length = 8, height = 0.52 } = {}) {
  const group = new THREE.Group()
  const parts = []

  parts.push({
    geo: new THREE.CylinderGeometry(0.075, 0.075, length, 10),
    color: STEEL,
    position: [0, height, 0],
    rotation: [Math.PI / 2, 0, 0],
  })
  // Kappen, damit die Rohrenden nicht offen wirken
  for (const s of [-1, 1]) {
    parts.push({
      geo: new THREE.SphereGeometry(0.078, 8, 6),
      color: STEEL_DARK,
      position: [0, height, s * length / 2],
    })
  }
  // Boecke
  for (const t of [-0.34, 0, 0.34]) {
    const z = t * length
    for (const sx of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.05, 0.06, height * 1.12, 6),
        color: STEEL_DARK,
        position: [sx * 0.17, height * 0.52, z],
        rotation: [0, 0, sx * 0.28],
      })
    }
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.4, metalness: 0.25 }))
  mesh.castShadow = true
  group.add(mesh)
  return group
}

// Gepolsterter Marker: kurzer Pfahl mit Schaumstoffhuelle, wie sie an
// Parkfiguren stehen. Zwei Farben im Wechsel.
// Box: eine Holzplatte mit Stahlkanten auf der Schneeaufschuettung. Sie liegt
// laengs zur Fahrtrichtung wie das Rail, ist aber breit genug, dass man quer
// darauf stehen kann – das ist der Unterschied zwischen Box und Rail.
//
// Die Schneeform darunter kommt aus dem Hoehenfeld; hier liegt nur die
// Oberflaeche. Deshalb sitzt die Platte knapp ueber Null und nicht auf
// Stuetzen: sie deckt die Kante ab, statt darueber zu schweben.
//
// `boden(x, z)` (lokal, Mitte = 0) gibt an, wie hoch das Dach der
// Aufschuettung dort gegen die Mitte liegt. Das Band darunter ist nicht
// gerade – am unteren Ende des Parks wird es flacher –, und ein gerades Brett
// steckte dort mit dem oberen Ende 15 cm im Schnee. Mit `boden` folgt jede
// Bohle und jede Stahlkante dem Dach.
export function createParkBox({ length = 7, width = 1.5, color = PAD_A, boden = null } = {}) {
  const group = new THREE.Group()
  const parts = []

  // Deck aus Bohlen quer zur Fahrtrichtung – die Fugen zeigen von oben die
  // Laufrichtung an.
  const planks = Math.max(4, Math.round(length / 0.55))
  for (let i = 0; i < planks; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(width, 0.09, length / planks - 0.035),
      color: i % 2 ? WOOD : 0x8d6540,
      position: [0, 0.045, -length / 2 + (i + 0.5) * (length / planks)],
    })
  }
  // Stahlkanten laengs: sie machen aus dem Holzsteg eine Box.
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.09, 0.15, length, 1, 1, Math.max(1, Math.round(length / 0.5))),
      color: STEEL,
      position: [sx * (width / 2 + 0.02), 0.06, 0],
    })
  }
  // Farbige Stirnbretter an beiden Enden – von oben der Hinweis, wo sie
  // anfaengt und aufhoert.
  for (const sz of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(width + 0.2, 0.16, 0.12),
      color,
      position: [0, 0.05, sz * (length / 2 + 0.05)],
    })
  }

  const geo = assemble(parts)
  if (boden) {
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + boden(p.getX(i), p.getZ(i)))
    geo.computeVertexNormals()
  }
  const mesh = new THREE.Mesh(geo, vertexColorMaterial({ roughness: 0.6 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return group
}

// Die Absprungkante als blaue Linie quer ueber die Schanze, wie die Kante
// beim Weitsprung. Vorher standen dort zwei blaue Kloetze an den Enden; sie
// sagten, wie breit die Kante ist, aber nicht, wo genau sie liegt – und sie
// sahen aus wie Kisten. `punkte` sind Weltpunkte [x, y, z] auf dem Schnee
// quer ueber die Kante, die Linie liegt in kurzen Stuecken darauf.
export function createLipLine(punkte, color = PAD_B) {
  const parts = []
  for (let i = 1; i < punkte.length; i++) {
    const [ax, ay, az] = punkte[i - 1]
    const [bx, by, bz] = punkte[i]
    const len = Math.hypot(bx - ax, by - ay, bz - az)
    const geo = new THREE.BoxGeometry(len + 0.02, 0.04, 0.28)
    geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(Math.atan2(by - ay, Math.hypot(bx - ax, bz - az))))
    geo.applyMatrix4(new THREE.Matrix4().makeRotationY(Math.atan2(-(bz - az), bx - ax)))
    parts.push({ geo, color, position: [(ax + bx) / 2, (ay + by) / 2, (az + bz) / 2] })
  }
  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.7 }))
  mesh.receiveShadow = true
  return mesh
}

// Beachflag: eine geschwungene Fahne an einer biegsamen Stange, wie sie an
// jedem Kicker im Park stehen. Je eine links und rechts der Absprungkante,
// dort wo vorher die blauen Kloetze standen: sie sagen schon im Anfahren,
// wo gesprungen wird. Die Flagge steht auf einem Federfuss (springMount in
// signpost.js) und legt sich um, wenn man sie trifft. Ursprung am Fuss, die
// Flaeche zeigt nach +z.
export function createBeachFlag(variant = 0) {
  const group = new THREE.Group()
  const color = variant % 2 ? PAD_B : PAD_A
  const parts = []
  parts.push({ geo: new THREE.CylinderGeometry(0.025, 0.035, 2.75, 6), color: 0x30383b, position: [0, 1.375, 0] })
  // Fuss: ein Kreuz aus zwei flachen Leisten mit Schnee darauf.
  for (const r of [0, Math.PI / 2]) {
    parts.push({ geo: new THREE.BoxGeometry(0.62, 0.05, 0.08), color: 0x30383b, position: [0, 0.03, 0], rotation: [0, r, 0] })
  }
  parts.push({ geo: new THREE.CylinderGeometry(0.16, 0.2, 0.05, 8), color: 0xf7fbff, position: [0, 0.06, 0] })
  // Das Tuch: eine Feder, unten schmal, oben rund, an der Stange entlang.
  const tuch = new THREE.Shape()
  tuch.moveTo(0, 0.55)
  tuch.quadraticCurveTo(0.42, 0.62, 0.55, 1.3)
  tuch.quadraticCurveTo(0.66, 2.2, 0.32, 2.62)
  tuch.quadraticCurveTo(0.16, 2.78, 0, 2.74)
  tuch.lineTo(0, 0.55)
  const geo = new THREE.ExtrudeGeometry(tuch, { depth: 0.015, bevelEnabled: false, curveSegments: 6 })
  geo.translate(0.03, 0, -0.0075)
  parts.push({ geo, color })
  // Ein heller Streifen laengs, damit die Form von weitem liest.
  const streifen = new THREE.Shape()
  streifen.moveTo(0.06, 1.0)
  streifen.quadraticCurveTo(0.3, 1.1, 0.36, 1.6)
  streifen.quadraticCurveTo(0.42, 2.1, 0.24, 2.4)
  streifen.lineTo(0.18, 2.36)
  streifen.quadraticCurveTo(0.3, 2.05, 0.26, 1.62)
  streifen.quadraticCurveTo(0.22, 1.2, 0.06, 1.12)
  const sg = new THREE.ExtrudeGeometry(streifen, { depth: 0.02, bevelEnabled: false, curveSegments: 5 })
  sg.translate(0.03, 0, -0.01)
  parts.push({ geo: sg, color: 0xf4f8fc })
  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.7, side: THREE.DoubleSide }))
  mesh.castShadow = true
  group.add(mesh)
  return group
}

// Gepolsterte Pfosten an Boxen, Rail und Wellen. Die Beachflags gehoeren
// an die Schanzen (Wunsch 04.10.); an den Boxen sahen sie aus, als waere
// dort der Absprung.
export function createPadMarker(variant = 0) {
  const group = new THREE.Group()
  const parts = []
  const color = variant % 2 ? PAD_B : PAD_A

  parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6), color: STEEL_DARK, position: [0, 0.55, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.15, 0.16, 0.78, 9), color, position: [0, 0.5, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.155, 0.155, 0.12, 9), color: 0xf4f8fc, position: [0, 0.66, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.24, 0.28, 0.06, 9), color: 0xf7fbff, position: [0, 0.03, 0] })

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.75 }))
  mesh.castShadow = true
  group.add(mesh)
  return group
}

// Eingangsschild des Parks: eine breite Tafel auf zwei Holzpfosten, nach
// hinten gekippt wie alle lesbaren Flaechen in dieser Welt.
export function createParkSign({ title = 'FUNPARK', sub = null } = {}) {
  const group = new THREE.Group()
  const parts = []
  const W = 3.6
  const H = 2.5
  const TILT = -0.52

  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.16, H, 0.16),
      color: WOOD,
      position: [sx * (W / 2 - 0.25), H / 2, 0],
      rotation: [0.06, 0, 0],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.3, 0.36, 0.1, 9),
      color: 0xf7fbff,
      position: [sx * (W / 2 - 0.25), 0.05, 0],
    })
  }

  const boardY = H * 0.78
  parts.push({
    geo: new THREE.BoxGeometry(W, 1.24, 0.09),
    color: 0x27313b,
    position: [0, boardY, 0.16],
    rotation: [TILT, 0, 0],
  })
  parts.push({
    geo: new THREE.BoxGeometry(W + 0.16, 0.1, 0.13),
    color: WOOD,
    position: [0, boardY + 0.56, 0.05],
    rotation: [TILT, 0, 0],
  })
  // Schneekante auf der Oberkante
  parts.push({
    geo: new THREE.BoxGeometry(W + 0.16, 0.07, 0.15),
    color: 0xf7fbff,
    position: [0, boardY + 0.62, 0.02],
    rotation: [TILT, 0, 0],
  })

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.8 }))
  mesh.castShadow = true
  group.add(mesh)

  const tex = labelTexture(title, {
    width: 512, height: 200, background: null, color: '#f2f7ff',
    font: '700 96px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    sub, subColor: '#9fd2b0',
  })
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.9, 1.06),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  // 6,5 cm entlang der Brettnormalen: 5 cm nur in Z lagen bei
  // 30 Grad Neigung noch innerhalb der 9 cm dicken Tafel.
  label.position.set(0, boardY - Math.sin(TILT) * 0.065, 0.16 + Math.cos(TILT) * 0.065)
  label.rotation.x = TILT
  group.add(label)

  return group
}
