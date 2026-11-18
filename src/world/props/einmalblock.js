import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { CAMERA } from '../../config.js'

// Der Einmalblock am Ende des Werkzeugwegs – pad.veerka.mp als Gegenstand.
//
// Ein One-Time-Pad war wirklich ein Block: Seiten mit Zifferngruppen, jede
// nur einmal benutzt und danach verbrannt. Genau das liegt hier. Ein schraeg
// abgesaegter Baumstumpf, auf der Schnittflaeche der Abreissblock mit
// zinnoberrotem Leimrand (die Farbe der App), daneben eine Feuerschale.
// Herangezoomt reisst das oberste Blatt ab, segelt hinueber und verbrennt;
// darunter liegt ein neues mit anderen Ziffern. Wer das sieht, hat das
// Verfahren verstanden, ohne dass es irgendwo steht.
//
// Ein Stumpf und kein Pult: 15 m weiter steht seit dem Tourenbuero schon
// ein Stehpult mit Dokument, zwei davon am selben Weg laesen sich wie ein
// Muster. Der Platz ist der der Stechuhr (bis 18.11.), eine kleine Lichtung
// an der Waldkante – dort steht ein Stumpf, als gehoere er hin.

const RINDE = 0x5a4030
const RINDE_DUNKEL = 0x3e2c20
const SCHNITT = 0xc9a77a
const EISEN = 0x2f343b
const SCHNEE = 0xf7fbff
const PAPIER = 0xf3ecdc
const ZINNOBER = 0xd9452b

// Der Schnitt faellt 35 Grad zur Kamera hin ab. Seine Normale steht dann 55
// Grad ueber dem Boden, die Kamera 36 – der Block liegt ihr fast frontal
// zugewandt. Ein flacher Schnitt hiesse von oben ein Strich aus Papier, ein
// steilerer saehe nicht mehr nach Saegeschnitt aus.
const SCHRAEG = 0.61
const NEIGUNG = -(Math.PI / 2 - SCHRAEG)

// Blattgroesse auf dem Stumpf. Seitenverhaeltnis = Canvas 360 x 300.
const BW = 0.48
const BH = 0.4
const DAUER = 1.7  // s vom Abreissen bis in die Glut

function seite(ctx, nr) {
  const { width: w, height: h } = ctx.canvas
  ctx.fillStyle = '#f3ecdc'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#d9452b'
  ctx.fillRect(0, 0, w, 54)
  ctx.fillStyle = '#f3ecdc'
  ctx.font = '700 30px "IBM Plex Mono", ui-monospace, Menlo, monospace'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`PAD · ${String(nr).padStart(4, '0')}`, w / 2, 29)

  // Vier Zeilen zu zwei Gruppen. Mehr waeren aus der Vogelperspektive nur
  // noch grau; so liest man auf sieben Meter "Ziffern", nicht "Text".
  ctx.fillStyle = '#1d2430'
  ctx.font = '700 40px "IBM Plex Mono", ui-monospace, Menlo, monospace'
  const gruppe = () => String(Math.floor(Math.random() * 1e5)).padStart(5, '0')
  for (let i = 0; i < 4; i++) ctx.fillText(`${gruppe()} ${gruppe()}`, w / 2, 94 + i * 56)
}

function leinwand() {
  const c = document.createElement('canvas')
  c.width = 360
  c.height = 300
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { ctx: c.getContext('2d'), tex }
}

