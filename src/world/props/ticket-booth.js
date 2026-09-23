import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture, snowDust } from '../../core/geometry.js'
import { paypalScreen, solanaScreen, createScreen, createHalo } from './screens.js'

// Die Skikasse: ein kleines Holzhaus mit Schalter, an dem jemand sitzt.
//
// Sie wird zweimal angesehen. Im Vorbeifahren aus dreiunddreissig Metern –
// dann traegt das rot-weisse Vordach mit der Aufschrift. Und herangezoomt aus
// knapp zehn Metern, sobald man an der Kasse Enter drueckt – dann muessen der
// Schalter, die beiden Zahlterminals und der Kassierer tragen. Deshalb steckt
// das Detail vorn in Brusthoehe und nicht an den Waenden.
//
// Die beiden Terminals sind die Auswahl selbst: links PayPal, rechts Solana,
// beide zur Kamera geneigt, weil man sie von schraeg oben liest. Das
// gewaehlte leuchtet auf und hebt sich, der Kassierer dreht den Kopf dorthin,
// und beim Oeffnen schiebt es einen Beleg heraus.

const WOOD = 0x7b5236
const WOOD_DARK = 0x4f3425
const WOOD_LIGHT = 0x9a6a42
const STONE = 0x767a82
const STONE_DARK = 0x60646c
const SNOW = 0xf7fbff
const SNOW_SHADE = 0xdde8f4
const RED = 0xc8402f
const CREAM = 0xf3ede2
const INTERIOR = 0x3a2c25
const WARM = 0xffc46b
const ICE = 0xd8ecfb

