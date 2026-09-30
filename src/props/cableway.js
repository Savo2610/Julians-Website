import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { CABLE } from '../config.js'
import { cableAt, cableCorners, cableSamples } from '../world/cable-path.js'
import { Rope } from './rope.js'

// Die Wasserskianlage: vier Eckmasten, das umlaufende Seil, die Mitnehmer
// und ihre Zugseile. Leere Mitnehmer ziehen ihr Seil hinter sich her, die
// Hantel huepft ueber das Wasser – so sieht man sofort, wie die Anlage
// funktioniert, und dass gleich der naechste Buegel kommt.

const STEEL = 0xe9e6de
const STEEL_DARK = 0x9aa1a8
const SIGNAL = 0xd9553a
const CARRIER = 0xf0a93a

// Gittermast mit Ausleger. Der Fuss steht auf einem Betonsockel im Wasser.
function mastGeometry(height, boom) {
  const parts = []
  parts.push({ geo: new THREE.CylinderGeometry(1.6, 1.9, 1.4, 8), color: 0xb9b4a8, position: [0, -0.3, 0] })
  const base = 0.75
  const top = 0.32
  const legs = [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  for (const [sx, sz] of legs) {
    const from = new THREE.Vector3(sx * base, 0.4, sz * base)
    const to = new THREE.Vector3(sx * top, height, sz * top)
    const dir = to.clone().sub(from)
    const geo = new THREE.CylinderGeometry(0.07, 0.09, dir.length(), 5)
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()))
    parts.push({ geo, color: STEEL, position: from.add(to).multiplyScalar(0.5).toArray() })
  }
  // Querstreben in Stockwerken.
  for (let y = 1.4; y < height - 0.5; y += 1.6) {
    const w = base + (top - base) * (y / height)
    for (const r of [0, Math.PI / 2]) {
      const g = new THREE.BoxGeometry(w * 2, 0.06, 0.06)
      g.rotateY(r)
      parts.push({ geo: g, color: STEEL_DARK, position: [0, y, r ? w : -w] })
      const g2 = new THREE.BoxGeometry(w * 2, 0.06, 0.06)
      g2.rotateY(r)
      parts.push({ geo: g2, color: STEEL_DARK, position: [r ? 0 : 0, y, r ? -w : w] })
    }
  }
  // Rot-weisse Spitze.
  parts.push({ geo: new THREE.BoxGeometry(0.75, 0.5, 0.75), color: SIGNAL, position: [0, height + 0.1, 0] })
  parts.push({ geo: new THREE.BoxGeometry(0.72, 0.4, 0.72), color: 0xffffff, position: [0, height + 0.55, 0] })
  parts.push({ geo: new THREE.BoxGeometry(0.75, 0.45, 0.75), color: SIGNAL, position: [0, height + 0.95, 0] })
  parts.push({ geo: new THREE.SphereGeometry(0.16, 6, 4), color: 0xffd36b, position: [0, height + 1.3, 0] })
  // Ausleger zur Bahn hin (lokal -x), mit Umlenkrolle am Ende.
  parts.push({ geo: new THREE.BoxGeometry(boom, 0.28, 0.32), color: STEEL, position: [-boom / 2, height - 0.6, 0] })
  const strut = new THREE.BoxGeometry(0.1, 0.1, boom * 0.75)
  strut.rotateY(Math.PI / 2)
  strut.rotateZ(-0.5)
  parts.push({ geo: strut, color: STEEL_DARK, position: [-boom * 0.35, height - 1.6, 0] })
  const wheel = new THREE.CylinderGeometry(1.1, 1.1, 0.22, 16)
  parts.push({ geo: wheel, color: 0x3b4450, position: [-boom, height - 1.05, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.3, 0.3, 0.4, 8), color: SIGNAL, position: [-boom, height - 0.85, 0] })
  return assemble(parts)
}

function carrierGeometry() {
  return assemble([
    { geo: new THREE.BoxGeometry(0.34, 0.42, 0.9), color: CARRIER, position: [0, -0.28, 0] },
    { geo: new THREE.BoxGeometry(0.36, 0.1, 0.94), color: 0x2f3640, position: [0, -0.02, 0] },
    { geo: new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10), color: 0x2f3640, position: [0, 0.06, 0.28], rotation: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10), color: 0x2f3640, position: [0, 0.06, -0.28], rotation: [0, 0, Math.PI / 2] },
    { geo: new THREE.BoxGeometry(0.08, 0.35, 0.08), color: 0x2f3640, position: [0, -0.62, -0.3] },
  ])
}

