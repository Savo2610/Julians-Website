import * as THREE from 'three'
import { WORLD } from '../config.js'
import { makeRng } from '../core/rng.js'
import { fbm } from '../core/noise.js'
import { terrainHeight, terrainNormal, LAKE, PLATEAU, SUMMIT, playAreaDistance } from './heightfield.js'
import { createForest, createFallenTree } from './props/trees.js'
import { createRocks, createBoulder } from './props/rocks.js'
import { createLake } from './props/lake.js'
import { createBackdrop } from './props/backdrop.js'
import { createFence, createPisteMarkers } from './props/fence.js'
import { createSignpost } from './props/signpost.js'
import { populateStations, STATION_SPOTS, TRAILS } from '../stations/stations.js'
import { createMarker } from '../stations/marker.js'
import { createTorch } from './props/torch.js'
import { createSummitCross } from './props/summit-cross.js'
import { DragLift } from './drag-lift.js'

// Gesperrte Zonen: hier soll nichts wachsen, weil dort gefahren oder etwas
// gebaut wird. Jede Station bringt ihre eigene Lichtung mit.
const CLEARINGS = [
  { x: PLATEAU.x, z: PLATEAU.z, r: PLATEAU.radius + 5 },   // Startplateau
  { x: LAKE.x, z: LAKE.z, r: LAKE.radius * 1.02 },
  { x: SUMMIT.x, z: SUMMIT.z, r: 13 },   // Gipfelbereich frei halten
  { x: -40, z: -44, r: 12 },   // Startbereich der langen Abfahrt
  ...Object.values(STATION_SPOTS).map((s) => ({ x: s.x, z: s.z, r: s.clearing })),
]

function inClearing(x, z, pad = 0) {
  for (const c of CLEARINGS) {
    const dx = x - c.x
    const dz = z - c.z
    const r = c.r + pad
    if (dx * dx + dz * dz < r * r) return true
  }
  return false
}

// Blue-Noise-artige Streuung per Rejection Sampling auf einem Raster. Die
// Kandidaten werden ueber die Bounding-Box der Spielflaeche gezogen und dann
// verworfen, was ausserhalb liegt – bei einer nierenfoermigen Karte ist das
// einfacher und gleichmaessiger als polar zu streuen.
function scatter(rng, { count, minDist, accept, tries = 40 }) {
  const cell = minDist / Math.SQRT2
  const grid = new Map()
  const points = []
  const key = (x, z) => `${Math.floor(x / cell)}:${Math.floor(z / cell)}`

  const fits = (x, z) => {
    const cx = Math.floor(x / cell)
    const cz = Math.floor(z / cell)
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const list = grid.get(`${cx + i}:${cz + j}`)
        if (!list) continue
        for (const p of list) {
          const dx = p.x - x
          const dz = p.z - z
          if (dx * dx + dz * dz < minDist * minDist) return false
        }
      }
    }
    return true
  }

  // Bounding-Box ueber alle Becken plus Rand.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const b of WORLD.basins) {
    const reach = b.radius + WORLD.rimWidth
    minX = Math.min(minX, b.x - reach)
    maxX = Math.max(maxX, b.x + reach)
    minZ = Math.min(minZ, b.z - reach)
    maxZ = Math.max(maxZ, b.z + reach)
  }

  let guard = count * tries
  while (points.length < count && guard-- > 0) {
    const x = minX + rng() * (maxX - minX)
    const z = minZ + rng() * (maxZ - minZ)
    if (!accept(x, z)) continue
    if (!fits(x, z)) continue
    const p = { x, z }
    points.push(p)
    const k = key(x, z)
    let list = grid.get(k)
    if (!list) grid.set(k, (list = []))
    list.push(p)
  }
  return points
}

// Der Lift braucht beim Einsteigen eine Referenz auf den Fahrer, der erst
// nach der Welt entsteht. Ein kleiner Halter loest das ohne Umweg.
export const skierRef = { current: null }

