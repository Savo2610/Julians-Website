import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'
import { mulberry32 } from '../../core/rng.js'
import { createGearDepot } from './gear-depot.js'

// Das Tourenbuero: md.veerka.mp im Tal. md vereint vier Werkzeuge –
// Dokument, Whiteboard, Memos, Packliste –, und im Gebirge gehoeren genau
// diese vier vor jede Tour: den Plan aufschreiben, die Route an die Tafel
// zeichnen, Zettel an die Pinnwand heften, den Rucksack packen. Deshalb kein
// neues Gebaeude, sondern das alte Materialdepot (die Packliste war die erste
// der vier) auf einem Holzpodest mit Tafelwand und Stehpult dazu.
//
// Lokal zeigt +z zur Kamera, +x nach rechts im Bild. Die Auswahl 0–3 folgt
// den Zielen der Station: Dokument (Pult), Board (Tafel), Memos (Pinnwand),
// Packliste (Kiste). Jedes Teil fuehrt beim Waehlen sein eigenes Stueck vor.

const WOOD = 0x7b5236
const WOOD_DARK = 0x543a26
const WOOD_LIGHT = 0x9a6c45
const METAL = 0xb7bdc4
const SNOW = 0xf4f8fc

// Handschrift fuer Tafel und Zettel; auf dem Mac Marker Felt, sonst was da ist.
const HAND = '"Marker Felt", "Chalkboard SE", "Comic Sans MS", "Segoe Print", cursive'
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
const INK = '#26323f'
// Die Farbe des Boards in der Auswahl; dieselbe Farbe zieht der Marker.
const LILA = '#7b5fd1'

const TOP = 0.125 // Oberkante des Podests

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

function texture(c) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// --- Tafel: eine Skitour im Stil der md-Boards ------------------------------
// Notizzettel, Pfeile, die an Elementen haengen, und die Route in Lila. Die
// Route wird bis `p` gezeichnet (0–1); zurueck kommt die Spitze, an der der
// Marker sitzt.
const TW = 1024
const TH = 448
const ROUTE = [[318, 384], [470, 344], [418, 292], [530, 252], [488, 206], [552, 134]]

function zettel(ctx, x, y, w, h, farbe, zeilen, dreh) {
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate(dreh)
  ctx.fillStyle = 'rgba(0,0,0,0.08)'
  ctx.fillRect(-w / 2 + 4, -h / 2 + 6, w, h)
  ctx.fillStyle = farbe
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.fillStyle = INK
  ctx.font = `600 34px ${HAND}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  zeilen.forEach((z, i) => ctx.fillText(z, 0, (i - (zeilen.length - 1) / 2) * 40))
  ctx.restore()
}

function zeichneTafel(ctx, p) {
  ctx.fillStyle = '#fbfbf8'
  ctx.fillRect(0, 0, TW, TH)
  // Reste von frueher, nicht ganz weggewischt.
  ctx.strokeStyle = 'rgba(120,130,140,0.12)'
  ctx.lineWidth = 22
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(700, 380); ctx.quadraticCurveTo(800, 330, 960, 400)
  ctx.moveTo(90, 400); ctx.lineTo(230, 370)
  ctx.stroke()

  ctx.fillStyle = INK
  ctx.font = `700 50px ${HAND}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText('Tour Sa.', 44, 70)

  // Berg mit Schneekappe und Fahne
  ctx.strokeStyle = INK
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(352, 410); ctx.lineTo(552, 120); ctx.lineTo(636, 214); ctx.lineTo(700, 160); ctx.lineTo(872, 410)
  ctx.stroke()
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(500, 196); ctx.lineTo(524, 180); ctx.lineTo(548, 200); ctx.lineTo(574, 178); ctx.lineTo(596, 196)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(552, 120); ctx.lineTo(552, 64)
  ctx.stroke()
  ctx.fillStyle = '#e4613a'
  ctx.beginPath()
  ctx.moveTo(554, 64); ctx.lineTo(596, 76); ctx.lineTo(554, 90)
  ctx.fill()

  // Huette am Start
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(272, 404); ctx.lineTo(272, 372); ctx.lineTo(292, 352); ctx.lineTo(312, 372); ctx.lineTo(312, 404); ctx.closePath()
  ctx.stroke()

  // Zettel wie auf einem md-Board, ein Pfeil haengt am rosa Zettel
  zettel(ctx, 52, 118, 176, 116, '#ffb3c7', ['Pieps', 'checken!'], -0.05)
  zettel(ctx, 836, 30, 156, 112, '#ffe27a', ['7:00', 'ab Hütte'], 0.04)
  ctx.strokeStyle = INK
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(150, 240); ctx.quadraticCurveTo(170, 360, 256, 386)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(240, 372); ctx.lineTo(258, 387); ctx.lineTo(236, 396)
  ctx.stroke()

  // Route bis p
  const laengen = []
  let gesamt = 0
  for (let i = 1; i < ROUTE.length; i++) {
    const l = Math.hypot(ROUTE[i][0] - ROUTE[i - 1][0], ROUTE[i][1] - ROUTE[i - 1][1])
    laengen.push(l)
    gesamt += l
  }
  let rest = gesamt * p
  let spitze = ROUTE[0]
  ctx.strokeStyle = LILA
  ctx.lineWidth = 8
  ctx.setLineDash([20, 13])
  ctx.beginPath()
  ctx.moveTo(...ROUTE[0])
  for (let i = 1; i < ROUTE.length && rest > 0; i++) {
    const u = Math.min(1, rest / laengen[i - 1])
    const [ax, ay] = ROUTE[i - 1]
    const [bx, by] = ROUTE[i]
    spitze = [ax + (bx - ax) * u, ay + (by - ay) * u]
    ctx.lineTo(...spitze)
    rest -= laengen[i - 1]
  }
  ctx.stroke()
  ctx.setLineDash([])
  if (p >= 1) {
    const [ax, ay] = ROUTE[ROUTE.length - 2]
    const [bx, by] = ROUTE[ROUTE.length - 1]
    const w = Math.atan2(by - ay, bx - ax)
    ctx.fillStyle = LILA
    ctx.beginPath()
    ctx.moveTo(bx + Math.cos(w) * 8, by + Math.sin(w) * 8)
    ctx.lineTo(bx + Math.cos(w + 2.5) * 26, by + Math.sin(w + 2.5) * 26)
    ctx.lineTo(bx + Math.cos(w - 2.5) * 26, by + Math.sin(w - 2.5) * 26)
    ctx.fill()
  }
  return spitze
}

