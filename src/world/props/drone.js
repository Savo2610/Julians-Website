import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Abgestuerzte Drohne, halb im Schnee. Ein Arm ist abgebrochen und liegt
// daneben, ein Rotor dreht sich noch trudelnd, das Statuslicht blinkt schwach.
// Sie steckt schraeg im Boden – als waere sie mit Schwung eingeschlagen.

const SHELL = 0x2b3138
const SHELL_LIGHT = 0x424a53
const ARM = 0x1d2227
const ROTOR = 0x8a929b
const LENS = 0x1a2c38

function arm(angle, length = 0.5) {
  return {
    geo: new THREE.BoxGeometry(length, 0.055, 0.09),
    color: ARM,
    position: [Math.cos(angle) * length * 0.5, 0.02, Math.sin(angle) * length * 0.5],
    rotation: [0, -angle, 0],
  }
}

export function createDrone() {
  const group = new THREE.Group()
  const parts = []

  // Rumpf
  parts.push({ geo: new THREE.BoxGeometry(0.34, 0.13, 0.44), color: SHELL, position: [0, 0.02, 0] })
  parts.push({ geo: new THREE.BoxGeometry(0.28, 0.07, 0.34), color: SHELL_LIGHT, position: [0, 0.11, 0] })

  // Drei intakte Arme mit Motoren, der vierte fehlt.
  const angles = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25]
  for (const a of angles) {
    parts.push(arm(a))
    parts.push({
      geo: new THREE.CylinderGeometry(0.065, 0.075, 0.09, 8),
      color: SHELL_LIGHT,
      position: [Math.cos(a) * 0.5, 0.05, Math.sin(a) * 0.5],
    })
  }
  // Bruchstelle des vierten Arms
  parts.push({
    geo: new THREE.BoxGeometry(0.12, 0.055, 0.09),
    color: ARM,
    position: [Math.cos(Math.PI * 1.75) * 0.08, 0.02, Math.sin(Math.PI * 1.75) * 0.08],
    rotation: [0, -Math.PI * 1.75, 0],
  })

  // Landefuesse
  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.02, 0.02, 0.18, 5),
      color: ARM,
      position: [sx * 0.13, -0.09, 0],
      rotation: [0, 0, sx * 0.2],
    })
  }

  // Kameragehaeuse unten, verdreht
  parts.push({
    geo: new THREE.BoxGeometry(0.16, 0.14, 0.16),
    color: SHELL,
    position: [0.02, -0.09, 0.16],
    rotation: [0.4, 0.3, 0],
  })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.55, metalness: 0.3 }))
  body.castShadow = true
  group.add(body)

  // Kameralinse
  const lens = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshStandardMaterial({ color: LENS, roughness: 0.1, metalness: 0.8 }),
  )
  lens.position.set(0.02, -0.11, 0.24)
  group.add(lens)

  // Zwei Rotoren liegen still, einer trudelt noch.
  const rotors = []
  angles.forEach((a, i) => {
    const blades = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.42, 0.012, 0.05), color: ROTOR },
        { geo: new THREE.BoxGeometry(0.05, 0.012, 0.42), color: ROTOR },
        { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), color: SHELL },
      ]),
      vertexColorMaterial({ roughness: 0.4, metalness: 0.4 }),
    )
    blades.position.set(Math.cos(a) * 0.5, 0.1, Math.sin(a) * 0.5)
    blades.rotation.y = i * 0.7
    blades.castShadow = true
    group.add(blades)
    rotors.push({ mesh: blades, speed: i === 0 ? 1.0 : 0 })
  })

  // Der abgebrochene Arm liegt daneben im Schnee.
  const brokenArm = new THREE.Mesh(
    assemble([
      { geo: new THREE.BoxGeometry(0.42, 0.055, 0.09), color: ARM },
      { geo: new THREE.CylinderGeometry(0.065, 0.075, 0.09, 8), color: SHELL_LIGHT, position: [0.2, 0.03, 0] },
      { geo: new THREE.BoxGeometry(0.38, 0.012, 0.05), color: ROTOR, position: [0.2, 0.09, 0], rotation: [0, 0.6, 0.1] },
    ]),
    vertexColorMaterial({ roughness: 0.55, metalness: 0.3 }),
  )
  brokenArm.position.set(0.72, -0.05, -0.5)
  brokenArm.rotation.set(0.2, 1.1, 0.35)
  brokenArm.castShadow = true
  group.add(brokenArm)

  // Statuslicht, das noch schwach blinkt.
  const ledMat = new THREE.MeshStandardMaterial({
    color: 0xff4d3d,
    emissive: new THREE.Color(0xff4d3d),
    emissiveIntensity: 1,
    roughness: 0.3,
  })
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), ledMat)
  led.position.set(-0.1, 0.15, -0.16)
  group.add(led)

  // Schraeg im Schnee steckend.
  group.rotation.set(-0.34, 0.7, 0.22)

  group.userData.animate = (t) => {
    for (const r of rotors) {
      if (r.speed > 0) r.mesh.rotation.y += r.speed * 0.9 * (0.6 + Math.sin(t * 0.7) * 0.4) * 0.016
    }
    // Unregelmaessiges Blinken – die Elektronik hat es hinter sich.
    const blip = Math.sin(t * 2.3) > 0.86 || Math.sin(t * 5.1 + 2) > 0.94
    ledMat.emissiveIntensity = blip ? 2.6 : 0.06
  }

  return group
}
