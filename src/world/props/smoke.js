import * as THREE from 'three'

// Aufsteigende Rauchwolken. Bewusst als handvoll weicher Kugeln gebaut statt
// als Partikelsystem – bei einem Kamin sieht man ohnehin nur wenige Puffs, und
// so bleiben sie kontrollierbar und werfen keine Sortierprobleme auf.

const PUFFS = 7

export function createSmoke({ color = 0xe9eef4, scale = 1, rate = 0.55 } = {}) {
  const group = new THREE.Group()
  const geo = new THREE.IcosahedronGeometry(0.3 * scale, 1)
  const puffs = []

  for (let i = 0; i < PUFFS; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0,
      roughness: 1,
      flatShading: true,
      depthWrite: false,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = 1
    group.add(mesh)
    puffs.push({ mesh, mat, phase: i / PUFFS, drift: (Math.random() - 0.5) * 0.5 })
  }

  group.userData.animate = (t) => {
    for (const p of puffs) {
      // Lebenszyklus in [0,1): aufsteigen, wachsen, verblassen.
      const life = (t * rate + p.phase) % 1
      const rise = life * 2.6 * scale
      p.mesh.position.set(
        Math.sin(life * 3.1 + p.phase * 6) * 0.34 * scale + p.drift * life * scale,
        rise,
        Math.cos(life * 2.6 + p.phase * 5) * 0.28 * scale,
      )
      const grow = 0.45 + life * 1.5
      p.mesh.scale.setScalar(grow)
      p.mesh.rotation.set(life * 1.4, life * 2.1, 0)
      // Sanft ein- und ausblenden, nie hart aufpoppen.
      p.mat.opacity = Math.sin(Math.min(1, life) * Math.PI) * 0.34
    }
  }

  return group
}