export function createEinmalblock() {
  const group = new THREE.Group()
  const fest = []

  // --- Stumpf --------------------------------------------------------------
  // Etwas links der Mitte, damit Stumpf und Schale zusammen um den Platz
  // herum stehen. Oben schraeg: die Deckelpunkte sinken nach vorn ab, der
  // Deckel des Zylinders wird so von selbst die Ellipse der Schnittflaeche.
  const PX = -0.28
  const R = 0.34
  const OBEN = 0.72   // Hoehe des Schnitts in der Mitte
  const tan = Math.tan(SCHRAEG)
  const schraeg = (g) => {
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > OBEN - 0.01) pos.setY(i, OBEN - pos.getZ(i) * tan)
    }
    return g
  }
  const stamm = new THREE.CylinderGeometry(R, R + 0.05, OBEN, 11)
  stamm.translate(0, OBEN / 2, 0)
  fest.push({ geo: schraeg(stamm), color: RINDE, position: [PX, 0, -0.04] })
  // Das helle Holz etwas kleiner als der Deckel: der Rand bleibt Rinde.
  const schnitt = new THREE.CircleGeometry(R - 0.04, 14)
  schnitt.rotateX(-Math.PI / 2)
  schnitt.translate(0, OBEN, 0)
  fest.push({ geo: schraeg(schnitt), color: SCHNITT, position: [PX, 0.006, -0.04] })
  // Drei Wurzelansaetze, sonst steht da ein Rohr im Schnee.
  for (const a of [0.6, 2.5, 4.3]) {
    fest.push({
      geo: new THREE.BoxGeometry(0.12, 0.14, 0.34),
      color: RINDE_DUNKEL,
      position: [PX + Math.sin(a) * 0.36, 0.05, -0.04 + Math.cos(a) * 0.36],
      rotation: [-0.35 * Math.cos(a), a, 0],
    })
  }
  fest.push({
    geo: (() => {
      const g = new THREE.SphereGeometry(0.42, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)
      g.scale(1.25, 0.28, 1)
      return g
    })(),
    color: SCHNEE,
    position: [0.1, -0.03, 0],
  })

  // --- Feuerschale ---------------------------------------------------------
  const SX = 0.62
  const SZ = 0.12
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4
    fest.push({
      geo: new THREE.CylinderGeometry(0.022, 0.028, 0.5, 5),
      color: EISEN,
      position: [SX + Math.sin(a) * 0.17, 0.25, SZ + Math.cos(a) * 0.17],
      rotation: [Math.cos(a) * 0.25, 0, -Math.sin(a) * 0.25],
    })
  }
  fest.push({
    geo: (() => {
      const g = new THREE.SphereGeometry(0.27, 12, 5, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5)
      g.scale(1, 0.55, 1)
      return g
    })(),
    color: EISEN,
    position: [SX, 0.6, SZ],
  })
  fest.push({ geo: new THREE.TorusGeometry(0.27, 0.025, 5, 16), color: EISEN, position: [SX, 0.6, SZ], rotation: [Math.PI / 2, 0, 0] })

  const koerper = new THREE.Mesh(assemble(fest), vertexColorMaterial({ roughness: 0.8, side: THREE.DoubleSide }))
  koerper.castShadow = true
  koerper.receiveShadow = true
  group.add(koerper)

  // Glut: ein flacher, selbst leuchtender Deckel in der Schale. Ohne sie ist
  // die Schale zwischen zwei Flammen ein leerer Topf.
  const glutMat = new THREE.MeshBasicMaterial({ color: 0xe0582a })
  const glut = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), glutMat)
  glut.rotation.x = -Math.PI / 2
  glut.position.set(SX, 0.55, SZ)
  group.add(glut)

  const aussenMat = new THREE.MeshBasicMaterial({ color: 0xff8a2b, transparent: true, opacity: 0.55, depthWrite: false })
  const innenMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.95, depthWrite: false })
  const flamme = new THREE.Group()
  flamme.position.set(SX, 0.56, SZ)
  group.add(flamme)
  const aussen = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.42, 7), aussenMat)
  aussen.position.y = 0.21
  const innen = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.24, 6), innenMat)
  innen.position.y = 0.12
  flamme.add(aussen, innen)

  // --- Block auf der Schnittflaeche ----------------------------------------
  // Eigene Ebene, parallel zum Schnitt: y laeuft hangaufwaerts, z aus dem
  // Holz heraus.
  const brett = new THREE.Group()
  brett.position.set(PX, OBEN + 0.006, -0.04)
  brett.rotation.x = NEIGUNG
  group.add(brett)

  const auflage = []
  // Der Stapel unter dem obersten Blatt, mit dem roten Leimrand oben.
  auflage.push({ geo: new THREE.BoxGeometry(BW, BH, 0.05), color: PAPIER, position: [0, 0, 0.025] })
  auflage.push({ geo: new THREE.BoxGeometry(BW + 0.02, 0.05, 0.07), color: ZINNOBER, position: [0, BH / 2 + 0.01, 0.035] })
  const auflageMesh = new THREE.Mesh(assemble(auflage), vertexColorMaterial({ roughness: 0.75 }))
  auflageMesh.castShadow = true
  auflageMesh.receiveShadow = true
  brett.add(auflageMesh)

  // Das Blatt haengt am Leimrand: Drehpunkt an seiner Oberkante.
  const ZOBEN = 0.052
  const angel = new THREE.Group()
  angel.position.set(0, BH / 2 - 0.015, ZOBEN)
  brett.add(angel)

  const oben = leinwand()
  const flug = leinwand()
  let nr = 1 + Math.floor(Math.random() * 400)
  seite(oben.ctx, nr)

  const blattGeo = new THREE.PlaneGeometry(BW - 0.01, BH - 0.04)
  blattGeo.translate(0, -(BH - 0.04) / 2, 0)
  const oberstes = new THREE.Mesh(blattGeo, new THREE.MeshBasicMaterial({ map: oben.tex }))
  oberstes.position.z = 0.001
  angel.add(oberstes)

  const fliegtMat = new THREE.MeshBasicMaterial({ map: flug.tex, side: THREE.DoubleSide })
  const fliegt = new THREE.Mesh(blattGeo, fliegtMat)
  fliegt.visible = false
  angel.add(fliegt)

  // --- Abreissen -----------------------------------------------------------
  const ZIEL = new THREE.Vector3(SX, 0.72, SZ)
  const start = new THREE.Vector3()
  const startDreh = new THREE.Euler()
  const weiss = new THREE.Color(0xffffff)
  const verkohlt = new THREE.Color(0x2a2522)
  let lauf = -1       // s seit dem Abreissen, -1 = Ruhe
  let geloest = false // schon vom Block los und auf dem Weg zur Schale
  let auflodern = 0

  const reissen = () => {
    if (lauf >= 0) return
    // Das alte Blatt fliegt, darunter liegt sofort das naechste.
    flug.ctx.drawImage(oben.ctx.canvas, 0, 0)
    flug.tex.needsUpdate = true
    nr += 1
    seite(oben.ctx, nr)
    oben.tex.needsUpdate = true
    if (fliegt.parent !== angel) angel.attach(fliegt)
    fliegt.position.set(0, 0, 0.003)
    fliegt.rotation.set(0, 0, 0)
    fliegt.scale.setScalar(1)
    fliegtMat.color.copy(weiss)
    fliegt.visible = true
    lauf = 0
    geloest = false
  }

  let gewaehlt = false
  group.userData.reissen = reissen
  group.userData.select = (i) => {
    if (i === null) gewaehlt = false
    else if (!gewaehlt) { gewaehlt = true; reissen() }
  }
  group.userData.press = reissen

  const ABZIEHEN = 0.35
  group.userData.animate = (t, dt = 0) => {
    // Die Flamme flackert immer, nach jedem Blatt lodert sie kurz auf.
    auflodern *= Math.exp(-2.2 * dt)
    const f = 1 + Math.sin(t * 9.3) * 0.07 + Math.sin(t * 15.1) * 0.05
    flamme.scale.set(1 + auflodern * 0.5, f * (1 + auflodern * 1.6), 1 + auflodern * 0.5)
    flamme.rotation.z = Math.sin(t * 3.7) * 0.06
    glutMat.color.setHSL(0.04, 0.78, 0.5 + Math.sin(t * 4.3) * 0.04 + auflodern * 0.12)

    if (lauf < 0) return
    lauf += dt

    if (lauf < ABZIEHEN) {
      // Vom Leimrand abziehen: das Blatt klappt nach vorn hoch.
      const u = lauf / ABZIEHEN
      fliegt.rotation.x = -1.15 * u * u
      return
    }

    if (!geloest) {
      // Los vom Block: ab hier in Gruppenkoordinaten weiter, damit die
      // Bahn zur Schale nicht mit dem Schnitt kippt.
      group.updateMatrixWorld(true)
      group.attach(fliegt)
      start.copy(fliegt.position)
      startDreh.copy(fliegt.rotation)
      geloest = true
    }

    const u = Math.min(1, (lauf - ABZIEHEN) / (DAUER - ABZIEHEN))
    const e = 1 - (1 - u) * (1 - u)
    // Bogen ueber die Schale: Kontrollpunkt 0,6 m ueber der Mitte.
    const mx = (start.x + ZIEL.x) / 2
    const my = Math.max(start.y, ZIEL.y) + 0.6
    const mz = (start.z + ZIEL.z) / 2 + 0.15
    const a = (1 - e) * (1 - e)
    const b = 2 * (1 - e) * e
    const c = e * e
    fliegt.position.set(
      a * start.x + b * mx + c * ZIEL.x,
      a * start.y + b * my + c * ZIEL.y,
      a * start.z + b * mz + c * ZIEL.z,
    )
    fliegt.rotation.set(startDreh.x - e * 1.4, startDreh.y + Math.sin(e * 5) * 0.5, startDreh.z + e * 2.6)
    // Im letzten Drittel faengt es Feuer: es dunkelt und schrumpft.
    const brennt = Math.max(0, (u - 0.6) / 0.4)
    fliegtMat.color.copy(weiss).lerp(verkohlt, brennt)
    fliegt.scale.setScalar(1 - brennt * 0.85)

    if (u >= 1) {
      fliegt.visible = false
      lauf = -1
      auflodern = 1
    }
  }

  // Die Schauseite gehoert zur Kamera.
  group.userData.facing = CAMERA.azimuth
  return group
}
