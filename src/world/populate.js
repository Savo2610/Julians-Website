import * as THREE from 'three'
import { LANDSCAPE_PATHS, GROVES } from './landscape-layout.js'
import { createLandscapeDetails } from './landscape-details.js'
import { CONNECTIONS } from './paths.js'
import { createWayfinding, arrow, PANORAMA } from './wayfinding.js'
import { WORLD } from '../config.js'
import { makeRng } from '../core/rng.js'
import { fbm } from '../core/noise.js'
import { terrainHeight, terrainNormal, LAKE, PLATEAU, SUMMIT, playAreaDistance, SLED_LANE, NORTH_LANE, GRAT, BRUECKE, KLAMM, PARK_LANE, PARK_FEATURES, KINDER_LANE, SHOOT_LANE } from './heightfield.js'
import { createForest, createFallenTree } from './props/trees.js'
import { createRocks, createBoulder } from './props/rocks.js'
import { createLake } from './props/lake.js'
import { createBackdrop } from './props/backdrop.js'
import { createFence, createPisteMarkers } from './props/fence.js'
import { createBreakableFence } from './props/park-fence.js'
import { createAvalancheBarrier } from './props/avalanche-barrier.js'
import { createSnowCannon } from './props/snow-cannon.js'
import { createSignpost, createMarkerSign, springMount } from './props/signpost.js'
import { populateStations, STATION_SPOTS, TRAILS } from '../stations/stations.js'
import { createMarker } from '../stations/marker.js'
import { createTorch } from './props/torch.js'
import { createSummitCross } from './props/summit-cross.js'
import { DragLift } from './drag-lift.js'
import { RaceCourse } from './race.js'
import { RailRide } from './rail-ride.js'
import { SpeedCheck } from './speed-check.js'
import { createRail, createPadMarker, createParkSign, createParkBox, createLipMarker } from './props/funpark.js'
import { APRES } from './apres-layout.js'
import { createApresTerrace } from './apres-terrace.js'
import { createApresSki } from './props/apres-ski.js'
import { createSledFence } from './props/sled.js'
import { Kinderland } from './kinderland.js'
import { NorthRun } from './north-run.js'
import { createStartGate } from './props/start-gate.js'
import { createGorgeBridge } from './props/gorge-bridge.js'

// Gesperrte Zonen: hier soll nichts wachsen, weil dort gefahren oder etwas
// gebaut wird. Jede Station bringt ihre eigene Lichtung mit.
const CLEARINGS = [
  // Die Quelle braucht ein freies Vorfeld; sonst verdecken die Ufertannen
  // den neuen Blickfang komplett aus der festen Kamerarichtung.
  { x: -58.5, z: 25, r: 5.5 },
  { x: PLATEAU.x, z: PLATEAU.z, r: PLATEAU.radius + 5 },   // Startplateau
  { x: LAKE.x, z: LAKE.z, r: LAKE.radius * 1.02 },
  { x: SUMMIT.x, z: SUMMIT.z, r: 13 },   // Gipfelbereich frei halten
  { x: -40, z: -44, r: 6 },    // Ausbuchtung der freien Abfahrt
  { x: 24, z: -60, r: 12 }, // Terrasse mit der Apres-Ski-Huette
  { x: -33.0, z: -25.0, r: 8 },  // Lichtschranke des Speedchecks
  { x: -35.1, z: -36.3, r: 6 },  // Schneekanone darueber
  { x: -21.5, z: -24.5, r: 5 },  // Display des Speedchecks

]

// Zusaetzlich zu den runden Lichtungen gibt es Schneisen: Streifen entlang
// einer Linie, in denen nichts waechst. Die Lifttrasse braucht so eine.
const LANES = []

// Die Lifttrasse liegt weiter links als frueher – sie schneidet jetzt durch
// den Wald statt durch den offenen Hang. Dadurch bleibt die grosse Abfahrt
// frei, und die Trasse quert den Hang sogar weniger schraeg als vorher.
export const LIFT_BASE = { x: -34, z: -8 }
export const LIFT_TOP = { x: -63, z: -55 }

// Die freie Abfahrt: sie laeuft im Korridor zwischen Lifttrasse und
// Rodelbahn, ueberall gut zehn Meter von beiden entfernt. Hier wird nichts
// ins Gelaende geschnitten – der Hang faellt hier von selbst gleichmaessig
// mit knapp 40 Grad, und wer ohne Uhr fahren will, hat seinen Weg.
// Der Rueckweg vom Ziel der Rodelbahn zur Talstation. Ohne ihn steht man
// unten im Wald und muss sich seinen Weg suchen – gerade dann, wenn man
// gerade eine Zeit gefahren ist und gleich nochmal will. Er faellt kaum,
// laeuft aber ueber flaches Gelaende und trifft am Ende auf die Ausfahrt der
// freien Abfahrt, sodass beide Wege gemeinsam zum Lift fuehren.
const RETURN_PATH = [
  [-4, -27], [-10, -24], [-17, -21], [-23, -18], [-27, -15],
]

const FREE_PISTE = [
  [-44, -52], [-41, -46], [-38, -40], [-34.5, -34],
  [-31, -28], [-28.5, -22], [-27, -14],
]

