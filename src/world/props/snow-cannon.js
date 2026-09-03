import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die Schneekanone: ein Geblaese auf einem Schlitten, das quer ueber die
// Strecke blaest und langsam hin und her schwenkt.
//
// Der Reiz liegt nicht im Geraet, sondern in der Fahne. Sie ist ein
// Partikelsystem, das die Kanone mitdreht – wer hindurchfaehrt, kommt weiss
// wieder heraus. Damit ist die Kanone das einzige Ding auf der Karte, das
// den Fahrer selbst veraendert, und deshalb steht sie quer und nicht laengs:
// laengs koennte man ihr ausweichen, quer faehrt man mitten hinein.
//
// Der Kegel ist eine reine Rechenform. Die Partikel starten an der Muendung,
// bekommen etwas Streuung und fallen; getroffen ist, wer im Kegel steckt.
// Eine echte Kollisionsabfrage gegen tausend Punkte waere hier Aufwand ohne
// sichtbaren Unterschied.

const STEEL = 0x9aa4ae
const STEEL_DARK = 0x5a636d
const YELLOW = 0xe8b03a
const HOSE = 0x37414c

const COUNT = 420
const REACH = 13         // Wurfweite der Fahne
const SPREAD = 0.34      // halber Oeffnungswinkel in rad
// Der Schwenk muss kleiner bleiben als die Streuung, sonst wandert die Fahne
// an einer festen Stelle staendig vorbei und man wird nur mit Glueck getroffen.
// Bei 0,38 zu 0,34 ueberlappen sich die Kegelraender an jedem Punkt der Bahn.
const SWEEP = 0.38       // Schwenk zu jeder Seite
const SWEEP_RATE = 0.28  // rad/s

