import * as THREE from 'three'

// Der Fahrer wird prozedural aus Primitiven gebaut – low-poly, flat shaded,
// mit warmen Farben, damit er im vielen Weiss sofort lesbar bleibt.

const PALETTE = {
  jacket: 0xe4613a,
  jacketDark: 0xb44526,
  pants: 0x2f3d5c,
  boot: 0x1b2233,
  skin: 0xe8b48c,
  helmet: 0xf2ede2,
  goggle: 0x1a2430,
  goggleGlass: 0x63c7d6,
  glove: 0x2f3d5c,
  pole: 0x9aa3ad,
  // Gruen, damit Gold eine Belohnung ist: bis 26.09. waren die Ski gelb, und
  // die goldenen Ski des Pistenpasses sahen kaum anders aus.
  ski: 0x8fc23a,
  skiEdge: 0x2b3240,
  pack: 0x50694f,
  scarf: 0xd9d2c4,
}

// Drehpunkt der Beine im Beinpaar: oben am Oberschenkel, wo die Jacke ansetzt.
export const HIP = { x: 0.17, y: 0.88 }

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.78,
    metalness: opts.metalness ?? 0.0,
    flatShading: opts.flat ?? true,
    ...(opts.extra || {}),
  })
}

// Ein Ski mit aufgebogener Schaufel, extrudiert aus einem Profil.
function makeSki(material, edgeMaterial) {
  const length = 1.72
  const shape = new THREE.Shape()
  const w = 0.055
  shape.moveTo(-length * 0.5, -w)
  shape.lineTo(length * 0.34, -w)
  shape.quadraticCurveTo(length * 0.5, -w * 0.6, length * 0.52, w * 1.6)
  shape.lineTo(length * 0.44, w * 1.9)
  shape.quadraticCurveTo(length * 0.36, w * 0.9, length * 0.3, w)
  shape.lineTo(-length * 0.5, w)
  shape.closePath()

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 4,
  })
  // Profil liegt in XY, Extrusion in Z -> so drehen, dass der Ski flach liegt
  // und nach -Z (Fahrtrichtung) zeigt.
  geo.rotateY(-Math.PI / 2)
  // Die Extrusion laeuft von 0 bis depth und liegt nach dem Drehen ganz auf
  // einer Seite. Ohne das Zuruecksetzen stand jeder Ski 7,5 cm neben seiner
  // Bindung, der Fahrer also auf der Innenkante des einen und der Aussen-
  // kante des anderen Skis – so gebaut seit dem ersten Commit.
  geo.translate(0.075, 0, 0)
  geo.computeVertexNormals()

  const ski = new THREE.Group()
  const body = new THREE.Mesh(geo, material)
  body.castShadow = true
  ski.add(body)

  const bindingGeo = new THREE.BoxGeometry(0.14, 0.05, 0.3)
  const binding = new THREE.Mesh(bindingGeo, edgeMaterial)
  binding.position.set(0, 0.055, 0)
  binding.castShadow = true
  ski.add(binding)

  return ski
}

function makePole(material, gripMaterial) {
  const group = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.011, 1.12, 6), material)
  shaft.castShadow = true
  group.add(shaft)

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 6), gripMaterial)
  grip.position.y = 0.54
  group.add(grip)

  const basket = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 4, 8), gripMaterial)
  basket.rotation.x = Math.PI / 2
  basket.position.y = -0.46
  group.add(basket)
  return group
}

