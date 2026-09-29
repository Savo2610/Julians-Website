import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { CAMERA } from '../../config.js'

// Die Stechuhr am Anfang des Werkzeugwegs.
//
// Sie ist der Arbeitszeitrechner als Gegenstand. Ein Rechner ist eine Seite –
// ein Ding, das man aufruft. Damit er in dieser Welt einen Platz hat, braucht
// er eine Gestalt, die dasselbe sagt, ohne es zu schreiben: eine Uhr auf einem
// Pfosten, ein Schlitz darunter und ein Regal mit Karten daneben. Wer sie
// sieht, weiss, worum es geht, bevor er den Hinweis liest.
//
// Sie steht am Anfang des Weges und nicht an seinem Ende. Man stempelt, bevor
// man arbeitet – und wer den gruenen Weg hinunterfaehrt, faengt hier an.
//
// Das Zifferblatt hat Pultneigung. Die Kamera schaut von schraeg oben, und
// eine senkrechte Scheibe waere von dort ein Strich. Geneigt und zur Kamera
// gedreht ist sie eine Flaeche, auf der die Zeiger wirklich laufen.

const IRON = 0x3f4954
const CASE = 0x2b3542      // dunkles Gehaeuse – das helle Blatt braucht Grund
const FRAME = 0x1b232c
const WOOD = 0x7a5a3c
const BRASS = 0xc79a45
const SNOW = 0xf7fbff
const CARD = 0xf6f2e6

// Die Kamera steht 36 Grad ueber dem Boden. Ein Blatt, dessen Normale um 54
// Grad aus der Senkrechten kippt, schaut ihr genau entgegen. Ganz so weit geht
// es nicht – dann liegt die Uhr flach da; 0,62 rad sind der Kompromiss, bei
// dem sie noch steht und trotzdem lesbar ist.
const TILT = -0.62

function dialTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f4efe3'
  ctx.beginPath()
  ctx.arc(128, 128, 124, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#2f3742'
  ctx.lineWidth = 8
  ctx.beginPath()
  ctx.arc(128, 128, 120, 0, Math.PI * 2)
  ctx.stroke()

  // Stundenstriche – kraeftig genug, um aus der Vogelperspektive noch als
  // Zifferblatt und nicht als Fleck zu lesen.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const long = i % 3 === 0
    ctx.strokeStyle = '#39424e'
    ctx.lineWidth = long ? 11 : 5
    ctx.beginPath()
    ctx.moveTo(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100)
    ctx.lineTo(128 + Math.sin(a) * (long ? 74 : 84), 128 - Math.cos(a) * (long ? 74 : 84))
    ctx.stroke()
  }

  ctx.fillStyle = '#37b87c'
  ctx.font = '700 22px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ARBEITSZEIT', 128, 74)
  ctx.fillStyle = '#7d8794'
  ctx.font = '600 17px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
  ctx.fillText('stempeln', 128, 196)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function createTimeClock() {
  const group = new THREE.Group()
  const parts = []

  // --- Pfosten und Sockel --------------------------------------------------
  parts.push({ geo: new THREE.CylinderGeometry(0.085, 0.1, 1.5, 8), color: IRON, position: [0, 0.72, 0] })
  parts.push({
    geo: (() => {
      const g = new THREE.SphereGeometry(0.36, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)
      g.scale(1, 0.3, 1)
      return g
    })(),
    color: SNOW,
    position: [0, -0.03, 0],
  })

  // Kartenschlitz unter der Uhr, mit Messingrand.
  parts.push({ geo: new THREE.BoxGeometry(0.5, 0.07, 0.12), color: BRASS, position: [0, 1.4, 0.22] })
  parts.push({ geo: new THREE.BoxGeometry(0.42, 0.04, 0.14), color: 0x11161c, position: [0, 1.4, 0.25] })

  // --- Kartenregal ---------------------------------------------------------
  // Vier Karten in einem Holzfach neben der Uhr. Von oben sind sie das, was
  // die Stechuhr eindeutig macht: eine Uhr allein waere nur eine Uhr.
  parts.push({ geo: new THREE.BoxGeometry(0.7, 0.52, 0.18), color: WOOD, position: [0.92, 1.6, 0.02] })
  parts.push({ geo: new THREE.BoxGeometry(0.74, 0.07, 0.24), color: WOOD, position: [0.92, 1.32, 0.03] })
  for (let i = 0; i < 4; i++) {
    parts.push({
      geo: new THREE.BoxGeometry(0.13, 0.46, 0.02),
      color: CARD,
      position: [0.68 + i * 0.16, 1.7, 0.12],
      rotation: [0, 0, (i - 1.5) * 0.05],
    })
  }

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.7 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Kopf mit Zifferblatt ------------------------------------------------
  // Das ganze Gehaeuse ist geneigt und nicht nur seine Front. Ein senkrechter
  // Korpus mit schraegem Blatt sah von oben aus wie ein Kasten mit einem Loch;
  // gekippt liest man auf den ersten Blick eine Uhr.
  const face = new THREE.Group()
  face.position.set(0, 1.92, 0.02)
  face.rotation.x = TILT
  group.add(face)

  const head = []
  head.push({ geo: new THREE.BoxGeometry(1.18, 1.04, 0.3), color: FRAME, position: [0, 0, 0] })
  head.push({ geo: new THREE.BoxGeometry(1.04, 0.9, 0.32), color: CASE, position: [0, 0, 0.02] })
  // Schneehaube auf der Oberkante – ohne sie steht hier ein Geraet im Schnee
  // statt eines Geraets, das den Winter schon eine Weile aushaelt.
  head.push({ geo: new THREE.BoxGeometry(1.2, 0.08, 0.34), color: SNOW, position: [0, 0.54, 0] })
  const headMesh = new THREE.Mesh(assemble(head), vertexColorMaterial({ roughness: 0.6 }))
  headMesh.castShadow = true
  face.add(headMesh)

  // Messingring um das Blatt. Auf zehn Meter Entfernung verschwindet die
  // Zeichnung des Zifferblatts, der helle Kreis in seiner Fassung nicht – er
  // ist das, woran man aus der Ferne die Uhr erkennt.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.045, 8, 28),
    new THREE.MeshStandardMaterial({ color: BRASS, roughness: 0.45, metalness: 0.3 }),
  )
  ring.position.z = 0.17
  face.add(ring)

  const dial = new THREE.Mesh(
    new THREE.CircleGeometry(0.41, 32),
    new THREE.MeshBasicMaterial({ map: dialTexture() }),
  )
  dial.position.z = 0.175
  face.add(dial)

  // Zeiger: zwei flache Balken, die in der Ebene des Blatts laufen. Sie sind
  // mit Absicht Geometrie und keine gemalte Zeit – eine Uhr, deren Zeiger
  // stehen, liest man als kaputt.
  const hands = new THREE.Group()
  hands.position.z = 0.19
  face.add(hands)

  const hourHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.038, 0.23, 0.012),
    new THREE.MeshBasicMaterial({ color: 0x2f3742 }),
  )
  hourHand.position.y = 0.09
  const hourPivot = new THREE.Group()
  hourPivot.add(hourHand)
  hands.add(hourPivot)

  const minHand = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.34, 0.012),
    new THREE.MeshBasicMaterial({ color: 0x39424e }),
  )
  minHand.position.y = 0.15
  const minPivot = new THREE.Group()
  minPivot.add(minHand)
  hands.add(minPivot)

  const cap = new THREE.Mesh(
    new THREE.CircleGeometry(0.035, 12),
    new THREE.MeshBasicMaterial({ color: BRASS }),
  )
  cap.position.z = 0.2
  face.add(cap)

  // --- Kontrollleuchte -----------------------------------------------------
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x37b87c, transparent: true, opacity: 0.9 })
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), lampMat)
  lamp.position.set(-0.4, 1.4, 0.24)
  group.add(lamp)

  // --- Ausgeworfene Karte --------------------------------------------------
  // Beim Stempeln faehrt sie aus dem Schlitz und wieder hinein. Mehr braucht
  // die Rueckmeldung nicht: man sieht, dass das Geraet etwas getan hat.
  const slip = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.42, 0.014),
    new THREE.MeshStandardMaterial({ color: CARD, roughness: 0.85 }),
  )
  slip.position.set(0, 1.28, 0.27)
  slip.visible = false
  group.add(slip)

  let stamp = 0
  // Herangezoomt rast die Zeit: die Zeiger drehen auf, und das Gehaeuse
  // scheppert wie ein Wecker. Die Geschwindigkeit zieht weich nach, damit
  // die Zeiger nicht springen, wenn es losgeht oder aufhoert.
  let eilig = false
  let tempo = 0.5     // rad/s des Minutenzeigers
  let winkel = 0

  group.userData.stamp = () => { stamp = 1.6 }
  group.userData.select = (i) => { eilig = i !== null }
  group.userData.press = () => { stamp = 1.6 }

  group.userData.animate = (t, dt = 0) => {
    // Die Uhr laeuft schneller als die Wirklichkeit. Eine echte Minute pro
    // Minute waere von aussen Stillstand; so sieht man ihr beim Laufen zu.
    tempo += ((eilig ? 16 : 0.5) - tempo) * (1 - Math.exp(-2.5 * dt))
    winkel += tempo * dt
    minPivot.rotation.z = -winkel
    hourPivot.rotation.z = -winkel / 12
    // Scheppern: je schneller, desto mehr zittert der Kopf.
    const wackeln = Math.max(0, tempo - 2) / 14
    face.rotation.z = Math.sin(t * 46) * 0.05 * wackeln
    face.position.x = Math.sin(t * 61) * 0.012 * wackeln

    if (stamp > 0) {
      stamp = Math.max(0, stamp - dt)
      const u = 1 - stamp / 1.6
      // Hin und zurueck: erst heraus, dann wieder eingezogen.
      const out = Math.sin(Math.min(1, u * 1.15) * Math.PI)
      slip.visible = out > 0.02
      slip.position.y = 1.28 + out * 0.34
      lampMat.color.setHex(0xffd35c)
      lampMat.opacity = 0.6 + 0.4 * Math.abs(Math.sin(u * 22))
    } else {
      slip.visible = false
      lampMat.color.setHex(0x37b87c)
      lampMat.opacity = 0.55 + 0.35 * (Math.sin(t * 2.1) * 0.5 + 0.5)
    }
  }

  // Die Schauseite gehoert zur Kamera – sonst liest man das Blatt von hinten.
  group.userData.facing = CAMERA.azimuth
  return group
}
