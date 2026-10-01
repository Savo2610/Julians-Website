import * as THREE from 'three'
import { assemble, vertexColorMaterial, tint, labelTexture } from '../core/geometry.js'
import { FEATURES, DOCK, BUOYS, RINGS, GATES } from '../world/features.js'

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

// Rail: kurze weisse Auffahrt wie an der Box, dann ein Stahlrohr auf zwei
// Stuetzen. Die Oberkante des Rohrs liegt genau auf der Hoehe, auf der die
// Rechnung den Fahrer fuehrt.
function railGeometry(f) {
  const tube = 0.075
  const rampProfile = (u) => f.profile(Math.min(u, f.ramp))
  const parts = [
    { geo: bodyGeometry(rampProfile, f.ramp, f.width, 8), color: 0x2f3640 },
    { geo: skinGeometry(rampProfile, f.ramp, f.width - 0.06, 8), color: HDPE },
    { geo: new THREE.BoxGeometry(f.width + 0.05, 0.08, 0.16), color: EDGE, position: [0, f.height - 0.03, f.ramp - 0.08] },
  ]
  const len = f.length - f.ramp
  parts.push({
    geo: new THREE.CylinderGeometry(tube, tube, len, 10),
    color: 0xc9d1d9,
    position: [0, f.height - tube, f.ramp + len / 2],
    rotation: [Math.PI / 2, 0, 0],
  })
  for (const u of [f.ramp + 1.2, f.length - 1.2]) {
    parts.push({ geo: new THREE.BoxGeometry(0.1, f.height + 0.2, 0.1), color: 0x3a4250, position: [0, (f.height - 0.2) / 2 - 0.1, u] })
    parts.push({ geo: new THREE.BoxGeometry(1.8, 0.35, 0.9), color: FLOAT, position: [0, -0.05, u] })
  }
  // Orange Ringe am Rohr, damit man es von oben ueberhaupt sieht.
  for (let u = f.ramp + 0.6; u < f.length - 0.3; u += 1.6) {
    parts.push({ geo: new THREE.CylinderGeometry(tube + 0.012, tube + 0.012, 0.18, 10), color: EDGE, position: [0, f.height - tube, u], rotation: [Math.PI / 2, 0, 0] })
  }
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
    const geo = f.type === 'kicker' ? kickerGeometry(f) : f.kind === 'Rail' ? railGeometry(f) : sliderGeometry(f)
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

const GATE_OPEN = 0xe4613a
const GATE_DONE = 0x8fc23a

export function createCollectibles(scene) {
  const material = vertexColorMaterial({ roughness: 0.35, metalness: 0.1 })
  // Boje zum Sammeln: kleiner Schwimmer, darueber ein leuchtender Stein, der
  // sich dreht, und ein Kreis auf dem Wasser, der atmet. Vorher war es ein
  // gelber Ball mit Wimpel, und der sah aus wie jede Boje an einer Anlage –
  // dass man ihn holen soll, hat niemand gemerkt.
  const floatGeo = assemble([
    { geo: new THREE.IcosahedronGeometry(0.3, 1), color: 0xf6f3ec, position: [0, 0.08, 0] },
    { geo: new THREE.TorusGeometry(0.3, 0.05, 4, 12), color: 0xf2c84b, position: [0, 0.1, 0], rotation: [Math.PI / 2, 0, 0] },
  ])
  const gemGeo = assemble([
    { geo: new THREE.OctahedronGeometry(0.42, 0), color: 0xf6c24a, scale: [1, 1.35, 1] },
  ])
  const gemMat = vertexColorMaterial({ roughness: 0.25, metalness: 0.2, emissive: 0xe0a020, emissiveIntensity: 0.9 })
  const haloGeo = new THREE.RingGeometry(0.95, 1.25, 28)
  haloGeo.rotateX(-Math.PI / 2)
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, depthWrite: false, fog: true })

  // Je Teil ein InstancedMesh fuer alle Bojen: drei Zeichenaufrufe statt 87.
  const instanced = (geo, mat, shadow) => {
    const m = new THREE.InstancedMesh(geo, mat, BUOYS.length)
    m.castShadow = shadow
    m.frustumCulled = false
    scene.add(m)
    return m
  }
  const floats = instanced(floatGeo, material, true)
  const gems = instanced(gemGeo, gemMat, true)
  const halos = instanced(haloGeo, haloMat, false)
  // Das Wasser ist selbst durchsichtig und kommt mit renderOrder 1; der
  // Kreis muss danach, sonst liegt er unter der Oberflaeche.
  halos.renderOrder = 2
  const buoys = BUOYS.map((b, i) => ({ ...b, phase: i * 0.77, taken: false, pop: 0, scale: 1, lift: 0, visible: true }))
  const _m = new THREE.Matrix4()
  const _q = new THREE.Quaternion()
  const _e = new THREE.Euler()
  const _p = new THREE.Vector3()
  const _s = new THREE.Vector3()
  const setPart = (mesh, i, x, y, z, rotY, rotZ, scale) => {
    _p.set(x, y, z)
    _q.setFromEuler(_e.set(0, rotY, rotZ))
    _s.setScalar(scale)
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s))
  }
  function drawBuoys(elapsed) {
    buoys.forEach((b, i) => {
      const sc = b.visible ? b.scale : 0
      const bob = b.taken ? b.lift : Math.sin(elapsed * 2 + b.phase) * 0.07
      const tilt = b.taken ? 0 : Math.sin(elapsed * 1.6 + b.phase) * 0.1
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * 3.2 + b.phase)
      setPart(floats, i, b.x, bob, b.z, b.phase, tilt, sc)
      setPart(gems, i, b.x, bob + 1.1 * sc + Math.sin(elapsed * 3 + b.phase) * 0.12, b.z, elapsed * 2.2 + b.phase, 0, sc)
      setPart(halos, i, b.x, 0.04, b.z, 0, 0, b.taken ? 0 : 0.85 + pulse * 0.3)
    })
    floats.instanceMatrix.needsUpdate = true
    gems.instanceMatrix.needsUpdate = true
    halos.instanceMatrix.needsUpdate = true
  }
  drawBuoys(0)

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

  // Slalomfahnen: rot-weisser Schwimmer, hoher Stab, ein Wimpel, der von
  // der Bahn weg zeigt – dorthin, wo man vorbei muss. Geschafft wird er gruen.
  const poleGeo = assemble([
    { geo: new THREE.CylinderGeometry(0.34, 0.4, 0.35, 10), color: 0xf6f3ec, position: [0, 0.05, 0] },
    { geo: new THREE.CylinderGeometry(0.36, 0.36, 0.12, 10), color: 0xd9553a, position: [0, 0.12, 0] },
    { geo: new THREE.CylinderGeometry(0.06, 0.06, 4.4, 6), color: 0xf6f3ec, position: [0, 2.4, 0] },
    { geo: new THREE.CylinderGeometry(0.065, 0.065, 0.4, 6), color: 0xd9553a, position: [0, 3.1, 0] },
    { geo: new THREE.CylinderGeometry(0.065, 0.065, 0.4, 6), color: 0xd9553a, position: [0, 1.9, 0] },
  ])
  const clothShape = new THREE.Shape()
  clothShape.moveTo(0, 0)
  clothShape.lineTo(2, -0.55)
  clothShape.lineTo(0, -1.1)
  clothShape.closePath()
  const clothGeo = new THREE.ShapeGeometry(clothShape)
  const gates = GATES.map((g) => {
    const mesh = new THREE.Group()
    mesh.position.set(g.x, 0, g.z)
    const pole = new THREE.Mesh(poleGeo, material)
    pole.castShadow = true
    const clothMat = new THREE.MeshStandardMaterial({ color: GATE_OPEN, roughness: 0.7, side: THREE.DoubleSide, flatShading: true })
    const cloth = new THREE.Mesh(clothGeo, clothMat)
    cloth.position.y = 4.55
    cloth.castShadow = true
    // Lokales +x soll von der Bahn weg zeigen: aussen ist (-dz, dx).
    const qx = -g.dz * g.side
    const qz = g.dx * g.side
    const flag = new THREE.Group()
    flag.rotation.y = Math.atan2(-qz, qx)
    flag.add(cloth)
    mesh.add(pole, flag)
    scene.add(mesh)
    return { ...g, mesh, cloth, flag, done: false }
  })

  const api = {
    buoys,
    rings,
    gates,
    all: [...buoys, ...rings],
    buoyMeshes: [floats, gems, halos],
    setGate(i, done) {
      const g = gates[i]
      if (!g || g.done === done) return
      g.done = done
      g.cloth.material.color.setHex(done ? GATE_DONE : GATE_OPEN)
    },
    resetGates() {
      for (const g of gates) api.setGate(g.index, false)
    },
    reset() {
      for (const b of buoys) Object.assign(b, { taken: false, pop: 0, scale: 1, lift: 0, visible: true })
      for (const r of rings) {
        r.taken = false
        r.pop = 0
        r.mesh.visible = true
        r.mesh.scale.setScalar(r.radius)
      }
      api.resetGates()
      drawBuoys(0)
    },
    update(elapsed, dt) {
      for (const b of buoys) {
        if (b.taken && b.pop > 0) {
          b.pop -= dt
          const t = 1 - b.pop / 0.35
          b.scale = 1 + t * 0.8
          b.lift = t * 1.2
          if (b.pop <= 0) b.visible = false
        }
      }
      drawBuoys(elapsed)
      haloMat.opacity = 0.4 + 0.2 * Math.sin(elapsed * 3.2)
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
      for (const g of gates) {
        g.flag.children[0].rotation.y = Math.sin(elapsed * 4 + g.index) * 0.18
        g.mesh.rotation.z = Math.sin(elapsed * 1.4 + g.index) * 0.03
      }
    },
  }
  return api
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
