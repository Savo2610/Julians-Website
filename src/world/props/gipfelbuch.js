import * as THREE from 'three'
import { assemble, transformed, vertexColorMaterial } from '../../core/geometry.js'

// Das Gipfelbuch am Aussichtspunkt ueber der Nordabfahrt – dort haengen
// Julians Touren (Komoot).
//
// Nicht am Gipfelkreuz: dort kommt jeder vorbei, der aus dem Lift steigt.
// Es steht ein paar Meter neben dem Startbogen auf dem Ruecken, von dem aus
// man ins Nordkar schaut, und wer es findet, hat sich umgesehen.
//
// Ein Gipfelbuch ist auf jedem Berg dasselbe: eine Blechkassette auf einem
// Pfahl, darin ein Buch und ein Stift an einer Schnur. Dazu ein Steinmann,
// den die Kamera schon von weitem als "hier ist etwas" liest, und eine Bank
// mit Blick ins Kar. Die Kassette zeigt zur Kamera, die Bank zur Aussicht –
// man sitzt dort, um zu schauen, nicht um gesehen zu werden.
//
// Herangezoomt klappt der Deckel auf, das Buch hebt sich heraus und
// blaettert; beim Oeffnen wird gestempelt.

const HOLZ = 0x6a4830
const HOLZ_DUNKEL = 0x4a3021
const BLECH = 0xc8402e
const BLECH_DUNKEL = 0x8e2b1f
const STEIN = 0x7d838c
const STEIN_HELL = 0x9aa0a8
const SCHNEE = 0xf7fbff
const PAPIER = 0xf3ecdc
const EINBAND = 0x2d5a3d

