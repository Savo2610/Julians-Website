import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture, snowDust, jitter } from '../../core/geometry.js'
import { makeRng } from '../../core/rng.js'

// Der Link-Shortener als begehbare Abkuerzung: ein Felsriegel mit einem
// Durchgang, ueber dem ein Schild haengt. Man kann wirklich hindurchfahren –
// die Metapher funktioniert nur, wenn sie auch stimmt.

const ROCK = 0x5d6673
const TIMBER = 0x6f5038

export function createShortcutTunnel({ label = 'ABKUERZUNG', width = 3.4 } = {}) {
  const rng = makeRng(4242)
  const group = new THREE.Group()
  const parts = []

  const half = width / 2
  const height = 3.2
  const depth = 2.6
  const opening = 1.5   // halbe Durchfahrtsbreite

  // Zwei Felsschultern links und rechts des Durchgangs.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.IcosahedronGeometry(1, 1)
      jitter(geo, 0.3, rng)
      parts.push({
        geo,
        color: ROCK,
        scale: [1.5 + rng() * 0.5, 1.5 + rng() * 0.7, 1.5 + rng() * 0.5],
        position: [
          side * (opening + 1.4 + rng() * 0.3),
          0.5 + i * 0.75,
          (i - 1) * 0.85 + (rng() - 0.5) * 0.5,
        ],
        rotation: [rng() * 3, rng() * 3, rng() * 3],
      })
    }
  }

  // Felsbruecke ueber dem Durchgang.
  for (let i = 0; i < 3; i++) {
    const geo = new THREE.IcosahedronGeometry(1, 1)
    jitter(geo, 0.26, rng)
    parts.push({
      geo,
      color: ROCK,
      scale: [1.5, 0.8, 1.3],
      position: [(i - 1) * 1.5, height - 0.3, (rng() - 0.5) * 0.6],
      rotation: [rng() * 2, rng() * 3, rng() * 2],
    })
  }

  // Holzverbau im Durchgang – wie ein alter Stollen.
  for (const side of [-1, 1]) {
    for (const dz of [-depth / 2 + 0.2, depth / 2 - 0.2]) {
      parts.push({
        geo: new THREE.BoxGeometry(0.2, height - 1.0, 0.24),
        color: TIMBER,
        position: [side * opening, (height - 1.0) / 2, dz],
      })
    }
  }
  for (const dz of [-depth / 2 + 0.2, depth / 2 - 0.2]) {
    parts.push({
      geo: new THREE.BoxGeometry(opening * 2 + 0.4, 0.22, 0.24),
      color: TIMBER,
      position: [0, height - 1.0, dz],
    })
  }

  const rock = assemble(parts)
  snowDust(rock, 0.9, 0.42)
  const body = new THREE.Mesh(rock, vertexColorMaterial({ roughness: 0.95 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Dunkler Durchblick, damit der Tunnel Tiefe bekommt.
  const shade = new THREE.Mesh(
    new THREE.BoxGeometry(opening * 2 - 0.1, height - 1.3, 0.02),
    new THREE.MeshBasicMaterial({ color: 0x2c3a4a, transparent: true, opacity: 0.35 }),
  )
  shade.position.set(0, (height - 1.3) / 2, 0)
  group.add(shade)

  // Schild ueber dem Durchgang, zur Kamera geneigt.
  const tex = labelTexture(label, {
    width: 640, height: 170,
    background: '#3b4a58', color: '#f2f6fa',
    font: '700 96px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
  })
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.6, 0.08),
    [
      new THREE.MeshStandardMaterial({ color: 0x2f3b47, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x2f3b47, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x2f3b47, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ color: 0x2f3b47, roughness: 0.6 }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: 0x2f3b47, roughness: 0.6 }),
    ],
  )
  sign.position.set(0, height - 0.55, depth / 2 + 0.1)
  sign.rotation.x = -0.45
  sign.castShadow = true
  group.add(sign)

  // Kollision nur fuer die Schultern – der Durchgang bleibt offen.
  group.userData.colliders = [
    { dx: -(opening + 1.5), dz: 0, r: 1.7 },
    { dx: opening + 1.5, dz: 0, r: 1.7 },
  ]
  return group
}
