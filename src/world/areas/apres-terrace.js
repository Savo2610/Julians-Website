import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { APRES, terraceWorld, terraceDistance, houseWorld } from './apres-layout.js'

const WOOD = 0x98734e, DARK = 0x574638, SNOW = 0xf7fbff
const BULBS = [0xffd27a, 0xff5a4e, 0x59d98e, 0x5aa8ff, 0xffe066]
const FLAGS = [0xc4302b, 0xf1ede4, 0x2f6b4a, 0xf2c230, 0x2c5f9e]
const SKIS = [0xd9412f, 0x1f6fd1, 0xf2c230, 0x2fae7a, 0xf06292, 0x7b4fd6, 0xff8a1f]

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
  if (kind === 'parasol') {
    // Rot-weisser Schirm durch die Tischmitte. Er gehoert zum Tisch und
    // faellt mit ihm um; die Stuetzrechnung in place() laesst den Tisch
    // dann auf der Schirmkante liegen, wie er es wirklich taete.
    parts.push({ geo: new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6), color: 0xf1ede4, position: [0, 1.25, 0] })
    for (let i = 0; i < 8; i++) {
      const wedge = new THREE.ConeGeometry(1.3, 0.5, 1, 1, true, i * Math.PI / 4, Math.PI / 4)
      parts.push({ geo: wedge, color: i % 2 ? 0xf6efe4 : 0xc4302b, position: [0, 2.45, 0] })
    }
    parts.push({ geo: new THREE.SphereGeometry(0.06, 6, 4), color: 0xf1ede4, position: [0, 2.72, 0] })
  }
  const geometry = assemble(parts)
  geometry.translate(0, -height / 2, 0)
  geometry.computeBoundingBox()
  return geometry
}

