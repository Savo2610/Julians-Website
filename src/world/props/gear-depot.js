import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Die Packlisten-App als Materialdepot: eine offene Holzkiste mit ausgebreiteter
// Ausruestung, ein Rucksack daneben, angelehnte Ski. Eine aufgeklappte Liste
// haengt am Deckel.

const WOOD = 0x7b5236
const WOOD_DARK = 0x543a26
const CANVAS = 0x4a6b52
const METAL = 0x8d949e
const ORANGE = 0xe4613a

export function createGearDepot() {
  const group = new THREE.Group()
  const parts = []

  const W = 1.6
  const D = 0.95
  const H = 0.62

  // --- Kiste ---------------------------------------------------------------
  // Boden und vier Waende, damit sie von oben wirklich offen aussieht.
  parts.push({ geo: new THREE.BoxGeometry(W, 0.08, D), color: WOOD_DARK, position: [0, 0.04, 0] })
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.08, H, D), color: WOOD, position: [sx * (W / 2 - 0.04), H / 2, 0] })
  }
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(W, H, 0.08), color: WOOD, position: [0, H / 2, sz * (D / 2 - 0.04)] })
  }
  // Eisenbeschlaege an den Ecken
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({
        geo: new THREE.BoxGeometry(0.1, H + 0.04, 0.1),
        color: METAL,
        position: [sx * (W / 2 - 0.05), H / 2, sz * (D / 2 - 0.05)],
      })
    }
  }

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Inhalt --------------------------------------------------------------
  // Jedes Stueck ist ein eigenes Mesh, damit es beim Heranzoomen einzeln aus
  // der Kiste huepfen kann – die Liste wird durchgezaehlt. Die Teile sitzen
  // um ihren Mittelpunkt, sonst drehte sich der Sprung um die Kistenmitte.
  const stueck = (teile, [x, y, z]) => {
    const m = new THREE.Mesh(assemble(teile), vertexColorMaterial({ roughness: 0.85 }))
    m.position.set(x, y, z)
    m.castShadow = true
    m.userData.ruhe = m.position.clone()
    group.add(m)
    return m
  }
  const inhalt = [
    // Gerollte Isomatte
    stueck([{
      geo: new THREE.CylinderGeometry(0.14, 0.14, 0.62, 10),
      color: ORANGE,
      rotation: [0, 0.2, Math.PI / 2],
    }], [-0.38, H - 0.1, 0.12]),
    // Zwei gefaltete Kleidungsstapel
    stueck([CANVAS, 0x3f5a72].map((c, i) => ({
      geo: new THREE.BoxGeometry(0.42, 0.14, 0.32),
      color: c,
      position: [0, i * 0.15, i * 0.05],
      rotation: [0, i * 0.14, 0],
    })), [0.24, 0.12, -0.14]),
    // Thermoskanne
    stueck([{
      geo: new THREE.CylinderGeometry(0.075, 0.075, 0.32, 9),
      color: METAL,
      rotation: [0.1, 0, 0.3],
    }], [0.5, H - 0.16, 0.24]),
  ]

  // --- Rucksack daneben ----------------------------------------------------
  const rucksack = stueck([
    { geo: new THREE.BoxGeometry(0.42, 0.6, 0.28), color: CANVAS, rotation: [0.12, -0.5, 0.08] },
    { geo: new THREE.BoxGeometry(0.36, 0.16, 0.1), color: 0x3a5541, position: [0.08, 0.2, 0.16], rotation: [0.12, -0.5, 0.08] },
  ], [W / 2 + 0.42, 0.3, -0.16])

  // --- Aufgeklappter Deckel mit Liste --------------------------------------
  const tex = labelTexture('PACKLISTE', {
    width: 512, height: 340,
    background: '#f4efe3', color: '#3b4a58',
    sub: 'abhaken', subColor: '#8a9099',
    font: '700 74px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.07, D),
    [
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
      new THREE.MeshStandardMaterial({ color: WOOD, roughness: 0.85 }),
    ],
  )
  // Der Deckel haengt an einem Scharnier an der Hinterkante. Die Liste klebt
  // innen, auf der Seite, die zugeklappt nach unten zeigt. Bis 29.09. lag sie
  // aussen und der Deckel stand frei im Raum: aus der Ferne fiel das nicht
  // auf, herangezoomt sah man nur braunes Holz.
  const scharnier = new THREE.Group()
  scharnier.position.set(0, H, -D / 2)
  lid.position.set(0, 0.035, D / 2)
  lid.castShadow = true
  scharnier.add(lid)
  group.add(scharnier)
  // Offen lehnt er 115 Grad nach hinten; herangezoomt klappt er erst zu und
  // dann weiter auf, bis die Liste der Kamera gerade gegenuebersteht.
  const OFFEN = -2.0
  const WEIT = -2.4
  scharnier.rotation.x = OFFEN

  // --- Angelehnte Ski ------------------------------------------------------
  for (const [i, off] of [-0.1, 0.1].entries()) {
    const ski = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.11, 1.7, 0.035), color: i ? 0xf5c542 : 0xe8703a },
        { geo: new THREE.BoxGeometry(0.13, 0.06, 0.05), color: 0x2b3240, position: [0, 0.1, 0.01] },
      ]),
      vertexColorMaterial({ roughness: 0.4 }),
    )
    ski.position.set(-W / 2 - 0.3 + off * 0.6, 0.78, 0.12 + off)
    ski.rotation.set(0.26, 0.3 + i * 0.1, -0.3 - i * 0.06)
    ski.castShadow = true
    group.add(ski)
  }

  // Herangezoomt huepft der Inhalt der Reihe nach heraus und wieder hinein,
  // als wuerde jemand abhaken; beim Oeffnen springt der Rucksack. Ein
  // Durchgang dauert 1,8 s, danach eine kurze Pause und von vorn.
  const RUNDE = 1.8
  const SPRUNG = 0.42
  const DECKEL = 0.7    // s: zu und wieder auf, bevor gezaehlt wird
  let zaehlt = false
  let auf = -1          // s seit dem Heranzoomen, -1 = nicht herangezoomt
  let uhr = 0
  let hopser = 0
  group.userData.select = (i) => {
    if (i !== null && !zaehlt) { uhr = 0; auf = 0 }
    zaehlt = i !== null
    if (!zaehlt) auf = -1
  }
  group.userData.press = () => { hopser = 0.5 }

  group.userData.animate = (t, dt = 0) => {
    // Deckel: zuklappen (0,22 s), dann mit einem kleinen Nachfedern weit auf.
    let ziel = OFFEN
    if (auf >= 0) {
      auf += dt
      if (auf < 0.22) ziel = OFFEN + (-0.03 - OFFEN) * (auf / 0.22) ** 2
      else {
        const u = Math.min(1, (auf - 0.22) / (DECKEL - 0.22))
        const feder = 1 - Math.cos(u * Math.PI * 1.5) * (1 - u) ** 2
        ziel = -0.03 + (WEIT + 0.03) * Math.min(1.12, feder)
      }
      scharnier.rotation.x = ziel
    } else {
      scharnier.rotation.x += (OFFEN - scharnier.rotation.x) * (1 - Math.exp(-6 * dt))
    }

    // Eine angefangene Runde darf zu Ende huepfen, sonst fiele alles mitten
    // in der Luft zurueck.
    if ((zaehlt && auf > DECKEL) || uhr > 0) uhr += dt
    if (!zaehlt && uhr % RUNDE > 1.05) uhr = 0
    const r = uhr % RUNDE
    inhalt.forEach((m, i) => {
      const u = (r - i * 0.3) / SPRUNG
      const h = u > 0 && u < 1 ? Math.sin(u * Math.PI) : 0
      m.position.y = m.userData.ruhe.y + h * 0.8
      m.rotation.y = h * 1.4 * (i % 2 ? -1 : 1)
    })
    if (hopser > 0) hopser = Math.max(0, hopser - dt)
    const h = Math.sin((1 - hopser / 0.5) * Math.PI) * (hopser > 0 ? 1 : 0)
    rucksack.position.y = rucksack.userData.ruhe.y + h * 0.35
    rucksack.scale.set(1 + h * 0.08, 1 - h * 0.06, 1 + h * 0.08)
  }

  group.userData.footprint = { width: W + 1.2, depth: D + 1.2 }
  return group
}
