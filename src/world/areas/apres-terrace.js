import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { APRES, terraceWorld, terraceDistance } from './apres-layout.js'

const WOOD = 0x98734e, DARK = 0x574638

function furnitureGeometry(kind) {
  const parts = []
  const bench = kind === 'bench'
  const height = bench ? 0.46 : 0.88
  const length = bench ? 1.8 : 1.6
  const width = bench ? 0.42 : 0.9
  for (let i = 0; i < (bench ? 2 : 4); i++) {
    const n = bench ? 2 : 4
    parts.push({ geo: new THREE.BoxGeometry(length, 0.1, width / n - 0.014), color: i % 2 ? WOOD : 0xa58059, position: [0, height - 0.05, (i + 0.5) * width / n - width / 2] })
  }
  for (const x of [-length * 0.35, length * 0.35]) {
    for (const z of [-width * 0.3, width * 0.3]) parts.push({ geo: new THREE.BoxGeometry(0.1, height - 0.1, 0.1), color: DARK, position: [x, (height - 0.1) / 2, z] })
    parts.push({ geo: new THREE.BoxGeometry(0.13, 0.1, width * 0.9), color: DARK, position: [x, 0.15, 0] })
  }
  const geometry = assemble(parts)
  geometry.translate(0, -height / 2, 0)
  geometry.computeBoundingBox()
  return geometry
}

