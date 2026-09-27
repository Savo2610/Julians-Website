import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die Uploadseite steckt als Rohrpost im Boden: ein Stahlrohr, das aus dem
// Schnee ragt, mit Trichter, Klappe und einem Pfeil nach unten. Aus dem Schacht
// steigt warme Luft – das erklaert den ausgeschmolzenen Ring ringsum.

const STEEL = 0x7b858f
const STEEL_DARK = 0x505a64
const RUST = 0x9a6746
const ACCENT = 0x37b87c

export function createUploadPipe() {
  const group = new THREE.Group()
  const parts = []

  // Betonkragen, aus dem das Rohr kommt
  parts.push({ geo: new THREE.CylinderGeometry(0.72, 0.85, 0.34, 12), color: 0x93999f, position: [0, 0.12, 0] })

  // Hauptrohr, leicht schief – als waere es schon lange da
  const tilt = 0.11
  parts.push({
    geo: new THREE.CylinderGeometry(0.42, 0.44, 1.5, 14),
    color: STEEL,
    position: [0.08, 0.95, 0],
    rotation: [0, 0, -tilt],
  })
  // Verstaerkungsringe
  for (const y of [0.5, 1.15]) {
    parts.push({
      geo: new THREE.TorusGeometry(0.45, 0.05, 6, 16),
      color: STEEL_DARK,
      position: [0.08 + (y - 0.95) * tilt, y, 0],
      rotation: [Math.PI / 2, 0, -tilt],
    })
  }
  // Rostspur unten
  parts.push({
    geo: new THREE.CylinderGeometry(0.455, 0.46, 0.22, 14, 1, true),
    color: RUST,
    position: [0.13, 0.42, 0],
    rotation: [0, 0, -tilt],
  })

  // Trichter oben
  parts.push({
    geo: new THREE.CylinderGeometry(0.62, 0.42, 0.36, 14, 1, true),
    color: STEEL_DARK,
    position: [0.02, 1.82, 0],
    rotation: [0, 0, -tilt],
  })
  parts.push({
    geo: new THREE.TorusGeometry(0.62, 0.045, 6, 18),
    color: STEEL,
    position: [0.0, 1.99, 0],
    rotation: [Math.PI / 2, 0, -tilt],
  })

  // Klappe am Scharnier, halb offen
  parts.push({
    geo: new THREE.CylinderGeometry(0.6, 0.6, 0.05, 14),
    color: ACCENT,
    position: [-0.42, 2.18, 0.06],
    rotation: [0.1, 0, -1.05],
  })
  parts.push({
    geo: new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6),
    color: STEEL_DARK,
    position: [-0.5, 1.98, 0],
    rotation: [Math.PI / 2, 0, 0],
  })

  // Pfeil nach unten am Rohr: hier kommt etwas rein.
  parts.push({ geo: new THREE.BoxGeometry(0.1, 0.34, 0.03), color: ACCENT, position: [0.1, 1.15, 0.44] })
  parts.push({
    geo: new THREE.ConeGeometry(0.13, 0.18, 4),
    color: ACCENT,
    position: [0.1, 0.92, 0.44],
    rotation: [0, Math.PI / 4, Math.PI],
  })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.5, metalness: 0.45 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Kapsel, die beim Ausloesen aus dem Rohr schiesst --------------------
  // Sie steckt normalerweise unsichtbar im Schacht. Beim Ausloesen faehrt sie
  // heraus, steigt, kippt und faellt zurueck – der sichtbare Beweis, dass
  // etwas hochgeladen wurde.
  const capsule = new THREE.Group()
  const shell = new THREE.Mesh(
    assemble([
      { geo: new THREE.CapsuleGeometry(0.19, 0.34, 4, 10), color: ACCENT },
      { geo: new THREE.ConeGeometry(0.19, 0.24, 10), color: 0x2b9668, position: [0, 0.36, 0] },
      { geo: new THREE.TorusGeometry(0.2, 0.03, 5, 12), color: 0xf2f7f4, position: [0, 0.04, 0], rotation: [Math.PI / 2, 0, 0] },
      // Drei Finnen unten
      ...[0, 1, 2].map((i) => ({
        geo: new THREE.BoxGeometry(0.05, 0.2, 0.16),
        color: 0x2b9668,
        position: [Math.sin((i / 3) * Math.PI * 2) * 0.18, -0.26, Math.cos((i / 3) * Math.PI * 2) * 0.18],
        rotation: [0, -(i / 3) * Math.PI * 2, 0],
      })),
    ]),
    vertexColorMaterial({ roughness: 0.42, metalness: 0.2 }),
  )
  shell.castShadow = true
  capsule.add(shell)
  capsule.visible = false
  group.add(capsule)

  // Rauchfahne aus wenigen Kugeln, die der Kapsel folgt.
  const puffs = []
  const puffGeo = new THREE.IcosahedronGeometry(0.16, 1)
  for (let i = 0; i < 6; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdfe8ee, transparent: true, opacity: 0, roughness: 1, flatShading: true, depthWrite: false,
    })
    const puff = new THREE.Mesh(puffGeo, mat)
    puff.visible = false
    group.add(puff)
    puffs.push({ mesh: puff, mat, offset: i })
  }

  let flightTime = -1
  const LAUNCH_X = 0.02
  const LAUNCH_Y = 1.97

  group.userData.launch = () => {
    flightTime = 0
  }

  group.userData.animate = (t) => {
    if (flightTime < 0) return
    // Fester Zeitschritt reicht: die Animation dauert nur zwei Sekunden.
    flightTime += 1 / 60
    const life = flightTime / 2.2

    if (life >= 1) {
      flightTime = -1
      capsule.visible = false
      puffs.forEach((p) => { p.mesh.visible = false })
      return
    }

    // Wurfparabel: schneller Aufstieg, dann kippen und fallen.
    const up = 9.5 * flightTime - 4.6 * flightTime * flightTime
    capsule.visible = true
    capsule.position.set(LAUNCH_X, LAUNCH_Y + up, 0)
    capsule.rotation.set(flightTime * 1.5 - 0.2, flightTime * 4.0, Math.sin(flightTime * 2.2) * 0.35)
    capsule.scale.setScalar(1 - Math.max(0, life - 0.85) * 4)

    puffs.forEach((p, i) => {
      const delay = i * 0.075
      const age = flightTime - delay
      if (age <= 0) { p.mesh.visible = false; return }
      const puffUp = 9.5 * age - 4.6 * age * age
      p.mesh.visible = true
      p.mesh.position.set(LAUNCH_X + (i % 2 ? 0.08 : -0.08), LAUNCH_Y + puffUp * 0.82, (i % 3 - 1) * 0.06)
      p.mesh.scale.setScalar(0.6 + age * 1.5)
      p.mat.opacity = Math.max(0, 0.5 - age * 0.42)
    })
  }

  // Dunkler Schlund – verschluckt das Licht, damit das Rohr tief wirkt.
  const throat = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 14),
    new THREE.MeshBasicMaterial({ color: 0x0b1016 }),
  )
  throat.rotation.x = -Math.PI / 2
  throat.position.set(0.0, 1.97, 0)
  group.add(throat)

  return group
}