// --- Pult: ein md-Dokument ---------------------------------------------------
// So, wie md es im Editor zeigt: Markdown-Zeichen blass, Text dunkel, der
// blaue Cursor des md-Symbols am Ende. Getippt wird bis `n` Zeichen.
const PW = 512
const PH = 420
const DOKUMENT = [
  [['# ', 1], ['Skitour', 0, 'h']],
  [],
  [['- [x] ', 1], ['Pieps', 0]],
  [['- [x] ', 1], ['Felle', 0]],
  [['- [ ] ', 1], ['Brotzeit', 0]],
  [['**', 1], ['Start', 0, 'b'], ['**', 1], [' 7:00', 0]],
]
const ZEICHEN = DOKUMENT.reduce((s, z) => s + z.reduce((a, [t]) => a + t.length, 0) + 1, 0)

function zeichneSeite(ctx, n) {
  ctx.fillStyle = '#fdfcf9'
  ctx.fillRect(0, 0, PW, PH)
  ctx.textBaseline = 'alphabetic'
  let rest = n
  let x = 30
  let y = 72
  for (const zeile of DOKUMENT) {
    x = 30
    for (const [text, blass, art] of zeile) {
      if (rest <= 0) break
      const t = text.slice(0, rest)
      rest -= t.length
      ctx.font = art === 'h' ? `700 62px ${MONO}` : art === 'b' ? `700 46px ${MONO}` : `400 46px ${MONO}`
      if (zeile[0]?.[0] === '# ' && blass) ctx.font = `700 62px ${MONO}`
      ctx.fillStyle = blass ? '#b9b8b2' : '#1e1e1e'
      ctx.fillText(t, x, y)
      x += ctx.measureText(t).width
    }
    if (rest <= 0) break
    rest -= 1
    y += zeile.length ? (zeile[0][0] === '# ' ? 84 : 66) : 26
  }
  return [x, y]
}

// --- Zettel der Pinnwand -----------------------------------------------------
function kritzelTextur() {
  const [c, ctx] = canvas(128, 128)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(38,50,63,0.75)'
  ctx.lineCap = 'round'
  const r = mulberry32(7)
  ctx.lineWidth = 9
  ctx.beginPath(); ctx.moveTo(22, 34); ctx.lineTo(70 + r() * 30, 34); ctx.stroke()
  ctx.lineWidth = 5
  for (let i = 0; i < 3; i++) {
    const y = 62 + i * 20
    ctx.beginPath()
    ctx.moveTo(22, y)
    for (let x = 22; x < 80 + r() * 26; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.4 + i) * 2.5)
    ctx.stroke()
  }
  return texture(c)
}

