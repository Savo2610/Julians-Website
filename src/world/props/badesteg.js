import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust } from '../../core/geometry.js'
import { CAMERA } from '../../config.js'
import { BADESTEG, BADESTEG_LAENGE, BADESTEG_RICHTUNG, LAKE } from '../heightfield.js'

// Der Badesteg am Eissee. Befahren wird das Hoehenfeld darunter (BADESTEG in
// heightfield.js), hier liegt nur das Holz darauf: Bohlen quer, zwei Pfahlreihen
// bis ins Eis, vorn eine Leiter. Am Landende haengt ein Rettungsring mit einer
// Wasserski-Hantel daran – im Winter das Einzige, was verraet, wofuer der
// Steg im Sommer da ist. Von hier geht es an den Kabelsee (src/sommer/).
//
// Lokal wie am Kabelsee: u laengs vom Landende zur Spitze, v quer. +v zeigt
// zur Kamera (Ostsuedost), deshalb steht der Ring auf -v: er soll den Steg
// nicht verdecken, und seine Schauseite dreht er trotzdem zur Kamera.

const WOOD = 0x9b7150
const WOOD_LIGHT = 0xb48760
const WOOD_DARK = 0x604737
const RING_ROT = 0xe4572e
const RING_WEISS = 0xf6f1e8
const SEIL = 0xe9dcc0
const HANTEL = 0x22303f

// Die Bohlen liegen 2 cm ueber dem Hoehenfeld, damit Holz und Schnee nicht
// flimmern; die Ski sinken die 2 cm ein, was man aus 26 m nicht sieht.
const DECK = BADESTEG.hoehe + 0.02

export function createBadesteg(world) {
  const len = BADESTEG_LAENGE
  const halb = BADESTEG.breite
  const yaw = Math.atan2(BADESTEG_RICHTUNG.x, BADESTEG_RICHTUNG.z)
  const parts = []

  // Bohlen quer, jede dritte etwas heller: ein Steg, kein Brett.
  let n = 0
  for (let u = -0.25; u < len - 0.1; u += 0.48) {
    parts.push({ geo: new THREE.BoxGeometry(halb * 2, 0.08, 0.42), color: n++ % 3 ? WOOD : WOOD_LIGHT, position: [0, DECK - 0.04, u + 0.21] })
  }
  // Zwei Laengstraeger unter den Bohlen, vorn sichtbar ueber dem Eis.
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.16, 0.22, len + 0.2), color: WOOD_DARK, position: [s * (halb - 0.12), DECK - 0.19, len / 2 - 0.1] })
  }
  // Pfaehle bis ins Eis, oben 25 cm ueber den Bohlen als Poller.
  const unten = LAKE.level - 0.3
  for (let u = 1.6; u < len + 0.01; u += (len - 1.6) / 2) {
    for (const s of [-1, 1]) {
      const oben = DECK + 0.25
      parts.push({ geo: new THREE.CylinderGeometry(0.1, 0.12, oben - unten, 7), color: WOOD_DARK, position: [s * (halb + 0.06), (oben + unten) / 2, Math.min(u, len - 0.12)] })
    }
  }
  // Leiter vorn an der Kameraseite, hinunter aufs Eis.
  const lx = halb + 0.18
  const lu = len - 0.7
  for (const du of [-0.24, 0.24]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.035, 0.035, 1.25, 6), color: 0xb9c4cf, position: [lx, DECK - 0.15, lu + du] })
  }
  for (let i = 0; i < 3; i++) {
    parts.push({ geo: new THREE.CylinderGeometry(0.025, 0.025, 0.48, 6), color: 0xb9c4cf, position: [lx, DECK - 0.55 + i * 0.28, lu], rotation: [Math.PI / 2, 0, 0] })
  }
  // Pfosten fuer den Ring am Landende, hinten links.
  const ringU = 0.55
  const ringV = -(halb + 0.32)
  const pfostenFuss = DECK - 1.1
  parts.push({ geo: new THREE.BoxGeometry(0.14, 1.95, 0.14), color: WOOD_DARK, position: [ringV, pfostenFuss + 0.975, ringU] })
  parts.push({ geo: new THREE.BoxGeometry(0.22, 0.06, 0.22), color: WOOD, position: [ringV, pfostenFuss + 1.98, ringU] })

  const geo = assemble(parts)
  // Duenn bestaeubt: bei 0,55 war der Steg aus 26 m eine weisse Flaeche.
  snowDust(geo, 0.3, 0.6)
  const material = vertexColorMaterial({ roughness: 0.85 })
  const steg = new THREE.Mesh(geo, material)
  steg.castShadow = true
  steg.receiveShadow = true

  // Rettungsring: acht Bogenstuecke im Wechsel rot und weiss, die Schauseite
  // zur Kamera. Darunter die Hantel an zwei Leinen.
  const ring = []
  for (let i = 0; i < 8; i++) {
    const bogen = new THREE.TorusGeometry(0.34, 0.085, 6, 4, Math.PI / 4)
    bogen.rotateZ(i * Math.PI / 4)
    ring.push({ geo: bogen, color: i % 2 ? RING_WEISS : RING_ROT })
  }
  ring.push({ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.62, 6), color: HANTEL, position: [0, -0.78, 0.04], rotation: [0, 0, Math.PI / 2] })
  for (const s of [-1, 1]) {
    ring.push({ geo: new THREE.CylinderGeometry(0.045, 0.045, 0.14, 6), color: 0x3a4a5c, position: [s * 0.22, -0.78, 0.04], rotation: [0, 0, Math.PI / 2] })
    const leine = new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4)
    ring.push({ geo: leine, color: SEIL, position: [s * 0.15, -0.55, 0.04], rotation: [0, 0, s * 0.55] })
  }
  const ringGeo = assemble(ring)
  const ringMesh = new THREE.Mesh(ringGeo, material)
  ringMesh.castShadow = true
  ringMesh.position.set(ringV, pfostenFuss + 1.45, ringU + 0.1)
  // Gruppe ist um yaw gedreht; die Kamera schaut aus CAMERA.azimuth.
  ringMesh.rotation.y = CAMERA.azimuth - yaw

  const group = new THREE.Group()
  group.name = 'badesteg'
  group.add(steg, ringMesh)
  group.position.set(BADESTEG.von.x, 0, BADESTEG.von.z)
  group.rotation.y = yaw
  world.scene.add(group)

  // Nur der Pfosten mit dem Ring steht im Weg; ueber die Bohlen faehrt man.
  const ca = Math.cos(yaw), sa = Math.sin(yaw)
  const px = BADESTEG.von.x + ringV * ca + ringU * sa
  const pz = BADESTEG.von.z - ringV * sa + ringU * ca
  world.addCollider(px, pz, 0.25, null, 2)

  // Wo der Fahrer vor dem Countdown steht: vorn auf dem Steg, mit Blick
  // uebers Eis – derselbe Platz wie am Startsteg des Kabelsees.
  const spitze = len - 1.2
  return {
    group,
    stand: {
      x: BADESTEG.von.x + BADESTEG_RICHTUNG.x * spitze,
      z: BADESTEG.von.z + BADESTEG_RICHTUNG.z * spitze,
      heading: yaw,
    },
  }
}
