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

const HOLZ = 0x6a4830
const HOLZ_HELL = 0x86603f
const HOLZ_DUNKEL = 0x43301f
const SCHNEE = 0xf7fbff

export function createGorgeBridge({
  laenge = 14.5,      // ueber die Klamm, in Fahrtrichtung
  breite = 5.8,       // lichte Breite – so breit wie der Streifen im Hoehenfeld
  gelaender = 0.95,
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
      position: [0, -0.22, sz * (hb - 0.28)],
    })
  }

  // Bohlen quer. Ihre Breite wechselt leicht, sonst sieht das Deck aus wie
  // bedruckt statt gebaut.
  const bohlen = Math.round(laenge / 0.42)
  for (let i = 0; i < bohlen; i++) {
    const t = (i + 0.5) / bohlen
    const x = (t - 0.5) * laenge
    const hell = i % 3 === 0 || i % 7 === 2
    parts.push({
      geo: new THREE.BoxGeometry(0.34 + (i % 2) * 0.03, 0.1, breite),
      color: hell ? HOLZ_HELL : HOLZ,
      position: [x, -0.02, 0],
    })
  }

  // Schnee liegt auch auf einer Bruecke – sonst sieht sie aus, als waere sie
  // gerade gekehrt worden, und das ist hier oben niemand.
  //
  // Er deckt aber nur die Fahrspur, nicht das ganze Deck: liegt er bis an die
  // Gelaender, dann sieht der Steg von der festen Kamera aus wie ein weisser
  // Streifen zwischen zwei Zaeunen, und das Holz, das ihn zur Bruecke macht,
  // ist nirgends zu sehen. Ein Meter Bohle bleibt links und rechts frei, und
  // vorn und hinten ein knapper Meter – genau die Stellen, an denen in Wahrheit
  // gekehrt und gestreut wird.
  parts.push({
    geo: new THREE.BoxGeometry(laenge - 2.6, 0.07, breite - 2.2),
    color: SCHNEE,
    position: [0, 0.05, 0],
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
  group.add(mesh)

  group.userData.halbeBreite = hb
  group.userData.laenge = laenge
  return group
}