function korkTextur() {
  const [c, ctx] = canvas(256, 208)
  ctx.fillStyle = '#b98a55'
  ctx.fillRect(0, 0, 256, 208)
  const r = mulberry32(11)
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = r() < 0.5 ? 'rgba(90,55,25,0.35)' : 'rgba(235,200,150,0.35)'
    ctx.fillRect(r() * 256, r() * 208, 1 + r() * 3, 1 + r() * 3)
  }
  return texture(c)
}

export function createTourenbuero() {
  const group = new THREE.Group()
  const parts = []

  // --- Podest --------------------------------------------------------------
  // Dielen mit Fugen, unten tiefer als oben, damit es am leichten Hang nicht
  // auf einer Seite schwebt.
  for (let i = 0; i < 9; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(0.49, 0.4, 2.4),
      color: i % 2 ? WOOD : WOOD_LIGHT,
      position: [-2.0 + i * 0.5, TOP - 0.2, 0.08],
    })
  }
  // Schneekante vorn, wo niemand gefegt hat
  parts.push({ geo: new THREE.BoxGeometry(4.5, 0.06, 0.22), color: SNOW, position: [0, TOP + 0.02, 1.2] })

  // --- Tafelwand -----------------------------------------------------------
  const WAND_Z = -0.9
  const MAST = 2.55
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.15, MAST, 0.15), color: WOOD_DARK, position: [sx * 2.0, TOP + MAST / 2, WAND_Z - 0.1] })
  }
  // Vordach: vorn tiefer, aber hoch genug, dass es die Oberkante der Tafel
  // aus 36 Grad nicht abschneidet.
  parts.push({ geo: new THREE.BoxGeometry(4.4, 0.08, 0.7), color: WOOD_DARK, position: [0, TOP + MAST, WAND_Z + 0.1], rotation: [0.22, 0, 0] })
  parts.push({ geo: new THREE.BoxGeometry(4.5, 0.12, 0.74), color: SNOW, position: [0, TOP + MAST + 0.09, WAND_Z + 0.08], rotation: [0.22, 0, 0] })
  // Zwei Riegel zwischen den Masten, an denen Tafel und Pinnwand haengen
  for (const y of [1.05, 2.05]) {
    parts.push({ geo: new THREE.BoxGeometry(4.0, 0.1, 0.08), color: WOOD, position: [0, TOP + y, WAND_Z - 0.12] })
  }

  // --- Stehpult ------------------------------------------------------------
  const PULT = { x: -1.4, z: 0.45 }
  parts.push({ geo: new THREE.BoxGeometry(0.6, 0.05, 0.45), color: WOOD_DARK, position: [PULT.x, TOP + 0.025, PULT.z] })
  parts.push({ geo: new THREE.BoxGeometry(0.12, 1.02, 0.12), color: WOOD_DARK, position: [PULT.x, TOP + 0.51, PULT.z] })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Schild auf dem Dach, wie WERKSTATT und SKIKASSE: aus 33 m der Name.
  const schild = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.42, 0.06),
    [
      ...Array(4).fill(new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.85 })),
      new THREE.MeshStandardMaterial({
        map: labelTexture('TOURENBÜRO', {
          width: 512, height: 112, background: '#5a3d27', color: '#f6efe2',
          font: '700 70px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
        }),
        roughness: 0.8,
      }),
      new THREE.MeshStandardMaterial({ color: WOOD_DARK, roughness: 0.85 }),
    ],
  )
  schild.position.set(0, TOP + MAST + 0.42, WAND_Z + 0.05)
  schild.rotation.x = -0.15
  schild.castShadow = true
  group.add(schild)

  // --- Tafel und Pinnwand ----------------------------------------------------
  // Leicht zurueckgelehnt (Pultneigung), sonst liest man sie von oben nur
  // gestaucht.
  const wand = new THREE.Group()
  wand.position.set(0, TOP + 1.58, WAND_Z)
  wand.rotation.x = -0.2
  group.add(wand)

  const WB = { x: -0.66, w: 2.42, h: 1.12 }
  const rahmen = new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(WB.w + 0.08, WB.h + 0.08, 0.04), color: METAL, position: [WB.x, 0, 0] },
      // Ablage fuer die Marker
      { geo: new THREE.BoxGeometry(1.1, 0.03, 0.1), color: METAL, position: [WB.x, -WB.h / 2 - 0.05, 0.05] },
      { geo: new THREE.BoxGeometry(1.32, 1.2, 0.05), color: WOOD_LIGHT, position: [1.29, 0, 0] },
    ]),
    vertexColorMaterial({ roughness: 0.5 }),
  )
  rahmen.castShadow = true
  wand.add(rahmen)

  const [tc, tctx] = canvas(TW, TH)
  let spitze = zeichneTafel(tctx, 1)
  const tafelTex = texture(tc)
  const tafel = new THREE.Mesh(
    new THREE.PlaneGeometry(WB.w - 0.06, WB.h - 0.06),
    new THREE.MeshStandardMaterial({ map: tafelTex, roughness: 0.45 }),
  )
  tafel.position.set(WB.x, 0, 0.022)
  wand.add(tafel)
  const tafelPunkt = ([cx, cy]) => new THREE.Vector3(
    WB.x + (cx / TW - 0.5) * (WB.w - 0.06),
    (0.5 - cy / TH) * (WB.h - 0.06),
    0.03,
  )

  // Drei Marker in der Ablage; der lila zeichnet.
  const markerGeo = (farbe) => assemble([
    // Groesser als echt: in Originalgroesse sah man aus 9 m nicht, wer zeichnet.
    { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), color: 0xf2f2f0, position: [0, 0.115, 0] },
    { geo: new THREE.CylinderGeometry(0.034, 0.034, 0.07, 8), color: farbe, position: [0, 0.245, 0] },
    { geo: new THREE.CylinderGeometry(0.01, 0.02, 0.016, 6), color: farbe, position: [0, 0.008, 0] },
  ])
  const markerRuhe = []
  for (const [i, farbe] of [0x26323f, 0xe4613a].entries()) {
    const m = new THREE.Mesh(markerGeo(farbe), vertexColorMaterial({ roughness: 0.5 }))
    m.position.set(WB.x - 0.35 + i * 0.2, -WB.h / 2 - 0.02, 0.06)
    m.rotation.z = Math.PI / 2
    wand.add(m)
  }
  const marker = new THREE.Mesh(markerGeo(new THREE.Color(LILA).getHex()), vertexColorMaterial({ roughness: 0.5 }))
  const RUHE = new THREE.Vector3(WB.x + 0.15, -WB.h / 2 - 0.02, 0.06)
  marker.position.copy(RUHE)
  marker.rotation.z = Math.PI / 2
  wand.add(marker)
  markerRuhe.push(RUHE)

  // Pinnwand mit Zetteln. Jeder Zettel haengt an seiner Nadel oben, damit er
  // im Wind um sie schwingt und nicht um seine Mitte.
  const kork = new THREE.Mesh(
    new THREE.PlaneGeometry(1.22, 1.1),
    new THREE.MeshStandardMaterial({ map: korkTextur(), roughness: 0.95 }),
  )
  kork.position.set(1.29, 0, 0.027)
  wand.add(kork)

  const kritzel = kritzelTextur()
  const zettelGeo = new THREE.PlaneGeometry(0.26, 0.26).translate(0, -0.12, 0)
  const nadelGeo = new THREE.SphereGeometry(0.018, 8, 6)
  const nadelMat = new THREE.MeshStandardMaterial({ color: 0xd8443a, roughness: 0.4 })
  const neuerZettel = (farbe, [x, y], dreh) => {
    const pin = new THREE.Group()
    pin.position.set(1.29 + x, y + 0.12, 0.04)
    const blatt = new THREE.Mesh(zettelGeo, new THREE.MeshStandardMaterial({ map: kritzel, color: farbe, roughness: 0.9, side: THREE.DoubleSide }))
    blatt.rotation.z = dreh
    pin.add(blatt)
    const nadel = new THREE.Mesh(nadelGeo, nadelMat)
    nadel.position.z = 0.012
    pin.add(nadel)
    wand.add(pin)
    return { pin, blatt, phase: dreh * 40 }
  }
  const PLAETZE = [[0.02, 0.3], [0.4, 0.27], [-0.39, -0.05], [0.02, -0.02], [0.4, -0.06], [-0.38, -0.38], [0.03, -0.36], [0.4, -0.39]]
  const FARBEN = [0xffe27a, 0xffb3c7, 0xbfe8c9, 0xb9dcff, 0xffe27a, 0xffd0a1, 0xbfe8c9, 0xffb3c7]
  const zettel = PLAETZE.map((p, i) => neuerZettel(FARBEN[i], p, (mulberry32(30 + i)() - 0.5) * 0.18))
  // Oben links bleibt frei: dort landet das neueste Memo, wie in der App oben.
  const ZIEL = new THREE.Vector3(1.29 - 0.38, 0.3 + 0.12, 0.05)
  const memo = neuerZettel(0xffe27a, [-0.38, 0.3], -0.06)
  memo.pin.visible = false

  // --- Pult mit md-Dokument --------------------------------------------------
  // Schraeg zur Kamera: die Seite steht ihr bei 0,6 rad fast gegenueber.
  const pult = new THREE.Group()
  pult.position.set(PULT.x, TOP + 1.06, PULT.z)
  pult.rotation.x = 0.6
  group.add(pult)
  const platte = new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(0.98, 0.05, 0.76), color: WOOD },
      { geo: new THREE.BoxGeometry(0.98, 0.06, 0.04), color: WOOD_DARK, position: [0, 0.04, 0.38] },
    ]),
    vertexColorMaterial({ roughness: 0.8 }),
  )
  platte.castShadow = true
  pult.add(platte)
  const [sc, sctx] = canvas(PW, PH)
  let ende = zeichneSeite(sctx, ZEICHEN)
  const seiteTex = texture(sc)
  const seiteMat = new THREE.MeshStandardMaterial({ map: seiteTex, roughness: 0.9 })
  const SW = 0.86
  const SH = SW * PH / PW
  const seite = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), seiteMat)
  seite.rotation.x = -Math.PI / 2
  seite.position.y = 0.027
  pult.add(seite)
  // Der Cursor des md-Symbols: ein blauer Strich.
  const cursor = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.004, 0.06),
    new THREE.MeshBasicMaterial({ color: 0x14a0ff, toneMapped: false }),
  )
  pult.add(cursor)
  const setzeCursor = ([cx, cy]) => {
    cursor.position.set((cx / PW - 0.5) * SW + 0.01, 0.028, (cy / PH - 0.5) * SH - 0.016)
  }
  setzeCursor(ende)

  // --- Kiste: die Packliste von frueher ---------------------------------------
  const depot = createGearDepot()
  depot.position.set(0.7, TOP, 0.62)
  depot.rotation.y = -0.18
  depot.scale.setScalar(0.88)
  group.add(depot)

  // --- Auswahl und Bewegung --------------------------------------------------
  let gewaehlt = null
  let tippen = -1      // getippte Zeichen, -1 = fertig
  let zeichnen = -1    // s seit Beginn der Route, -1 = fertig
  let memoFlug = -1    // s seit Beginn des Anflugs
  let boe = 0          // Windstoss an der Pinnwand, klingt ab
  let blitz = 0
  let tipp = 0

  group.userData.select = (i) => {
    if (i === 0 && gewaehlt !== 0) tippen = 0
    if (i === 1 && gewaehlt !== 1) zeichnen = 0
    if (i === 2 && gewaehlt !== 2) { memoFlug = 0; boe = Math.max(boe, 0.6) }
    if (i !== 2 && gewaehlt === 2) memoFlug = -2
    depot.userData.select(i === 3 ? 0 : null)
    gewaehlt = i
  }
  group.userData.press = (i) => {
    if (i === 0) blitz = 1
    if (i === 1) tipp = 1
    if (i === 2) boe = 1.6
    if (i === 3) depot.userData.press()
  }

  const ANFAHRT = 0.3
  const STRICH = 1.6
  const ZURUECK = 0.35
  // Schreibhaltung: der Stift schaut nach rechts unten aus der Tafel heraus.
  // Senkrecht zur Tafel zeigte er genau zur Kamera und war nur ein Punkt.
  const SCHREIB = { x: Math.PI / 2 + 0.55, z: -0.5 }
  const zwischen = new THREE.Vector3()

  group.userData.animate = (t, dt = 1 / 60) => {
    depot.userData.animate(t, dt)

    // Dokument: in gut anderthalb Sekunden neu getippt, danach blinkt der Cursor.
    if (tippen >= 0) {
      const vorher = Math.floor(tippen)
      tippen += dt * 52
      if (tippen >= ZEICHEN) {
        tippen = -1
        ende = zeichneSeite(sctx, ZEICHEN)
        seiteTex.needsUpdate = true
      } else if (Math.floor(tippen) !== vorher) {
        ende = zeichneSeite(sctx, Math.floor(tippen))
        seiteTex.needsUpdate = true
      }
      setzeCursor(ende)
    }
    cursor.visible = tippen >= 0 || Math.floor(t * 1.8) % 2 === 0
    blitz = Math.max(0, blitz - dt * 2.5)
    seiteMat.color.setScalar(1 + blitz * 0.35)

    // Board: der lila Marker holt sich die Route neu.
    if (zeichnen >= 0) {
      zeichnen += dt
      const s = zeichnen - ANFAHRT
      const p = Math.min(1, Math.max(0, s / STRICH))
      if (s <= STRICH + 0.05) {
        spitze = zeichneTafel(tctx, p)
        tafelTex.needsUpdate = true
      }
      const anTafel = tafelPunkt(spitze)
      anTafel.z += 0.01
      if (zeichnen < ANFAHRT) {
        const u = zeichnen / ANFAHRT
        zwischen.lerpVectors(RUHE, anTafel, u * u * (3 - 2 * u))
        zwischen.z += Math.sin(u * Math.PI) * 0.12
        marker.position.copy(zwischen)
        marker.rotation.set(SCHREIB.x * u, 0, Math.PI / 2 * (1 - u) + SCHREIB.z * u)
      } else if (s <= STRICH) {
        marker.position.copy(anTafel)
        marker.rotation.set(SCHREIB.x, 0, SCHREIB.z + Math.sin(s * 14) * 0.08)
      } else {
        const u = Math.min(1, (s - STRICH) / ZURUECK)
        zwischen.lerpVectors(anTafel, RUHE, u * u * (3 - 2 * u))
        zwischen.z += Math.sin(u * Math.PI) * 0.12
        marker.position.copy(zwischen)
        marker.rotation.set(SCHREIB.x * (1 - u), 0, SCHREIB.z * (1 - u) + Math.PI / 2 * u)
        if (u >= 1) zeichnen = -1
      }
    }
    if (tipp > 0) {
      tipp = Math.max(0, tipp - dt * 3)
      marker.position.z = (zeichnen >= 0 ? marker.position.z : RUHE.z) + Math.sin(tipp * Math.PI) * 0.06
    }

    // Memos: Wind an der Pinnwand, beim Waehlen fliegt ein neuer Zettel an.
    boe = Math.max(0, boe - dt * 0.9)
    const wind = 0.05 + boe * 0.5
    for (const z of [...zettel, memo]) {
      z.pin.rotation.x = -Math.abs(Math.sin(t * (2.1 + boe * 6) + z.phase)) * wind
      z.blatt.rotation.y = Math.sin(t * 1.7 + z.phase) * wind * 0.6
    }
    if (memoFlug >= 0) {
      memoFlug += dt
      const u = Math.min(1, memoFlug / 0.7)
      const e = 1 - (1 - u) ** 3
      memo.pin.visible = true
      memo.pin.position.set(
        ZIEL.x + (1 - e) * 1.1,
        ZIEL.y + Math.sin(u * Math.PI) * 0.25 + (1 - e) * 0.15,
        ZIEL.z + (1 - e) * 0.6,
      )
      memo.pin.rotation.z = (1 - e) * 2.4
      memo.pin.scale.setScalar(0.4 + e * 0.6)
    } else if (memoFlug < -1) {
      // Abgewaehlt: das neue Memo verschwindet wieder, damit es beim naechsten
      // Mal erneut ankommen kann.
      memoFlug = Math.min(-1, memoFlug + dt * 3)
      const s = Math.max(0, (-1 - memoFlug))
      memo.pin.scale.setScalar(s)
      if (s <= 0.01) { memo.pin.visible = false; memoFlug = -1 }
    }
  }

  // Kollision in lokalen Koordinaten (x nach rechts, z zur Kamera); die
  // Station dreht sie in die Welt.
  group.userData.kollision = [
    { dx: -1.4, dz: -0.6, r: 0.75 },
    { dx: 0.0, dz: -0.75, r: 0.75 },
    { dx: 1.4, dz: -0.6, r: 0.75 },
    { dx: PULT.x, dz: PULT.z, r: 0.5 },
    { dx: 0.7, dz: 0.62, r: 0.85 },
    { dx: 1.55, dz: 0.55, r: 0.45 },
  ]
  group.userData.footprint = { width: 4.6, depth: 2.6 }
  return group
}
