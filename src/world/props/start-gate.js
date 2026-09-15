import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../../core/geometry.js'

// Der Startbogen der Nordabfahrt.
//
// Er ist nicht Schmuck, sondern die Entscheidung: wer hindurchfaehrt, nimmt die
// Piste, und genau in diesem Moment geht die Kamera hinter den Fahrer. Deshalb
// gibt es hier keine Taste und kein Menue – das Tor *ist* der Schalter. Damit
// bleibt die Regel dieser Welt unangetastet, dass es keine Oberflaeche gibt.
//
// Neuneinhalb Meter lichte Weite bei vierzehn Metern Bahnbreite: schmal genug,
// dass man es als Tor liest und nicht als zwei Pfosten, weit genug, dass man
// nicht zielen muss. Die Pfosten haben Kollision, weil ein Tor, durch dessen
// Pfosten man faehrt, keines ist.

const HOLZ = 0x6d4a31
const HOLZ_DUNKEL = 0x4a3021
const SCHNEE = 0xf7fbff

export function createStartGate({
  weite = 9.5,
  hoehe = 3.5,
  titel = 'NORDKAR',
  unter = null,
  punkt = 0x2f6bd8,      // Schwierigkeitspunkt – blau, die Bahn hat 9 Grad
} = {}) {
  const group = new THREE.Group()
  const parts = []
  const halb = weite / 2

  for (const sx of [-1, 1]) {
    // Der Pfosten steht leicht nach aussen geneigt. Senkrecht wirkt ein Tor
    // wie ein Tuerrahmen; die Neigung macht daraus ein Bauwerk, das im Hang
    // steht.
    parts.push({
      geo: new THREE.BoxGeometry(0.24, hoehe, 0.24),
      color: HOLZ,
      position: [sx * halb, hoehe / 2, 0],
      rotation: [0, 0, -sx * 0.045],
    })
    // Strebe nach hinten, wie sie jeder Mast im Hang braucht.
    parts.push({
      geo: new THREE.BoxGeometry(0.13, hoehe * 0.62, 0.13),
      color: HOLZ_DUNKEL,
      position: [sx * (halb - 0.32), hoehe * 0.3, 0.55],
      rotation: [0.42, 0, -sx * 0.045],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.42, 0.5, 0.12, 9),
      color: SCHNEE,
      position: [sx * halb, 0.06, 0],
    })
  }

  // Der Querbalken ist ein flacher Bogen aus sieben Stuecken. Ein gerades
  // Brett waere einfacher, aber ein Bogen erkennt man aus jeder Entfernung als
  // Tor – und aus der festen Kamera sieht man bis hierher nur den Umriss.
  const felder = 7
  const stich = 0.55                    // wie weit der Bogen in der Mitte steigt
  for (let i = 0; i < felder; i++) {
    const t0 = i / felder
    const t1 = (i + 1) / felder
    const x0 = -halb + weite * t0
    const x1 = -halb + weite * t1
    const bogen = (t) => hoehe + stich * Math.sin(t * Math.PI)
    const y0 = bogen(t0)
    const y1 = bogen(t1)
    const len = Math.hypot(x1 - x0, y1 - y0)
    parts.push({
      geo: new THREE.BoxGeometry(len + 0.04, 0.2, 0.2),
      color: HOLZ,
      position: [(x0 + x1) / 2, (y0 + y1) / 2, 0],
      rotation: [0, 0, Math.atan2(y1 - y0, x1 - x0)],
    })
    // Schneeauflage auf dem Bogen – sie liegt ueberall, warum nicht hier.
    parts.push({
      geo: new THREE.BoxGeometry(len + 0.04, 0.08, 0.24),
      color: SCHNEE,
      position: [(x0 + x1) / 2, (y0 + y1) / 2 + 0.13, 0],
      rotation: [0, 0, Math.atan2(y1 - y0, x1 - x0)],
    })
  }

  // Die Tafel haengt unter dem Bogen an zwei kurzen Ketten.
  const tafelY = hoehe - 0.42
  parts.push({
    geo: new THREE.BoxGeometry(3.5, 0.82, 0.09),
    color: 0x27313b,
    position: [0, tafelY, 0],
  })
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.025, 0.025, 0.36, 5),
      color: HOLZ_DUNKEL,
      position: [sx * 1.4, tafelY + 0.58, 0],
    })
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.82 }))
  mesh.castShadow = true
  group.add(mesh)

  // Beschriftung auf beiden Seiten: von vorn liest man sie beim Einfahren, von
  // hinten sieht man sie in der Verfolgerkamera noch einmal davonziehen.
  const tex = labelTexture(titel, {
    width: 512, height: 140, background: null, color: '#f2f7ff',
    font: '700 84px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    sub: unter, subColor: '#9fb8d8',
  })
  for (const [z, drehung] of [[0.055, 0], [-0.055, Math.PI]]) {
    const tafel = new THREE.Mesh(
      new THREE.PlaneGeometry(3.1, 0.66),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    tafel.position.set(0, tafelY, z)
    tafel.rotation.y = drehung
    group.add(tafel)
  }

  // Der Schwierigkeitspunkt sitzt am linken Pfosten auf Augenhoehe – dieselbe
  // Stelle, an der er in jedem Skigebiet klebt.
  const scheibe = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 20),
    new THREE.MeshBasicMaterial({ color: punkt }),
  )
  scheibe.position.set(-halb + 0.14, hoehe * 0.55, 0.13)
  group.add(scheibe)
  const scheibe2 = scheibe.clone()
  scheibe2.position.z = -0.13
  scheibe2.rotation.y = Math.PI
  group.add(scheibe2)

  group.userData.postOffset = halb
  return group
}
