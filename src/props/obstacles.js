import * as THREE from 'three'
import { assemble, vertexColorMaterial, tint, labelTexture } from '../core/geometry.js'
import { FEATURES, DOCK, BUOYS, RINGS } from '../world/features.js'

// Was im Wasser steht: Kicker, Rail-Box, der Startsteg und die Sammelsachen.
// Die Form kommt aus features.js – gezeichnet wird genau das, was die
// Rechnung befaehrt, sonst springt man neben der sichtbaren Kante ab.

const HDPE = 0xf5f3ec       // weisse Gleitflaeche
const SIDE = 0x3b7fb8       // blaue Seitenwangen
const EDGE = 0xf0a93a       // orange Kante an der Lippe
const FLOAT = 0xf2c84b      // gelbe Schwimmer
const WOOD = 0xa9794f
const WOOD_DARK = 0x6b4a35

// Oberseite einer Rampe als Streifen entlang des Profils.
function skinGeometry(profile, length, width, steps, lift = 0.015) {
  const pos = []
  const idx = []
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * length
    const h = profile(u) + lift
    pos.push(-width / 2, h, u, width / 2, h, u)
  }
  for (let i = 0; i < steps; i++) {
    const a = i * 2
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  return g.toNonIndexed()
}

// Seitenwange: das Profil als Flaeche, nach unten bis unter Wasser.
function bodyGeometry(profile, length, width, steps) {
  const shape = new THREE.Shape()
  shape.moveTo(0, -0.35)
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * length
    shape.lineTo(u, profile(u))
  }
  shape.lineTo(length, -0.35)
  shape.closePath()
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 2 })
  // Profil liegt in XY (x = u), Extrusion in Z (Breite). Auf die lokale
  // Rampenlage drehen: u entlang +z, Breite entlang x.
  g.rotateY(-Math.PI / 2)
  g.translate(width / 2, 0, 0)
  return g
}

function kickerGeometry(f) {
  const steps = 16
  const parts = [
    { geo: bodyGeometry(f.profile, f.length, f.width, steps), color: SIDE },
    { geo: skinGeometry(f.profile, f.length, f.width - 0.12, steps), color: HDPE },
  ]
  // Orange Lippe und zwei Laengsstreifen, damit man die Kante von weitem sieht.
  parts.push({ geo: new THREE.BoxGeometry(f.width + 0.05, 0.12, 0.22), color: EDGE, position: [0, f.height - 0.02, f.length - 0.1] })
  const stripes = skinGeometry(f.profile, f.length, 0.12, steps, 0.025)
  parts.push({ geo: stripes, color: EDGE, position: [-f.width / 2 + 0.35, 0, 0] })
  parts.push({ geo: stripes, color: EDGE, position: [f.width / 2 - 0.35, 0, 0] })
  // Schwimmer unter der Rampe.
  for (const u of [0.2, 0.55, 0.9]) {
    for (const s of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.28, 0.28, f.length * 0.28, 8),
        color: FLOAT,
        position: [s * (f.width / 2 + 0.05), 0.02, f.length * u - f.length * 0.1],
        rotation: [Math.PI / 2, 0, 0],
      })
    }
  }
  return assemble(parts)
}

function sliderGeometry(f) {
  const parts = [
    { geo: bodyGeometry(f.profile, f.length, f.width, 24), color: 0x2f3640 },
    { geo: skinGeometry(f.profile, f.length, f.width - 0.06, 24), color: HDPE },
  ]
  // Gelb-schwarze Kanten an der Box, wie an jeder Anlage.
  for (let u = f.ramp; u < f.length - 0.2; u += 1.2) {
    for (const s of [-1, 1]) {
      parts.push({
        geo: new THREE.BoxGeometry(0.05, 0.14, 0.6),
        color: 0xf2c84b,
        position: [s * (f.width / 2 + 0.01), f.height - 0.1, u + 0.3],
      })
    }
  }
  parts.push({ geo: new THREE.BoxGeometry(f.width + 1.4, 0.4, f.length * 0.9), color: FLOAT, position: [0, -0.08, f.length * 0.5] })
  return assemble(parts)
}

function dockGeometry() {
  const parts = []
  const w = DOCK.width
  const h = DOCK.height
  for (let u = 0.2; u < DOCK.length; u += 0.55) {
    parts.push({ geo: new THREE.BoxGeometry(w, 0.1, 0.48), color: (Math.round(u / 0.55) % 3) ? WOOD : 0x9a6d47, position: [0, h - 0.05, u] })
  }
  for (let u = 0.4; u < DOCK.length; u += 2.6) {
    for (const s of [-1, 1]) {
      parts.push({ geo: new THREE.CylinderGeometry(0.13, 0.15, h + 1.8, 6), color: WOOD_DARK, position: [s * (w / 2 - 0.1), h / 2 - 0.9, u] })
    }
  }
  // Startmarke vorne an der Kante.
  parts.push({ geo: new THREE.BoxGeometry(w, 0.02, 0.18), color: 0xffffff, position: [0, h + 0.01, 1.1] })
  return assemble(parts)
}