export function createApresTerrace(world) {
  const parts = []
  // Jede Bohle wird an der gemeinsamen Grundrisskontur abgeschnitten. So
  // entsteht ein angeschlossener Vorplatz statt eines aufgesetzten Rechtecks.
  function clipRow(poly, edge, above) {
    const result = []
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length]
      const ai = above ? a[1] >= edge : a[1] <= edge
      const bi = above ? b[1] >= edge : b[1] <= edge
      if (ai) result.push(a)
      if (ai !== bi) {
        const t = (edge - a[1]) / (b[1] - a[1])
        result.push([a[0] + (b[0] - a[0]) * t, edge])
      }
    }
    return result
  }
  function panel(poly, color, lift) {
    const shape = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(u, v)))
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) {
      const {x, z} = terraceWorld(p.getX(i), -p.getZ(i))
      p.setXYZ(i, x, terrainHeight(x, z) + lift, z)
    }
    // Die Spiegelung der lokalen Tiefe kehrt die Dreiecksrichtung um.
    const idx = geo.index
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a)
    }
    geo.computeVertexNormals()
    parts.push({ geo, color })
  }
  panel(APRES.outline, DARK, 0.016)
  for (let v = 1.45, i = 0; v < 9; v += 0.28, i++) {
    const poly = clipRow(clipRow(APRES.outline, v, true), v + 0.263, false)
    if (poly.length > 2) panel(poly, i % 3 ? 0x96704e : 0x886044, 0.025)
  }
  const floor = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))
  floor.name = 'apres-terrassenboden'
  floor.receiveShadow = true
  world.scene.add(floor)

  // Vor der Tuer bleibt Platz, links eine breite Durchfahrt. Drei versetzte
  // Gruppen gliedern den Terrassenfluegel, ohne die Piste selbst zu versperren.
  const layouts = [[0.5, 4.5, 0], [-3.5, 6.4, 0.08], [-6.7, 4.1, -0.08]].map(([u, v, angle]) => {
    const {x, z} = terraceWorld(u, v)
    return [x, z, APRES.house.yaw + angle]
  })
  const material = vertexColorMaterial({ roughness: 0.85 })
  const geometries = { table: furnitureGeometry('table'), bench: furnitureGeometry('bench') }
  const bodies = []
  const v = new THREE.Vector3()
  for (const [x, z, yaw] of layouts) for (const offset of [0, -1.15, 1.15]) {
    const kind = offset ? 'bench' : 'table'
    const mesh = new THREE.Mesh(geometries[kind], material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = `terrasse-${kind}`
    const home = { x: x + Math.sin(yaw) * offset, z: z + Math.cos(yaw) * offset, yaw }
    const body = { mesh, kind, home, x: home.x, z: home.z, yaw, tiltX: 0, tiltZ: 0, targetX: 0, targetZ: 0, vx: 0, vz: 0, spin: 0, hold: 0, cooldown: 0, radius: kind === 'table' ? 0.82 : 0.7 }
    bodies.push(body)
    world.scene.add(mesh)
    place(body)
  }

  // Die Lichter gehen von der Fassade zu zwei Randpfosten. Damit gehoeren
  // Haus und Terrasse sichtbar zusammen; die offene Pistenkante bleibt frei.
  const fixtures = [], bulbs = []
  const anchors = [[-8.6, 4.2], [2.8, 6.5]]
  for (const [u, v] of anchors) {
    const {x, z} = terraceWorld(u, v)
    fixtures.push({ geo: new THREE.CylinderGeometry(0.055, 0.085, 2.9, 7), color: DARK, position: [x, terrainHeight(x, z) + 1.45, z] })
    world.addCollider(x, z, 0.12)
  }
  for (const [i, anchor] of anchors.entries()) {
    const a = terraceWorld(i ? 1.9 : -1.9, 1.65), b = terraceWorld(...anchor)
    const ay = APRES.house.height + 2.1, by = terrainHeight(b.x, b.z) + 2.9
    const points = []
    for (let j = 0; j <= 24; j++) {
      const t = j / 24, x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 0.35
      points.push(new THREE.Vector3(x, y, z))
      if (j % 3 === 1) bulbs.push({ geo: new THREE.SphereGeometry(0.075, 6, 4), color: 0xffd28e, position: [x, y - 0.08, z] })
    }
    fixtures.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.015, 4, false), color: DARK })
  }
  // Nur die hangseitige Kante bekommt eine niedrige Bruestung. Fusslaeufig
  // und mit Ski bleiben beide Enden des linken Fluegels zugaenglich.
  for (const [from, to] of [[[4, 3.5], [4, 6]], [[4, 6], [1, 8]]]) {
    const a = terraceWorld(...from), b = terraceWorld(...to)
    const points = []
    for (let i = 0; i <= 4; i++) {
      const x = a.x + (b.x - a.x) * i / 4, z = a.z + (b.z - a.z) * i / 4, y = terrainHeight(x, z)
      fixtures.push({ geo: new THREE.BoxGeometry(0.1, 0.85, 0.1), color: DARK, position: [x, y + 0.425, z] })
      points.push(new THREE.Vector3(x, y + 0.85, z))
      world.addCollider(x, z, 0.16)
    }
    fixtures.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, 0.06, 4, false), color: WOOD })
  }
  const frame = new THREE.Mesh(assemble(fixtures), material)
  frame.castShadow = true
  world.scene.add(frame)
  world.scene.add(new THREE.Mesh(assemble(bulbs), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })))

  function place(body) {
    const mesh = body.mesh
    // Ruhende Moebel brauchen keine 12 teuren Gelaendeproben pro Frame.
    const pose = [body.x, body.z, body.yaw, body.tiltX, body.tiltZ]
    if (body.lastPose && pose.every((value, i) => Math.abs(value - body.lastPose[i]) < 0.00001)) return
    body.lastPose = pose
    const c = Math.cos(body.yaw), s = Math.sin(body.yaw)
    const gx = (terrainHeight(body.x + 0.15, body.z) - terrainHeight(body.x - 0.15, body.z)) / 0.3
    const gz = (terrainHeight(body.x, body.z + 0.15) - terrainHeight(body.x, body.z - 0.15)) / 0.3
    mesh.rotation.set(body.tiltX - Math.atan(gx * s + gz * c), body.yaw, body.tiltZ + Math.atan(gx * c - gz * s), 'YXZ')
    const box = mesh.geometry.boundingBox
    let support = -Infinity
    // Der jeweils tiefste Punkt stuetzt das gekippte Moebel. Ohne diese
    // Rechnung verschwanden die Beine beim Umfallen unter den Bohlen.
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).applyEuler(mesh.rotation)
      support = Math.max(support, terrainHeight(body.x + v.x, body.z + v.z) - v.y)
    }
    mesh.position.set(body.x, support + 0.02, body.z)
  }

  let previous = null, hits = 0
  return {
    bodies,
    get hits() { return hits },
    update(dt, skier) {
      if (!skier || dt <= 0) return
      const current = skier.position
      const old = previous && previous.distanceTo(current) < 4 ? previous : current
      const dx = current.x - old.x, dz = current.z - old.z
      const length2 = dx * dx + dz * dz
      for (const b of bodies) {
        b.cooldown = Math.max(0, b.cooldown - dt)
        const t = length2 ? THREE.MathUtils.clamp(((b.x - old.x) * dx + (b.z - old.z) * dz) / length2, 0, 1) : 0
        const distance = Math.hypot(b.x - old.x - dx * t, b.z - old.z - dz * t)
        const near = Math.hypot(current.x - b.x, current.z - b.z)
        if (distance < b.radius + 0.55 && Math.abs(current.y - terrainHeight(b.x, b.z)) < 1.35 && skier.speed > 1.2 && !skier.tow && b.cooldown === 0) {
          const force = Math.min(8.5, 1.5 + skier.speed * 0.5)
          b.vx = skier.forward.x * force
          b.vz = skier.forward.z * force
          b.spin = (b.x - current.x) * skier.forward.z - (b.z - current.z) * skier.forward.x
          b.targetX = THREE.MathUtils.clamp(skier.forward.z * 1.35, -1.35, 1.35)
          b.targetZ = THREE.MathUtils.clamp(-skier.forward.x * 1.35, -1.35, 1.35)
          b.hold = 10
          b.cooldown = 0.6
          hits++
        }
        if (b.hold > 0) {
          b.hold = Math.max(0, b.hold - dt)
          b.tiltX += (b.targetX - b.tiltX) * (1 - Math.exp(-12 * dt))
          b.tiltZ += (b.targetZ - b.tiltZ) * (1 - Math.exp(-12 * dt))
          b.x += b.vx * dt; b.z += b.vz * dt; b.yaw += b.spin * dt
          const drag = Math.exp(-2.2 * dt)
          b.vx *= drag; b.vz *= drag; b.spin *= drag
          // Moebel bleiben im Vorplatz, statt in die Park-Landungen zu driften.
          if (terraceDistance(b.x, b.z) > -0.6) {
            b.x -= b.vx * dt; b.z -= b.vz * dt
            b.vx *= -0.25; b.vz *= -0.25
          }
        } else if (near > 7 && Math.hypot(current.x - b.home.x, current.z - b.home.z) > 7) {
          const blend = 1 - Math.exp(-2.5 * dt)
          b.x += (b.home.x - b.x) * blend; b.z += (b.home.z - b.z) * blend
          b.yaw += Math.atan2(Math.sin(b.home.yaw - b.yaw), Math.cos(b.home.yaw - b.yaw)) * blend
          b.tiltX *= 1 - blend; b.tiltZ *= 1 - blend
        }
        place(b)
      }
      if (!previous) previous = current.clone()
      else previous.copy(current)
    },
  }
}
