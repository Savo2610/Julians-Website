import * as THREE from 'three'
import { LANDSCAPE_PATHS, GROVES } from './landscape-layout.js'
import { createLandscapeDetails, FALL_SPOT } from './landscape-details.js'
import { BroadcastFeed } from '../stations/broadcast.js'
import { LINKS } from '../stations/links.js'
import { CONNECTIONS } from './paths.js'
import { createWayfinding, arrow, PANORAMA, WEGWEISER } from './wayfinding.js'
import { WORLD, CAMERA } from '../config.js'
import { makeRng } from '../core/rng.js'
import { fbm } from '../core/noise.js'
import { terrainHeight, terrainNormal, LAKE, PLATEAU, SUMMIT, playAreaDistance, SLED_LANE, NORTH_LANE, GRAT, BRUECKE, KLAMM, SCHANZE, stegLage, PARK_LANE, PARK_FEATURES, KINDER_LANE, SHOOT_LANE, BADESTEG } from './heightfield.js'
import { createForest, createFallenTree } from './props/trees.js'
import { createRocks, createBoulder } from './props/rocks.js'
import { createLake } from './props/lake.js'
import { createBadesteg } from './props/badesteg.js'
import { createBackdrop } from './props/backdrop.js'
import { createFence, createPisteMarkers } from './props/fence.js'
import { createBreakableFence } from './props/park-fence.js'
import { createAvalancheBarrier } from './props/avalanche-barrier.js'
import { createSnowCannon } from './props/snow-cannon.js'
import { createMarkerSign, springMount, createGefahrKreuz } from './props/signpost.js'
import { populateStations, STATION_SPOTS, TRAILS } from '../stations/stations.js'
import { createMarker } from '../stations/marker.js'
import { createTorch } from './props/torch.js'
import { createSummitCross } from './props/summit-cross.js'
import { DragLift } from './attractions/drag-lift.js'
import { RaceCourse } from './attractions/race.js'
import { RailRide } from './attractions/rail-ride.js'
import { SpeedCheck } from './attractions/speed-check.js'
import { createRail, createParkSign, createParkBox, createLipLine, createBeachFlag, createPadMarker } from './props/funpark.js'
import { APRES, houseWorld } from './areas/apres-layout.js'
import { createApresTerrace } from './areas/apres-terrace.js'
import { createApresSki } from './props/apres-ski.js'
import { createEiszapfen } from './props/eiszapfen.js'
import { createSledFence } from './props/sled.js'
import { Kinderland } from './areas/kinderland.js'
import { NorthRun } from './attractions/north-run.js'
import { KlammSprung } from './attractions/klamm-sprung.js'
import { createStartGate } from './props/start-gate.js'
import { createGorgeBridge } from './props/gorge-bridge.js'
import { createKlammSchanze } from './props/klamm-schanze.js'
import { createKlammEis, rohrLage } from './props/klamm-eis.js'
import { SUEDZAUN, SEEZAUN, NETZ, KETTE_NORDWEST, KETTE_NORDOST, KETTE_SEE, aufLinie } from './grenze.js'
import { grenzeZiehen } from './grenzkette.js'
import { Fangnetz } from './attractions/fangnetz.js'
import { createFangnetz } from './props/fangnetz.js'

