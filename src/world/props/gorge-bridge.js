import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Der Steg ueber die Klamm auf der Nordabfahrt.
//
// Er traegt nichts. Getragen wird der Fahrer vom Hoehenfeld: dort ist der
// Streifen, auf dem er faehrt, schlicht nicht ausgeschnitten, und genau darauf
// liegt dieses Holz. Das ist derselbe Grundsatz wie bei den Schanzen im
// Funpark – was man befaehrt, ist Gelaende, was man sieht, ist Aufbau. Ein Steg
// als Objekt waere ein Objekt, durch das man hindurchfaehrt.
//
// Laengsachse ist die Fahrtrichtung, die Gelaender stehen links und rechts
// davon. Die Bohlen liegen quer, wie auf jeder Holzbruecke – so greift der Ski
// nicht in die Fuge.
//
// Zwei Dinge sind deshalb Bedingung, und beide wurden erst falsch gebaut:
//
// 1. Die Deckflaeche liegt auf der lokalen Hoehe **null**. Alles Holz haengt
//    darunter, alles Gelaender darueber. Lag das Deck wie anfangs bei +0,1, so
//    stand der Fahrer bis zur Wade darin – seine Ski liegen auf der
//    Gelaendehoehe, und die ist hier per Definition die Deckflaeche.
// 2. Der Steg wird **geneigt** gebaut. Die Bahn faellt an dieser Stelle mit
//    8,7 Grad; auf vierzehneinhalb Metern Laenge sind das 2,2 Meter. Waagerecht
//    hingelegt steckte er am oberen Ende knapp einen Meter im Hang und schwebte
//    am unteren einen Meter darueber.
//
// Bleibt ein Rest: das Gelaende unter dem Deck ist nicht ganz gerade. Gegen die
// Ausgleichsgerade weicht es um gut fuenf Zentimeter nach oben wie nach unten
// ab. Deshalb ist der Steg **breiter als der Streifen, der traegt** – acht
// Meter zwanzig gegen fuenf Meter achtzig. Nur so kann man ueberhaupt Holz
// sehen: im Streifen liegt das Gelaende auf Deckhoehe, und jedes Brett, das
// dort oben liegt, durchsticht den Schnee in Fetzen. Aussen dagegen faellt der
// Saum ab, und dort steht das Holz frei. Was man also sieht, ist eine
// Schneespur zwischen zwei hoelzernen Randbohlen – genau das, was von einer
// verschneiten Bruecke zu sehen ist.

const HOLZ = 0x6a4830
const HOLZ_HELL = 0x86603f
const HOLZ_DUNKEL = 0x43301f
const SCHNEE = 0xf7fbff

export function createGorgeBridge({
  laenge = 14.5,      // ueber die Klamm, in Fahrtrichtung
  breite = 8.2,       // ueber den tragenden Streifen hinaus, siehe oben
  gelaender = 0.95,
  neigung = 0,        // rad, positiv = das vordere Ende liegt tiefer
} = {}) {
  const group = new THREE.Group()
  const parts = []
  const hb = breite / 2

  // Zwei Traeger unter den Raendern. Sie reichen ueber die Bohlen hinaus und
  // liegen damit auf dem festen Grund beiderseits der Rinne auf.
  for (const sz of [-1, 1]) {
    parts.push({
      geo: new THREE.BoxGeometry(laenge, 0.34, 0.3),
      color: HOLZ_DUNKEL,
      position: [0, -0.30, sz * (hb - 0.28)],
    })
  }

  // Bohlen quer. Ihre Breite wechselt leicht, sonst sieht das Deck aus wie
  // bedruckt statt gebaut.
  //
  // Ihre Oberkante liegt acht Zentimeter unter der Deckflaeche – tiefer als das
  // Gelaende im tragenden Streifen jemals faellt. Lagen sie buendig, sahen sie
  // aus wie zerrissen: Mesh und Hoehenfeld schneiden sich dann staendig.
  const bohlen = Math.round(laenge / 0.42)
  for (let i = 0; i < bohlen; i++) {
    const t = (i + 0.5) / bohlen
    const x = (t - 0.5) * laenge
    const hell = i % 3 === 0 || i % 7 === 2
    parts.push({
      geo: new THREE.BoxGeometry(0.34 + (i % 2) * 0.03, 0.1, breite),
      color: hell ? HOLZ_HELL : HOLZ,
      position: [x, -0.13, 0],
    })
  }

  // Schnee liegt auch auf einer Bruecke – sonst sieht sie aus, als waere sie
  // gerade gekehrt worden, und das ist hier oben niemand.
  //
  // Er deckt die Fahrspur und genau die: sechs Meter breit, also den tragenden
  // Streifen. Links und rechts bleibt gut ein Meter Bohle frei, und das ist die
  // Strecke, auf der der Saum schon abfaellt – dort liegt das Holz sichtbar
  // ueber der Klamm. Seine Oberkante steht anderthalb Zentimeter ueber der
  // Deckflaeche; das Gelaende sticht stellenweise hindurch, aber weiss durch
  // weiss sieht niemand.
  //
  // In der Laenge reicht er dagegen fast bis an die Enden. Liess man dort Bohle
  // frei, lag am Anfang des Steges ein dunkles Brett quer im Schnee – die Enden
  // liegen auf festem Grund, dort ist nichts zu zeigen.
  parts.push({
    geo: new THREE.BoxGeometry(laenge - 0.6, 0.10, breite - 2.2),
    color: SCHNEE,
    position: [0, -0.035, 0],
  })

  // Gelaender: Pfosten mit zwei Holmen. Sie stehen etwas nach aussen geneigt,
  // damit der Steg nicht wie ein Kaefig wirkt.
  const pfosten = Math.max(4, Math.round(laenge / 2.4))
  for (const sz of [-1, 1]) {
    for (let i = 0; i <= pfosten; i++) {
      const x = (i / pfosten - 0.5) * (laenge - 0.6)
      parts.push({
        geo: new THREE.BoxGeometry(0.13, gelaender, 0.13),
        color: HOLZ_DUNKEL,
        position: [x, gelaender / 2, sz * (hb - 0.18)],
        rotation: [sz * 0.05, 0, 0],
      })
    }
    for (const [hoehe, dick] of [[gelaender - 0.06, 0.12], [gelaender * 0.55, 0.09]]) {
      parts.push({
        geo: new THREE.BoxGeometry(laenge - 0.5, dick, dick),
        color: HOLZ,
        position: [0, hoehe, sz * (hb - 0.14)],
      })
    }
    // Schneewulst auf dem oberen Holm.
    parts.push({
      geo: new THREE.BoxGeometry(laenge - 0.5, 0.06, 0.17),
      color: SCHNEE,
      position: [0, gelaender + 0.03, sz * (hb - 0.14)],
    })
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
