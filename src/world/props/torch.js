import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Fackel: ein schraeg in den Schnee gerammter Stab mit umwickeltem Kopf und
// einer Flamme aus zwei ineinander liegenden Kegeln. Die Flamme leuchtet selbst
// (emissive) – echtes Licht bekommt nur der Platz als Ganzes, sonst wird die
// Beleuchtung zu teuer.
//
// Sie hat keine Kollision. Ein Kranz aus achtzehn Pfaehlen um das Startplateau
// waere sonst genau das: ein Zaun, den man auf den ersten Metern der Fahrt
// umkurven muss. Stattdessen faellt sie um, wenn man sie erwischt, verlischt
// und richtet sich nach ein paar Sekunden wieder auf. Das ist die bessere
// Antwort auf einen Gegenstand am Wegrand: nicht wegnehmen, sondern
// nachgeben.

const WOOD = 0x5d4130
const WRAP = 0x3d2c1f
const IRON = 0x4a5058

export function createTorch(seed = 0) {
  const group = new THREE.Group()
  const rnd = (n) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1

  const lean = (rnd(1) - 0.5) * 0.22
  const height = 1.55 + rnd(2) * 0.3

  const parts = []
  // Stab
  parts.push({
    geo: new THREE.CylinderGeometry(0.045, 0.06, height, 6),
    color: WOOD,
    position: [0, height / 2 - 0.15, 0],
    rotation: [lean, 0, (rnd(3) - 0.5) * 0.18],
  })
  // Umwicklung unter dem Kopf
  parts.push({
    geo: new THREE.CylinderGeometry(0.075, 0.07, 0.2, 7),
    color: WRAP,
    position: [Math.sin(lean) * 0.0, height - 0.32, Math.sin(lean) * 0.62],
    rotation: [lean, 0, 0],
  })
  // Eiserner Korb
  parts.push({
    geo: new THREE.CylinderGeometry(0.11, 0.075, 0.18, 7, 1, true),
    color: IRON,
    position: [0, height - 0.13, Math.sin(lean) * 0.78],
    rotation: [lean, 0, 0],
  })
  // Schneekragen am Fuss
  parts.push({
    geo: (() => {
      const g = new THREE.SphereGeometry(0.3, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.5)
      g.scale(1, 0.34, 1)
      return g
    })(),
    color: 0xf7fbff,
    position: [0, -0.12, 0],
  })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85 }))
  body.castShadow = true
  group.add(body)

  // --- Flamme -------------------------------------------------------------
  const flameY = height - 0.02 + Math.sin(lean) * 0.02
  const flameZ = Math.sin(lean) * 0.86

  const outerMat = new THREE.MeshBasicMaterial({
    color: 0xff8a2b, transparent: true, opacity: 0.55, depthWrite: false,
  })
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffe9a8, transparent: true, opacity: 0.95, depthWrite: false,
  })

  const outer = new THREE.Mesh(new THREE.ConeGeometry(0.23, 0.78, 7), outerMat)
  outer.position.set(0, flameY + 0.36, flameZ)
  group.add(outer)

  const inner = new THREE.Mesh(new THREE.ConeGeometry(0.125, 0.44, 6), innerMat)
  inner.position.set(0, flameY + 0.21, flameZ)
  group.add(inner)

  const phase = rnd(4) * 10

  // --- Umfallen -----------------------------------------------------------
  // Ein einziger Zustand genuegt: `fall` laeuft von 0 (steht) auf 1 (liegt)
  // und wieder zurueck. Die Neigung ist der Sinus davon, das Feuer der
  // Kehrwert – sie geht aus, waehrend sie kippt, und kommt beim Aufrichten
  // wieder. Ein Schwingen beim Zurueckstellen macht aus dem Aufrichten eine
  // Bewegung statt eines Zurueckspulens.
  let fall = 0
  let hold = 0
  let tipX = 1
  let tipZ = 0

  // Die Stossrichtung kommt in Weltkoordinaten herein, gekippt wird aber im
  // Koerper der Gruppe – und die steht bereits um einen Zufallswinkel gedreht.
  // Ohne diese Rueckdrehung faellt jede Fackel in ihre eigene Richtung statt
  // in die, aus der sie getroffen wurde.
  group.userData.knock = (dirX, dirZ) => {
    if (fall > 0.4) return
    const len = Math.hypot(dirX, dirZ) || 1
    const a = group.rotation.y
    const wx = dirX / len
    const wz = dirZ / len
    tipX = wx * Math.cos(a) - wz * Math.sin(a)
    tipZ = wx * Math.sin(a) + wz * Math.cos(a)
    hold = 2.6
  }

  // Fuer den Pistenpass (Lichter aus): liegt sie, ist das Feuer aus.
  group.userData.liegt = () => fall > 0.45

  group.userData.animate = (t, dt = 0) => {
    if (hold > 0) {
      hold -= dt
      fall = Math.min(1, fall + dt * 4.5)
    } else if (fall > 0) {
      fall = Math.max(0, fall - dt * 1.5)
    }
    if (fall > 0) {
      // Um die Fusslinie kippen: die Achse steht quer zur Stossrichtung.
      const a = fall * (Math.PI / 2) * 0.94
      group.rotation.x = a * tipZ
      group.rotation.z = -a * tipX
      const lit = Math.max(0, 1 - fall * 2.2)
      outer.visible = inner.visible = lit > 0.02
      outerMat.opacity = 0.55 * lit
      innerMat.opacity = 0.95 * lit
      if (lit <= 0.02) return
    } else if (group.rotation.x !== 0 || group.rotation.z !== 0) {
      group.rotation.x = 0
      group.rotation.z = 0
      outer.visible = inner.visible = true
      innerMat.opacity = 0.95
    }

    // Flackern aus zwei ungleich schnellen Sinuskurven – wirkt unregelmaessig,
    // ohne zufaellig zu springen.
    const f = Math.sin(t * 9.1 + phase) * 0.5 + Math.sin(t * 5.3 + phase * 2) * 0.5
    outer.scale.set(1 + f * 0.11, 1 + f * 0.2, 1 + f * 0.11)
    inner.scale.set(1 - f * 0.09, 1 + f * 0.24, 1 - f * 0.09)
    outer.rotation.y = t * 1.6 + phase
    inner.rotation.y = -t * 2.1
    outer.position.x = Math.sin(t * 3.7 + phase) * 0.02
    inner.position.x = Math.sin(t * 4.3 + phase) * 0.015
    outerMat.opacity = 0.45 + f * 0.14
  }

  group.userData.flameHeight = flameY + 0.3
  group.userData.isTorch = true
  return group
}
