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
// Unter dem Deck steht der Damm aus Gelaende, der den Fahrer traegt – eine
// Hoehe je Punkt, also kann man nicht unter der Bruecke hindurch. Zuerst sah
// man den Damm als weissen Block in der Klamm, an dem der Bach aufhoerte.
// Jetzt schliessen zwei Mauern die Bruecke bis auf den Grund nach unten ab,
// und der Bach laeuft durch einen gewoelbten Durchlass: man sieht, dass er
// hindurch kann und man selbst nicht.
//
// Drei Dinge vom alten Steg gelten weiter, weil sie einmal falsch waren:
//
// 1. Die Fahrflaeche liegt auf der lokalen Hoehe **null**. Die Ski liegen auf
//    der Gelaendehoehe, und die ist im tragenden Streifen genau diese Ebene.
//    Die Bohlen liegen vier Zentimeter darueber: darunter verschwanden sie
//    unter dem Schnee des Gelaendes, und das Deck las sich als weisses
//    Rechteck. Vier Zentimeter Holz ueber den Ski sieht aus 33 Metern niemand.
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
const FUGE = 0x5d626b
const DUNKEL = 0x20262e
const EIS_DUNKEL = 0x4d8ea3
const EIS = 0x82c3d3

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
  // Lokale Hoehe des Grundes neben dem Damm (lx, lz) → y, ohne Neigung. Ohne
  // sie gibt es keine Mauern (Tests, Vorschau).
  grund = null,
  bachX = 0,          // wo der Bach unter der Bruecke durchlaeuft, lokal
  durchlass = 1.15,   // Radius des Gewoelbes; das Eis ist 2,6 Meter breit
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
  // Zwei Laengstraeger unter den Raendern, auf denen die Bohlen liegen.
  for (const sz of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(laenge, 0.36, 0.3), color: HOLZ_DUNKEL, position: [0, -0.36, sz * (hb - 0.3)] })
  }
  // Schnee bleibt nur am Rand liegen, an den Pfosten angeweht, in Stuecken
  // ungleicher Laenge. Ein durchgehender Streifen war wieder ein Rechteck.
  for (const sz of [-1, 1]) {
    let x = -laenge / 2 + 0.4
    let k = sz > 0 ? 0 : 3
    while (x < laenge / 2 - 0.6) {
      const l = 0.9 + ((k * 53) % 7) * 0.28
      const b = 0.32 + ((k * 31) % 5) * 0.07
      if (k % 4 !== 2) {
        parts.push({
          geo: new THREE.BoxGeometry(Math.min(l, laenge / 2 - 0.4 - x), 0.07, b),
          color: SCHNEE,
          position: [x + Math.min(l, laenge / 2 - 0.4 - x) / 2, 0.075, sz * (hb - 0.25 - b / 2)],
        })
      }
      x += l + 0.25
      k++
    }
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
  if (grund) group.add(...mauern({ grund, laenge, hb, neigung, bachX, durchlass }))
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

// --- Mauern bis auf den Grund ---------------------------------------------
// Je eine Bruchsteinmauer unter jedem Deckrand, von den Laengstraegern bis in
// den Grund der Klamm. Sie stehen ausserhalb des Damms (der traegt 2,7 Meter
// zur Seite, die Mauer steht bei 3,0 bis 3,4) und verdecken seine
// Boeschung. Dahinter eine Fugenschicht in schmalen Streifen, davor Steine
// mit Luft dazwischen – so liest sie sich als Mauerwerk und nicht als Wand.
//
// Gebaut ohne Neigung, in der Gruppe selbst: der Grund kommt als lokale Hoehe
// aus dem Hoehenfeld, und das Deck faellt hier mit `neigung`.
function mauern({ grund, laenge, hb, neigung, bachX, durchlass: r }) {
  const parts = []
  const deckY = (x) => -Math.tan(neigung) * x - 0.5
  const halbL = laenge / 2 - 0.3
  const dicke = 0.4
  const zw = hb + 0.1

  // Der Bach liegt in der Sohle; das Gewoelbe sitzt auf dem tiefsten Punkt
  // unter ihm, sonst stuende es auf einer Seite in der Luft.
  let sohle = Infinity
  for (const sz of [-1, 1]) {
    for (let dx = -r; dx <= r + 0.01; dx += r / 4) sohle = Math.min(sohle, grund(bachX + dx, sz * zw))
  }
  const imBogen = (x, y, rand = 0) => {
    const dy = y - sohle
    return Math.hypot(x - bachX, Math.max(0, dy)) < r + rand && dy < r + rand
  }

  for (const sz of [-1, 1]) {
    const z = sz * zw
    // Fugen: Streifen von 25 Zentimetern, im Gewoelbe nur oberhalb des Bogens.
    for (let x = -halbL; x < halbL; x += 0.25) {
      const xm = x + 0.125
      const oben = deckY(xm)
      let unten = Math.min(grund(x, z), grund(x + 0.25, z)) - 0.25
      if (Math.abs(xm - bachX) < r) unten = Math.max(unten, sohle + Math.sqrt(r * r - (xm - bachX) ** 2))
      if (oben - unten < 0.05) continue
      parts.push({ geo: new THREE.BoxGeometry(0.26, oben - unten, dicke - 0.08), color: FUGE, position: [xm, (oben + unten) / 2, z] })
    }
    // Steine in waagerechten Lagen, jede zweite um einen halben Stein
    // versetzt. Lagen, die dem Gefaelle des Decks folgten, sahen aus wie
    // Fischgraet. Oben schneidet die Unterkante des Decks sie ab.
    const kopf = deckY(-halbL)
    let k = sz > 0 ? 0 : 5
    for (let lage = 0; lage < 14; lage++) {
      let x = -halbL - (lage % 2) * 0.4
      while (x < halbL) {
        const w = 0.62 + ((k * 37) % 5) * 0.09
        const h = 0.46 + ((k * 13) % 3) * 0.05
        const x0 = Math.max(x, -halbL)
        const x1 = Math.min(x + w, halbL)
        k++
        x += w + 0.06
        if (x1 - x0 < 0.2) continue
        const xm = (x0 + x1) / 2
        const y1 = Math.min(kopf - 0.03 - lage * 0.56, deckY(x1) - 0.03)
        const y0 = Math.min(y1, kopf - 0.03 - lage * 0.56) - h
        const g = Math.min(grund(x0, z), grund(x1, z))
        if (y1 < g - 0.1 || y1 - y0 < 0.12) continue
        if (imBogen(x0, y0, 0.42) || imBogen(x1, y0, 0.42) || imBogen(xm, y0, 0.42)) continue
        const unten = Math.max(y0, g - 0.3)
        parts.push({
          geo: new THREE.BoxGeometry(x1 - x0, y1 - unten, dicke),
          color: (k + lage) % 3 ? STEIN : STEIN_HELL,
          position: [xm, (y1 + unten) / 2, z],
        })
      }
    }
    // Das Gewoelbe: neun Keilsteine im Halbkreis, eine Spur vorstehend.
    const n = 9
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (i + 0.5) / n
      const rr = r + 0.21
      const geo = new THREE.BoxGeometry(0.42, (Math.PI * rr) / n - 0.05, dicke + 0.1)
      geo.rotateZ(a)
      parts.push({ geo, color: i % 2 ? STEIN_HELL : STEIN, position: [bachX + Math.cos(a) * rr, sohle + Math.sin(a) * rr, z] })
    }
  }
  const mauer = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.95 }))
  mauer.castShadow = true
  mauer.receiveShadow = true

  // Im Durchlass ist es dunkel, und unten liegt das Eis weiter: eine halbe
  // Roehre von Mauer zu Mauer, von innen gezeichnet.
  const roehre = new THREE.CylinderGeometry(r, r, zw * 2, 14, 1, true, Math.PI / 2, Math.PI)
  roehre.rotateX(Math.PI / 2)
  roehre.translate(bachX, sohle, 0)
  const boden = new THREE.BoxGeometry(r * 2, 0.04, zw * 2)
  boden.translate(bachX, sohle + 0.03, 0)
  // Die Roehre steckt fast ganz im Damm. Sichtbar ist nur ihr Mund, und
  // hinter ihm stiege sonst gleich die Boeschung des Damms als Schnee auf.
  // Eine dunkle Scheibe schliesst ihn, dreissig Zentimeter tief in der Mauer:
  // am Fuss der Boeschung lag sie hinter dem Gelaende-Mesh, das auf einem
  // halben Meter Raster die Boeschung um gut so viel nach aussen verschmiert.
  const innen = [{ geo: roehre, color: DUNKEL }, { geo: boden, color: EIS_DUNKEL }]
  for (const sz of [-1, 1]) {
    // Eine Eiszunge aus dem Mund heraus: ueber ihr stach sonst der Schnee
    // des Gelaendes zackig ins Gewoelbe.
    const zunge = new THREE.BoxGeometry(r * 2 - 0.1, 0.3, 0.9)
    zunge.translate(bachX, sohle + 0.02, sz * (zw + 0.1))
    innen.push({ geo: zunge, color: EIS })
    const scheibe = new THREE.CircleGeometry(r, 14, 0, Math.PI)
    scheibe.translate(bachX, sohle, sz * (zw - 0.1))
    innen.push({ geo: scheibe, color: DUNKEL })
  }
  const mund = new THREE.Mesh(assemble(innen), vertexColorMaterial({ roughness: 1, side: THREE.DoubleSide }))
  return [mauer, mund]
}