// Schneidet ein Vieleck an einer Geraden u = edge (axis 0) oder v = edge
// (axis 1) und behaelt die Seite darueber oder darunter.
function clip(poly, axis, edge, above) {
  const result = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const ai = above ? a[axis] >= edge : a[axis] <= edge
    const bi = above ? b[axis] >= edge : b[axis] <= edge
    if (ai) result.push(a)
    if (ai !== bi) {
      const t = (edge - a[axis]) / (b[axis] - a[axis])
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return result
}
const band = (poly, axis, from, to) => clip(clip(poly, axis, from, true), axis, to, false)

export function createApresTerrace(world) {
  const parts = []
  const at = (u, v, lift = 0) => {
    const { x, z } = terraceWorld(u, v)
    return [x, terrainHeight(x, z) + lift, z]
  }
  function panel(poly, color, lift) {
    if (poly.length < 3) return
    const shape = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(u, v)))
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) p.setXYZ(i, ...at(p.getX(i), -p.getZ(i), lift))
    // Die Spiegelung der lokalen Tiefe kehrt die Dreiecksrichtung um.
    const idx = geo.index
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a)
    }
    geo.computeVertexNormals()
    parts.push({ geo, color })
  }
  // Jede Bohle wird an der gemeinsamen Grundrisskontur abgeschnitten und
  // quer in 0,6-m-Stuecke geteilt: ein Vieleck hat nur an seinen Ecken eine
  // Hoehe, und ueber die Rampe zwischen den Ebenen haette eine ungeteilte
  // Bohle bis 20 cm im Schnee gesteckt.
  const outline = APRES.outline
  const upper = clip(outline, 0, APRES.split, true)
  const lower = clip(outline, 0, APRES.split, false)
  for (let u = -9.6; u < 5; u += 0.6) for (let v = -7; v < 8.5; v += 0.6) panel(band(band(outline, 0, u, u + 0.6), 1, v, v + 0.6), DARK, 0.016)
  // Beide Ebenen mit Bohlen quer zum Bild; laengs liefen sie aus der
  // Spielkamera als senkrechte Streifen und das Sonnendeck las sich als
  // Bretterwand. Unten ist das Holz heller (Sonne), und die Stosskante
  // trennt die Ebenen.
  for (const [poly, light, dark] of [[upper, 0x96704e, 0x886044], [lower, 0xa88259, 0x987050]]) {
    for (let v = -7, i = 0; v < 8.2; v += 0.28, i++) {
      const row = band(poly, 1, v, v + 0.263)
      for (let u = -9.6; u < 5; u += 0.6) panel(band(row, 0, u, u + 0.6), i % 3 ? light : dark, 0.025)
    }
  }
  const floor = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))
  floor.name = 'apres-terrassenboden'
  floor.receiveShadow = true
  world.scene.add(floor)

  // Zwei Gruppen oben vor dem Haus, eine auf dem Sonnendeck. Vor der Tuer
  // und zwischen den Ebenen bleiben gut zwei Meter frei.
  const layouts = [[-1.2, 4.6, 0, 'parasol'], [2.3, 5.4, 0.08, 'table'], [-7.4, -1.8, Math.PI / 2 - 0.06, 'parasol']].map(([u, v, angle, kind]) => {
    const { x, z } = terraceWorld(u, v)
    return [x, z, APRES.house.yaw + angle, kind]
  })
  const material = vertexColorMaterial({ roughness: 0.85 })
  const geometries = { table: furnitureGeometry('table'), parasol: furnitureGeometry('parasol'), bench: furnitureGeometry('bench') }
  const bodies = []
  const v = new THREE.Vector3()
  for (const [x, z, yaw, table] of layouts) for (const offset of [0, -1.15, 1.15]) {
    const kind = offset ? 'bench' : table
    const mesh = new THREE.Mesh(geometries[kind], material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = `terrasse-${kind}`
    const home = { x: x + Math.sin(yaw) * offset, z: z + Math.cos(yaw) * offset, yaw }
    const body = { mesh, kind, home, x: home.x, z: home.z, yaw, tiltX: 0, tiltZ: 0, targetX: 0, targetZ: 0, vx: 0, vz: 0, spin: 0, hold: 0, cooldown: 0, radius: kind === 'bench' ? 0.7 : 0.82 }
    bodies.push(body)
    world.scene.add(mesh)
    place(body)
  }

  const fixtures = [], bulbs = []
  const tube = (points, radius, color, segments = points.length * 2) =>
    fixtures.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 4, false), color })

  // Masten an der Aussenkante. Die Lichterketten spannen sich von Traufe und
  // Giebel zu ihnen und laufen die Kante entlang – Haus und beide Ebenen
  // gehoeren damit sichtbar zusammen. Die Birnen bunt wie in der Vorlage.
  const MAST = 3.1
  const masts = [[-8.4, -3.7], [-7.2, 2.9], [-2.4, 7.1], [3.4, 6.6]].map(([u, w]) => {
    const [x, y, z] = at(u, w)
    fixtures.push({ geo: new THREE.CylinderGeometry(0.055, 0.085, MAST, 7), color: DARK, position: [x, y + MAST / 2, z] })
    fixtures.push({ geo: new THREE.CylinderGeometry(0.1, 0.1, 0.1, 7), color: SNOW, position: [x, y + MAST + 0.05, z] })
    world.addCollider(x, z, 0.12)
    return [x, y + MAST - 0.05, z]
  })
  const H = APRES.house, eave = H.height + 2.0, run = H.width / 2 + 0.4
  const corner = (hx, hz, y) => { const p = houseWorld(hx, hz); return [p.x, y, p.z] }
  const roofFL = corner(-run, H.depth / 2 + 0.3, eave), roofFR = corner(run, H.depth / 2 + 0.3, eave)
  const roofBL = corner(-run, -H.depth / 2, eave)
  let bulbIndex = 0
  function strand(a, b, sag) {
    const points = []
    for (let j = 0; j <= 20; j++) {
      const t = j / 20
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t])
    }
    tube(points, 0.015, 0x1b1b1b, 24)
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const n = Math.max(2, Math.round(length / 0.6))
    for (let j = 1; j < n; j++) {
      const t = j / n
      bulbs.push({
        geo: new THREE.SphereGeometry(0.07, 6, 4),
        color: BULBS[bulbIndex++ % BULBS.length],
        position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - 0.07, a[2] + (b[2] - a[2]) * t],
      })
    }
  }
  strand(masts[0], masts[1], 0.4)
  strand(masts[1], masts[2], 0.45)
  strand(masts[2], masts[3], 0.45)
  strand(roofBL, masts[0], 0.35)
  strand(roofFL, masts[1], 0.4)
  strand(roofFR, masts[3], 0.35)

  // Wimpelkette tiefer zwischen den vorderen Masten, zur Kamera hin: dort,
  // wo das Gelaender der Vorlage war, ohne der Durchfahrt im Weg zu stehen.
  const flag = new THREE.Shape([new THREE.Vector2(-0.15, 0), new THREE.Vector2(0.15, 0), new THREE.Vector2(0, -0.32)])
  let flagIndex = 0
  for (const [a, b] of [[masts[1], masts[2]], [masts[2], masts[3]]]) {
    const low = 1.0, sag = 0.35
    const points = []
    const length = Math.hypot(b[0] - a[0], b[2] - a[2])
    const yaw = Math.atan2(a[2] - b[2], b[0] - a[0])
    for (let j = 0; j <= 12; j++) {
      const t = j / 12
      points.push([a[0] + (b[0] - a[0]) * t, a[1] - low + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t])
    }
    tube(points, 0.012, 0xe8e2d6, 16)
    for (let t = 0.4 / length; t < 1 - 0.2 / length; t += 0.42 / length) {
      fixtures.push({
        geo: new THREE.ExtrudeGeometry(flag, { depth: 0.012, bevelEnabled: false }),
        color: FLAGS[flagIndex++ % FLAGS.length],
        position: [a[0] + (b[0] - a[0]) * t, a[1] - low + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t],
        rotation: [0, yaw, 0],
      })
    }
  }

  // Gelaender mit Schneehaube nur an der hangseitigen Kante. Die Seite zur
  // Piste bleibt offen: dort faehrt man auf und ab.
  for (const [from, to] of [[[3.8, 2.6], [4.6, 4.4]], [[4.6, 4.4], [3.8, 6.8]]]) {
    const a = terraceWorld(...from), b = terraceWorld(...to)
    const top = [], mid = []
    for (let i = 0; i <= 4; i++) {
      const x = a.x + (b.x - a.x) * i / 4, z = a.z + (b.z - a.z) * i / 4, y = terrainHeight(x, z)
      fixtures.push({ geo: new THREE.BoxGeometry(0.12, 0.95, 0.12), color: DARK, position: [x, y + 0.475, z] })
      top.push([x, y + 0.95, z]); mid.push([x, y + 0.5, z])
      world.addCollider(x, z, 0.16)
    }
    tube(top, 0.06, WOOD, 8)
    tube(mid, 0.04, WOOD, 8)
    tube(top.map(([x, y, z]) => [x, y + 0.07, z]), 0.055, SNOW, 8)
  }

  // Die Stosskante zwischen den Ebenen: ein dunkler Balken quer ueber die
  // Rampe, hinten zwei Blumenkaesten mit Geranien. Sie lassen vorn gut sechs
  // Meter frei, dort faehrt man von einer Ebene auf die andere.
  const seam = []
  for (let w = -7; w < 8.5; w += 0.25) {
    const { x, z } = terraceWorld(APRES.split, w)
    if (terraceDistance(x, z) < -0.05) seam.push([x, terrainHeight(x, z) + 0.03, z])
  }
  if (seam.length > 1) tube(seam, 0.05, 0x46301f)
  for (const w of [-5.2, -3.4]) {
    const [x, y, z] = at(APRES.split, w)
    fixtures.push({ geo: new THREE.BoxGeometry(0.5, 0.45, 1.5), color: WOOD, position: [x, y + 0.22, z], rotation: [0, APRES.house.yaw, 0] })
    for (let i = 0; i < 5; i++) {
      const [fx, fy, fz] = at(APRES.split + (i % 2 ? 0.1 : -0.1), w - 0.6 + i * 0.3)
      fixtures.push({ geo: new THREE.SphereGeometry(0.13, 6, 4), color: i % 2 ? 0xd7263d : 0xe8452c, position: [fx, Math.max(fy, y) + 0.52, fz] })
    }
    for (const d of [-0.5, 0, 0.5]) {
      const p = terraceWorld(APRES.split, w + d)
      world.addCollider(p.x, p.z, 0.32)
    }
  }

  // Skistaender vorn an der Kante: sieben bunte Paare, angelehnt, die
  // Belaege zur Kamera. Aus 33 m die bunteste Stelle. An der Rueckkante des
  // Sonnendecks stand er genau in der Linie von der Nordabfahrt nach Osten –
  // dort blieb ein Fahrer bei (14,9, −65,3) haengen.
  {
    const from = -1.4, to = 0.9, w = 7.15
    const a = terraceWorld(from, w), b = terraceWorld(to, w)
    const ya = terrainHeight(a.x, a.z), yb = terrainHeight(b.x, b.z)
    tube([[a.x, ya + 1.2, a.z], [b.x, yb + 1.2, b.z]], 0.05, DARK, 4)
    tube([[a.x, ya + 1.28, a.z], [b.x, yb + 1.28, b.z]], 0.05, SNOW, 4)
    for (const p of [a, b]) {
      fixtures.push({ geo: new THREE.BoxGeometry(0.12, 1.25, 0.12), color: DARK, position: [p.x, terrainHeight(p.x, p.z) + 0.62, p.z] })
    }
    for (let i = 0; i < 7; i++) {
      const u = from + 0.25 + i * (to - from - 0.5) / 6
      const [x, y, z] = at(u, w + 0.3)
      for (const d of [-0.06, 0.06]) {
        const q = terraceWorld(u + d, w + 0.3)
        fixtures.push({ geo: new THREE.BoxGeometry(0.09, 1.7, 0.03), color: SKIS[i % SKIS.length], position: [q.x, y + 0.82, q.z], rotation: [-0.18, APRES.house.yaw, 0] })
      }
      if (i % 2 === 0) world.addCollider(x, z, 0.3)
    }
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