// Weiss auf Weiss sieht man nicht. Die Fahne bekommt deshalb einen leicht
// kuehlen Ton und weiche runde Punkte – ohne beides ist sie im besonnten
// Schnee schlicht unsichtbar.
function puffTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(238,245,253,0.8)')
  g.addColorStop(1, 'rgba(214,230,246,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function createSnowCannon({ heading = 0 } = {}) {
  const group = new THREE.Group()
  const parts = []

  // --- Schlitten -----------------------------------------------------------
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.18, 0.16, 2.6),
      color: STEEL_DARK,
      position: [sx * 0.62, 0.08, 0],
    })
    // Aufgebogene Kufenspitzen
    parts.push({
      geo: new THREE.BoxGeometry(0.18, 0.16, 0.55),
      color: STEEL_DARK,
      position: [sx * 0.62, 0.16, -1.42],
      rotation: [-0.42, 0, 0],
    })
  }
  parts.push({ geo: new THREE.BoxGeometry(1.5, 0.14, 1.2), color: STEEL, position: [0, 0.22, 0] })
  // Aggregatkasten hinten, damit die Kanone nicht nur ein Rohr auf Beinen ist.
  parts.push({ geo: new THREE.BoxGeometry(1.1, 0.7, 0.8), color: YELLOW, position: [0, 0.62, -0.7] })
  parts.push({ geo: new THREE.BoxGeometry(1.16, 0.12, 0.86), color: STEEL_DARK, position: [0, 0.98, -0.7] })
  // Schlauch, der im Schnee verschwindet – sie haengt an irgendetwas.
  for (let i = 0; i < 7; i++) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.1, 0.1, 0.55, 6),
      color: HOSE,
      position: [-0.7 - i * 0.42, 0.36 - i * 0.045, -1.0 - i * 0.16],
      rotation: [0, 0.35, Math.PI / 2 - i * 0.02],
    })
  }
  const sled = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.62 }))
  sled.castShadow = true
  group.add(sled)

  // --- Schwenkbarer Kopf ---------------------------------------------------
  // Alles, was sich dreht, haengt in einer eigenen Gruppe; der Schlitten
  // bleibt stehen.
  const headParts = []
  headParts.push({ geo: new THREE.CylinderGeometry(0.16, 0.2, 0.9, 8), color: STEEL_DARK, position: [0, 0.45, 0] })
  // Das Rohr zeigt in die lokale +Z-Richtung und ist leicht angehoben.
  headParts.push({
    geo: new THREE.CylinderGeometry(0.46, 0.52, 1.9, 14, 1, true),
    color: STEEL,
    position: [0, 1.15, 0.55],
    rotation: [Math.PI / 2 - 0.22, 0, 0],
  })
  headParts.push({
    geo: new THREE.TorusGeometry(0.5, 0.075, 6, 16),
    color: YELLOW,
    position: [0, 1.36, 1.45],
    rotation: [0.22, 0, 0],
  })
  // Duesenkranz an der Muendung
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    headParts.push({
      geo: new THREE.CylinderGeometry(0.05, 0.05, 0.22, 5),
      color: STEEL_DARK,
      position: [Math.cos(a) * 0.36, 1.36 + Math.sin(a) * 0.36, 1.4],
      rotation: [Math.PI / 2, 0, 0],
    })
  }
  // Gegengewicht hinten, damit der Kopf nicht vorn ueberhaengt
  headParts.push({ geo: new THREE.BoxGeometry(0.5, 0.36, 0.4), color: STEEL_DARK, position: [0, 1.05, -0.5] })

  const head = new THREE.Group()
  const headMesh = new THREE.Mesh(assemble(headParts), vertexColorMaterial({ roughness: 0.55, metalness: 0.2 }))
  headMesh.castShadow = true
  head.add(headMesh)
  head.position.y = 0.28
  group.add(head)

  // --- Fahne ---------------------------------------------------------------
  const positions = new Float32Array(COUNT * 3)
  const life = new Float32Array(COUNT)
  const seed = new Float32Array(COUNT * 3)
  for (let i = 0; i < COUNT; i++) {
    life[i] = Math.random()
    // Feste Streurichtung pro Partikel: so bleibt die Fahne ueber die Zeit
    // gleichmaessig gefuellt, statt zu flackern.
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random())
    seed[i * 3] = Math.cos(a) * r
    seed[i * 3 + 1] = Math.sin(a) * r
    seed[i * 3 + 2] = 0.75 + Math.random() * 0.5
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const plume = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      color: 0xccdcee,
      map: puffTexture(),
      size: 1.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  )
  plume.frustumCulled = false
  head.add(plume)

  // --- Bewegung ------------------------------------------------------------
  let sweep = 0
  const muzzle = new THREE.Vector3(0, 1.36, 1.5)

  group.userData.animate = (t, dt) => {
    sweep = Math.sin(t * SWEEP_RATE) * SWEEP
    head.rotation.y = sweep

    const step = dt / 1.35
    for (let i = 0; i < COUNT; i++) {
      life[i] += step
      if (life[i] > 1) life[i] -= 1
      const u = life[i]
      const d = u * REACH
      // Streuung waechst mit der Entfernung – daraus wird der Kegel.
      const spread = d * Math.tan(SPREAD)
      positions[i * 3] = muzzle.x + seed[i * 3] * spread
      positions[i * 3 + 1] = muzzle.y + seed[i * 3 + 1] * spread + d * 0.22 - u * u * REACH * 0.30
      positions[i * 3 + 2] = muzzle.z + d * seed[i * 3 + 2]
    }
    geo.attributes.position.needsUpdate = true
  }

  // Steckt der Punkt (x, z) in der Fahne? Gerechnet wird in der Ebene: die
  // Fahne haengt zwar durch, aber wer darunter durchfaehrt, faehrt trotzdem
  // hindurch.
  const world = new THREE.Vector3()
  group.userData.inPlume = (x, z) => {
    world.set(0, 0, 0)
    group.localToWorld(world)
    const ax = Math.sin(group.rotation.y + sweep)
    const az = Math.cos(group.rotation.y + sweep)
    const dx = x - world.x
    const dz = z - world.z
    const along = dx * ax + dz * az
    if (along < 1.2 || along > REACH) return 0
    const across = Math.abs(-dx * az + dz * ax)
    const half = along * Math.tan(SPREAD) + 0.6
    if (across > half) return 0
    // Voll in der Mitte, an der Kante nur noch angehaucht.
    return (1 - across / half) * (1 - Math.max(0, (along - REACH * 0.75) / (REACH * 0.25)) * 0.6)
  }

  group.rotation.y = heading
  return group
}
