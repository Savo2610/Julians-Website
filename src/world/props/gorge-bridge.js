import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die Bogenbruecke ueber die Klamm auf der Nordabfahrt – der ruhige Weg
// neben der Schanze.
//
// Sie traegt nichts. Getragen wird der Fahrer vom Hoehenfeld: dort ist der
// Streifen, auf dem er faehrt, schlicht nicht ausgeschnitten, und genau darauf
// liegt dieses Holz (BRUECKE in heightfield.js). Was man befaehrt, ist
// Gelaende, was man sieht, ist Aufbau.
//
// Der erste Steg war ein Brett mit zwei Randbohlen; von oben las er sich als
// Schneespur zwischen zwei Strichen, und die Klamm darunter sah man kaum.
// Diese Bruecke zeigt, *dass* sie traegt: zwei Holzboegen spannen ueber das
// Deck von Widerlager zu Widerlager, das Deck haengt an ihnen, an beiden Enden
// liegt sie auf gemauerten Steinen. Aus der festen Kamera sind die Boegen das
// Erste, was man von ihr sieht.
//
// Drei Dinge vom alten Steg gelten weiter, weil sie einmal falsch waren:
//
// 1. Die Deckflaeche liegt auf der lokalen Hoehe **null**. Die Ski liegen auf
//    der Gelaendehoehe, und die ist im tragenden Streifen die Deckflaeche.
// 2. Die Bruecke wird **geneigt** gebaut (`neigung`, aus einer
//    Ausgleichsgeraden in populate.js): die Bahn faellt hier mit 9,4 Grad.
// 3. Das Deck ist **breiter als der Damm, der traegt** – 6,2 Meter gegen vier
//    Meter Streifen und 0,7 Meter Saum je Seite. Im Streifen liegt das
//    Gelaende auf Deckhoehe, und jedes Brett dort zerschnitte sich mit dem
//    Schnee zu Fetzen; aussen steht das Holz frei. Und nur ausserhalb des
//    Damms sieht man die Boegen: beim ersten Versuch mit 5,4 Metern Deck und
//    1,5 Metern Saum steckten sie ganz im Schnee.

const HOLZ = 0x6a4830
const HOLZ_HELL = 0x8a6340
const HOLZ_DUNKEL = 0x43301f
const STEIN = 0x7b8089
const STEIN_HELL = 0x959aa3
const SCHNEE = 0xf7fbff
const LATERNE = 0xffc874

// Ein Balken von a nach b (jeweils [x, y, z]) als Quader.
function balken(parts, a, b, dick, color) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const dz = b[2] - a[2]
  const len = Math.hypot(dx, dy, dz)
  const geo = new THREE.BoxGeometry(dick, len, dick)
  const m = new THREE.Matrix4().makeRotationFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize()),
  )
  geo.applyMatrix4(m)
  parts.push({ geo, color, position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] })
}

