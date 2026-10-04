import * as THREE from 'three'
import { vertexColorMaterial } from '../../core/geometry.js'
import { makeRng } from '../../core/rng.js'
import { fbm } from '../../core/noise.js'
import { WORLD, LAKE, ISLAND, CABLE, MURMEL } from '../config.js'
import { terrainHeight, lakeDistance, islandDistance, PLAZA } from './heightfield.js'
import { createTrees } from '../props/trees.js'
import { signMesh } from '../props/obstacles.js'
import * as B from '../props/buildings.js'

// Aufbau der Gegend um den See. Alles deterministisch (feste Saat), damit
// der See bei jedem Laden gleich aussieht.
//
// Aufteilung, im Uhrzeigersinn von der Station aus: im Norden die Anlage mit
// Kiosk und Steg, im Osten eine Wiese mit Zelten und Bulli, im Sueden der
// Badestrand mit Rettungsturm, im Westen ein Bootshaus. Auf der Insel ein
// Pavillon auf der Kuppe, ein Lagerfeuer am Strand und ein Ruderboot. Dazu
// Wald ringsum, der nach aussen dichter und dunkler wird.

// Punkt am Ufer in Richtung a (vom Seemittelpunkt aus), `inland` Meter
// landeinwaerts (negativ = im Wasser).
export function shorePoint(a, inland = 0) {
  const dx = Math.cos(a)
  const dz = Math.sin(a)
  let r = 20
  while (r < 200 && lakeDistance(LAKE.x + dx * r, LAKE.z + dz * r) > -inland) r += 0.25
  const x = LAKE.x + dx * r
  const z = LAKE.z + dz * r
  return { x, z, y: terrainHeight(x, z), face: Math.atan2(-dx, -dz) }
}

function islandPoint(a, inward = 0) {
  const dx = Math.cos(a)
  const dz = Math.sin(a)
  let r = 0
  while (r < 60 && islandDistance(ISLAND.x + dx * r, ISLAND.z + dz * r) > inward) r += 0.2
  const x = ISLAND.x + dx * r
  const z = ISLAND.z + dz * r
  return { x, z, y: terrainHeight(x, z), face: Math.atan2(dx, dz) }
}