export function createTicketBooth({ label = 'SKIKASSE' } = {}) {
  const group = new THREE.Group()
  const parts = []

  const W = 3.0          // Breite
  const D = 2.2          // Tiefe
  const H = 2.5          // Wandhoehe ueber dem Sockel
  const B = 0.34         // Sockelhoehe
  const front = D / 2
  const counterY = B + 0.98
  const top = B + H

  // --- Steinsockel ----------------------------------------------------------
  parts.push({ geo: new THREE.BoxGeometry(W + 0.3, B, D + 0.3), color: STONE, position: [0, B / 2, 0] })
  for (let i = 0; i < 9; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(0.3 + (i % 3) * 0.06, 0.15, 0.08),
      color: i % 2 ? STONE_DARK : 0x858992,
      position: [-W / 2 + 0.18 + i * (W / 8.6), 0.1 + (i % 2) * 0.14, front + 0.16],
    })
  }

  // --- Waende ---------------------------------------------------------------
  // Rueck- und Seitenwaende aus liegenden Bohlen; die Fugen sind abwechselnd
  // helle und dunkle Bretter, sonst liest die Wand als Platte.
  const boards = 8
  for (let i = 0; i < boards; i++) {
    const y = B + (i + 0.5) * (H / boards)
    const c = i % 2 ? WOOD : WOOD_LIGHT
    parts.push({ geo: new THREE.BoxGeometry(W, H / boards - 0.02, 0.14), color: c, position: [0, y, -front] })
    for (const sx of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.14, H / boards - 0.02, D), color: i % 2 ? WOOD_LIGHT : WOOD, position: [sx * W / 2, y, 0] })
    }
  }
  // Eckpfosten
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.2, H, 0.2), color: WOOD_DARK, position: [sx * W / 2, B + H / 2, sz * front] })
    }
  }

  // Vorderseite unten: senkrechte Bretter unter dem Schalter.
  for (let i = 0; i < 9; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(W / 9 - 0.03, counterY - B - 0.06, 0.12),
      color: i % 2 ? WOOD : WOOD_LIGHT,
      position: [-W / 2 + (i + 0.5) * (W / 9), B + (counterY - B) / 2 - 0.03, front],
    })
  }
  // Sturz und Seitenwangen um das Schalterfenster.
  const winTop = top - 0.34
  parts.push({ geo: new THREE.BoxGeometry(W, top - winTop, 0.14), color: WOOD, position: [0, (top + winTop) / 2, front] })
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.28, winTop - counterY, 0.14), color: WOOD_LIGHT, position: [sx * (W / 2 - 0.14), (winTop + counterY) / 2, front] })
  }
  // Mittelpfosten mit Fensterrahmen – links offen, rechts die Glasscheibe.
  parts.push({ geo: new THREE.BoxGeometry(0.08, winTop - counterY, 0.1), color: CREAM, position: [0.35, (winTop + counterY) / 2, front + 0.02] })
  parts.push({ geo: new THREE.BoxGeometry(W - 0.5, 0.07, 0.1), color: CREAM, position: [0, winTop - 0.03, front + 0.02] })

  // Innenraum: dunkel, damit Kassierer und Licht davor stehen.
  parts.push({ geo: new THREE.BoxGeometry(W - 0.2, H - 0.1, D - 0.3), color: INTERIOR, position: [0, B + H / 2, -0.08] })
  // Regal an der Rueckwand mit Skipaessen in drei Farben.
  parts.push({ geo: new THREE.BoxGeometry(W - 0.6, 0.05, 0.22), color: WOOD_LIGHT, position: [0, counterY + 0.62, -front + 0.3] })
  for (let i = 0; i < 7; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(0.13, 0.19, 0.02),
      color: [0x2b8ce6, 0xe0b23a, 0x9945ff, 0x37b87c][i % 4],
      position: [-0.95 + i * 0.3, counterY + 0.74, -front + 0.33],
      rotation: [-0.15, 0, (i % 3 - 1) * 0.08],
    })
  }
  // Uhr ueber dem Regal.
  parts.push({ geo: new THREE.CylinderGeometry(0.16, 0.16, 0.04, 16), color: CREAM, position: [-0.8, counterY + 1.02, -front + 0.2], rotation: [Math.PI / 2, 0, 0] })
  parts.push({ geo: new THREE.BoxGeometry(0.02, 0.11, 0.02), color: 0x2a2a2a, position: [-0.8, counterY + 1.05, -front + 0.23] })
  parts.push({ geo: new THREE.BoxGeometry(0.08, 0.02, 0.02), color: 0x2a2a2a, position: [-0.77, counterY + 1.02, -front + 0.23] })

  // Schalterbrett: steht vor, darunter zwei Konsolen.
  // Das Brett ragt weit vor: die Terminals muessen vor der Traufe stehen,
  // sonst liegt das Dach auf ihrer Sichtlinie zur Kamera.
  parts.push({ geo: new THREE.BoxGeometry(W - 0.1, 0.09, 1.0), color: WOOD_LIGHT, position: [0, counterY, front + 0.34] })
  parts.push({ geo: new THREE.BoxGeometry(W - 0.06, 0.04, 1.02), color: 0xb07d4f, position: [0, counterY + 0.06, front + 0.34] })
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.09, 0.36, 0.34),
      color: WOOD_DARK,
      position: [sx * (W / 2 - 0.3), counterY - 0.24, front + 0.3],
      rotation: [0.75, 0, 0],
    })
  }
  // Glocke auf dem Brett, in der Mitte zwischen den Terminals.
  parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), color: 0x3b3b3b, position: [0, counterY + 0.1, front + 0.6] })
  parts.push({ geo: new THREE.SphereGeometry(0.085, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), color: 0xd9b24a, position: [0, counterY + 0.11, front + 0.6] })

  // --- Satteldach -----------------------------------------------------------
  // First quer zur Blickrichtung: von oben sieht man beide Dachflaechen, und
  // die vordere traegt die dicke Schneeauflage mit Eiszapfen an der Traufe.
  const rise = 0.85
  const over = 0.22
  const run = D / 2 + over
  const slopeLen = Math.hypot(run, rise)
  const slopeAngle = Math.atan2(rise, run)
  const gable = new THREE.Shape()
  gable.moveTo(-D / 2 - 0.1, 0)
  gable.lineTo(D / 2 + 0.1, 0)
  gable.lineTo(0, rise)
  gable.closePath()
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.ExtrudeGeometry(gable, { depth: 0.14, bevelEnabled: false }),
      color: WOOD_DARK,
      position: [sx * (W / 2) - 0.07, top, 0],
      rotation: [0, Math.PI / 2, 0],
    })
  }
  for (const sz of [-1, 1]) {
    const cz = sz * run / 2
    parts.push({
      geo: new THREE.BoxGeometry(W + 0.6, 0.12, slopeLen),
      color: WOOD_DARK,
      position: [0, top + rise / 2, cz],
      rotation: [sz * slopeAngle, 0, 0],
    })
    // Schnee: eine dicke Auflage, an der Traufe etwas zurueckgesetzt und
    // mit weichem Wulst davor.
    parts.push({
      geo: new THREE.BoxGeometry(W + 0.52, 0.26, slopeLen - 0.1),
      color: sz > 0 ? SNOW : SNOW_SHADE,
      position: [0, top + rise / 2 + 0.18, cz],
      rotation: [sz * slopeAngle, 0, 0],
    })
  }
  // Wulst an der vorderen Traufe
  // Die Dachlinie faellt vom First (z = 0, top + rise) bis zur Traufe
  // (z = run, top).
  const roofY = (z) => top + rise - Math.abs(z) * (rise / run)
  const eaveY = roofY(run) + 0.14
  const eaveZ = front + over - 0.02
  parts.push({
    geo: new THREE.CylinderGeometry(0.15, 0.15, W + 0.5, 10),
    color: SNOW,
    position: [0, eaveY, eaveZ],
    rotation: [0, 0, Math.PI / 2],
    scale: [1, 1, 0.8],
  })
  // Eiszapfen – unregelmaessig lang, damit sie nicht wie ein Kamm aussehen.
  const lens = [0.22, 0.34, 0.16, 0.42, 0.2, 0.3, 0.14, 0.38, 0.24, 0.18, 0.33]
  lens.forEach((len, i) => {
    parts.push({
      geo: new THREE.ConeGeometry(0.035, len, 5),
      color: ICE,
      position: [-W / 2 - 0.1 + (i + 0.5) * ((W + 0.2) / lens.length), eaveY - 0.12 - len / 2, eaveZ + 0.02],
      rotation: [Math.PI, 0, 0],
    })
  })
  // Kleiner Schornstein mit Schneehaube.
  parts.push({ geo: new THREE.BoxGeometry(0.3, 0.7, 0.3), color: STONE, position: [W / 2 - 0.55, top + rise, -0.35] })
  parts.push({ geo: new THREE.BoxGeometry(0.38, 0.09, 0.38), color: SNOW, position: [W / 2 - 0.55, top + rise + 0.38, -0.35] })

  // --- Blende unter der Traufe ------------------------------------------------
  // Rot-weiss gestreift: das Zeichen, an dem man die Kasse erkennt. Frueher
  // eine schraege Markise vor dem Schalter – aus 36 Grad lag sie genau auf
  // der Sichtlinie zu den Terminals (die steigt nur 0,73 m pro Meter zur
  // Kamera hin) und verdeckte sie zur Haelfte. Jetzt haengt sie senkrecht an
  // der Traufe, hinter den Terminals.
  const stripes = 11
  const valW = W + 0.5
  for (let i = 0; i < stripes; i++) {
    const x = -valW / 2 + (i + 0.5) * (valW / stripes)
    const c = i % 2 ? CREAM : RED
    parts.push({ geo: new THREE.BoxGeometry(valW / stripes, 0.2, 0.04), color: c, position: [x, eaveY - 0.2, eaveZ + 0.03] })
    parts.push({
      geo: new THREE.CylinderGeometry(valW / stripes / 2, valW / stripes / 2, 0.04, 10, 1, false, 0, Math.PI),
      color: c,
      position: [x, eaveY - 0.3, eaveZ + 0.03],
      rotation: [Math.PI / 2, Math.PI / 2, 0],
    })
  }

  // --- Beiwerk --------------------------------------------------------------
  // Ski und Stoecke an der rechten Wand.
  for (const [i, c] of [[0, 0xe0b23a], [1, 0x2b8ce6]]) {
    parts.push({
      geo: new THREE.BoxGeometry(0.08, 1.7, 0.03),
      color: c,
      position: [W / 2 + 0.1, B + 0.86, 0.45 + i * 0.14],
      rotation: [0, Math.PI / 2, -0.12],
    })
  }
  for (let i = 0; i < 2; i++) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.015, 0.015, 1.3, 5),
      color: 0x3a3f46,
      position: [W / 2 + 0.12, B + 0.66, -0.2 - i * 0.12],
      rotation: [0, 0, -0.15],
    })
  }
  // Holzkiste links, mit Schnee darauf.
  parts.push({ geo: new THREE.BoxGeometry(0.55, 0.42, 0.45), color: WOOD_LIGHT, position: [-W / 2 - 0.42, 0.21, -0.4], rotation: [0, 0.25, 0] })
  parts.push({ geo: new THREE.BoxGeometry(0.5, 0.07, 0.4), color: SNOW, position: [-W / 2 - 0.42, 0.45, -0.4], rotation: [0, 0.25, 0] })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.78 }))
  snowDust(body.geometry, 0.3, 0.8)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Glasscheibe rechts im Schalter – halb zugeschoben, leicht blaeulich.
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W / 2 - 0.55, winTop - counterY - 0.1),
    new THREE.MeshStandardMaterial({ color: 0xcfe6fa, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }),
  )
  glass.position.set(0.35 + (W / 2 - 0.55) / 2 + 0.02, (winTop + counterY) / 2, front + 0.03)
  group.add(glass)

  // --- Kassierer ------------------------------------------------------------
  // Klein, rund, mit Muetze. Ohne ihn ist ein Schalter ein Loch in der Wand.
  const cashier = new THREE.Group()
  const torso = new THREE.Mesh(
    assemble([
      { geo: new THREE.CylinderGeometry(0.26, 0.32, 0.55, 10), color: 0x2f6bd8, position: [0, 0.27, 0] },
      { geo: new THREE.TorusGeometry(0.2, 0.07, 6, 12), color: RED, position: [0, 0.55, 0.02], rotation: [Math.PI / 2, 0, 0] },
      // Arme auf dem Brett
      { geo: new THREE.CapsuleGeometry(0.07, 0.34, 3, 6), color: 0x2f6bd8, position: [-0.26, 0.2, 0.2], rotation: [1.2, 0, 0.3] },
    ]),
    vertexColorMaterial({ roughness: 0.8 }),
  )
  cashier.add(torso)
  const wave = new THREE.Mesh(
    assemble([
      { geo: new THREE.CapsuleGeometry(0.07, 0.34, 3, 6), color: 0x2f6bd8, position: [0, 0.2, 0] },
      { geo: new THREE.SphereGeometry(0.08, 8, 6), color: 0xf1c7a3, position: [0, 0.42, 0] },
    ]),
    vertexColorMaterial({ roughness: 0.8 }),
  )
  wave.position.set(0.27, 0.36, 0.05)
  wave.rotation.set(1.1, 0, -0.3)
  cashier.add(wave)
  const head = new THREE.Group()
  head.add(new THREE.Mesh(
    assemble([
      { geo: new THREE.SphereGeometry(0.22, 14, 10), color: 0xf1c7a3, position: [0, 0, 0] },
      // Muetze mit Bommel
      { geo: new THREE.SphereGeometry(0.235, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), color: RED, position: [0, 0.04, 0] },
      { geo: new THREE.CylinderGeometry(0.24, 0.24, 0.07, 14), color: CREAM, position: [0, 0.06, 0] },
      { geo: new THREE.SphereGeometry(0.08, 8, 6), color: CREAM, position: [0, 0.3, 0] },
      // Augen und Nase – zur Kamera, also nach +Z.
      { geo: new THREE.SphereGeometry(0.028, 6, 4), color: 0x1d232a, position: [-0.08, -0.02, 0.2] },
      { geo: new THREE.SphereGeometry(0.028, 6, 4), color: 0x1d232a, position: [0.08, -0.02, 0.2] },
      { geo: new THREE.SphereGeometry(0.04, 6, 4), color: 0xe7a07f, position: [0, -0.07, 0.22] },
    ]),
    vertexColorMaterial({ roughness: 0.7 }),
  ))
  head.position.y = 0.8
  cashier.add(head)
  cashier.position.set(-0.35, counterY - 0.28, front - 0.42)
  cashier.traverse((o) => { o.castShadow = true })
  group.add(cashier)

  // --- Die beiden Terminals -------------------------------------------------
  const terminals = []
  const screenTex = [paypalScreen(), solanaScreen()]
  const tint = [0x2b8ce6, 0x9945ff]
  const tilt = -0.62   // Pultneigung: bei 36 Grad Kamera fast frontal
  for (let i = 0; i < 2; i++) {
    const t = new THREE.Group()
    const x = i === 0 ? -0.9 : 0.9
    t.position.set(x, counterY + 0.06, front + 0.5)
    const base = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.34, 0.05, 0.26), color: 0x2a2f36, position: [0, 0.025, 0] },
        { geo: new THREE.CylinderGeometry(0.035, 0.05, 0.22, 8), color: 0x3a4048, position: [0, 0.13, -0.02] },
      ]),
      vertexColorMaterial({ roughness: 0.4, metalness: 0.3 }),
    )
    t.add(base)
    const headT = new THREE.Group()
    headT.position.set(0, 0.26, -0.02)
    headT.rotation.x = tilt
    const shell = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.72, 0.56, 0.08), color: 0x22272e, position: [0, 0, 0] },
        // Farbiger Rahmen – auch im Leerlauf sieht man, welches welches ist.
        { geo: new THREE.BoxGeometry(0.76, 0.6, 0.05), color: tint[i], position: [0, 0, -0.03] },
        // Kartenschlitz unten
        { geo: new THREE.BoxGeometry(0.4, 0.035, 0.05), color: 0x0e1115, position: [0, -0.3, 0.02] },
      ]),
      vertexColorMaterial({ roughness: 0.35, metalness: 0.2 }),
    )
    shell.castShadow = true
    headT.add(shell)
    const screen = createScreen(screenTex[i], 0.66, 0.495)
    screen.position.z = 0.042
    headT.add(screen)
    const halo = createHalo(tint[i], 1.6)
    halo.position.z = -0.08
    headT.add(halo)
    // Beleg, der beim Bezahlen aus dem Schlitz faehrt.
    const receipt = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.34),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }),
    )
    receipt.position.set(0, -0.3, 0.035)
    receipt.visible = false
    headT.add(receipt)
    t.add(headT)
    group.add(t)
    terminals.push({ group: t, head: headT, screen, halo, receipt, pop: 0, receiptT: 1 })
  }

  // --- Tafel auf dem Aufsteller -----------------------------------------------
  const boardTex = chalkboardTexture()
  const easel = new THREE.Group()
  easel.add(new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(0.06, 1.1, 0.05), color: WOOD_DARK, position: [-0.34, 0.5, 0], rotation: [-0.2, 0, 0] },
      { geo: new THREE.BoxGeometry(0.06, 1.1, 0.05), color: WOOD_DARK, position: [0.34, 0.5, 0], rotation: [-0.2, 0, 0] },
      { geo: new THREE.BoxGeometry(0.06, 1.05, 0.05), color: WOOD_DARK, position: [0, 0.48, -0.3], rotation: [0.3, 0, 0] },
      { geo: new THREE.BoxGeometry(0.8, 0.66, 0.05), color: WOOD_DARK, position: [0, 0.66, 0.08], rotation: [-0.2, 0, 0] },
    ]),
    vertexColorMaterial({ roughness: 0.85 }),
  ))
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.56), new THREE.MeshStandardMaterial({ map: boardTex, roughness: 0.95 }))
  board.position.set(0, 0.66, 0.112)
  board.rotation.x = -0.2
  easel.add(board)
  easel.position.set(-W / 2 - 0.55, 0, front + 0.75)
  easel.rotation.y = 0.35
  easel.traverse((o) => { o.castShadow = true })
  group.add(easel)

  // --- Laterne am rechten Pfosten ------------------------------------------------
  const lantern = new THREE.Group()
  lantern.add(new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(0.05, 0.05, 0.36), color: 0x2a2f36, position: [0, 0.2, -0.16] },
      { geo: new THREE.ConeGeometry(0.14, 0.12, 4), color: 0x2a2f36, position: [0, 0.11, 0], rotation: [0, Math.PI / 4, 0] },
      { geo: new THREE.BoxGeometry(0.16, 0.03, 0.16), color: 0x2a2f36, position: [0, -0.14, 0] },
    ]),
    vertexColorMaterial({ roughness: 0.5, metalness: 0.4 }),
  ))
  const flame = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.2, 0.12),
    new THREE.MeshBasicMaterial({ color: WARM, toneMapped: false }),
  )
  flame.position.y = -0.03
  lantern.add(flame)
  lantern.position.set(W / 2 + 0.12, winTop - 0.1, front + 0.3)
  group.add(lantern)

  // --- Absperrung mit Kordel ------------------------------------------------------
  // Vier Pfosten und zwei durchhaengende rote Kordeln: eine Schlange, in der
  // niemand steht, sagt trotzdem, wo man sich anstellt.
  const rails = []
  const posts = [[-1.25, 2.3], [-1.25, 3.9], [1.25, 2.3], [1.25, 3.9]]
  for (const [x, z] of posts) {
    rails.push({ geo: new THREE.CylinderGeometry(0.04, 0.04, 0.95, 8), color: 0xc9a44a, position: [x, 0.47, z] })
    rails.push({ geo: new THREE.CylinderGeometry(0.15, 0.17, 0.05, 12), color: 0x3a3f46, position: [x, 0.03, z] })
    rails.push({ geo: new THREE.SphereGeometry(0.06, 8, 6), color: 0xd9b24a, position: [x, 0.97, z] })
  }
  const railMesh = new THREE.Mesh(assemble(rails), vertexColorMaterial({ roughness: 0.35, metalness: 0.5 }))
  railMesh.castShadow = true
  group.add(railMesh)
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0xa3232b, roughness: 0.6 })
  for (const x of [-1.25, 1.25]) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x, 0.88, 2.3), new THREE.Vector3(x, 0.6, 3.1), new THREE.Vector3(x, 0.88, 3.9),
    )
    const rope = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.03, 6), ropeMat)
    rope.castShadow = true
    group.add(rope)
  }

  // --- Beschriftung auf der Markise ---------------------------------------------
  const tex = labelTexture(label, {
    width: 512, height: 128, background: null, color: '#ffffff',
    font: '800 72px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.2, 0.62),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  // Auf die Dachflaeche gelegt, nicht auf die Markise: vorn auf dem Schnee
  // liest man sie aus dreiunddreissig Metern, und herangezoomt verdeckt sie
  // nichts vom Schalter.
  const plateZ = 0.8
  plate.position.set(0, roofY(plateZ) + 0.37, plateZ)
  plate.rotation.x = -Math.PI / 2 + slopeAngle
  group.add(plate)
  const plateBack = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.1, 0.5),
    new THREE.MeshStandardMaterial({ color: RED, roughness: 0.7 }),
  )
  plateBack.position.set(0, roofY(plateZ) + 0.365, plateZ)
  plateBack.rotation.x = -Math.PI / 2 + slopeAngle
  plateBack.renderOrder = -1
  group.add(plateBack)

  // Warmes Licht im Schalter.
  const lamp = new THREE.PointLight(WARM, 5.5, 9, 2)
  lamp.position.set(0, counterY + 0.8, front - 0.2)
  group.add(lamp)

  // --- Auswahl und Bewegung -----------------------------------------------------
  let selected = null
  let lookAt = 0
  let waving = 0
  group.userData.select = (index) => {
    selected = index
    terminals.forEach((t, i) => {
      t.screen.userData.want = index === null ? 0.8 : index === i ? 1.12 : 0.38
    })
    if (index !== null) waving = Math.max(waving, 0.6)
  }
  group.userData.press = (index) => {
    const t = terminals[index]
    if (!t) return
    t.screen.userData.flash = 1
    t.receiptT = 0
    t.receipt.visible = true
    waving = 1.4
  }
  group.userData.animate = (time, dt = 1 / 60) => {
    const k = 1 - Math.exp(-8 * dt)
    for (const [i, t] of terminals.entries()) {
      t.screen.userData.step(dt)
      const on = selected === i ? 1 : 0
      t.pop += (on - t.pop) * k
      t.head.position.y = 0.26 + t.pop * 0.07
      t.head.rotation.x = tilt + t.pop * 0.08
      t.halo.material.opacity = t.pop * (0.5 + Math.sin(time * 3) * 0.08) + t.screen.userData.flash * 0.6
      // Der Beleg schiebt sich eine Sekunde lang nach unten heraus, dann
      // verschwindet er wieder im Schlitz.
      if (t.receiptT < 1) {
        t.receiptT = Math.min(1, t.receiptT + dt * 0.7)
        const out = Math.sin(t.receiptT * Math.PI)
        t.receipt.position.y = -0.3 - out * 0.2
        t.receipt.scale.y = Math.max(0.01, out)
        if (t.receiptT >= 1) t.receipt.visible = false
      }
    }
    // Kopf zum gewaehlten Terminal, sonst leichtes Umschauen.
    const want = selected === null ? Math.sin(time * 0.4) * 0.25 : selected === 0 ? -0.55 : 0.5
    lookAt += (want - lookAt) * (1 - Math.exp(-5 * dt))
    head.rotation.y = lookAt
    head.position.y = 0.8 + Math.sin(time * 2.1) * 0.012
    waving = Math.max(0, waving - dt)
    wave.rotation.set(waving > 0 ? -2.3 : 1.1, 0, waving > 0 ? -0.35 + Math.sin(time * 14) * 0.35 : -0.3)
    wave.position.y = waving > 0 ? 0.5 : 0.36
    const flicker = 1 + Math.sin(time * 9.1) * 0.05 + Math.sin(time * 4.3) * 0.05
    flame.material.color.setHex(WARM).multiplyScalar(flicker)
    lamp.intensity = 5.5 * flicker
  }

  group.userData.footprint = { width: W + 1.2, depth: D + 0.6 }
  return group
}

