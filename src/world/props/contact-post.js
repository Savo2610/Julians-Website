import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust, labelTexture } from '../../core/geometry.js'
import { createEmergencyPhone } from './emergency-phone.js'
import { signalScreen, instagramScreen, createScreen, createHalo } from './screens.js'

// Der Kontaktposten am Waldrand: das gelbe Notruftelefon und ein
// Aussichtsfernglas auf einem gemeinsamen Holzpodest.
//
// Signal und Instagram standen zuletzt an zwei Enden des Tals – das Telefon
// unten am Weg, das Fernrohr hinter dem Gipfel. Zwei Stationen fuer
// "schreib mir" und "schau, was ich mache" sind ein Gedanke an zwei Orten.
// Jetzt stehen beide nebeneinander wie auf einem Aussichtspunkt, und Enter
// zoomt heran wie an der Kasse.
//
// Die beiden Geraete spielen die Auswahl selbst:
// - Signal gewaehlt: der Hoerer hebt sich vom Haken und zittert, als
//   klingelte es, das Blinklicht geht auf Anruf, und ueber dem Kasten steht
//   eine Sprechblase mit drei tippenden Punkten.
// - Instagram gewaehlt: das Fernglas, das sonst ueber den Wald schwenkt,
//   dreht sich um und schaut einen an. Beim Oeffnen blitzt es – ein Foto.
// Vorn an der Kante stehen die zwei Tafeln mit Namen und Farbe, zur Kamera
// geneigt wie die Terminals der Kasse; ohne sie waere gelb nicht Signal.

const WOOD = 0x8a5a36
const WOOD_DARK = 0x57392a
const WOOD_LIGHT = 0xa87850
const SNOW = 0xf7fbff
const STEEL = 0x5f6a76
const DARK = 0x1d2229
// Das Fernglas traegt das Pink aus dem Instagram-Verlauf, die Ringe das Gelb.
const PINK = 0xc8306f
const PINK_DARK = 0x8e2352
const GOLD = 0xf2b53a

const W = 4.2           // Podest Breite
const D = 1.9           // Podest Tiefe
const DECK = 0.24       // Podest Hoehe