export function populate(scene) {
  const material = vertexColorMaterial({ roughness: 0.8 })
  const animated = []

  const put = (geo, x, z, rotY = 0, { y = null, lift = 0, shadow = true, scale = 1 } = {}) => {
    const mesh = new THREE.Mesh(geo, material)
    mesh.position.set(x, (y ?? terrainHeight(x, z)) + lift, z)
    mesh.rotation.y = rotY
    mesh.scale.setScalar(scale)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    scene.add(mesh)
    return mesh
  }

  // --- Station ----------------------------------------------------------------
  const sx = PLAZA.x
  const sz = PLAZA.z - 9
  put(B.stationGeometry(), sx, sz, 0, { y: PLAZA.height })
  const sign = signMesh('KABELSEE', { width: 7, height: 1.6, background: '#23384d', color: '#f6efe2', sub: 'Wasserski am Kabel' })
  sign.position.set(sx, PLAZA.height + 5.35, sz + 2.2)
  sign.castShadow = true
  scene.add(sign)
  for (const [dx, dz, a, b] of [[-5.5, 6.5, 0xe4613a, 0xf6f3ec], [5.8, 6.2, 0x3a9ea5, 0xf6f3ec], [0.4, 8.2, 0xf2c84b, 0xf6f3ec]]) {
    put(B.parasolGeometry(a, b), sx + dx, sz + dz, dx * 0.2, { y: PLAZA.height + 0.3 })
  }
  put(B.boardRackGeometry(), sx + 9.5, sz + 1, -Math.PI / 2 + 0.3)
  put(B.flagGeometry(0xe4613a, 7), sx - 9, sz + 5)
  put(B.flagGeometry(0x3a9ea5, 7), sx - 10.5, sz + 3.5)
  put(B.boothGeometry(), sx + 5.2, -69.5, -0.4)
  put(B.benchGeometry(), sx - 3.5, -72, 0.1)

  // Liegen und Handtuecher am Strand westlich der Station.
  const towelColors = [0xe4613a, 0x3a9ea5, 0xf2c84b, 0x8fc23a]
  for (let i = 0; i < 4; i++) {
    const p = shorePoint(-1.28 - i * 0.05, 4.5)
    put(B.loungerGeometry(i % 2 ? 0x3a9ea5 : 0xf6f3ec), p.x, p.z, p.face)
    if (i % 2 === 0) put(B.parasolGeometry(i ? 0x3a9ea5 : 0xe4613a), p.x + 1.2, p.z - 0.6, 0)
  }

  // --- Badestrand im Sueden -----------------------------------------------------
  for (let i = 0; i < 6; i++) {
    const p = shorePoint(1.42 + i * 0.07, 3 + (i % 2) * 2)
    put(B.towelGeometry(towelColors[i % 4]), p.x, p.z, p.face + (i % 3 - 1) * 0.25, { shadow: false, lift: 0.02 })
    if (i % 2 === 0) put(B.parasolGeometry(i === 2 ? 0x3a9ea5 : 0xe4613a), p.x + 1.3, p.z + 0.4, i)
  }
  {
    const p = shorePoint(1.72, 6)
    put(B.lifeguardGeometry(), p.x, p.z, p.face)
  }
  {
    const p = shorePoint(1.3, 1.5)
    put(B.rowboatGeometry(0x3a9ea5), p.x, p.z, p.face + 1.3, { lift: 0.05 })
  }

  // --- Zeltwiese im Osten -------------------------------------------------------
  const camp = shorePoint(0.12, 16)
  put(B.vanGeometry(), camp.x + 3, camp.z - 4, -0.6)
  put(B.tentGeometry(0xe4613a), camp.x - 3, camp.z + 2, 0.5)
  put(B.tentGeometry(0x3a9ea5), camp.x + 2, camp.z + 6, 0.9)
  put(B.tentGeometry(0xefe3c8), camp.x + 7, camp.z + 1, 0.2)
  put(B.firepitGeometry(), camp.x - 1, camp.z - 3, 0.3)
  put(B.picnicGeometry(), camp.x - 6, camp.z - 5, 0.8)
  put(B.lanternGeometry(), camp.x + 0.5, camp.z + 0.5, 0)
  for (let i = 0; i < 3; i++) {
    const p = shorePoint(-0.25 + i * 0.28, 3)
    put(B.benchGeometry(), p.x, p.z, p.face + Math.PI)
  }

  // --- Bootshaus im Westen -----------------------------------------------------
  {
    const p = shorePoint(Math.PI - 0.32, -2.5)
    put(B.boathouseGeometry(), p.x, p.z, p.face + Math.PI, { y: 0.1 })
    const q = shorePoint(Math.PI - 0.2, -3)
    put(B.rowboatGeometry(0xd9553a), q.x, q.z, q.face + 1.6, { y: -0.35 })
  }

  // --- Insel ----------------------------------------------------------------------
  // Kuppe suchen: der hoechste Punkt nahe der Mitte.
  let top = { x: ISLAND.x, z: ISLAND.z, y: -99 }
  for (let dx = -8; dx <= 8; dx += 1) {
    for (let dz = -6; dz <= 6; dz += 1) {
      const y = terrainHeight(ISLAND.x + dx, ISLAND.z + dz)
      if (y > top.y) top = { x: ISLAND.x + dx, z: ISLAND.z + dz, y }
    }
  }
  put(B.pavilionGeometry(), top.x, top.z, 0.2, { y: top.y - 0.1 })
  put(B.flagGeometry(0xe4613a, 5.5), top.x + 4, top.z + 1.5)
  for (const a of [0.9, 1.9, 2.8]) {
    const p = islandPoint(a, 6)
    put(B.lanternGeometry(), p.x, p.z, 0)
  }
  {
    const p = islandPoint(1.25, 2.2)
    put(B.firepitGeometry(), p.x, p.z, 0.4)
    const q = islandPoint(1.75, 1.2)
    put(B.rowboatGeometry(0xf6f3ec), q.x, q.z, q.face + 1.4, { lift: 0.02 })
    const b = islandPoint(0.55, 4)
    put(B.benchGeometry(), b.x, b.z, b.face)
  }

  // --- Felsen -----------------------------------------------------------------
  const rng = makeRng(2024)
  const rockGeos = [1, 2, 3, 4].map((s) => B.rockGeometry(s))
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2
    if (Math.abs(a - 5.13) < 0.35) continue  // nicht vor die Station
    const p = shorePoint(a, rng.range(-1.2, 3))
    put(rockGeos[i % 4], p.x, p.z, rng() * 6, { lift: -0.2, scale: rng.range(0.5, 1.5) })
  }
  for (let i = 0; i < 12; i++) {
    const p = islandPoint(rng() * Math.PI * 2, rng.range(-0.8, 2))
    put(rockGeos[i % 4], p.x, p.z, rng() * 6, { lift: -0.15, scale: rng.range(0.5, 1.2) })
  }

  // --- Schilf -----------------------------------------------------------------
  const reedGeos = [7, 8, 9].map((s) => B.reedGeometry(s))
  const reedMat = vertexColorMaterial({ roughness: 0.9 })
  const reedList = []
  for (let i = 0; i < 240; i++) {
    const a = rng() * Math.PI * 2
    // Station, Strand im Sueden und Badestelle bleiben frei.
    if (Math.abs(a - 5.13) < 0.5 || Math.abs(a - 1.55) < 0.3) continue
    if (fbm(Math.cos(a) * 3, Math.sin(a) * 3, 2) < 0.45) continue
    const p = shorePoint(a, rng.range(-3.5, -0.3))
    reedList.push({ ...p, r: rng() * 6, s: rng.range(0.8, 1.3), k: i % 3 })
  }
  for (let i = 0; i < 70; i++) {
    const a = rng() * Math.PI * 2
    if (Math.abs(a - 1.5) < 0.4) continue
    const p = islandPoint(a, rng.range(-2.5, -0.2))
    reedList.push({ ...p, r: rng() * 6, s: rng.range(0.7, 1.1), k: i % 3 })
  }
  reedGeos.forEach((geo, k) => {
    const list = reedList.filter((r) => r.k === k)
    const mesh = new THREE.InstancedMesh(geo, reedMat, list.length)
    const d = new THREE.Object3D()
    list.forEach((r, i) => {
      d.position.set(r.x, Math.max(r.y, -0.5), r.z)
      d.rotation.set(0, r.r, 0)
      d.scale.setScalar(r.s)
      d.updateMatrix()
      mesh.setMatrixAt(i, d.matrix)
    })
    mesh.castShadow = true
    scene.add(mesh)
  })

  // --- Enten ------------------------------------------------------------------
  const duckGeo = B.duckGeometry()
  const ducks = []
  for (const [cx, cz, n, r] of [[-30, 32, 4, 4.5], [30, -24, 3, 3.5], [-86, -58, 3, 3]]) {
    for (let i = 0; i < n; i++) {
      const mesh = put(duckGeo, cx, cz, 0, { y: 0, shadow: false })
      ducks.push({ mesh, cx, cz, r: r + i * 0.4, phase: (i / n) * Math.PI * 2 - i * 0.2, speed: 0.12 + i * 0.01 })
    }
  }
  animated.push((t) => {
    for (const d of ducks) {
      const a = d.phase + t * d.speed
      d.mesh.position.set(d.cx + Math.cos(a) * d.r, Math.sin(t * 2 + d.phase) * 0.02, d.cz + Math.sin(a) * d.r)
      d.mesh.rotation.y = -a
    }
  })

  // --- Baeume -----------------------------------------------------------------
  const trees = []
  const murmel = shorePoint(MURMEL.winkel, MURMEL.inland)
  const half = WORLD.size / 2 - 4
  const blocked = (x, z) => {
    if (Math.hypot(x - PLAZA.x, z - PLAZA.z) < PLAZA.radius + 4) return true
    if (Math.hypot(x - camp.x, z - camp.z) < 13) return true
    // Die Murmeltierbaue bleiben offen, sonst saessen sie im Wald.
    if (Math.hypot(x - murmel.x, z - murmel.z) < 9) return true
    // Station liegt im Norden; der Streifen zwischen Haus und Hang bleibt frei.
    if (Math.abs(x - PLAZA.x) < 8 && z < PLAZA.z && z > PLAZA.z - 40) return true
    return false
  }
  for (let i = 0; i < 5200 && trees.length < 1150; i++) {
    const x = rng.range(-half, half)
    const z = rng.range(-half, half)
    const e = -lakeDistance(x, z)
    if (e < 7 || blocked(x, z)) continue
    // Nahe am Wasser lichte Gruppen, nach aussen geschlossener Wald.
    const n = fbm(x * 0.04 + 9, z * 0.04 - 3, 3)
    const density = e < 30 ? (n > 0.56 ? 0.55 : 0.04) : Math.min(1, 0.25 + (e - 30) / 50) * (n > 0.38 ? 1 : 0.35)
    if (rng() > density) continue
    const y = terrainHeight(x, z)
    let kind
    const roll = rng()
    if (e < 30) kind = roll < 0.45 ? 'oak' : roll < 0.75 ? 'birch' : roll < 0.85 ? 'oakGold' : 'pine'
    else kind = roll < 0.55 ? 'pine' : roll < 0.75 ? 'pineTall' : roll < 0.88 ? 'oak' : roll < 0.94 ? 'pineSmall' : 'oakGold'
    trees.push({ kind, x, y, z, rotation: rng() * 6.28, scale: rng.range(0.8, 1.35) * (e > 60 ? 1.15 : 1), shade: rng() })
  }
  // Inselwald: Kiefern und Birken, die Kuppe um den Pavillon frei.
  for (let i = 0; i < 400 && trees.length < 1260; i++) {
    const x = ISLAND.x + rng.range(-ISLAND.rx, ISLAND.rx)
    const z = ISLAND.z + rng.range(-ISLAND.rz, ISLAND.rz)
    const di = islandDistance(x, z)
    if (di < 4.5 || Math.hypot(x - top.x, z - top.z) < 6.5) continue
    // Suedufer zur Kamera hin licht halten, sonst verdecken Kronen den Strand.
    if (z > ISLAND.z + 8 && di < 9) continue
    const roll = rng()
    trees.push({
      kind: roll < 0.4 ? 'pine' : roll < 0.65 ? 'birch' : roll < 0.9 ? 'oak' : 'oakGold',
      x, y: terrainHeight(x, z), z, rotation: rng() * 6.28, scale: rng.range(0.75, 1.15), shade: rng(),
    })
  }
  createTrees(scene, trees)

  return { animated, top, cableHeight: CABLE.height }
}
