import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust } from '../../core/geometry.js'
import { githubScreen, linkedinScreen, createScreen, createHalo } from './screens.js'

// Die Werkbank vor der Werkstatt: hier liegen die beiden beruflichen Ziele.
//
// Die Huette selbst steht um 0,28 rad gegen die Kamera verdreht, damit sie
// nicht wie eine Kulisse wirkt – Bildschirme darin laesen sich dann schief.
// Die Bank steht deshalb als eigenes Stueck davor und schaut gerade zur
// Kamera. Links der Monitor mit Quelltext (GitHub), rechts das Profil
// (LinkedIn), beide mit Pultneigung. Dazwischen, was auf einer Werkbank
// liegt: Schraubstock, Hammer, eine Tasse. Eine Lampe am Gelenkarm stand
// auch schon da – aus 36 Grad ragte sie genau in den linken Bildschirm.

const WOOD = 0x8a5a36
const WOOD_DARK = 0x57392a
const WOOD_LIGHT = 0xa87850
const STEEL = 0x5f6a76
const SNOW = 0xf7fbff

export function createWorkbench() {
  const group = new THREE.Group()
  const parts = []

  const L = 2.6
  const T = 0.8
  const Y = 0.92

  // Platte aus drei Bohlen, Beine mit Querstreben, Ablage darunter.
  for (let i = 0; i < 3; i++) {
    parts.push({ geo: new THREE.BoxGeometry(L, 0.08, T / 3 - 0.02), color: i % 2 ? WOOD : WOOD_LIGHT, position: [0, Y, -T / 3 + i * (T / 3)] })
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.1, Y, 0.1), color: WOOD_DARK, position: [sx * (L / 2 - 0.12), Y / 2, sz * (T / 2 - 0.08)] })
    }
    parts.push({ geo: new THREE.BoxGeometry(0.08, 0.08, T - 0.1), color: WOOD_DARK, position: [sx * (L / 2 - 0.12), 0.25, 0] })
  }
  parts.push({ geo: new THREE.BoxGeometry(L - 0.2, 0.05, T - 0.2), color: WOOD_DARK, position: [0, 0.28, 0] })
  // Auf der Ablage: Kiste und ein Stapel Bretter.
  parts.push({ geo: new THREE.BoxGeometry(0.5, 0.3, 0.4), color: 0x3d6e9e, position: [-0.7, 0.46, 0] })
  for (let i = 0; i < 3; i++) {
    parts.push({ geo: new THREE.BoxGeometry(0.9, 0.05, 0.16), color: i % 2 ? WOOD_LIGHT : WOOD, position: [0.55, 0.33 + i * 0.05, -0.05 + i * 0.03], rotation: [0, 0.08 * i, 0] })
  }

  // Schraubstock vorn in der Mitte.
  parts.push({ geo: new THREE.BoxGeometry(0.26, 0.14, 0.2), color: STEEL, position: [0, Y + 0.11, T / 2 - 0.12] })
  parts.push({ geo: new THREE.BoxGeometry(0.28, 0.12, 0.06), color: 0x3f4852, position: [0, Y + 0.2, T / 2 - 0.02] })
  parts.push({ geo: new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6), color: 0xc9ced4, position: [0, Y + 0.12, T / 2 + 0.06], rotation: [0, 0, Math.PI / 2] })
  // Hammer und Tasse.
  parts.push({ geo: new THREE.CylinderGeometry(0.022, 0.022, 0.36, 6), color: WOOD_LIGHT, position: [0.35, Y + 0.06, 0.18], rotation: [Math.PI / 2, 0, 0.4] })
  parts.push({ geo: new THREE.BoxGeometry(0.16, 0.06, 0.06), color: STEEL, position: [0.43, Y + 0.07, 0.02], rotation: [0, 0.4, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.055, 0.05, 0.11, 10), color: 0xc8402f, position: [-0.3, Y + 0.09, 0.22] })
  // Schnee, der auf der Bank liegen geblieben ist.
  parts.push({ geo: new THREE.BoxGeometry(0.35, 0.04, 0.2), color: SNOW, position: [1.1, Y + 0.06, 0.26] })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.8 }))
  snowDust(body.geometry, 0.25, 0.85)
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Die beiden Bildschirme ---------------------------------------------
  const screens = []
  const tex = [githubScreen(), linkedinScreen()]
  const tint = [0x2b3137, 0x0a66c2]
  const tilt = -0.55
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Group()
    m.position.set(i === 0 ? -0.72 : 0.72, Y + 0.04, -0.1)
    m.add(new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.36, 0.03, 0.24), color: 0x22272e, position: [0, 0.015, 0] },
        { geo: new THREE.BoxGeometry(0.06, 0.3, 0.04), color: 0x2f353d, position: [0, 0.17, -0.06] },
      ]),
      vertexColorMaterial({ roughness: 0.4, metalness: 0.3 }),
    ))
    const head = new THREE.Group()
    head.position.set(0, 0.38, -0.04)
    head.rotation.x = tilt
    const shell = new THREE.Mesh(
      assemble([
        { geo: new THREE.BoxGeometry(0.98, 0.76, 0.06), color: 0x1b1f24, position: [0, 0, 0] },
        { geo: new THREE.BoxGeometry(1.02, 0.8, 0.03), color: tint[i], position: [0, 0, -0.035] },
      ]),
      vertexColorMaterial({ roughness: 0.35, metalness: 0.2 }),
    )
    shell.castShadow = true
    head.add(shell)
    const screen = createScreen(tex[i], 0.92, 0.69)
    screen.position.z = 0.032
    head.add(screen)
    const halo = createHalo(i === 0 ? 0x7ee787 : 0x3d8fe0, 2.1)
    halo.position.z = -0.08
    head.add(halo)
    m.add(head)
    group.add(m)
    screens.push({ head, screen, halo, pop: 0 })
  }

  let selected = null
  group.userData.select = (index) => {
    selected = index
    screens.forEach((s, i) => {
      s.screen.userData.want = index === null ? 0.8 : index === i ? 1.12 : 0.38
    })
  }
  group.userData.press = (index) => {
    if (screens[index]) screens[index].screen.userData.flash = 1
  }
  group.userData.animate = (time, dt = 1 / 60) => {
    const k = 1 - Math.exp(-8 * dt)
    for (const [i, s] of screens.entries()) {
      s.screen.userData.step(dt)
      s.pop += ((selected === i ? 1 : 0) - s.pop) * k
      s.head.position.y = 0.38 + s.pop * 0.08
      s.head.rotation.x = tilt + s.pop * 0.08
      s.halo.material.opacity = s.pop * (0.45 + Math.sin(time * 3) * 0.07) + s.screen.userData.flash * 0.6
    }
  }

  group.userData.footprint = { width: L + 0.3, depth: T + 0.3 }
  return group
}