export function createContactPost({ label = 'KONTAKT' } = {}) {
  const group = new THREE.Group()
  const parts = []

  // --- Podest ---------------------------------------------------------------
  const planks = 7
  for (let i = 0; i < planks; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(W, 0.07, D / planks - 0.025),
      color: i % 2 ? WOOD : WOOD_LIGHT,
      position: [0, DECK - 0.035, -D / 2 + (i + 0.5) * (D / planks)],
    })
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.16, DECK + 0.2, 0.16), color: WOOD_DARK, position: [sx * (W / 2 - 0.1), (DECK - 0.2) / 2, sz * (D / 2 - 0.1)] })
  }
  parts.push({ geo: new THREE.BoxGeometry(W, 0.12, 0.08), color: WOOD_DARK, position: [0, DECK - 0.12, D / 2 - 0.02] })

  // Gelaender hinten, zum Wald hin: man steht am Rand und schaut hinaus.
  const railZ = -D / 2 + 0.1
  for (const x of [-W / 2 + 0.1, -0.7, 0.7, W / 2 - 0.1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.1, 1.0, 0.1), color: WOOD_DARK, position: [x, DECK + 0.5, railZ] })
    parts.push({ geo: new THREE.SphereGeometry(0.1, 8, 5), color: SNOW, position: [x, DECK + 1.02, railZ], scale: [1, 0.55, 1] })
  }
  for (const y of [0.55, 0.95]) {
    parts.push({ geo: new THREE.BoxGeometry(W - 0.1, 0.07, 0.07), color: WOOD, position: [0, DECK + y, railZ] })
  }
  parts.push({ geo: new THREE.BoxGeometry(W - 0.1, 0.05, 0.12), color: SNOW, position: [0, DECK + 1.0, railZ] })

  // Schneewehen an den hinteren Ecken, wo der Wind vom Wald her anweht.
  // Flach halten: mit einem Drittel Hoehe lasen sie sich aus 36 Grad als
  // Felsbrocken neben dem Podest.
  for (const [x, z, s] of [[-W / 2, -D / 2, 0.55], [W / 2, -D / 2, 0.45]]) {
    parts.push({ geo: new THREE.SphereGeometry(s, 12, 6), color: SNOW, position: [x, 0.02, z], scale: [1.5, 0.28, 1.1] })
  }

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.82 }))
  snowDust(body.geometry, 0.35, 0.85)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Schild auf dem Gelaender, mittig zwischen den beiden Geraeten.
  const sign = new THREE.Group()
  sign.position.set(0, DECK + 1.28, railZ + 0.02)
  sign.rotation.x = -0.5
  sign.add(new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(1.34, 0.46, 0.06), color: WOOD_DARK },
      { geo: new THREE.BoxGeometry(1.38, 0.06, 0.12), color: SNOW, position: [0, 0.25, 0] },
    ]),
    vertexColorMaterial({ roughness: 0.8 }),
  ))
  const signFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.24, 0.36),
    new THREE.MeshStandardMaterial({
      map: labelTexture(label, {
        width: 512, height: 148, background: '#935976', color: '#ffffff',
        font: '800 84px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
      }),
      roughness: 0.7,
    }),
  )
  signFace.position.z = 0.032
  sign.add(signFace)
  group.add(sign)

  // --- Telefon links --------------------------------------------------------
  const phone = createEmergencyPhone()
  phone.position.set(-1.3, DECK - 0.1, -0.25)
  phone.scale.setScalar(0.92)
  group.add(phone)

  // Sprechblase ueber dem Kasten: ein Sprite, das immer zur Kamera schaut.
  const bubble = new THREE.Sprite(new THREE.SpriteMaterial({
    map: bubbleTexture(), transparent: true, depthWrite: false, toneMapped: false,
  }))
  bubble.position.set(-1.3 + 0.55, DECK + 2.95, -0.25)
  bubble.scale.setScalar(0.001)
  bubble.renderOrder = 3
  group.add(bubble)

  // --- Fernglas rechts ------------------------------------------------------
  const scope = new THREE.Group()
  scope.position.set(1.3, DECK, -0.25)
  const stand = new THREE.Mesh(
    assemble([
      { geo: new THREE.CylinderGeometry(0.3, 0.36, 0.12, 12), color: STEEL, position: [0, 0.06, 0] },
      { geo: new THREE.CylinderGeometry(0.075, 0.1, 1.0, 10), color: PINK_DARK, position: [0, 0.6, 0] },
      // Muenzkasten am Mast
      { geo: new THREE.BoxGeometry(0.2, 0.26, 0.14), color: GOLD, position: [0, 0.78, 0.1] },
      { geo: new THREE.BoxGeometry(0.1, 0.02, 0.03), color: DARK, position: [0, 0.85, 0.18] },
    ]),
    vertexColorMaterial({ roughness: 0.45, metalness: 0.3 }),
  )
  stand.castShadow = true
  scope.add(stand)

  // Gabel dreht um die Hochachse, der Kopf darin um die Querachse.
  const yoke = new THREE.Group()
  yoke.position.y = 1.12
  yoke.add(new THREE.Mesh(
    assemble([
      { geo: new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), color: STEEL, position: [0, -0.02, 0] },
      { geo: new THREE.BoxGeometry(0.62, 0.05, 0.12), color: PINK_DARK, position: [0, 0.02, 0] },
      { geo: new THREE.BoxGeometry(0.05, 0.3, 0.12), color: PINK_DARK, position: [-0.29, 0.16, 0] },
      { geo: new THREE.BoxGeometry(0.05, 0.3, 0.12), color: PINK_DARK, position: [0.29, 0.16, 0] },
    ]),
    vertexColorMaterial({ roughness: 0.45, metalness: 0.3 }),
  ))
  const head = new THREE.Group()
  head.position.y = 0.26
  const headParts = [
    { geo: new THREE.BoxGeometry(0.5, 0.3, 0.42), color: PINK },
    // Kappe gegen Schnee, die Schirmkante ueber den Okularen.
    { geo: new THREE.BoxGeometry(0.56, 0.05, 0.54), color: PINK_DARK, position: [0, 0.17, -0.04] },
    { geo: new THREE.BoxGeometry(0.56, 0.04, 0.5), color: SNOW, position: [0, 0.21, -0.04] },
    // Okularschild hinten
    { geo: new THREE.BoxGeometry(0.46, 0.16, 0.08), color: DARK, position: [0, 0.02, -0.25] },
  ]
  for (const sx of [-1, 1]) {
    // Die beiden Tuben vorn, mit gelbem Ring.
    headParts.push({ geo: new THREE.CylinderGeometry(0.11, 0.1, 0.24, 14), color: PINK, position: [sx * 0.13, 0, 0.3], rotation: [Math.PI / 2, 0, 0] })
    headParts.push({ geo: new THREE.CylinderGeometry(0.125, 0.125, 0.05, 14), color: GOLD, position: [sx * 0.13, 0, 0.42], rotation: [Math.PI / 2, 0, 0] })
    headParts.push({ geo: new THREE.CylinderGeometry(0.04, 0.05, 0.08, 8), color: DARK, position: [sx * 0.1, 0.02, -0.3], rotation: [Math.PI / 2, 0, 0] })
  }
  const headMesh = new THREE.Mesh(assemble(headParts), vertexColorMaterial({ roughness: 0.4, metalness: 0.25 }))
  headMesh.castShadow = true
  head.add(headMesh)
  // Linsen: dunkles Glas, das beim Blitz aufleuchtet.
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0x10222e, roughness: 0.08, metalness: 0.6,
    emissive: new THREE.Color(0xffffff), emissiveIntensity: 0,
  })
  for (const sx of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.095, 16), lensMat)
    lens.position.set(sx * 0.13, 0, 0.446)
    head.add(lens)
  }
  const flashHalo = createHalo(0xffffff, 1.6)
  flashHalo.position.z = 0.5
  head.add(flashHalo)
  yoke.add(head)
  scope.add(yoke)
  group.add(scope)

  // --- Die beiden Tafeln vorn -----------------------------------------------
  const screens = []
  const tex = [signalScreen(), instagramScreen()]
  const glow = [0x4f8bff, 0xee2a7b]
  const tilt = -0.62
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -1.05 : 1.05
    const post = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.09, 0.62, 0.09), color: WOOD_DARK, position: [0, 0.31, 0] },
        { geo: new THREE.BoxGeometry(0.3, 0.04, 0.2), color: WOOD_DARK, position: [0, 0.02, 0] },
      ]),
      vertexColorMaterial({ roughness: 0.8 }),
    )
    post.position.set(x, DECK, D / 2 - 0.32)
    post.castShadow = true
    group.add(post)

    const plate = new THREE.Group()
    plate.position.set(x, DECK + 0.72, D / 2 - 0.3)
    plate.rotation.x = tilt
    const frame = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.98, 0.76, 0.05), color: 0x1b1f24 },
        { geo: new THREE.BoxGeometry(1.0, 0.05, 0.1), color: SNOW, position: [0, 0.4, -0.01] },
      ]),
      vertexColorMaterial({ roughness: 0.4, metalness: 0.2 }),
    )
    frame.castShadow = true
    plate.add(frame)
    const screen = createScreen(tex[i], 0.92, 0.69)
    screen.position.z = 0.027
    plate.add(screen)
    const halo = createHalo(glow[i], 2.1)
    halo.position.z = -0.08
    plate.add(halo)
    group.add(plate)
    screens.push({ plate, screen, halo, pop: 0, baseY: plate.position.y })
  }

  // --- Verhalten ------------------------------------------------------------
  const handset = phone.userData.handset
  const handsetHome = phone.userData.handsetHome
  let selected = null
  let lift = 0          // Hoerer vom Haken, 0..1
  let turn = 0          // Fernglas zur Kamera, 0..1
  let bubbleK = 0
  let ring = 0          // Nachschwingen beim Oeffnen von Signal
  let flash = 0         // Blitz beim Oeffnen von Instagram

  group.userData.select = (index) => {
    selected = index
    screens.forEach((s, i) => {
      s.screen.userData.want = index === null ? 0.8 : index === i ? 1.12 : 0.38
    })
  }
  group.userData.press = (index) => {
    if (screens[index]) screens[index].screen.userData.flash = 1
    if (index === 0) ring = 1
    if (index === 1) flash = 1
  }

  group.userData.animate = (time, dt = 1 / 60) => {
    const k = 1 - Math.exp(-8 * dt)
    const slow = 1 - Math.exp(-3.5 * dt)
    phone.userData.animate(time)
    for (const [i, s] of screens.entries()) {
      s.screen.userData.step(dt)
      s.pop += ((selected === i ? 1 : 0) - s.pop) * k
      s.plate.position.y = s.baseY + s.pop * 0.07
      s.plate.rotation.x = tilt + s.pop * 0.08
      s.halo.material.opacity = s.pop * (0.45 + Math.sin(time * 3) * 0.07) + s.screen.userData.flash * 0.6
    }

    // Telefon
    lift += ((selected === 0 ? 1 : 0) - lift) * k
    ring = Math.max(0, ring - dt * 1.4)
    phone.userData.alarm = lift
    const shake = (lift * 0.5 + ring) * Math.sin(time * 38)
    handset.position.set(
      handsetHome.x + lift * 0.05,
      handsetHome.y + lift * 0.16 + Math.abs(shake) * 0.02,
      handsetHome.z + lift * 0.14,
    )
    handset.rotation.set(lift * 0.35, 0, lift * 0.25 + shake * 0.12)
    bubbleK += ((selected === 0 ? 1 : 0) - bubbleK) * k
    const pulse = 1 + ring * 0.25 * Math.sin(ring * 12)
    bubble.scale.set(0.9 * bubbleK * pulse, 0.62 * bubbleK * pulse, 1)
    bubble.position.y = DECK + 2.95 + Math.sin(time * 2.2) * 0.04
    bubble.visible = bubbleK > 0.01
    if (bubble.visible) bubble.material.map.userData.dots(time)

    // Fernglas: im Leerlauf schwenkt es ueber den Wald (von der Kamera weg),
    // gewaehlt dreht es sich um und schaut einen an.
    turn += ((selected === 1 ? 1 : 0) - turn) * slow
    const idleYaw = Math.PI + Math.sin(time * 0.25) * 0.6
    yoke.rotation.y = idleYaw * (1 - turn) + Math.sin(time * 0.8) * 0.04 * turn
    // Die Kamera steht 36 Grad hoch; zu ihr hin hebt sich der Kopf.
    head.rotation.x = (-0.08 + Math.sin(time * 0.19) * 0.06) * (1 - turn) - 0.5 * turn
    flash = Math.max(0, flash - dt * 2.2)
    lensMat.emissiveIntensity = flash * 3 + turn * 0.15
    flashHalo.material.opacity = flash * flash
    flashHalo.scale.setScalar(1 + (1 - flash) * 0.8)
  }

  group.userData.footprint = { width: W + 0.4, depth: D + 0.4 }
  // Kollision: zwei Kreise ueber die Breite, Mittelpunkte in lokalen Metern.
  group.userData.colliders = [{ dx: -1.1, dz: 0, r: 1.05 }, { dx: 1.1, dz: 0, r: 1.05 }]
  return group
}