export function populate(world, sky, registry) {
  const rng = makeRng(20260902)
  const animatedProps = []

  createBackdrop(world.scene, { fogColor: world.scene.fog.color })
  const n = new THREE.Vector3()

  const steepness = (x, z) => {
    terrainNormal(x, z, n)
    return 1 - n.y
  }

  // --- Wald ------------------------------------------------------------
  // Dichter Guertel aussen, lockere Gruppen innen: der Wald ist die weiche
  // Talgrenze, bevor die Felswand kommt.
  const treeSpots = scatter(rng, {
    count: 760,
    minDist: 3.4,
    accept: (x, z) => {
      const edge = playAreaDistance(x, z)
      if (edge > WORLD.rimWidth - 2) return false
      if (inClearing(x, z, 2)) return false
      if (steepness(x, z) > 0.5) return false
      // Baumgrenze: nach oben hin lichtet sich der Wald, statt an einer Linie
      // abzubrechen. Das macht die kahle Kuppe lesbar, ohne dass ein Ring
      // entsteht.
      const height = terrainHeight(x, z)
      if (height > 24) return false
      const treeline = 1 - THREE.MathUtils.smoothstep(height, 13, 24)

      // Der Wald ist die weiche Kartengrenze: am Rand geschlossen, innen nur
      // vereinzelte Gruppen, damit die Flaeche zum Fahren offen bleibt.
      const rim = THREE.MathUtils.smoothstep(edge, -22, -4)
      // Grosszuegige Haine statt Gleichverteilung.
      const groves = Math.pow(THREE.MathUtils.smoothstep(fbm(x * 0.035 + 60, z * 0.035 + 60, 3), 0.52, 0.78), 1.4)
      const density = Math.min(1, rim * 0.98 + groves * 0.5) * treeline
      return rng() < density
    },
  })

  const placements = treeSpots.map((p) => {
    const edge = THREE.MathUtils.clamp((playAreaDistance(p.x, p.z) + 26) / 26, 0, 1)
    return {
      x: p.x,
      z: p.z,
      variant: rng() < 0.55 ? 0 : rng() < 0.6 ? 1 : 2,
      rotation: rng() * Math.PI * 2,
      // Aussen stehen die groesseren Baeume – gibt der Talgrenze Gewicht.
      scale: (0.7 + rng() * rng() * 0.85) * (1 + edge * 0.5),
      tiltX: (rng() - 0.5) * 0.07,
      tiltZ: (rng() - 0.5) * 0.07,
      shade: rng(),
    }
  })
  createForest(world, placements)

  // --- Felsen -----------------------------------------------------------
  const rockSpots = scatter(rng, {
    count: 210,
    minDist: 5.0,
    accept: (x, z) => {
      if (playAreaDistance(x, z) > WORLD.rimWidth - 1) return false
      if (inClearing(x, z, 2)) return false
      const s = steepness(x, z)
      // Felsen brechen bevorzugt aus steilen Flanken heraus, und oberhalb der
      // Baumgrenze praegen sie den Gipfel.
      const alpine = terrainHeight(x, z) > 20 ? 0.3 : 0
      return rng() < 0.16 + s * 1.4 + alpine
    },
  })
  createRocks(
    world,
    rockSpots.map((p, i) => ({
      x: p.x,
      z: p.z,
      variant: i % 3,
      rotation: rng() * Math.PI * 2,
      scale: 0.65 + rng() * rng() * 1.75,
      stretch: 0.85 + rng() * 0.45,
      tilt: rng() - 0.5,
    })),
  )

  // Zwei Landmarken-Findlinge, an denen man sich orientieren kann.
  const boulderA = createBoulder(31, 2.4)
  world.place(boulderA, 18, -30, { yOffset: -1.1, rotation: 0.7 })
  world.addCollider(18, -30, 2.6)

  const boulderB = createBoulder(77, 2.0)
  world.place(boulderB, -22, 8, { yOffset: -0.9, rotation: 2.1 })
  world.addCollider(-22, 8, 2.2)

  // --- Umgestuerzte Baeume am Waldrand ----------------------------------
  for (const [i, spot] of [
    { x: -12, z: -18, rot: 0.9 },
    { x: 36, z: 16, rot: 2.4 },
    { x: -46, z: 12, rot: 1.7 },
  ].entries()) {
    const log = createFallenTree(i * 977 + 13)
    world.place(log, spot.x, spot.z, { yOffset: 0.28, rotation: spot.rot })
    // Der Stamm liegt quer – als Hindernis reichen zwei Kreise entlang.
    for (const t of [-1.4, 0, 1.4]) {
      world.addCollider(spot.x + Math.sin(spot.rot) * t, spot.z + Math.cos(spot.rot) * t, 0.75)
    }
  }

  // --- Stationen ---------------------------------------------------------
  const stations = populateStations(world, registry)

  // --- Wegfuehrung --------------------------------------------------------
  // Jeder der drei Wege bekommt Pistenstangen in seiner Farbe. Sie haben keine
  // Kollision – sie sind Einladung, kein Zaun.
  const route = (waypoints, spacing) => {
    const curve = new THREE.CatmullRomCurve3(
      waypoints.map((p) => new THREE.Vector3(p[0], 0, p[1])),
      false,
      'catmullrom',
      0.4,
    )
    const count = Math.max(2, Math.round(curve.getLength() / spacing))
    return curve.getSpacedPoints(count).map((v) => ({ x: v.x, z: v.z }))
  }

  for (const [key, trail] of Object.entries(TRAILS)) {
    createPisteMarkers(world, route(trail.path, 4.6), {
      seed: key.length * 137 + 5,
      color: trail.markerColor,
    })
  }

  // --- Startplateau -------------------------------------------------------
  // Fackelkranz mit Luecken dort, wo die Wege abgehen. Der Kranz macht aus der
  // flachen Terrasse einen erkennbaren Ort.
  const torchRadius = PLATEAU.radius + 0.5
  const exits = Object.values(TRAILS).map((t) => {
    const first = t.path[0]
    return Math.atan2(first[0] - PLATEAU.x, first[1] - PLATEAU.z)
  })
  const nearExit = (angle) =>
    exits.some((e) => Math.abs(Math.atan2(Math.sin(angle - e), Math.cos(angle - e))) < 0.42)

  const torchCount = 18
  for (let i = 0; i < torchCount; i++) {
    const angle = (i / torchCount) * Math.PI * 2
    if (nearExit(angle)) continue
    const tx = PLATEAU.x + Math.sin(angle) * torchRadius
    const tz = PLATEAU.z + Math.cos(angle) * torchRadius
    const torch = createTorch(i * 7 + 3)
    world.place(torch, tx, tz, { rotation: rng() * Math.PI * 2 })
    world.addCollider(tx, tz, 0.32)
    animatedProps.push(torch.userData.animate)
  }

  // Zwei warme Lichter tragen den ganzen Platz – einzelne Lichter pro Fackel
  // waeren zu teuer.
  for (const off of [[-4, 0], [4, 0]]) {
    const lamp = new THREE.PointLight(0xffb066, 9, 26, 2)
    lamp.position.set(
      PLATEAU.x + off[0],
      terrainHeight(PLATEAU.x + off[0], PLATEAU.z + off[1]) + 1.9,
      PLATEAU.z + off[1],
    )
    world.scene.add(lamp)
  }

  // --- Wegweiser an den Ausgaengen ----------------------------------------
  for (const trail of Object.values(TRAILS)) {
    const first = trail.path[0]
    const angle = Math.atan2(first[0] - PLATEAU.x, first[1] - PLATEAU.z)
    // Knapp neben dem Ausgang, damit man nicht dagegen faehrt.
    const sx = PLATEAU.x + Math.sin(angle) * (torchRadius - 0.4) + Math.cos(angle) * 2.2
    const sz = PLATEAU.z + Math.cos(angle) * (torchRadius - 0.4) - Math.sin(angle) * 2.2

    const sign = createSignpost([
      { text: trail.label, background: trail.color, width: 2.3, height: 0.6, rotation: angle - Math.PI * 0.25 },
    ], { height: 2.6 })
    world.place(sign, sx, sz, { rotation: Math.PI * 0.25 })
    world.addCollider(sx, sz, 0.45)
  }

  // --- Schlepplift --------------------------------------------------------
  // Verbindet den Talkessel mit dem Gipfel des Bergarms. Er ist der einzige
  // bequeme Weg nach oben – zu Fuss kommt man nur kriechend hinauf.
  const lift = new DragLift(world, {
    base: { x: -22, z: -20 },
    top: { x: -50, z: -55 },
    speed: 4.4,
    label: 'GIPFELBAHN',
  })

  registry.add({
    id: 'lift',
    label: 'Gipfelbahn',
    hint: 'Einsteigen',
    color: '#d94b3f',
    position: { x: lift.base.x, z: lift.base.y },
    radius: 4.5,
    labelHeight: terrainHeight(lift.base.x, lift.base.y) + 5.4,
    onUse: () => lift.board(skierRef.current),
    marker: (() => {
      const m = createMarker(lift.base.x, lift.base.y, 4.5, '#d94b3f')
      world.scene.add(m)
      return m
    })(),
  })

  // --- Gipfel -------------------------------------------------------------
  const cross = createSummitCross({ label: 'GIPFEL' })
  world.place(cross, SUMMIT.x + 1.5, SUMMIT.z + 1.5, { rotation: Math.PI * 0.25 })
  world.addCollider(SUMMIT.x + 1.5, SUMMIT.z + 1.5, 0.7)

  // Stangen fuer die lange Abfahrt vom Gipfel zurueck ins Tal.
  createPisteMarkers(world, route([
    [SUMMIT.x + 7, SUMMIT.z + 9], [-44, -46], [-34, -34], [-24, -22], [-14, -10], [-5, 2], [0, 14],
  ], 5.5), { seed: 55, color: 0xe8703a })

  // --- Zaeune -------------------------------------------------------------
  // Ein alter Weidezaun im Osten, ein Absperrzaun oberhalb des Seeufers.
  createFence(world, [
    { x: 52, z: 18 }, { x: 46, z: 30 }, { x: 34, z: 44 }, { x: 20, z: 50 },
  ], { seed: 41 })
  createFence(world, [
    { x: -24, z: 44 }, { x: -30, z: 52 }, { x: -42, z: 54 },
  ], { seed: 77 })
  createFence(world, [
    { x: 14, z: -46 }, { x: 2, z: -50 }, { x: -12, z: -48 },
  ], { seed: 93 })

  // --- See --------------------------------------------------------------
  const lake = createLake(world, {
    fogColor: world.scene.fog.color,
    fogDensity: world.scene.fog.density,
    sunDir: sky.sunDir,
  })

  return { lake, lift, animated: [...stations.animated, ...animatedProps] }
}