// Flaeche lokal (u entlang +z, v entlang x) in die Welt legen.
function placeLocal(mesh, f) {
  mesh.position.set(f.x, 0, f.z)
  mesh.rotation.y = Math.atan2(f.dx, f.dz)
}

export function createObstacles(scene) {
  const material = vertexColorMaterial({ roughness: 0.55 })
  for (const f of FEATURES) {
    const geo = f.type === 'kicker' ? kickerGeometry(f) : sliderGeometry(f)
    const mesh = new THREE.Mesh(geo, material)
    placeLocal(mesh, f)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }
  const dock = new THREE.Mesh(dockGeometry(), material)
  placeLocal(dock, DOCK)
  dock.castShadow = true
  dock.receiveShadow = true
  scene.add(dock)
}

// --- Sammelsachen ------------------------------------------------------------

export function createCollectibles(scene) {
  const material = vertexColorMaterial({ roughness: 0.35, metalness: 0.1 })
  // Boje: gelber Ball mit weissem Band und einem kleinen Wimpel.
  const buoyGeo = assemble([
    { geo: new THREE.IcosahedronGeometry(0.42, 1), color: 0xf6b93b, position: [0, 0.18, 0] },
    { geo: new THREE.TorusGeometry(0.42, 0.06, 4, 12), color: 0xffffff, position: [0, 0.2, 0], rotation: [Math.PI / 2, 0, 0] },
    { geo: new THREE.CylinderGeometry(0.025, 0.025, 0.9, 4), color: 0x2f3640, position: [0, 0.8, 0] },
    { geo: new THREE.BoxGeometry(0.02, 0.22, 0.34), color: 0xd9553a, position: [0, 1.1, 0.17] },
  ])
  const buoys = BUOYS.map((b, i) => {
    const mesh = new THREE.Mesh(buoyGeo, material)
    mesh.position.set(b.x, 0, b.z)
    mesh.castShadow = true
    scene.add(mesh)
    return { ...b, mesh, phase: i * 0.77, taken: false, pop: 0 }
  })

  const ringGeo = assemble([
    { geo: new THREE.TorusGeometry(1, 0.1, 6, 28), color: 0xf6c24a },
    { geo: new THREE.TorusGeometry(1, 0.035, 4, 28), color: 0xffffff, position: [0, 0, 0.09] },
  ])
  const ringMat = vertexColorMaterial({ roughness: 0.3, metalness: 0.35, emissive: 0x6b4a10, emissiveIntensity: 0.35 })
  const rings = RINGS.map((r, i) => {
    const mesh = new THREE.Mesh(ringGeo, ringMat)
    mesh.position.set(r.x, r.y, r.z)
    mesh.scale.setScalar(r.radius)
    mesh.rotation.y = Math.atan2(r.dx, r.dz)
    mesh.castShadow = true
    scene.add(mesh)
    return { ...r, mesh, phase: i, taken: false, pop: 0 }
  })

  return {
    buoys,
    rings,
    all: [...buoys, ...rings],
    reset() {
      for (const it of [...buoys, ...rings]) {
        it.taken = false
        it.pop = 0
        it.mesh.visible = true
        it.mesh.scale.setScalar(it.kind === 'ring' ? it.radius : 1)
      }
    },
    update(elapsed, dt) {
      for (const b of buoys) {
        if (b.taken) {
          if (b.pop > 0) {
            b.pop -= dt
            const t = 1 - b.pop / 0.35
            b.mesh.scale.setScalar(1 + t * 0.8)
            b.mesh.position.y = t * 1.2
            if (b.pop <= 0) b.mesh.visible = false
          }
          continue
        }
        b.mesh.position.y = Math.sin(elapsed * 2 + b.phase) * 0.07
        b.mesh.rotation.y = elapsed * 0.6 + b.phase
        b.mesh.rotation.z = Math.sin(elapsed * 1.6 + b.phase) * 0.12
      }
      for (const r of rings) {
        if (r.taken) {
          if (r.pop > 0) {
            r.pop -= dt
            r.mesh.scale.setScalar(r.radius * (1 + (1 - r.pop / 0.4) * 0.6))
            if (r.pop <= 0) r.mesh.visible = false
          }
          continue
        }
        r.mesh.position.y = r.y + Math.sin(elapsed * 1.3 + r.phase) * 0.12
      }
    },
  }
}

// Schild mit Aufschrift, fuer Station und Insel.
export function signMesh(text, { width = 3, height = 0.8, background = '#f6efe2', color = '#23384d', sub = null } = {}) {
  const tex = labelTexture(text, {
    width: 512, height: Math.round(512 * (height / width)), background, color, sub,
    font: '800 110px ui-rounded, "SF Pro Rounded", "Segoe UI", system-ui, sans-serif',
  })
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat)
  return mesh
}

export { tint }