export function createSkierModel() {
  const root = new THREE.Group()
  root.name = 'skier'

  const materials = {
    jacket: mat(PALETTE.jacket),
    jacketDark: mat(PALETTE.jacketDark),
    pants: mat(PALETTE.pants),
    boot: mat(PALETTE.boot, { roughness: 0.55 }),
    skin: mat(PALETTE.skin, { flat: false, roughness: 0.9 }),
    helmet: mat(PALETTE.helmet, { flat: false, roughness: 0.42 }),
    goggle: mat(PALETTE.goggle, { roughness: 0.4 }),
    glass: mat(PALETTE.goggleGlass, { flat: false, roughness: 0.12, metalness: 0.6 }),
    glove: mat(PALETTE.glove),
    pole: mat(PALETTE.pole, { roughness: 0.4, metalness: 0.5 }),
    ski: mat(PALETTE.ski, { roughness: 0.35 }),
    skiEdge: mat(PALETTE.skiEdge, { roughness: 0.5 }),
    pack: mat(PALETTE.pack),
    scarf: mat(PALETTE.scarf, { roughness: 0.95 }),
  }

  // --- Ski --------------------------------------------------------------
  const skis = new THREE.Group()
  const skiLeft = makeSki(materials.ski, materials.skiEdge)
  skiLeft.position.set(-0.19, 0.05, 0)
  const skiRight = makeSki(materials.ski, materials.skiEdge)
  skiRight.position.set(0.19, 0.05, 0)
  skis.add(skiLeft, skiRight)
  root.add(skis)

  // --- Beine ------------------------------------------------------------
  // Jedes Bein haengt an seiner Huefte. So kann es im Pflug nach aussen
  // schwingen und am Hang einzeln einknicken, ohne dass sich die Ruhelage
  // gegenueber dem alten, starren Beinpaar um einen Millimeter verschiebt.
  const legs = new THREE.Group()
  legs.position.y = 0.1
  const legSides = {}
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(side * HIP.x, HIP.y, 0)
    const at = (mesh, x, y, z) => {
      mesh.position.set(x - side * HIP.x, y - HIP.y, z)
      mesh.castShadow = true
      hip.add(mesh)
      return mesh
    }

    at(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.19, 0.29), materials.boot), side * 0.19, 0.11, -0.01)
    const shin = at(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.082, 0.42, 7), materials.pants), side * 0.185, 0.4, 0.02)
    shin.rotation.x = -0.16
    const thigh = at(new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.1, 0.36, 7), materials.pants), side * 0.16, 0.72, -0.04)
    thigh.rotation.x = 0.34

    legs.add(hip)
    legSides[side < 0 ? 'left' : 'right'] = hip
  }
  root.add(legs)

  // --- Torso ------------------------------------------------------------
  const torso = new THREE.Group()
  torso.position.set(0, 0.98, -0.02)
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.3, 3, 8), materials.jacket)
  chest.castShadow = true
  torso.add(chest)

  const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.245, 0.1, 9), materials.jacketDark)
  hem.position.y = -0.2
  torso.add(hem)

  // Lokales +Z ist die Blickrichtung – der Rucksack gehoert nach hinten.
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.36, 0.16), materials.pack)
  pack.position.set(0, 0.05, -0.26)
  pack.castShadow = true
  torso.add(pack)

  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.055, 5, 10), materials.scarf)
  scarf.rotation.x = Math.PI / 2
  scarf.position.y = 0.27
  torso.add(scarf)

  // --- Arme -------------------------------------------------------------
  const arms = {}
  for (const side of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(side * 0.27, 0.16, 0)

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.078, 0.24, 3, 6), materials.jacket)
    upper.position.set(side * 0.04, -0.16, 0.02)
    upper.rotation.z = side * -0.22
    upper.castShadow = true
    arm.add(upper)

    // Unterarm nach vorne, wie in der Abfahrtshocke.
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.22, 3, 6), materials.jacket)
    fore.position.set(side * 0.12, -0.4, 0.16)
    fore.rotation.set(0.62, 0, side * -0.18)
    fore.castShadow = true
    arm.add(fore)

    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.085, 7, 6), materials.glove)
    glove.position.set(side * 0.16, -0.52, 0.29)
    arm.add(glove)

    // Stock: Griff in der Hand, Teller weit hinten – klassische Abfahrtshaltung.
    const pole = makePole(materials.pole, materials.glove)
    pole.position.set(side * 0.16, -0.52, 0.29)
    pole.rotation.set(1.02, 0, side * 0.16)
    arm.add(pole)

    torso.add(arm)
    arms[side < 0 ? 'left' : 'right'] = arm
  }

  root.add(torso)

  // --- Kopf -------------------------------------------------------------
  const head = new THREE.Group()
  head.position.set(0, 0.42, 0.02)

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8), materials.skin)
  face.castShadow = true
  head.add(face)

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.185, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.62),
    materials.helmet,
  )
  helmet.position.y = 0.015
  helmet.castShadow = true
  head.add(helmet)

  // Halteband laeuft um den ganzen Kopf ...
  const goggleBand = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.032, 5, 12), materials.goggle)
  goggleBand.rotation.x = 0.12
  goggleBand.position.y = 0.045
  head.add(goggleBand)

  // ... das Glas sitzt vorne. Eine flachgedrueckte Kapsel liest sich als
  // Skibrille und laesst sich eindeutig ausrichten.
  const lens = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.15, 3, 8), materials.glass)
  lens.rotation.z = Math.PI / 2
  lens.scale.set(1, 1, 0.55)
  lens.position.set(0, 0.05, 0.14)
  head.add(lens)

  // Nase, damit die Blickrichtung auch von oben eindeutig ist.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.07, 5), materials.skin)
  nose.rotation.x = Math.PI / 2
  nose.position.set(0, -0.04, 0.16)
  head.add(nose)

  torso.add(head)

  root.userData.parts = { skis, skiLeft, skiRight, legs, legSides, torso, head, arms, materials }
  return root
}