export function createGorgeBridge({
  laenge = 15,        // ueber die Klamm, in Fahrtrichtung
  breite = 6.2,       // ueber den tragenden Streifen hinaus, siehe oben
  spanne = 13.2,      // von Widerlager zu Widerlager; die Klamm ist 12,8 breit
  stich = 2.4,        // so hoch stehen die Boegen in der Mitte ueber dem Deck
  gelaender = 1.0,
  neigung = 0,        // rad, positiv = das vordere Ende liegt tiefer
} = {}) {
  const group = new THREE.Group()
  const parts = []
  const hb = breite / 2
  const hs = spanne / 2

  // --- Deck ---------------------------------------------------------------
  // Bohlen quer, acht Zentimeter unter der Deckflaeche – buendig sahen sie
  // zerrissen aus, weil Mesh und Hoehenfeld sich dann staendig schneiden.
  const bohlen = Math.round(laenge / 0.42)
  for (let i = 0; i < bohlen; i++) {
    const x = ((i + 0.5) / bohlen - 0.5) * laenge
    const hell = i % 3 === 0 || i % 7 === 2
    parts.push({
      geo: new THREE.BoxGeometry(0.34 + (i % 2) * 0.03, 0.1, breite),
      color: hell ? HOLZ_HELL : HOLZ,
      position: [x, -0.13, 0],
    })
  }
  // Zwei Laengstraeger unter den Raendern, auf denen die Bohlen liegen.
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(laenge, 0.36, 0.3), color: HOLZ_DUNKEL, position: [0, -0.36, sz * (hb - 0.3)] })
  }
  // Schnee auf der Fahrspur: genau der tragende Streifen, gut einen halben
  // Meter Bohle bleibt beiderseits frei.
  parts.push({ geo: new THREE.BoxGeometry(laenge - 0.6, 0.1, breite - 1.3), color: SCHNEE, position: [0, -0.035, 0] })

  // --- Boegen ---------------------------------------------------------------
  // Zwei Boegen ueber dem Deck, an beiden Raendern, mit Haengern hinunter zum
  // Traeger. Erst lagen sie darunter, wie bei einer Bogenbruecke im Tal –
  // aber unter dem Deck steht hier der Damm aus Gelaende, der den Fahrer
  // traegt, und aus 36 Grad sah man von den Boegen gar nichts. Ueber dem Deck
  // sind sie das, woran man die Bruecke schon vom Startbogen aus erkennt.
  const bogenY = (x) => 0.35 + (stich - 0.35) * (1 - (x / hs) ** 2)
  const stuecke = 14
  for (const sz of [-1, 1]) {
    const z = sz * (hb + 0.08)
    for (let i = 0; i < stuecke; i++) {
      const x0 = (i / stuecke - 0.5) * spanne
      const x1 = ((i + 1) / stuecke - 0.5) * spanne
      balken(parts, [x0, bogenY(x0), z], [x1, bogenY(x1), z], 0.24, i % 2 ? HOLZ : HOLZ_DUNKEL)
      // Schnee liegt auf dem Bogen, soweit er flach genug ist.
      if (Math.abs(x0 + x1) < spanne * 0.9) {
        balken(parts, [x0, bogenY(x0) + 0.15, z], [x1, bogenY(x1) + 0.15, z], 0.12, SCHNEE)
      }
    }
    for (const x of [-4.95, -3.3, -1.65, 0, 1.65, 3.3, 4.95]) {
      balken(parts, [x, bogenY(x), z], [x, gelaender, z], 0.07, HOLZ_DUNKEL)
    }
    // Fuesse der Boegen auf den Widerlagern.
    for (const sx of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.5, 0.5, 0.42), color: STEIN_HELL, position: [sx * hs, 0.2, z] })
    }
  }

  // --- Widerlager -----------------------------------------------------------
  // Gemauert aus ungleich grossen Steinen, an beiden Enden ueber die Kante
  // gesetzt. Sie geben der Klamm ihre Kante: Schnee auf Schnee hat aus der
  // festen Kamera keine.
  for (const sx of [-1, 1]) {
    const x = sx * (hs + 0.2)
    let k = 0
    for (let lage = 0; lage < 4; lage++) {
      const y = -0.62 - lage * 0.62
      for (const sz of [-1, 0, 1]) {
        const w = 0.9 + ((k * 37) % 5) * 0.08
        parts.push({
          geo: new THREE.BoxGeometry(w, 0.58, breite / 3 + 0.12),
          color: (k++ + lage) % 3 ? STEIN : STEIN_HELL,
          position: [x + sx * ((lage % 2) * 0.12), y, sz * (breite / 3)],
        })
      }
    }
  }

  // --- Gelaender --------------------------------------------------------------
  // Andreaskreuze zwischen den Pfosten: von oben ein Muster, das man als
  // Bruecke liest, wo zwei Holme nur zwei Striche waren.
  const felder = Math.round((laenge - 0.6) / 1.65)
  for (const sz of [-1, 1]) {
    const z = sz * (hb - 0.12)
    for (let i = 0; i <= felder; i++) {
      const x = (i / felder - 0.5) * (laenge - 0.6)
      parts.push({ geo: new THREE.BoxGeometry(0.15, gelaender, 0.15), color: HOLZ_DUNKEL, position: [x, gelaender / 2, z] })
      if (i === felder) continue
      const x1 = ((i + 1) / felder - 0.5) * (laenge - 0.6)
      balken(parts, [x, 0.12, z], [x1, gelaender - 0.12, z], 0.08, HOLZ)
      balken(parts, [x, gelaender - 0.12, z], [x1, 0.12, z], 0.08, HOLZ)
    }
    parts.push({ geo: new THREE.BoxGeometry(laenge - 0.5, 0.13, 0.15), color: HOLZ_HELL, position: [0, gelaender, z] })
    parts.push({ geo: new THREE.BoxGeometry(laenge - 0.5, 0.07, 0.19), color: SCHNEE, position: [0, gelaender + 0.09, z] })
  }
  // Ein hoeherer Pfosten an jeder Ecke, mit Laterne: der Eingang soll sich
  // schon von oben am Tor ablesen lassen.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (laenge / 2 - 0.3)
      const z = sz * (hb - 0.12)
      parts.push({ geo: new THREE.BoxGeometry(0.24, 1.7, 0.24), color: HOLZ_DUNKEL, position: [x, 0.85, z] })
      parts.push({ geo: new THREE.BoxGeometry(0.3, 0.07, 0.3), color: SCHNEE, position: [x, 1.74, z] })
      parts.push({ geo: new THREE.BoxGeometry(0.18, 0.22, 0.18), color: LATERNE, position: [x, 1.5, z + sz * 0.2] })
    }
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.88 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  // Die Neigung sitzt in einer eigenen Gruppe darunter, damit world.place()
  // weiterhin nur die Drehung um die Hochachse setzen muss.
  const deck = new THREE.Group()
  deck.rotation.z = -neigung
  deck.add(mesh)
  group.add(deck)

  group.userData.halbeBreite = hb
  group.userData.laenge = laenge
  return group
}