// Gesperrte Zonen: hier soll nichts wachsen, weil dort gefahren oder etwas
// gebaut wird. Jede Station bringt ihre eigene Lichtung mit.
const CLEARINGS = [
  // Die Quelle braucht ein freies Vorfeld; sonst verdecken die Ufertannen
  // den neuen Blickfang komplett aus der festen Kamerarichtung.
  { x: -58.5, z: 25, r: 5.5 },
  { x: PLATEAU.x, z: PLATEAU.z, r: PLATEAU.radius + 5 },   // Startplateau
  { x: LAKE.x, z: LAKE.z, r: LAKE.radius * 1.02 },
  { x: BADESTEG.von.x, z: BADESTEG.von.z, r: 4 },   // Landende des Badestegs
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

// Liegt (x, z) mit Radius r dort, wohin das Netz nachgibt? Das sind gut
// zwei Meter dahinter und das Netz selbst, zwischen den Pfosten. Was davor
// steht, bleibt: die kleine Tanne vor dem linken Feld stand in der Skizze mit
// drauf.
function imNetz(x, z, r) {
  const p = NETZ.pfosten
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len
    const u = (x - a.x) * tx + (z - a.z) * tz
    // Normale nach innen, wie in attractions/fangnetz.js.
    let nx = -tz, nz = tx
    if ((NETZ.innen.x - a.x) * nx + (NETZ.innen.z - a.z) * nz < 0) { nx = -nx; nz = -nz }
    const d = (x - a.x) * nx + (z - a.z) * nz
    if (u > 0.6 && u < len - 0.6 && d + r > -2.3 && d - r < 0.4) return true
  }
  return false
}

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