function inClearing(x, z, pad = 0) {
  for (const c of CLEARINGS) {
    const dx = x - c.x
    const dz = z - c.z
    const r = c.r + pad
    if (dx * dx + dz * dz < r * r) return true
  }
  for (const spot of Object.values(STATION_SPOTS)) {
    if (Math.hypot(x - spot.x, z - spot.z) < spot.clearing + pad) return true
  }
  for (const l of LANES) {
    const ax = l.x2 - l.x1
    const az = l.z2 - l.z1
    const len2 = ax * ax + az * az
    const t = Math.max(0, Math.min(1, ((x - l.x1) * ax + (z - l.z1) * az) / len2))
    const dx = x - (l.x1 + ax * t)
    const dz = z - (l.z1 + az * t)
    const r = l.r + pad
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

  // Erst die flachen Stationsplaetze bestimmen: sonst bleibt der Wald an
  // den alten Koordinaten frei und waechst in den tatsaechlichen Vorplatz.
  const stations = populateStations(world, registry)

  createBackdrop(world.scene, { fogColor: world.scene.fog.color })

  // Lifttrasse als Waldschneise freihalten – ein Schlepplift laeuft nie durch
  // den Bestand. Muss vor der Bepflanzung feststehen.
  LANES.length = 0
  LANES.push({ x1: LIFT_BASE.x, z1: LIFT_BASE.z, x2: LIFT_TOP.x, z2: LIFT_TOP.z, r: 7.5 })
  // Die vier markierten Wege muessen frei bleiben. Sie waren es frueher von
  // selbst, weil dort kaum Wald stand – seit der Wald dichter ist, muessen
  // sie es ausdruecklich sein. Ein markierter Weg, der von Baeumen versperrt
  // wird, ist schlimmer als gar keiner.
  for (const trail of [...Object.values(TRAILS), ...CONNECTIONS, ...LANDSCAPE_PATHS]) {
    for (let i = 0; i < trail.path.length - 1; i++) {
      const [x1, z1] = trail.path[i]
      const [x2, z2] = trail.path[i + 1]
      LANES.push({ x1, z1, x2, z2, r: trail.width ? trail.width / 2 + 1 : 5 })
    }
  }
  // Die freie Abfahrt braucht keine Gelaendeformung, aber eine Schneise –
  // sonst stehen die Stangen zwischen Baeumen. Sie faellt schmal aus: der
  // Streifen Wald zwischen Piste und Rodelbahn ist das, was die beiden
  // ueberhaupt als getrennte Wege lesbar macht.
  for (let i = 0; i < FREE_PISTE.length - 1; i++) {
    const [x1, z1] = FREE_PISTE[i]
    const [x2, z2] = FREE_PISTE[i + 1]
    LANES.push({ x1, z1, x2, z2, r: 4.5 })
  }
  // Derselbe Gedanke fuer den Rueckweg: ein Weg, der zugewachsen ist, ist
  // keiner. Breiter als die freie Abfahrt, weil man hier ohne Schwung ankommt.
  for (let i = 0; i < RETURN_PATH.length - 1; i++) {
    const [x1, z1] = RETURN_PATH[i]
    const [x2, z2] = RETURN_PATH[i + 1]
    LANES.push({ x1, z1, x2, z2, r: 6 })
  }
  // Rennstrecke und Funpark sind praeparierte Bahnen – dort waechst nichts.
  // Die Streifen kommen aus derselben Quelle wie die Gelaendeformung, damit
  // Bewuchs und Boden nicht auseinanderlaufen koennen.
  for (const [lane, r] of [[SLED_LANE, 7.5], [NORTH_LANE, 9], [PARK_LANE, 13], [KINDER_LANE, 12], [SHOOT_LANE, 7]]) {
    for (let i = 0; i < lane.points.length - 1; i++) {
      const a = lane.points[i]
      const b = lane.points[i + 1]
      LANES.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r })
    }
  }
  // Abstand zu einer Bahnmitte – gebraucht fuer die Waldbaender, die eine Bahn
  // einfassen. Zwei Bahnen brauchen das inzwischen, deshalb einmal geschrieben
  // und zweimal gebunden.
  const abstandZu = (pts) => (x, z) => {
    let best = Infinity
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const ax = b.x - a.x
      const az = b.z - a.z
      const t = Math.max(0, Math.min(1, ((x - a.x) * ax + (z - a.z) * az) / (ax * ax + az * az)))
      const dx = x - (a.x + ax * t)
      const dz = z - (a.z + az * t)
      const d = dx * dx + dz * dz
      if (d < best) best = d
    }
    return Math.sqrt(best)
  }
  const sledDist = abstandZu(SLED_LANE.points)
  const nordDist = abstandZu(NORTH_LANE.points)

  const n = new THREE.Vector3()

  const steepness = (x, z) => {
    terrainNormal(x, z, n)
    return 1 - n.y
  }

  let apresTerrace

  // --- Wald ------------------------------------------------------------
  // Dichter Guertel aussen, lockere Gruppen innen: der Wald ist die weiche
  // Talgrenze, bevor die Felswand kommt.
  // Die Zahl ist mit der Spielflaeche gewachsen: das Nordkar ist neu bepflanzbar,
  // und bei 880 waere der ganze Wald duenner geworden statt die Rueckseite
  // dichter – scatter() verteilt eine feste Anzahl auf die angenommene Flaeche.
  const treeSpots = scatter(rng, {
    count: 1010,
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
      // Waldband an der Rodelbahn: sie soll durch den Bestand fahren und
      // nicht neben ihm her. Direkt an der Bahn haelt die Schneise frei, ab
      // etwa zehn Metern steht der Wald dann dicht an der Bande.
      const woods = 0.75 * (1 - THREE.MathUtils.smoothstep(sledDist(x, z), 12, 30))
      // Die Rueckseite ist die schattige Seite. Dort steht der Wald dichter und
      // reicht bis dicht an die Bahn heran – das ist der Unterschied, an dem man
      // merkt, dass man nicht mehr im Tal ist. Dass er oben trotzdem aufhoert,
      // besorgt die Baumgrenze von selbst: die Abfahrt beginnt auf 25 Metern und
      // endet auf 12, sie faehrt also von ueber der Grenze unter sie.
      const nordkar = 0.9 * (1 - THREE.MathUtils.smoothstep(nordDist(x, z), 11, 36))
      const density = Math.min(1, rim * 0.98 + groves * 0.5 + woods + nordkar) * treeline
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
  // Die Baumgruppe um den frueheren LinkedIn-Wegweiser ist mit ihm
  // verschwunden. Sie stand dort, weil das Schild einen Waldrand brauchte und
  // das Rauschfeld an der Stelle zu duenn war; ohne Schild ist sie ein Hain
  // ohne Anlass, und der Hang zwischen Plateau und Kinderland ist mit ihm
  // wieder frei zu befahren.

  // Kleine Gruppen auf den Ruecken rahmen die neuen Fahrpassagen ein.
  // Sie nutzen dieselben Freizonen wie der Wald, damit kein Astweg zuwaechst.
  const groveRng = makeRng(210926)
  const groveTrees = []
  for (const grove of GROVES) {
    for (let i = 0; i < grove.count * 8 && groveTrees.filter(p => p.grove === grove).length < grove.count; i++) {
      const angle = groveRng() * Math.PI * 2
      const radius = Math.sqrt(groveRng()) * grove.radius
      const x = grove.x + Math.cos(angle) * radius, z = grove.z + Math.sin(angle) * radius
      if (inClearing(x, z, -0.4)) continue
      if ([...placements, ...groveTrees].some(p => Math.hypot(p.x - x, p.z - z) < 2.3)) continue
      groveTrees.push({ x, z, grove, variant: i % 4, rotation: angle, scale: 0.65 + groveRng() * 0.35, shade: groveRng() })
    }
  }
  placements.push(...groveTrees)
  createForest(world, placements)
  const landscape = createLandscapeDetails(world, groveTrees)
  animatedProps.push((t, dt) => landscape.update(dt, skierRef.current))

  // --- Felsen -----------------------------------------------------------
  const rockSpots = scatter(rng, {
    count: 245,
    minDist: 5.0,
    accept: (x, z) => {
      if (playAreaDistance(x, z) > WORLD.rimWidth - 1) return false
      if (inClearing(x, z, 2)) return false
      const s = steepness(x, z)
      // Felsen brechen bevorzugt aus steilen Flanken heraus, und oberhalb der
      // Baumgrenze praegen sie den Gipfel.
      const alpine = terrainHeight(x, z) > 20 ? 0.3 : 0
      // Im Tal bilden Findlinge Gruppen am Waldrand; einzelne Zufallssteine
      // zwischen Stationen wirkten wie verstreute Requisiten.
      const edge = THREE.MathUtils.smoothstep(playAreaDistance(x, z), -24, -5)
      return rng() < 0.025 + edge * 0.16 + s * 1.4 + alpine
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
  // Der Findling stand frueher am Rand des Hangs; seit der Funpark in der
  // Luecke liegt, stuende er mitten in der Jib-Linie. Er ist nach Westen aus
  // dem Band heraus gerueckt und bleibt trotzdem die Marke, an der man sieht,
  // wo der Park anfaengt.
  // Beide sind zu hoch zum Ueberspringen – sie sind Marken, keine Hindernisse
  // auf der Linie, und ein Sprung ueber einen Findling von Hausgroesse saehe
  // aus, als fuehre man durch ihn hindurch.
  const boulderA = createBoulder(31, 2.4)
  world.place(boulderA, 9, -31, { yOffset: -1.1, rotation: 0.7 })
  world.addCollider(9, -31, 2.6)

  const boulderB = createBoulder(77, 2.0)
  world.place(boulderB, -22, 8, { yOffset: -0.9, rotation: 2.1 })
  world.addCollider(-22, 8, 2.2)

  // --- Umgestuerzte Baeume am Waldrand ----------------------------------
  for (const [i, spot] of [
    { x: -2, z: -10, rot: 0.9 },
    { x: -46, z: 12, rot: 1.7 },
  ].entries()) {
    const log = createFallenTree(i * 977 + 13)
    world.place(log, spot.x, spot.z, { yOffset: 0.28, rotation: spot.rot })
    // Der Stamm liegt quer – als Hindernis reichen drei Kreise entlang. Er
    // liegt laengs der lokalen x-Achse, und die zeigt nach Drehung um rot in
    // (cos, -sin); die Kreise lagen vorher laengs (sin, cos), also quer zum
    // Stamm, und man blieb neben ihm haengen und fuhr durch ihn hindurch.
    // Der Stamm ist 0,6 m hoch und laesst sich ueberspringen, der
    // Wurzelteller am Ende (-x) mit 1,3 m nicht.
    for (const t of [-1.4, 0, 1.4]) {
      world.addCollider(spot.x + Math.cos(spot.rot) * t, spot.z - Math.sin(spot.rot) * t, 0.75, null, t < 0 ? Infinity : 0.62)
    }
  }

  // --- Orientierung ------------------------------------------------------
  const wayfinding = createWayfinding(world, { registry, trees: placements, lift: { base: LIFT_BASE, top: LIFT_TOP }, skierRef })
  animatedProps.push(wayfinding.animate)

  // --- Wegfuehrung --------------------------------------------------------
  // Jeder der vier Wege bekommt Pistenstangen in seiner Farbe. Sie haben keine
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

  // Alle Stangenreihen zusammen. Sie brauchen jeden Frame den Fahrer, um zu
  // merken, wenn er eine erwischt – deshalb eine gemeinsame Schleife statt
  // eines Animators je Reihe.
  const markerRows = []

  for (const [key, trail] of Object.entries(TRAILS)) {
    markerRows.push(createPisteMarkers(world, route(trail.path, 9), {
      seed: key.length * 137 + 5,
      color: trail.markerColor,
    }))
  }

  // --- Startplateau -------------------------------------------------------
  // Fackelkranz mit Luecken dort, wo die Wege abgehen. Der Kranz macht aus der
  // flachen Terrasse einen erkennbaren Ort.
  const torchRadius = PLATEAU.radius + 0.5
  const exits = Object.values(TRAILS).map((t) => {
    const first = t.path[0]
    return Math.atan2(first[0] - PLATEAU.x, first[1] - PLATEAU.z)
  })
  // Die Panoramatafel steht auf dem Kranz; eine Fackel davor verdeckte die
  // Karte zur Haelfte.
  exits.push(Math.atan2(PANORAMA.x - PLATEAU.x, PANORAMA.z - PLATEAU.z))
  const nearExit = (angle) =>
    exits.some((e) => Math.abs(Math.atan2(Math.sin(angle - e), Math.cos(angle - e))) < 0.42)

  // Keine Kollision. Der Kranz stand vorher als Reihe fester Pfaehle um den
  // Platz, auf dem die Fahrt anfaengt – man ist auf den ersten zwanzig Metern
  // gegen die eigene Kulisse gefahren. Jetzt faehrt man hindurch und legt
  // dabei um, was im Weg war; nach ein paar Sekunden steht es wieder.
  const torches = []
  const torchCount = 10
  for (let i = 0; i < torchCount; i++) {
    const angle = (i / torchCount) * Math.PI * 2
    if (nearExit(angle)) continue
    const tx = PLATEAU.x + Math.sin(angle) * torchRadius
    const tz = PLATEAU.z + Math.cos(angle) * torchRadius
    const torch = createTorch(i * 7 + 3)
    world.place(torch, tx, tz, { rotation: rng() * Math.PI * 2 })
    torches.push({ obj: torch, x: tx, z: tz })
    animatedProps.push(torch.userData.animate)
  }

  // Umstossen: ein Kreis von einem halben Meter genuegt. Gestossen wird in
  // Fahrtrichtung und nicht radial vom Fusspunkt weg – wer knapp vorbeizieht,
  // soll sie in seine Richtung legen und nicht zur Seite schieben.
  animatedProps.push((t, dt) => {
    const skier = skierRef.current
    if (!skier) return
    for (const torch of torches) {
      const dx = skier.position.x - torch.x
      const dz = skier.position.z - torch.z
      if (dx * dx + dz * dz > 0.36) continue
      torch.obj.userData.knock(skier.forward.x, skier.forward.z)
    }
    // Dieselbe Regel fuer jede Pistenstange im Gebiet.
    for (const row of markerRows) row?.userData.update(dt, skier)
  })

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

    // Die Tafel zeigt dorthin, wohin der Weg im Bild laeuft: Pfeil davor,
    // und fuer Wege nach links (TOOLS) ragt sie nach links vom Pfosten weg.
    // Vorher standen alle vier Tafeln nach rechts; TOOLS zeigte damit vom
    // eigenen Weg weg, und KARRIERE ragte am rechten Rand aus dem Bild.
    const target = trail.path[Math.min(2, trail.path.length - 1)]
    const pfeil = arrow(sx, sz, target)
    const links = (target[0] - sx) - (target[1] - sz) < 0
    const sign = createMarkerSign([
      { text: trail.label, arrow: pfeil, background: trail.color, width: 4.0, height: 0.74, side: links ? -1 : 1 },
    ], { height: 2.6 })
    world.place(sign, sx, sz, { rotation: Math.PI * 0.25 })
    // Auf Federfuss statt festem Kreis, siehe springMount.
    const feder = springMount(world, sign, sx, sz, Math.PI * 0.25)
    animatedProps.push((t, dt) => feder(dt, skierRef.current))
  }

  // Die Winkel im Schnee, die hier einmal alle 16 m den Weg wiesen, sind den
  // Leuchtschleiern gewichen (world/trail-glints.js): die huschen vom Platz
  // aus die Wege entlang und zeigen die Richtung, ohne den Schnee dauerhaft
  // zu bemalen. Die Stangen in Wegfarbe markieren weiter den Verlauf.

  // --- Schlepplift --------------------------------------------------------
  // Verbindet den Talkessel mit dem Gipfel des Bergarms. Er ist der einzige
  // bequeme Weg nach oben – zu Fuss kommt man nur kriechend hinauf.
  const lift = new DragLift(world, {
    // Die Trasse liegt am linken Rand des Bergarms, mitten im Wald. Das ist
    // nicht nur Platzersparnis: so gemessen quert sie den Hang im Mittel nur
    // noch mit 18 statt 30 Grad, laeuft also naeher an der Falllinie.
    base: LIFT_BASE,
    top: LIFT_TOP,
    speed: 7.2,
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

  // --- Lawinenverbauung an der Westflanke ---------------------------------
  // Auf der Hoehenlinie um 24 m, sechs bis neun Meter unter dem Gipfel und
  // drei bis vier Meter vor der Waldkante (Baeume ab x = -75). Links davon
  // faellt der Hang mit ueber 35 Grad in den Wald; hier ist Schluss.
  createAvalancheBarrier(world, [[-71, -70], [-71.5, -62], [-72, -54], [-70.5, -47], [-68, -43.5]])

  // --- Gipfel -------------------------------------------------------------
  const cross = createSummitCross({ label: 'GIPFEL' })
  world.place(cross, SUMMIT.x + 1.5, SUMMIT.z + 1.5, { rotation: Math.PI * 0.25 })
  world.addCollider(SUMMIT.x + 1.5, SUMMIT.z + 1.5, 0.7)

  // Die freie Abfahrt zwischen Lifttrasse und Rodelbahn: wer nicht auf Zeit
  // fahren will, hat hier seinen Weg vom Gipfel ins Tal. Nur Stangen, kein
  // eingeschnittenes Band – die Piste soll offen bleiben.
  markerRows.push(createPisteMarkers(world, route(FREE_PISTE, 5.5), { seed: 55, color: 0xe8703a }))

  // --- Nordabfahrt --------------------------------------------------------
  // Die Bahn selbst ist Gelaende (NORTH_LANE im Hoehenfeld). Hier stehen nur
  // das Tor am Anfang und die Stangen an den Raendern – und der Zustand, an
  // dem die Kamera haengt.
  const northRun = new NorthRun()
  {
    const P = NORTH_LANE.points
    // Richtung der Bahn am Start; das Tor steht quer dazu.
    const drehung = Math.atan2(P[1].x - P[0].x, P[1].z - P[0].z) + Math.PI
    const weite = 9.5
    const halb = weite / 2
    const pfostenOrt = (sx) => [
      P[0].x + Math.cos(drehung) * halb * sx,
      P[0].z - Math.sin(drehung) * halb * sx,
    ]
    // Wie tief der Boden unter den Pfosten liegt, in der Reihenfolge, in der
    // das Tor sie baut. Der Start liegt auf einem gerundeten Ruecken: auf den
    // 4,75 Metern bis zu den Pfosten faellt das Gelaende um 0,85 und 0,70
    // Meter ab, und ohne diese Zahlen schwebt das Tor mit beiden Beinen.
    const mitte = terrainHeight(P[0].x, P[0].z)
    const fuss = [-1, 1].map((sx) => mitte - terrainHeight(...pfostenOrt(sx)))
    const tor = createStartGate({ weite, fuss })
    world.place(tor, P[0].x, P[0].z, { rotation: drehung })
    // Kollision nur fuer die beiden Pfosten, nicht fuer das Tor als Ganzes.
    for (const sx of [-1, 1]) world.addCollider(...pfostenOrt(sx), 0.34)

    // Stangen an beiden Raendern. Eine versetzte Linie braucht je Punkt eine
    // Querrichtung; genommen wird die Richtung der beiden Nachbarn, damit an
    // den Knicken kein Knick in der Stangenreihe entsteht.
    const seite = (versatz) => P.map((p, i) => {
      const a = P[Math.max(0, i - 1)]
      const b = P[Math.min(P.length - 1, i + 1)]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const L = Math.hypot(dx, dz) || 1
      return [p.x - (dz / L) * versatz, p.z + (dx / L) * versatz]
    })
    // Der Steg ueber die Klamm. Die Richtung nimmt er von der Bahn: seine
    // Laengsachse ist die Fahrtrichtung, quer dazu liegt die Rinne.
    {
      let vor = P[0]
      let nach = P[1]
      for (let i = 0; i < P.length - 1; i++) {
        if ((BRUECKE.x - P[i].x) * (P[i + 1].x - P[i].x) + (BRUECKE.z - P[i].z) * (P[i + 1].z - P[i].z) > 0
            && (BRUECKE.x - P[i + 1].x) * (P[i].x - P[i + 1].x) + (BRUECKE.z - P[i + 1].z) * (P[i].z - P[i + 1].z) > 0) {
          vor = P[i]; nach = P[i + 1]
        }
      }
      // Lokales +X der Gruppe zeigt nach (cos, -sin) – daher dieses atan2 und
      // nicht das sonst uebliche atan2(dx, dz).
      const dreh = Math.atan2(-(nach.z - vor.z), nach.x - vor.x)

      // Neigung und Hoehe nimmt der Steg vom Gelaende ab, nicht von den
      // Stuetzpunkten der Bahn: was der Fahrer befaehrt, ist das Hoehenfeld,
      // und nur dessen Sehne durch die beiden Stegenden zaehlt. Waagerecht
      // hingelegt steckte er oben einen Meter im Hang und schwebte unten einen
      // Meter darueber – der Fahrer fuhr sichtbar durch das Holz.
      const laenge = 14.5
      const ll = Math.hypot(nach.x - vor.x, nach.z - vor.z)
      const ux = (nach.x - vor.x) / ll
      const uz = (nach.z - vor.z) / ll
      // Ausgleichsgerade durch fuenfzehn Proben und nicht Sehne durch die
      // beiden Enden: das Gelaende haengt gegen so eine Sehne um bis zu acht
      // Zentimeter durch, und die Ausgleichsgerade verteilt den Rest von selbst
      // auf beide Seiten. Uebrig bleiben gut fuenf Zentimeter – bei einem Ski
      // von fuenf Zentimetern Dicke und dreiunddreissig Metern Kamerahoehe
      // nicht mehr zu sehen.
      const N = 15
      let summeH = 0, summeOH = 0, summeOO = 0
      for (let i = 0; i < N; i++) {
        const o = (i / (N - 1) - 0.5) * laenge
        const h = terrainHeight(BRUECKE.x + ux * o, BRUECKE.z + uz * o)
        summeH += h
        summeOH += o * h
        summeOO += o * o
      }
      const neigung = Math.atan(-summeOH / summeOO)
      const hoehe = summeH / N - terrainHeight(BRUECKE.x, BRUECKE.z)

      const bruecke = createGorgeBridge({ laenge, neigung })
      world.place(bruecke, BRUECKE.x, BRUECKE.z, { rotation: dreh, yOffset: hoehe })
    }

    // Stangen, die in der Klamm stuenden, faellt weg. Eine Pistenstange, die
    // vier Meter unter der Bahn im Graben steht, sieht nicht nach Absperrung
    // aus, sondern nach Fehler.
    const inKlamm = (p) => Math.hypot(p.x - BRUECKE.x, p.z - BRUECKE.z) < 9
    for (const [versatz, seed] of [[6.2, 71], [-6.2, 73]]) {
      markerRows.push(createPisteMarkers(world, route(seite(versatz), 5.4).filter((p) => !inKlamm(p) && !(p.x > 17 && p.x < 32 && p.z > -68 && p.z < -49)), {
        seed, color: 0x2f6bd8,
      }))
    }

    // An ihrer Stelle steht eine eigene Reihe quer vor der Klamm, acht Meter vor
    // der Rinnenmitte. Naeher geht nicht: der Steg reicht mit seiner halben
    // Laenge 7,25 Meter dorthin, und eine Stange auf dem Deck waere eine Stange
    // im Weg. Acht Meter ist ausserdem noch sicherer Grund – die Rinne greift
    // nur 6,4 Meter weit.
    //
    // Die Reihe sperrt nicht nur, sie trichtert. Sie laesst genau vor dem Steg
    // eine Luecke von 7,8 Metern in einer vierzehn Meter breiten Piste; wer
    // hindurchfaehrt, trifft ihn, und das sieht man schon von oben am Tor.
    {
      const ax = KLAMM.bis.x - KLAMM.von.x
      const az = KLAMM.bis.z - KLAMM.von.z
      const la = Math.hypot(ax, az)
      const laengs = { x: ax / la, z: az / la }
      const quer = { x: -az / la * 8, z: ax / la * 8 }
      // Welche Seite bergseitig ist, wird gemessen und nicht angenommen: wird
      // die Klamm einmal verlegt, kippt die Reihe sonst auf die falsche Seite.
      const bergauf = terrainHeight(BRUECKE.x + quer.x, BRUECKE.z + quer.z)
        > terrainHeight(BRUECKE.x - quer.x, BRUECKE.z - quer.z) ? 1 : -1
      const lippe = [-10.6, -8.2, -5.8, -3.9, 3.9, 5.8, 8.2, 10.6].map((s) => ({
        x: BRUECKE.x + quer.x * bergauf + laengs.x * s,
        z: BRUECKE.z + quer.z * bergauf + laengs.z * s,
      }))
      markerRows.push(createPisteMarkers(world, lippe, { seed: 77, color: 0x2f6bd8 }))

      // Fels in der Klamm. Ohne ihn liest sie sich aus der festen Kamera als
      // heller Fleck im hellen Hang: gemessen viereinhalb Meter tief und
      // trotzdem kaum zu sehen, weil Schnee auf Schnee keine Kante hat. Der
      // Fels gibt ihr die Kante – auf beiden Oberkanten und vereinzelt auf der
      // Sohle, also dort, wo das Gestein liegt, das so eine Rinne ueberhaupt
      // erst ausgewaschen hat.
      //
      // Sieben Meter um den Steg herum bleibt er weg: Felsen bringen Kollision
      // mit, und der Trichter aus Stangen muss frei bleiben.
      const klammRng = makeRng(30514)
      const klammFelsen = []
      for (let u = 0.1; u <= 0.93; u += 0.022) {
        const mx = KLAMM.von.x + (KLAMM.bis.x - KLAMM.von.x) * u
        const mz = KLAMM.von.z + (KLAMM.bis.z - KLAMM.von.z) * u
        if (Math.abs((mx - BRUECKE.x) * laengs.x + (mz - BRUECKE.z) * laengs.z) < 7) continue
        for (const seite of [-1, 1]) {
          if (klammRng() > 0.5) continue
          // Meist auf der Oberkante, jeder sechste unten in der Sohle.
          const ab = klammRng() < 0.17 ? klammRng() * 1.2 : 4.1 + klammRng() * 1.9
          const x = mx + (quer.x / 6) * ab * seite
          const z = mz + (quer.z / 6) * ab * seite
          if (playAreaDistance(x, z) > WORLD.rimWidth) continue
          klammFelsen.push({
            x, z, variant: klammFelsen.length % 3,
            rotation: klammRng() * Math.PI * 2,
            scale: 1.0 + klammRng() * klammRng() * 1.9,
            stretch: 0.6 + klammRng() * 0.6,
            tilt: klammRng() - 0.5,
          })
        }
      }
      createRocks(world, klammFelsen, 30515)
    }

    // Felsriegel auf dem Grat. Er steht dort, wo der Grat ohnehin schon vier
    // bis sieben Meter ueber dem Kar aufragt – die Felsen setzen nur die Krone
    // darauf. Damit bekommt die Aussenseite der Kurve eine Kante, an der der
    // Blick haengenbleibt, statt ins Weisse zu laufen.
    //
    // Naeher als zehn Meter an die Bahnmitte kommt keiner: Felsen bringen
    // Kollision mit, und ein Felsen am Pistenrand ist etwas anderes als einer
    // auf der Piste.
    const felsRng = makeRng(99137)
    const gratPunkte = route(GRAT.map((g) => [g[0], g[1]]), 5.0)
    const gratFelsen = []
    for (const [i, p] of gratPunkte.entries()) {
      if (felsRng() > 0.62) continue
      const seitlich = (felsRng() - 0.5) * 7
      const quer = i > 0 && i < gratPunkte.length - 1
        ? Math.atan2(gratPunkte[i + 1].z - gratPunkte[i - 1].z, gratPunkte[i + 1].x - gratPunkte[i - 1].x)
        : 0
      const x = p.x - Math.sin(quer) * seitlich
      const z = p.z + Math.cos(quer) * seitlich
      if (nordDist(x, z) < 10) continue
      if (playAreaDistance(x, z) > WORLD.rimWidth) continue
      gratFelsen.push({
        x, z, variant: i % 3,
        rotation: felsRng() * Math.PI * 2,
        scale: 1.5 + felsRng() * felsRng() * 2.6,
        stretch: 0.7 + felsRng() * 0.5,
        tilt: felsRng() - 0.5,
      })
    }
    createRocks(world, gratFelsen, 8821)
  }

  // Der Rueckweg traegt dieselbe Farbe wie die freie Abfahrt: von unten
  // gesehen ist beides derselbe Weg zurueck an den Lift.
  // Die Stangen in der Farbe der freien Abfahrt sagen genug; ein Schild am
  // Ziel waere ein Wort zuviel.
  markerRows.push(createPisteMarkers(world, route(RETURN_PATH, 5.0), { seed: 61, color: 0xe8703a }))

  // --- Zaeune -------------------------------------------------------------
  // Ein alter Weidezaun im Osten, ein Absperrzaun oberhalb des Seeufers.
  // Der Ostzaun folgt jetzt der Kante des Waldes statt einer geraden Linie
  // durch ihn hindurch. Die Punkte liegen auf einer Kontur gleichen Abstands
  // zum Rand der Spielflaeche – derselben Groesse, aus der auch die Waldbreite
  // gerechnet wird. Damit laeuft der Zaun zwangslaeufig da, wo der Bestand
  // aufhoert, und nicht quer hindurch. Vorn ist er ausserdem so weit
  // hinausgezogen, dass der Loeschzug davor Platz hat und nicht mehr mitten
  // im Zaun steht.
  createFence(world, [
    { x: 59.3, z: 16.3 }, { x: 57.0, z: 24.2 }, { x: 52.0, z: 31.0 },
    { x: 46.2, z: 36.7 }, { x: 41.2, z: 42.2 }, { x: 35.7, z: 47.0 },
    { x: 29.8, z: 50.9 }, { x: 23.5, z: 54.1 },
  ], { seed: 41 })
  createFence(world, [
    // Am Ufer statt auf dem Eis: der letzte Pfosten lag 2 m im See.
    { x: -26, z: 47 }, { x: -32, z: 56 }, { x: -42, z: 60 },
  ], { seed: 77 })
  // Der Zaun oben am Funpark gibt nach, siehe props/park-fence.js.
  const parkFence = createBreakableFence(world, [
    { x: 14, z: -46 }, { x: 2, z: -50 }, { x: -12, z: -48 },
  ], { seed: 93 })
  animatedProps.push((t, dt) => parkFence.update(dt, skierRef.current))

  // --- Rodelbahn vom Gipfel ----------------------------------------------
  // Die Bahn ist eine Rinne mit Banden – die Tore darin sind kein zweiter
  // Weg, sondern eine Aufgabe innerhalb des einen Wegs: sie zwingen zu einer
  // Linie, statt nur zu einer Richtung. Wo es durchgeht, steht in der Farbe
  // im Schnee, nicht in den Stangen.
  const race = new RaceCourse(world, { lane: SLED_LANE, gates: true })
  world.scene.add(createSledFence(SLED_LANE))

  {
    const lane = PARK_LANE
    const dirAt = (i) => {
      const a = lane.points[i]
      const b = lane.points[Math.min(i + 1, lane.points.length - 1)]
      const len = Math.hypot(b.x - a.x, b.z - a.z) || 1
      return { dx: (b.x - a.x) / len, dz: (b.z - a.z) / len }
    }

    // Eingangsschild an der linken Flanke der Einfahrt, unter dem Zaun am
    // Waldrand. Bei (13, -49) stand es 2,6 m neben der Mittellinie des Parks,
    // genau in der Linie von der Terrasse herunter; hier liegt es gut zehn
    // Meter daneben und ist beim Anfahren trotzdem im Bild.
    const signX = 5
    const signZ = -44.5
    const sign = createParkSign({ title: 'FUNPARK', sub: 'Wellen, Kicker, Boxen' })
    world.place(sign, signX, signZ, { rotation: Math.PI * 0.25 })
    world.addCollider(signX, signZ, 0.8)

    // --- Apres-Ski auf der Terrasse ---------------------------------------
    // Das Haus steht auf der rechten Hangschulter. Nur der flache Vorplatz
    // liegt in der Verbindung zwischen Nordabfahrt und Park.
    const apres = createApresSki()
    world.place(apres, APRES.house.x, APRES.house.z, { rotation: APRES.house.yaw })
    world.addCollider(APRES.house.x, APRES.house.z, 2.4)
    for (const [x, z, r] of [[-2.6, 1.2, 0.45], [2.6, 1.2, 0.45], [-2.8, 2.25, 0.25]]) {
      const c = Math.cos(APRES.house.yaw), s = Math.sin(APRES.house.yaw)
      world.addCollider(APRES.house.x + x * c + z * s, APRES.house.z - x * s + z * c, r)
    }
    apresTerrace = createApresTerrace(world)
    animatedProps.push(apres.userData.animate)
    animatedProps.push((t, dt) => apresTerrace.update(dt, skierRef.current))

    // Das Rail liegt auf der Schneekante und laeuft mit ihr. Es ist jetzt
    // laenger und an den rechten Rand des Bandes gerueckt – zwischen den
    // Schanzen war kein Platz mehr, seit die beiden Landehaenge haben.
    const ledge = PARK_FEATURES.find((f) => f.kind === 'ledge')
    const rail = createRail({ length: ledge.length - 1.6, height: 0.5 })
    // align: das Rail muss der Neigung der Kante folgen. Waagerecht steckt ein
    // Ende im Schnee und das andere haengt in der Luft – die Kante faellt auf
    // ihrer Laenge fast einen Meter.
    // Kein yOffset: die Hoehe der Kante steckt schon im Gelaende. Sie
    // obendrauf noch einmal zu addieren, haengte das Rohr einen knappen
    // Meter ueber den Schnee.
    world.place(rail, ledge.x, ledge.z, {
      rotation: Math.atan2(ledge.dx, ledge.dz),
      align: 1,
    })

    // Die Boxen der Jib-Linie sitzen genauso auf ihrer Aufschuettung.
    for (const [i, f] of PARK_FEATURES.filter((q) => q.kind === 'box').entries()) {
      // Nur so lang wie das flache Dach der Aufschuettung. Ein Deck, das
      // ueber die Anrampung hinausragt, haengt an den Enden in der Luft –
      // die Schneeform faellt dort ab, das Brett bleibt gerade.
      const box = createParkBox({
        length: f.length - 2 * f.ramp + 0.4,
        width: f.width + 0.4,
        color: i % 2 ? 0x2f6bd8 : 0xe0662f,
      })
      world.place(box, f.x, f.z, {
        rotation: Math.atan2(f.dx, f.dz),
        align: 1,
      })
    }

    // --- Die Absprungkanten ------------------------------------------------
    // Die Farbe im Schnee ist wieder weg. Seit die Schanzen einen Landehang
    // haben, sind sie als Form lesbar: eine Rampe mit einer Mulde dahinter
    // wirft aus jedem Winkel Schatten, ein aufgemalter Balken war dagegen nur
    // laut. Was bleibt, sind zwei Kloetze an den Enden der Kante – sie sagen,
    // wie breit die Kante ist, und man sieht sie im Anfahren.
    for (const f of PARK_FEATURES) {
      if (f.kind !== 'kicker') continue
      const half = f.width * 0.5
      for (const side of [-1, 1]) {
        const mx = f.x - f.dz * side * (half + 0.5)
        const mz = f.z + f.dx * side * (half + 0.5)
        const lip = createLipMarker(0x2f6bd8)
        world.place(lip, mx, mz, { rotation: Math.atan2(f.dx, f.dz) })
      }
    }

    // Gepolsterte Marker links und rechts der Figuren – sie machen aus der
    // Schneeflaeche einen Park. Die Schanzen bekommen keine mehr: sie haben
    // seit neuestem ihre Kloetze auf der Kante, und beides zusammen waere
    // ein Slalom aus Polstern.
    let variant = 0
    for (const f of PARK_FEATURES) {
      if (f.kind === 'kicker') continue
      const half = (f.width ?? 8) * 0.5 + 2.2
      for (const side of [-1, 1]) {
        const mx = f.x + f.dz * side * half
        const mz = f.z - f.dx * side * half
        const marker = createPadMarker(variant++)
        world.place(marker, mx, mz, { rotation: rng() * Math.PI * 2 })
      }
    }
  }

  // --- Speedcheck auf der freien Abfahrt -----------------------------------
  // Die Stelle ist so gewaehlt, dass man vorher gut zwanzig Meter Anlauf hat
  // und die Bahn dort gerade laeuft – eine Messung in der Kurve waere eine
  // Messung des Kurvenradius.
  //
  // Die Lichtschranke ist so weit nach links gerueckt, wie es geht: der
  // Reflektorpfosten steht noch fuenf Meter neben der Lifttrasse, weiter waere
  // er in ihr. Der Kamerapfosten steht dreizehn Meter davon entfernt auf der
  // anderen Seite – man faehrt zwischen beiden hindurch, und die Kamera schaut
  // von rechts, also aus der Richtung, aus der sie den Fahrer von vorn
  // erwischt.
  //
  // Die Torachse steht senkrecht auf der Lifttrasse. Vorher stand sie quer zur
  // Falllinie – rechnerisch das Sauberere, weil dann beide Pfosten auf
  // derselben Hoehenlinie stehen. Angesehen hat es sich trotzdem schief, und
  // zwar aus einem Grund, der nichts mit dem Hang zu tun hat: die Trasse ist
  // die einzige lange Gerade in diesem Bildausschnitt, und alles daneben wird
  // an ihr gemessen. Senkrecht auf ihr laeuft das Tor bei fester Kamera fast
  // waagerecht ueber den Bildschirm (dreizehn Grad statt achtunddreissig).
  //
  // Der Preis: die Trasse quert den Hang um achtzehn Grad, also liegen die
  // Pfosten nicht mehr gleich hoch. Deshalb steht das Tor jetzt acht Meter
  // weiter unten, wo der Hang von 45 auf 25 Grad abgeflacht ist – dort sind
  // es noch knapp zwei Meter Unterschied auf zehn Meter Torbreite.
  const speedAt = { x: -33.0, z: -25.0 }
  const speedDir = (() => {
    const dx = LIFT_BASE.x - LIFT_TOP.x
    const dz = LIFT_BASE.z - LIFT_TOP.z
    const len = Math.hypot(dx, dz)
    return { dx: dx / len, dz: dz / len }
  })()
  const speedCheck = new SpeedCheck(world, {
    x: speedAt.x, z: speedAt.z, dx: speedDir.dx, dz: speedDir.dz, width: 10,
  })

  // --- Schneekanone auf der freien Abfahrt ---------------------------------
  // Einen Stangenabstand oberhalb der Lichtschranke, am oestlichen Rand der
  // Piste, quer in den Hang blasend. Wer den Speedcheck anfaehrt, faehrt
  // vorher durch ihr Feld – und weil sie sich wie die im Kinderland nur
  // manchmal dafuer entscheidet, weiss man nie, ob man oben ankommt oder
  // eingeschneit.
  //
  // Die Richtung zeigt quer ueber die Piste und dabei leicht hangaufwaerts.
  // Beides ist gemessen und nicht geraten. Quer, weil die Fahne bei fester
  // Kamera dann fast vollstaendig ueber den Bildschirm laeuft statt in die
  // Blickachse zu zeigen. Leicht bergauf, weil der Kopf nur 0,85 rad
  // schwenken kann und eine Sekunde braucht, bis er auf voller Leistung ist:
  // zeigt sie quer, sieht sie den Fahrer erst, wenn er schon neben ihr ist,
  // und blaest ihm hinterher. So bekommt sie ihn zwanzig Meter vorher ins
  // Feld und laeuft an, waehrend er noch anfaehrt.
  //
  // Seit die Rodelbahn 17 statt 13 Meter breit ist, stand sie mit 7,7 Metern
  // Abstand zur Bahnmitte innerhalb der Bande. Sie ist 3,2 Meter quer zur
  // Bahn auf die Piste gerueckt; zur Lichtschranke sind es jetzt 11,5 Meter.
  const pisteCannon = createSnowCannon({ heading: Math.atan2(-0.88, 0.47) })
  world.place(pisteCannon, -35.1, -36.3, {})
  world.addCollider(-35.1, -36.3, 1.0)
  animatedProps.push((t, dt) => {
    const skier = skierRef.current
    if (!skier) return
    pisteCannon.userData.aimAt(skier.position.x, skier.position.z, !skier.tow)
    pisteCannon.userData.animate(t, dt)
    const hit = pisteCannon.userData.inPlume(skier.position.x, skier.position.z)
    // Schneller als im Kinderland: dort faehrt man langsam quer durch die
    // Fahne, hier schiesst man mit zwoelf Metern je Sekunde hindurch.
    if (hit > 0) skier.dustWithSnow(Math.min(1, skier.snowed + hit * dt * 4.5))
  })
  // Das Display steht weit unterhalb, seitlich neben dem einzelnen Baum und
  // dort, wo der Hang endlich flach wird – ein Brett auf zwei Pfosten in
  // vierzig Grad Hang steht mit einem Bein in der Luft.
  speedCheck.buildDisplay(-21.5, -24.5)
  speedCheck._draw()

  // Die Rail ist ausserdem fahrbar: wer sie oben mit gedrueckter Leertaste
  // erwischt, wird aufgezogen und rutscht bis ans Ende durch.
  const railRide = new RailRide(world, PARK_FEATURES.find((f) => f.kind === 'ledge'))

  // --- Kinderland ---------------------------------------------------------
  // Spielwiese oben auf der Osthoehe, Uebungshang darunter, Zauberteppich
  // dazwischen. Der Teppich beginnt keine sieben Meter neben der Huette –
  // wer den Weg BERUF faehrt, stolpert von selbst darueber.
  const kinderland = new Kinderland(world, registry)

  // --- See --------------------------------------------------------------
  const lake = createLake(world, {
    fogColor: world.scene.fog.color,
    fogDensity: world.scene.fog.density,
    sunDir: sky.sunDir,
  })

  return { apresTerrace, landscape, lake, parkFence, lift, race, kinderland, railRide, speedCheck, northRun, animated: [...stations.animated, ...animatedProps] }
}