export function createGipfelbuch({ blick = 0 } = {}) {
  const group = new THREE.Group()
  const fest = []

  // --- Pfahl und Kassette ---------------------------------------------------
  fest.push({ geo: new THREE.BoxGeometry(0.14, 1.15, 0.14), color: HOLZ, position: [0, 0.575, 0] })
  fest.push({ geo: new THREE.BoxGeometry(0.56, 0.36, 0.36), color: BLECH, position: [0, 1.33, 0] })
  // Ein weisses Kreuz auf der Vorderseite: so erkennt man aus 33 Metern, dass
  // es kein Briefkasten ist.
  fest.push({ geo: new THREE.BoxGeometry(0.06, 0.22, 0.02), color: 0xffffff, position: [0, 1.33, 0.185] })
  fest.push({ geo: new THREE.BoxGeometry(0.16, 0.06, 0.02), color: 0xffffff, position: [0, 1.37, 0.185] })

  // --- Steinmann --------------------------------------------------------------
  // Fuenf Steine, nach oben kleiner, leicht versetzt – gestapelt, nicht
  // gemauert.
  const steine = [[0.42, 0.25, 0], [0.34, 0.66, 0.04], [0.27, 1.0, -0.03], [0.2, 1.27, 0.03], [0.13, 1.47, 0]]
  steine.forEach(([r, y, dx], i) => {
    const geo = new THREE.IcosahedronGeometry(r, 0)
    geo.scale(1, 0.72, 1)
    fest.push({ geo, color: i % 2 ? STEIN_HELL : STEIN, position: [-1.25 + dx, y, -0.35], rotation: [0, i * 1.3, 0] })
  })
  fest.push({ geo: new THREE.SphereGeometry(0.15, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), color: SCHNEE, position: [-1.25, 1.53, -0.35], scale: [1, 0.5, 1] })

  // --- Bank mit Blick ins Kar -------------------------------------------------
  // In eigener Drehung (blick), zusammengesetzt im eigenen Ursprung.
  const bank = []
  for (const sx of [-0.7, 0.7]) {
    bank.push({ geo: new THREE.BoxGeometry(0.1, 0.42, 0.42), color: HOLZ_DUNKEL, position: [sx, 0.21, 0] })
  }
  bank.push({ geo: new THREE.BoxGeometry(1.7, 0.08, 0.46), color: HOLZ, position: [0, 0.44, 0] })
  bank.push({ geo: new THREE.BoxGeometry(1.7, 0.3, 0.07), color: HOLZ, position: [0, 0.68, -0.24], rotation: [-0.2, 0, 0] })
  bank.push({ geo: new THREE.BoxGeometry(1.66, 0.06, 0.42), color: SCHNEE, position: [0, 0.51, 0.01] })
  for (const teil of bank) {
    const geo = transformed(teil.geo, teil)
    geo.rotateY(blick)
    geo.translate(1.2, 0, -0.6)
    fest.push({ geo, color: teil.color })
  }

  const body = new THREE.Mesh(assemble(fest), vertexColorMaterial({ roughness: 0.82 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Deckel, Buch und Seite ---------------------------------------------------
  // Der Deckel haengt hinten an einem Scharnier.
  const scharnier = new THREE.Group()
  scharnier.position.set(0, 1.51, -0.18)
  const deckel = new THREE.Mesh(assemble([
    { geo: new THREE.BoxGeometry(0.6, 0.06, 0.4), color: BLECH_DUNKEL, position: [0, 0.03, 0.2] },
    { geo: new THREE.BoxGeometry(0.58, 0.07, 0.38), color: SCHNEE, position: [0, 0.09, 0.2] },
  ]), vertexColorMaterial({ roughness: 0.6 }))
  deckel.castShadow = true
  scharnier.add(deckel)
  group.add(scharnier)

  const buch = new THREE.Group()
  buch.position.set(0, 1.36, 0)
  const einband = new THREE.Mesh(assemble([
    { geo: new THREE.BoxGeometry(0.42, 0.05, 0.3), color: EINBAND },
    { geo: new THREE.BoxGeometry(0.4, 0.04, 0.28), color: PAPIER, position: [0, 0.03, 0] },
  ]), vertexColorMaterial({ roughness: 0.9 }))
  buch.add(einband)
  // Eine Seite, die beim Blaettern um den Ruecken schwingt.
  const ruecken = new THREE.Group()
  ruecken.position.set(-0.0, 0.055, 0)
  const seite = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.006, 0.27), new THREE.MeshStandardMaterial({ color: PAPIER, roughness: 0.95 }))
  seite.position.x = 0.1
  ruecken.add(seite)
  buch.add(ruecken)
  buch.visible = false
  group.add(buch)

  // Ein Stempelabdruck, der beim Oeffnen kurz auf der Seite erscheint.
  const stempel = new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), new THREE.MeshBasicMaterial({ color: 0x6aa127, transparent: true, opacity: 0 }))
  stempel.rotation.x = -Math.PI / 2
  stempel.position.set(-0.1, 0.057, 0.02)
  buch.add(stempel)

  // Herangezoomt: Deckel auf (0,4 s), Buch heraus (bis 0,9 s), dann blaettert
  // es zweimal und bleibt offen liegen. Einmal, nicht in Schleife.
  let auf = -1
  let stempelt = 0
  group.userData.select = (i) => {
    if (i !== null && auf < 0) auf = 0
    if (i === null) auf = -1
  }
  group.userData.press = () => { stempelt = 1 }

  group.userData.animate = (t, dt = 0) => {
    const k = 1 - Math.exp(-8 * dt)
    let deckelZiel = 0
    let buchHoch = 0
    let blatt = 0
    if (auf >= 0) {
      auf += dt
      deckelZiel = -1.9 * Math.min(1, auf / 0.4)
      buchHoch = Math.max(0, Math.min(1, (auf - 0.35) / 0.5))
      const b = Math.max(0, auf - 0.9)
      // Zwei Seiten in je 0,45 s, dann liegt sie links.
      blatt = b <= 0 ? 0 : b < 0.9 ? (b % 0.45) / 0.45 : 1
    }
    scharnier.rotation.x += (deckelZiel - scharnier.rotation.x) * k
    const h = buchHoch * buchHoch * (3 - 2 * buchHoch)
    buch.visible = h > 0.01
    buch.position.y = 1.36 + h * 0.38
    buch.rotation.x = h * 0.55
    ruecken.rotation.z = blatt * Math.PI
    if (stempelt > 0) stempelt = Math.max(0, stempelt - dt * 0.8)
    stempel.material.opacity = stempelt > 0 ? Math.min(1, stempelt * 3) : 0
  }

  group.userData.footprint = { width: 3.4, depth: 1.8 }
  return group
}