export function handleGeometry() {
  return assemble([
    { geo: new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), color: 0x1f2630, rotation: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.045, 0.045, 0.2, 8), color: SIGNAL, position: [-0.2, 0, 0], rotation: [0, 0, Math.PI / 2] },
    { geo: new THREE.CylinderGeometry(0.045, 0.045, 0.2, 8), color: SIGNAL, position: [0.2, 0, 0], rotation: [0, 0, Math.PI / 2] },
  ])
}

export function createCableway(scene, cable) {
  const material = vertexColorMaterial({ roughness: 0.6 })

  // Masten: aussen an jeder Ecke, der Ausleger reicht bis ueber die Bahn.
  const boom = 4
  const mastGeo = mastGeometry(CABLE.height + 1.4, boom)
  for (const c of cableCorners()) {
    const mesh = new THREE.Mesh(mastGeo, material)
    mesh.position.set(c.x + c.ox * boom, 0, c.z + c.oz * boom)
    // Lokales -x soll nach innen zeigen, also zur Ecke der Bahn.
    mesh.rotation.y = Math.atan2(-c.oz, c.ox)
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }

  // Das umlaufende Seil.
  const path = cableSamples()
  const pts = []
  for (let i = 0; i < path.count; i += 4) pts.push(new THREE.Vector3(path.xs[i], CABLE.height, path.zs[i]))
  const curve = new THREE.CatmullRomCurve3(pts, true)
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(curve, pts.length * 2, 0.05, 4, true),
    new THREE.MeshStandardMaterial({ color: 0x39414c, roughness: 0.5, metalness: 0.4 }),
  )
  line.castShadow = true
  scene.add(line)

  // Mitnehmer und ihre Seile.
  const carrierGeo = carrierGeometry()
  const handleGeo = handleGeometry()
  const carriers = []
  for (let i = 0; i < cable.count; i++) {
    const mesh = new THREE.Mesh(carrierGeo, material)
    mesh.castShadow = true
    scene.add(mesh)
    const rope = new Rope({ radius: 0.03, color: 0xf2efe6 })
    scene.add(rope.mesh)
    const handle = new THREE.Mesh(handleGeo, material)
    handle.castShadow = true
    scene.add(handle)
    carriers.push({ mesh, rope, handle, phase: i * 1.7 })
  }

  const c = {}
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const back = {}

  return {
    carriers,
    // Liefert die Aufhaengung eines Mitnehmers (fuer das Zugseil des Fahrers).
    anchor(i, out) {
      cable.position(i, c)
      return out.set(c.x, CABLE.height - 0.95, c.z)
    },
    update(elapsed, rider, handWorld) {
      for (let i = 0; i < carriers.length; i++) {
        const k = carriers[i]
        cable.position(i, c)
        k.mesh.position.set(c.x, CABLE.height, c.z)
        k.mesh.rotation.y = Math.atan2(c.dx, c.dz)
        a.set(c.x, CABLE.height - 0.95, c.z)

        const towing = rider.tow === i && (rider.mode === 'ride' || (rider.mode === 'dock' && rider.hooked))
        if (towing && handWorld) {
          b.copy(handWorld)
          // Durchhang aus der ueberschuessigen Seillaenge.
          const len3 = Math.hypot(rider.ropeLength, CABLE.height - 1)
          const slack = Math.max(0, len3 - a.distanceTo(b))
          k.rope.set(a, b, 0.35 + slack * 0.9, 0.02)
          k.handle.visible = false
        } else if (rider.mode === 'dock' && rider.tow === i) {
          // Vor dem Einhaengen haengt das Seil kurz aufgerollt am Mitnehmer.
          b.set(c.x - c.dx * 2, CABLE.height - 4, c.z - c.dz * 2)
          k.rope.set(a, b, 0.2)
          k.handle.visible = true
          k.handle.position.copy(b)
          k.handle.rotation.set(0, Math.atan2(c.dx, c.dz), 0)
        } else {
          // Leer: Hantel schleift 13 m dahinter ueber das Wasser.
          cableAt(cable.sAt(i) - 13, back)
          const bob = Math.sin(elapsed * 7 + k.phase) * 0.06
          b.set(back.x, 0.12 + bob, back.z)
          k.rope.set(a, b, 1.6, 0.05)
          k.handle.visible = true
          k.handle.position.copy(b)
          k.handle.rotation.set(0, Math.atan2(back.dx, back.dz), 0)
        }
      }
    },
  }
}
