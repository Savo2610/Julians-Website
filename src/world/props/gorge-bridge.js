import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die Bogenbruecke ueber die Klamm auf der Nordabfahrt – der ruhige Weg
// neben der Schanze.
//
// Sie traegt wirklich: unter ihr laeuft die Klamm mit dem Bach durch, und
// der Fahrer faehrt auf dem Deck (stegDeck in heightfield.js, die einzige
// zweite Flaeche im Tal). Bis 04.10. stand darunter ein Damm aus Gelaende,
// erst als weisser Block, dann hinter zwei Mauern mit Durchlass – beides
// sah hingesetzt aus und schnitt den Bach ab.
//
// Der erste Steg war ein Brett mit zwei Randbohlen; von oben las er sich als
// Schneespur zwischen zwei Strichen, und die Klamm darunter sah man kaum.
// Diese Bruecke zeigt, *dass* sie traegt: zwei Holzboegen spannen ueber das
// Deck von Widerlager zu Widerlager, das Deck haengt an ihnen, an beiden Enden
// liegt sie auf Steinen, die an die Wand der Klamm gemauert sind. Aus der
// festen Kamera sind die Boegen das Erste, was man von ihr sieht.
//
// Die Fahrflaeche liegt auf der lokalen Hoehe **null**, die Bohlen vier
// Zentimeter darueber, und die Bruecke wird **geneigt** gebaut (`neigung`):
// die Bahn faellt hier mit 9,4 Grad.

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
  // Lokale Hoehe des Grundes (lx, lz) → y, ohne Neigung. Ohne sie gibt es
  // keine Widerlager (Tests, Vorschau).
  grund = null,
} = {}) {
  const group = new THREE.Group()
  const parts = []
  const hb = breite / 2
  const hs = spanne / 2

  // --- Deck ---------------------------------------------------------------
  // Bohlen quer, mit der Oberkante vier Zentimeter ueber der Fahrflaeche.
  // Buendig sahen sie zerrissen aus, weil Mesh und Hoehenfeld sich dann
  // staendig schneiden; darunter lag Schnee auf dem ganzen Deck.
  const bohlen = Math.round(laenge / 0.42)
  for (let i = 0; i < bohlen; i++) {
    const x = ((i + 0.5) / bohlen - 0.5) * laenge
    const hell = i % 3 === 0 || i % 7 === 2
    parts.push({
      geo: new THREE.BoxGeometry(0.34 + (i % 2) * 0.03, 0.12, breite),
      color: hell ? HOLZ_HELL : HOLZ,
      position: [x, -0.02, 0],
    })
  }
  // Darunter eine dunkle Lage: durch die Fugen sah man an den Enden den
  // Schnee des Hangs als weisse Striche, ueber der Klamm ihren Grund.
  parts.push({ geo: new THREE.BoxGeometry(laenge, 0.02, breite - 0.1), color: HOLZ_DUNKEL, position: [0, 0.012, 0] })
  // Zwei Laengstraeger unter den Raendern, auf denen die Bohlen liegen.
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(laenge, 0.36, 0.3), color: HOLZ_DUNKEL, position: [0, -0.36, sz * (hb - 0.3)] })
  }
  // Unter dem Deck: Quertraeger an jedem Haenger. Seit die Klamm darunter
  // offen ist, sieht man von oben am Rand hinunter, und Bohlen ohne
  // Unterbau sahen aus wie ein Teppich.
  for (const x of [-4.95, -3.3, -1.65, 0, 1.65, 3.3, 4.95]) {
    parts.push({ geo: new THREE.BoxGeometry(0.22, 0.24, breite + 0.3), color: HOLZ_DUNKEL, position: [x, -0.3, 0] })
  }
  // Schnee bleibt am Rand liegen, an Pfosten und Gelaender angeweht: flache
  // Wehen mit welligem Umriss, unterschiedlich lang. Rechteckige Streifen
  // lasen sich als Bauteil, und ein Deck ganz ohne Schnee sah nach Sommer aus.
  const wehe = (x0, x1, tief, sz, k) => {
    const sh = new THREE.Shape()
    const n = 10
    sh.moveTo(x0, 0)
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const x = x0 + (x1 - x0) * t
      const w = tief * Math.sin(Math.PI * t) ** 0.6 * (0.75 + 0.25 * Math.sin(t * 9 + k * 2.1))
      sh.lineTo(x, w)
    }
    sh.lineTo(x1, 0)
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.03, bevelSegments: 1, curveSegments: 2 })
    // Die Form liegt in x/y; gekippt auf das Deck waechst die Wehe vom Rand
    // nach innen und die Dicke nach oben. Fuer den anderen Rand gedreht,
    // nicht gespiegelt – gespiegelt zeigten die Flaechen nach innen.
    geo.rotateX(-Math.PI / 2)
    if (sz < 0) geo.rotateY(Math.PI)
    parts.push({ geo, color: SCHNEE, position: [0, 0.02, sz * (hb - 0.2)] })
  }
  for (const sz of [-1, 1]) {
    let x = -laenge / 2 + 0.3
    let k = sz > 0 ? 0 : 3
    while (x < laenge / 2 - 0.8) {
      const l = 1.1 + ((k * 53) % 7) * 0.32
      const x1 = Math.min(x + l, laenge / 2 - 0.3)
      if (k % 4 !== 2) wehe(x, x1, 0.32 + ((k * 31) % 5) * 0.09, sz, k)
      x = x1 + 0.2 + ((k * 17) % 3) * 0.25
      k++
    }
  }
  // Und an beiden Enden, wo das Deck an den Hang stoesst, ein Keil Schnee
  // quer ueber die erste Bohle: dort schiebt jeder Fahrer etwas mit hinauf.
  for (const sx of [-1, 1]) {
    const geo = new THREE.CylinderGeometry(0.35, 0.35, breite - 0.6, 10, 1, false, 0, Math.PI)
    geo.rotateX(Math.PI / 2)
    geo.scale(1, 0.22, 1)
    parts.push({ geo, color: SCHNEE, position: [sx * (laenge / 2 - 0.05), 0.04, 0] })
  }

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

  const steine = []
  // --- Widerlager -----------------------------------------------------------
  // An beiden Enden eine gemauerte Stirnwand unter dem Deck, senkrecht bis
  // auf den Hang der Klamm: dort, wo er gut anderthalb Meter unter dem Deck
  // liegt. So sieht man, worauf die Bruecke aufliegt, und die Klamm hat an
  // ihr eine Kante – Schnee auf Schnee hat aus der festen Kamera keine. Eine
  // Treppe aus Lagen, die jede weiter vorstand, las sich als Stufen.
  if (grund) {
    const deckY = (x) => -Math.tan(neigung) * x
    const LAGE = 0.48
    let k = 0
    for (const sx of [-1, 1]) {
      // Die Stirn: von aussen nach innen, bis der Hang 1,6 Meter tief ist.
      let stirn = sx * (hs + 0.6)
      while (Math.abs(stirn) > 4.5 && grund(stirn, 0) > deckY(stirn) - 1.6) stirn -= sx * 0.1
      // Hinten bleibt sie unter dem Deck: am unteren Ende stand sie sonst
      // mit der Neigung einen halben Meter aus dem Hang.
      const aussen = sx * (laenge / 2 - 0.4)
      const x0 = Math.min(stirn, aussen), x1 = Math.max(stirn, aussen)
      const krone = Math.min(deckY(stirn), deckY(aussen)) - 0.5
      for (let lage = 0; lage < 6; lage++) {
        const oben = krone - lage * LAGE
        const unten = oben - LAGE + 0.05
        let tiefster = Infinity
        for (const z of [-hb, 0, hb]) tiefster = Math.min(tiefster, grund(stirn, z))
        if (oben < tiefster - 0.2) break
        // Drei bis vier Steine je Lage, jede zweite um einen halben versetzt.
        const n = 4 + (lage % 2)
        for (let i = 0; i < n; i++) {
          const za = -hb - 0.1 + (breite + 0.2) * Math.max(0, (i - (lage % 2) * 0.5) / (n - (lage % 2) * 0.5))
          const zb = -hb - 0.1 + (breite + 0.2) * Math.min(1, (i + 1 - (lage % 2) * 0.5) / (n - (lage % 2) * 0.5))
          if (zb - za < 0.2) continue
          const vor = ((k * 7) % 3) * 0.04
          steine.push({
            geo: new THREE.BoxGeometry(x1 - x0 + vor, oben - unten, zb - za - 0.06),
            color: (k++ + lage) % 3 ? STEIN : STEIN_HELL,
            position: [(x0 + x1) / 2 - sx * vor / 2, (oben + unten) / 2, (za + zb) / 2],
          })
        }
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
  // Die Widerlager stehen im Gelaende, nicht auf dem geneigten Deck: sie
  // sind ohne Neigung gerechnet und haengen direkt an der Gruppe.
  if (steine.length) {
    const fels = new THREE.Mesh(assemble(steine), vertexColorMaterial({ roughness: 0.95 }))
    fels.castShadow = true
    fels.receiveShadow = true
    group.add(fels)
  }
  const deck = new THREE.Group()
  deck.rotation.z = -neigung
  deck.add(mesh)
  group.add(deck)

  group.userData.halbeBreite = hb
  group.userData.laenge = laenge
  return group
}