// Kreidetafel: Handschrift ist eine Frage von Schraege und Unruhe, nicht der
// Schriftart – leicht gedrehte Zeilen, weiche Kreidekanten.
function chalkboardTexture() {
  const c = document.createElement('canvas')
  c.width = 384
  c.height = 300
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#26352e'
  ctx.fillRect(0, 0, 384, 300)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`
    ctx.fillRect(Math.random() * 384, Math.random() * 300, 2, 2)
  }
  ctx.fillStyle = '#f4f1e8'
  ctx.textBaseline = 'middle'
  const line = (text, y, size, rot = 0, color = '#f4f1e8', x = 30) => {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.font = `700 ${size}px "Chalkboard SE", "Comic Sans MS", ui-rounded, system-ui, sans-serif`
    ctx.fillStyle = color
    ctx.shadowColor = 'rgba(255,255,255,0.3)'
    ctx.shadowBlur = 3
    ctx.fillText(text, 0, 0)
    ctx.restore()
  }
  line('Heute', 46, 40, -0.04, '#ffd66b')
  line('Kaffee ........ 3 €', 112, 30, 0.01)
  line('Gipfelbier ... 5 €', 160, 30, -0.01)
  line('Kaiserschmarrn  8 €', 208, 30, 0.015)
  line('♥ Danke!', 262, 32, -0.03, '#9ee6c4')
  return (() => {
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
}