// Die Sprechblase: weiss mit blauem Rand und drei Punkten, die nacheinander
// huepfen wie beim Tippen. Gezeichnet wird nur neu, wenn sich ein Punkt
// sichtbar bewegt hat.
function bubbleTexture() {
  const c = document.createElement('canvas')
  c.width = 192
  c.height = 132
  const ctx = c.getContext('2d')
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  let last = -1
  tex.userData.dots = (time) => {
    const phase = Math.floor(time * 12) % 12
    if (phase === last) return
    last = phase
    ctx.clearRect(0, 0, 192, 132)
    ctx.fillStyle = '#ffffff'
    ctx.strokeStyle = '#3a76f0'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.roundRect(8, 8, 176, 90, 45)
    ctx.moveTo(40, 94)
    ctx.lineTo(30, 124)
    ctx.lineTo(70, 96)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(34, 86, 40, 10)
    ctx.fillStyle = '#3a76f0'
    for (let i = 0; i < 3; i++) {
      const up = Math.max(0, Math.sin(((time * 3.2) - i * 0.35) * Math.PI)) * 12
      ctx.beginPath()
      ctx.arc(60 + i * 36, 53 - up, 11, 0, Math.PI * 2)
      ctx.fill()
    }
    tex.needsUpdate = true
  }
  tex.userData.dots(0)
  return tex
}