export function populate(world, sky, registry, stationOptions = {}) {
  const rng = makeRng(20260902)
  const animatedProps = []

  // Erst die flachen Stationsplaetze bestimmen: sonst bleibt der Wald an
  // den alten Koordinaten frei und waechst in den tatsaechlichen Vorplatz.
  const stations = populateStations(world, registry, stationOptions)

  createBackdrop(world.scene, sky)

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
  // Die Nordabfahrt ist an der Gabel breiter, und die Flugbahn der Schanze
  // muss frei sein: ein Baum hat keine Hoehe, an der man ihn ueberfliegt.
  {
    const u0 = -SCHANZE.laenge - 4
    const u1 = SCHANZE.drueben + SCHANZE.landung + 2
    LANES.push({
      x1: SCHANZE.x + SCHANZE.dx * u0, z1: SCHANZE.z + SCHANZE.dz * u0,
      x2: SCHANZE.x + SCHANZE.dx * u1, z2: SCHANZE.z + SCHANZE.dz * u1,
      r: SCHANZE.halb + SCHANZE.flanke + 2.5,
    })
    for (let i = 0; i < NORTH_LANE.points.length - 1; i++) {
      const a = NORTH_LANE.points[i]
      const b = NORTH_LANE.points[i + 1]
      const w = Math.max(a.w ?? 0, b.w ?? 0)
      if (w) LANES.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r: w / 2 + 2 })
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

  let apresTerrace, eiszapfen, huette
  // Felsen der Rueckseite, auf deren Kuppe der Steinbock stehen kann.
  const felsen = []

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
  // Vor dem Rohr, aus dem der Bach kommt, steht kein Baum: er verdeckte es
  // aus der Spielkamera. Herausgenommen wird erst hier, damit der Zufall fuer
  // alle anderen Baeume derselbe bleibt.
  {
    const rohr = rohrLage()
    if (rohr) {
      const vor = { x: rohr.mx + 2.5, z: rohr.mz + 2.5 }
      for (let i = placements.length - 1; i >= 0; i--) {
        const p = placements[i]
        const hinten = { x: rohr.mx - rohr.ax * 3, z: rohr.mz - rohr.az * 3 }
        if (Math.hypot(p.x - rohr.mx, p.z - rohr.mz) < 4 || Math.hypot(p.x - vor.x, p.z - vor.z) < 3.5 || Math.hypot(p.x - hinten.x, p.z - hinten.z) < 3) placements.splice(i, 1)
      }
    }
  }
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
  // Kein Baum in den Tafeln der Wegweiser: sie ragen 3,4 m zur Seite, und
  // seit sich der Wald mit dem Gelaende an der Klamm neu verteilt hat, stand
  // einer mit seinen unteren Zweigen in WERKSTATT (04.10.). Beide Seiten,
  // auf welche die Tafeln zeigen, entscheidet erst createWayfinding.
  for (const { at: [sx, sz] } of WEGWEISER) {
    const rx = Math.cos(CAMERA.azimuth), rz = -Math.sin(CAMERA.azimuth)
    for (let i = placements.length - 1; i >= 0; i--) {
      const p = placements[i]
      const entlang = (p.x - sx) * rx + (p.z - sz) * rz
      const quer = Math.abs(-(p.x - sx) * rz + (p.z - sz) * rx)
      if (Math.abs(entlang) < 4.2 && quer < 2.6) placements.splice(i, 1)
    }
  }
  // Kein Stamm im Zaun und keiner dort, wohin das Netz nachgibt. Erst hier
  // herausgenommen, damit der Zufall fuer alle anderen Baeume derselbe bleibt.
  for (let i = placements.length - 1; i >= 0; i--) {
    const p = placements[i]
    if (aufLinie(SUEDZAUN, p.x, p.z).d < 1.1 || aufLinie(SEEZAUN, p.x, p.z).d < 1.1 || imNetz(p.x, p.z, 0.8)) placements.splice(i, 1)
  }
  createForest(world, placements)
  const landscape = createLandscapeDetails(world, groveTrees)
  animatedProps.push((t, dt) => landscape.update(dt, skierRef.current))

  // Die gefrorene Quelle am See zeigt die laufende Sendung von
  // broadcast.veerka.mp. Bewusst ohne Ring im Schnee, ohne Eintrag auf der
  // Karte und im Pistenpass: wer sie findet, hat gestoebert. Enter zoomt
  // heran, dann taut das Eis auf – deshalb eine Auswahl mit nur einem Ziel.
  const feed = new BroadcastFeed(landscape.fall, FALL_SPOT)
  const fallGround = terrainHeight(FALL_SPOT.x, FALL_SPOT.z)
  registry.add({
    id: 'broadcast',
    label: 'Gefrorene Quelle',
    color: '#5fa8f0',
    position: FALL_SPOT,
    radius: 6.5,
    groundY: fallGround,
    // Die Einladung schwebt vor dem Fall auf dem Eis. Am Fuss verdeckte sie
    // das untere Drittel des Bildes.
    labelHeight: fallGround + 0.2,
    labelAt: {
      x: FALL_SPOT.x + Math.sin(CAMERA.azimuth) * 3.2,
      z: FALL_SPOT.z + Math.cos(CAMERA.azimuth) * 3.2,
    },
    object: landscape.fall,
    // Die Mitte des Eises liegt 1,1 m hinter und 1,9 m ueber dem Fuss.
    focus: { abstand: 12.5, hoehe: 1.9, vor: -0.4 },
    choices: [
      { label: 'Broadcast', sub: () => feed.sub, glyph: 'broadcast', url: LINKS.broadcast, color: '#ff6b5a' },
    ],
  })
  // registry.add kopiert die Station; der Hinweis haengt am Stand der
  // Sendung und muss deshalb an der Kopie nachgelesen werden.
  Object.defineProperty(registry.stations.at(-1), 'hint', { get: () => feed.hint })
  animatedProps.push((t, dt) => {
    landscape.fall.userData.animate(t, dt)
    landscape.tower.userData.setLive(!!feed.message)
    landscape.tower.userData.animate(t, dt)
    feed.update(dt, skierRef.current)
  })

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
    })).filter((p) => !imNetz(p.x, p.z, p.scale * p.stretch) && aufLinie(SUEDZAUN, p.x, p.z).d > p.scale + 0.6),
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
  let torPfostenRechts = null
  const klammSprung = new KlammSprung(world)
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
    torPfostenRechts = pfostenOrt(1)

    // Stangen an beiden Raendern. Eine versetzte Linie braucht je Punkt eine
    // Querrichtung; genommen wird die Richtung der beiden Nachbarn, damit an
    // den Knicken kein Knick in der Stangenreihe entsteht.
    //
    // Der Versatz zaehlt vom Rand der Bahn nach innen: an der Gabel ist sie
    // 22 statt 14 Meter breit, und die Stangen gehen mit.
    const seite = (vomRand, sx) => P.map((p, i) => {
      const a = P[Math.max(0, i - 1)]
      const b = P[Math.min(P.length - 1, i + 1)]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const L = Math.hypot(dx, dz) || 1
      const versatz = sx * ((p.w ?? NORTH_LANE.width) / 2 - vomRand)
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

      // Neigung und Hoehe nimmt die Bruecke vom Deck (stegLage in
      // heightfield.js), auf dem der Fahrer faehrt. Bis 04.10. kamen sie aus
      // einer Ausgleichsgeraden durch das Gelaende – das trug damals selbst,
      // jetzt laeuft darunter die Klamm durch.
      const laenge = 15
      const ll = Math.hypot(nach.x - vor.x, nach.z - vor.z)
      const ux = (nach.x - vor.x) / ll
      const uz = (nach.z - vor.z) / ll
      const deckY = (o) => stegLage(BRUECKE.x + ux * o, BRUECKE.z + uz * o).y
      const neigung = Math.atan((deckY(-5) - deckY(5)) / 10)
      const mitteY = deckY(0)
      const hoehe = mitteY - terrainHeight(BRUECKE.x, BRUECKE.z)

      // Fuer die Widerlager: der Grund in den lokalen Koordinaten der
      // Bruecke, gemessen von der Deckmitte aus.
      const c = Math.cos(dreh), sn = Math.sin(dreh)
      const grund = (lx, lz) => terrainHeight(BRUECKE.x + lx * c + lz * sn, BRUECKE.z - lx * sn + lz * c) - mitteY

      const bruecke = createGorgeBridge({ laenge, neigung, grund })
      world.place(bruecke, BRUECKE.x, BRUECKE.z, { rotation: dreh, yOffset: hoehe })
    }

    // Stangen, die in der Klamm stuenden, faellt weg. Eine Pistenstange, die
    // vier Meter unter der Bahn im Graben steht, sieht nicht nach Absperrung
    // aus, sondern nach Fehler.
    const inKlamm = (p) => {
      const ax = KLAMM.bis.x - KLAMM.von.x
      const az = KLAMM.bis.z - KLAMM.von.z
      const la = Math.hypot(ax, az)
      return Math.abs(((p.x - KLAMM.von.x) * az - (p.z - KLAMM.von.z) * ax) / la) < 8.5
    }
    for (const [sx, seed] of [[1, 71], [-1, 73]]) {
      markerRows.push(createPisteMarkers(world, route(seite(0.8, sx), 5.4).filter((p) => !inKlamm(p) && !(p.x > 17 && p.x < 32 && p.z > -68 && p.z < -49)), {
        seed, color: 0x2f6bd8,
      }))
    }

    // An ihrer Stelle steht eine Reihe quer vor der Klamm, acht Meter vor der
    // Rinnenmitte – die Rinne greift 6,4 Meter weit, acht ist noch fester
    // Grund. Sie laesst zwei Luecken: rechts vor der Bruecke, links vor der
    // Schanze. Dazwischen trennt eine Stangenreihe die beiden Wege schon
    // zwanzig Meter vorher, damit man sich entscheidet, bevor man an der
    // Kante steht, und nicht erst dort.
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
      // Wo die Schanze, von der Bruecke aus laengs der Rinne gemessen, liegt.
      const schanzeBei = (SCHANZE.x - BRUECKE.x) * laengs.x + (SCHANZE.z - BRUECKE.z) * laengs.z
      const luecken = [[-BRUECKE.halb - 0.6, BRUECKE.halb + 0.6], [schanzeBei - SCHANZE.halb - 0.7, schanzeBei + SCHANZE.halb + 0.7]]
      // Wo die gelben Kreuze stehen (weiter unten): zwischen Bruecke und
      // Schanze und links der Bruecke. Dort und zwischen Kreuz und Bruecke
      // keine blauen Stangen mehr – das Kreuz sagt es allein.
      const kreuzBei = [(BRUECKE.halb + 0.6 + schanzeBei - SCHANZE.halb - 0.7) / 2, -BRUECKE.halb - 3.0]
      luecken.push([BRUECKE.halb, schanzeBei], [kreuzBei[1] - 2, -BRUECKE.halb])
      const lippe = []
      for (let s = -6.6; s <= schanzeBei + 6; s += 1.9) {
        if (luecken.some(([a, b]) => s > a && s < b)) continue
        lippe.push({ x: BRUECKE.x + quer.x * bergauf + laengs.x * s, z: BRUECKE.z + quer.z * bergauf + laengs.z * s })
      }
      markerRows.push(createPisteMarkers(world, lippe, { seed: 77, color: 0x2f6bd8 }))

      // Gelbe Kreuze an der Kante, wo es in die Klamm hinuntergeht: zwischen
      // Bruecke und Schanze und auf der anderen Seite der Bruecke (Wunsch
      // 04.10.). Die blauen Stangen allein sagten nur, wo die Bahn endet.
      const kreuzDreh = Math.atan2(-laengs.z, laengs.x)
      for (const s of kreuzBei) {
        const kx = BRUECKE.x + quer.x * bergauf + laengs.x * s
        const kz = BRUECKE.z + quer.z * bergauf + laengs.z * s
        const kreuz = createGefahrKreuz()
        world.place(kreuz, kx, kz, { rotation: kreuzDreh })
        const feder = springMount(world, kreuz, kx, kz, kreuzDreh)
        animatedProps.push((t, dt) => feder(dt, skierRef.current))
      }

      // Die Trennlinie zwischen beiden Wegen, in Fahrtrichtung der Schanze
      // zurueck bis dorthin, wo die Bahn breiter wird.
      const mitte = (BRUECKE.halb + 0.6 + schanzeBei - SCHANZE.halb - 0.7) / 2
      const trenn = []
      for (let t = 10.5; t <= 21; t += 3.5) {
        trenn.push({
          x: BRUECKE.x + quer.x * bergauf * (t / 8) + laengs.x * mitte,
          z: BRUECKE.z + quer.z * bergauf * (t / 8) + laengs.z * mitte,
        })
      }
      markerRows.push(createPisteMarkers(world, trenn, { seed: 79, color: 0xd8462f }))

      // Die Schanze selbst: Rampe mit Seitenbrettern, Kante, Weitenmarken.
      const schanze = createKlammSchanze(world)
      animatedProps.push(schanze.userData.animate)

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
        // Auch nicht dort, wo man ueber die Klamm springt: ein Fels auf der
        // Kante ist ein Fels in der Flugbahn.
        const l = (mx - BRUECKE.x) * laengs.x + (mz - BRUECKE.z) * laengs.z
        if (Math.abs(l) < BRUECKE.halb + 2.6 || Math.abs(l - schanzeBei) < SCHANZE.halb + 2.6) continue
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
      felsen.push(...klammFelsen)
      createKlammEis(world)
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
    felsen.push(...gratFelsen)
  }

  // Der Rueckweg traegt dieselbe Farbe wie die freie Abfahrt: von unten
  // gesehen ist beides derselbe Weg zurueck an den Lift.
  // Die Stangen in der Farbe der freien Abfahrt sagen genug; ein Schild am
  // Ziel waere ein Wort zuviel.
  markerRows.push(createPisteMarkers(world, route(RETURN_PATH, 5.0), { seed: 61, color: 0xe8703a }))

  // --- Zaeune -------------------------------------------------------------
  // Der alte Weidezaun im Osten ist seit 08.10. die Suedgrenze: vom Seeufer
  // bis auf die Hoehe des Funparks, im Wald auf der Kontur fuenf Meter
  // innerhalb des Randes (Begruendung und Linie in grenze.js). Er ist dicht –
  // vorher passte man zwischen zwei Pfosten hindurch. Der Absperrzaun am See
  // (der letzte Pfosten lag frueher 2 m im See) ist sein Anfang.
  createFence(world, SUEDZAUN, { seed: 41, dicht: true })
  createFence(world, SEEZAUN, { seed: 77, dicht: true })
  // Der Zaun oben am Funpark gibt nach, siehe props/park-fence.js.
  const parkFenceEnde = { x: -12, z: -48 }
  const parkFence = createBreakableFence(world, [
    { x: 14, z: -46 }, { x: 2, z: -50 }, parkFenceEnde,
  ], { seed: 93 })
  animatedProps.push((t, dt) => parkFence.update(dt, skierRef.current))

  // --- Rodelbahn vom Gipfel ----------------------------------------------
  // Die Bahn ist eine Rinne mit Banden – die Tore darin sind kein zweiter
  // Weg, sondern eine Aufgabe innerhalb des einen Wegs: sie zwingen zu einer
  // Linie, statt nur zu einer Richtung. Wo es durchgeht, steht in der Farbe
  // im Schnee, nicht in den Stangen.
  const race = new RaceCourse(world, { lane: SLED_LANE, gates: true })
  // Die Bergseite der Bande beginnt am rechten Pfosten des Startbogens der
  // Nordabfahrt und laeuft von dort gerade zur ersten Ecke. Vorher stand ihr
  // erster Pfosten mitten auf dem Gipfelplatz, und die Pistenraupe fuhr durch
  // ihn hindurch; jetzt bleibt sie davor.
  const [ax, az] = torPfostenRechts
  // Auf der anderen Seite laeuft sie durch bis ans Ende des Funparkzauns:
  // ein Zaun zwischen Slalom und Nordabfahrt, der wie der Funparkzaun
  // bricht. Felsen (Kreise ab 1,2 m) unterbrechen ihn.
  const sledFence = createSledFence(SLED_LANE, {
    brechbar: {
      side: -1,
      von: { x: ax, z: az },
      bis: parkFenceEnde,
      hindernis: (x, z) => world.nearby(x, z, []).filter((c) => c.r >= 1.2),
    },
  })
  world.scene.add(sledFence)
  const slalomZaun = createBreakableFence(world, sledFence.userData.brechbar, { bande: true, seed: 95 })
  animatedProps.push((t, dt) => slalomZaun.update(dt, skierRef.current))

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
    // Das Haus steht auf der rechten Hangschulter, leicht schraeg (siehe
    // apres-layout.js). Nur das Sonnendeck liegt neben der Verbindung
    // zwischen Nordabfahrt und Park, auf deren Hoehe.
    const apres = createApresSki()
    huette = apres
    world.place(apres, APRES.house.x, APRES.house.z, { rotation: APRES.house.yaw + APRES.house.turn })
    // Drei Kreise statt einem: einer mit 2,4 m sperrte bei 5 m Hausbreite
    // entweder die Ecken nicht oder reichte 0,6 m vor die Tuer.
    for (const [x, z, r] of [[-1.3, 0, 1.95], [0, 0, 1.95], [1.3, 0, 1.95], [-3.1, 2.2, 0.6], [3.1, 2.2, 0.6], [-2.95, -0.6, 0.45]]) {
      const p = houseWorld(x, z)
      world.addCollider(p.x, p.z, r)
    }
    apresTerrace = createApresTerrace(world)
    animatedProps.push(apres.userData.animate)
    // Eiszapfen an der rechten Traufe, zum Abbrechen (props/eiszapfen.js).
    apres.updateMatrixWorld(true)
    const zapfen = createEiszapfen(world.scene, apres.userData.zapfen.map((z) => {
      const w = apres.localToWorld(new THREE.Vector3(z.x, z.y, z.z))
      return { x: w.x, y: w.y, z: w.z, l: z.l }
    }))
    eiszapfen = zapfen
    animatedProps.push((t, dt) => zapfen.update(dt, skierRef.current))
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
      // Die Platte folgt dem Dach der Aufschuettung (boden), statt gerade
      // und nach der Mitte geneigt darauf zu liegen. Gemessen wird auf dem
      // flachen Dach; an den Enden und Kanten nicht weiter, sonst hinge das
      // Holz in die Anrampung hinunter.
      const flach = f.length * 0.5 - f.ramp
      const mitte = terrainHeight(f.x, f.z)
      const box = createParkBox({
        length: f.length - 2 * f.ramp + 0.4,
        width: f.width + 0.4,
        color: i % 2 ? 0x2f6bd8 : 0xe0662f,
        boden: (lx, lz) => {
          const u = Math.max(-flach, Math.min(flach, lz))
          const q = Math.max(-f.width * 0.5, Math.min(f.width * 0.5, lx))
          return terrainHeight(f.x + q * f.dz + u * f.dx, f.z - q * f.dx + u * f.dz) - mitte
        },
      })
      world.place(box, f.x, f.z, { rotation: Math.atan2(f.dx, f.dz) })
    }

    // --- Die Absprungkanten ------------------------------------------------
    // Die Farbe im Schnee ist wieder da, aber als Linie: blau quer ueber die
    // Kante wie beim Weitsprung (Wunsch 04.10.). Der erste aufgemalte Balken
    // war breit und laut; die Kloetze an den Enden danach sahen aus wie
    // Kisten. Eine schmale Linie sagt, wo man abspringt, und sonst nichts.
    for (const f of PARK_FEATURES) {
      if (f.kind !== 'kicker') continue
      const half = f.width * 0.5 + 0.4
      const punkte = []
      for (let v = -half; v <= half + 0.01; v += 0.5) {
        // Zehn Zentimeter vor der Kante: dort ist die Rampe noch ganz da.
        const x = f.x - f.dx * 0.1 - f.dz * v
        const z = f.z - f.dz * 0.1 + f.dx * v
        punkte.push([x, terrainHeight(x, z) + 0.025, z])
      }
      world.scene.add(createLipLine(punkte))
    }

    // Beachflags links und rechts der Absprungkanten, wo vorher die Kloetze
    // standen: im Anfahren sieht man daran, wo gesprungen wird. Sie stehen
    // auf Federfuessen: wer dagegen faehrt, legt sie um, und sie schwingen
    // hinter ihm zurueck.
    let variant = 0
    for (const f of PARK_FEATURES) {
      if (f.kind !== 'kicker') continue
      const half = f.width * 0.5 + 0.7
      for (const side of [-1, 1]) {
        const mx = f.x - f.dz * side * half
        const mz = f.z + f.dx * side * half
        const flagge = createBeachFlag(variant++)
        world.place(flagge, mx, mz, { rotation: Math.PI * 0.25 })
        const feder = springMount(world, flagge, mx, mz, Math.PI * 0.25)
        animatedProps.push((t, dt) => feder(dt, skierRef.current))
      }
    }

    // Gepolsterte Pfosten links und rechts der Figuren – sie machen aus der
    // Schneeflaeche einen Park.
    for (const f of PARK_FEATURES) {
      if (f.kind === 'kicker') continue
      const half = (f.width ?? 8) * 0.5 + 2.2
      // Die Wellen liegen seit 04.10. am linken Rand neben dem Landehang
      // der grossen Schanze; ein Polster auf ihrer Innenseite stuende
      // mitten in dessen Flanke. Sie bekommen nur das aeussere.
      for (const side of f.kind === 'rollers' ? [-1] : [-1, 1]) {
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
  // Der Badesteg: von hier in den Sommer, siehe src/sommer/.
  const badesteg = createBadesteg(world)

  // --- Grenze im Norden ----------------------------------------------------
  // Das Fangnetz an der Kante der Nordabfahrt und links und rechts davon eine
  // Kette aus Baeumen und Felsen, die nicht mehr durchlaesst (grenze.js).
  // Die dritte Kette schliesst den Seezaun an den Rand an.
  const fangnetz = new Fangnetz(NETZ)
  fangnetz.kollision(world)
  const netzBild = createFangnetz(world, fangnetz)
  animatedProps.push((t, dt) => netzBild.update(dt, skierRef.current))
  const grenze = [
    grenzeZiehen(world, KETTE_NORDWEST, { seed: 4401 }),
    grenzeZiehen(world, KETTE_NORDOST, { seed: 4402 }),
    grenzeZiehen(world, KETTE_SEE, { seed: 4403 }),
  ]

  return { fangnetz, grenze, trees: placements, huette, kreuz: cross, felsen, apresTerrace, eiszapfen, landscape, rohrpost: stations.pipe, broadcast: feed, lake, badesteg, parkFence, lift, race, kinderland, railRide, speedCheck, northRun, klammSprung, animated: [...stations.animated, ...animatedProps] }
}
