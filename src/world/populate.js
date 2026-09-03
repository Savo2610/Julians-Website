import * as THREE from 'three'
import { WORLD } from '../config.js'
import { makeRng } from '../core/rng.js'
import { fbm } from '../core/noise.js'
import { terrainHeight, terrainNormal, LAKE, PLATEAU, SUMMIT, playAreaDistance, SLED_LANE, PARK_LANE, PARK_FEATURES, KINDER_LANE } from './heightfield.js'
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
import { RaceCourse } from './race.js'
import { createRail, createPadMarker, createParkSign } from './props/funpark.js'
import { createSledFence } from './props/sled.js'
import { snowPaint } from './props/snow-paint.js'
import { Kinderland } from './kinderland.js'

// Gesperrte Zonen: hier soll nichts wachsen, weil dort gefahren oder etwas
// gebaut wird. Jede Station bringt ihre eigene Lichtung mit.
const CLEARINGS = [
  { x: PLATEAU.x, z: PLATEAU.z, r: PLATEAU.radius + 5 },   // Startplateau
  { x: LAKE.x, z: LAKE.z, r: LAKE.radius * 1.02 },
  { x: SUMMIT.x, z: SUMMIT.z, r: 13 },   // Gipfelbereich frei halten
  { x: -40, z: -44, r: 6 },    // Ausbuchtung der freien Abfahrt
  ...Object.values(STATION_SPOTS).map((s) => ({ x: s.x, z: s.z, r: s.clearing })),
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

  createBackdrop(world.scene, { fogColor: world.scene.fog.color })

  // Lifttrasse als Waldschneise freihalten – ein Schlepplift laeuft nie durch
  // den Bestand. Muss vor der Bepflanzung feststehen.
  LANES.length = 0
  LANES.push({ x1: LIFT_BASE.x, z1: LIFT_BASE.z, x2: LIFT_TOP.x, z2: LIFT_TOP.z, r: 7.5 })
  // Die vier markierten Wege muessen frei bleiben. Sie waren es frueher von
  // selbst, weil dort kaum Wald stand – seit der Wald dichter ist, muessen
  // sie es ausdruecklich sein. Ein markierter Weg, der von Baeumen versperrt
  // wird, ist schlimmer als gar keiner.
  for (const trail of Object.values(TRAILS)) {
    for (let i = 0; i < trail.path.length - 1; i++) {
      const [x1, z1] = trail.path[i]
      const [x2, z2] = trail.path[i + 1]
      LANES.push({ x1, z1, x2, z2, r: 5 })
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
  for (const [lane, r] of [[SLED_LANE, 7.5], [PARK_LANE, 13], [KINDER_LANE, 12]]) {
    for (let i = 0; i < lane.points.length - 1; i++) {
      const a = lane.points[i]
      const b = lane.points[i + 1]
      LANES.push({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r })
    }
  }
  // Abstand zur Rodelbahn – gebraucht fuer das Waldband, das sie einfasst.
  const sledDist = (x, z) => {
    let best = Infinity
    const pts = SLED_LANE.points
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

  const n = new THREE.Vector3()

  const steepness = (x, z) => {
    terrainNormal(x, z, n)
    return 1 - n.y
  }

  // --- Wald ------------------------------------------------------------
  // Dichter Guertel aussen, lockere Gruppen innen: der Wald ist die weiche
  // Talgrenze, bevor die Felswand kommt.
  const treeSpots = scatter(rng, {
    count: 880,
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
      const density = Math.min(1, rim * 0.98 + groves * 0.5 + woods) * treeline
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
  // Eine Handvoll Baeume um den LinkedIn-Wegweiser. Der Bestand ist dort von
  // Natur aus duenn – die Haine kommen aus einem Rauschfeld, und genau an
  // dieser Stelle liegt es niedrig. Ohne diese Gruppe stuende das Schild auf
  // freiem Feld statt am Waldrand, und das war ausdruecklich nicht gewollt.
  {
    const sign = STATION_SPOTS.signpostCareer
    for (const [angle, dist, variant] of [
      [0.35, 5.2, 0], [1.15, 6.4, 1], [2.0, 5.6, 0], [2.75, 7.4, 2],
      [3.6, 5.0, 1], [4.4, 6.8, 0], [5.2, 5.4, 2], [5.9, 7.8, 1],
    ]) {
      placements.push({
        x: sign.x + Math.sin(angle) * dist,
        z: sign.z + Math.cos(angle) * dist,
        variant,
        rotation: angle * 1.7,
        scale: 0.85 + ((angle * 7) % 1) * 0.6,
        tiltX: (((angle * 13) % 1) - 0.5) * 0.06,
        tiltZ: (((angle * 17) % 1) - 0.5) * 0.06,
        shade: (angle * 11) % 1,
      })
    }
  }

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
    { x: -8, z: -16, rot: 0.9 },
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

  // --- Wegweiser im Schnee ------------------------------------------------
  // Die Stangen sagen, wo der Weg ist. Die Winkel im Schnee sagen, wohin er
  // fuehrt – man kann ihnen folgen, ohne die Karte im Kopf zu haben. Sie
  // tragen die Farbe ihres Weges, damit man beim Kreuzen sieht, auf welchem
  // man gerade ist.
  {
    const paint = snowPaint()
    const washed = new THREE.Color()
    for (const trail of Object.values(TRAILS)) {
      const pts = trail.path
      // Farbe auf Schnee ist nie satt. Ein Drittel Weiss dazu, sonst liegen
      // vier Plastikpfeile in der Landschaft statt vier Markierungen.
      washed.setHex(trail.markerColor).lerp(new THREE.Color(0xffffff), 0.34)
      const tone = washed.getHex()
      // Der Weg wird als Polylinie abgeschritten, ein Winkel alle 16 Meter.
      let carry = 7
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, z1] = pts[i]
        const [x2, z2] = pts[i + 1]
        const len = Math.hypot(x2 - x1, z2 - z1)
        const dx = (x2 - x1) / len
        const dz = (z2 - z1) / len
        for (let d = carry; d < len; d += 16) {
          paint.chevron(x1 + dx * d, z1 + dz * d, dx, dz, 2.2, tone)
        }
        carry = Math.max(0, carry - len) || (16 - ((len - carry) % 16))
      }
    }
    world.scene.add(paint.build({ name: 'wegweiser-schnee' }))
  }

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

  // --- Gipfel -------------------------------------------------------------
  const cross = createSummitCross({ label: 'GIPFEL' })
  world.place(cross, SUMMIT.x + 1.5, SUMMIT.z + 1.5, { rotation: Math.PI * 0.25 })
  world.addCollider(SUMMIT.x + 1.5, SUMMIT.z + 1.5, 0.7)

  // Die freie Abfahrt zwischen Lifttrasse und Rodelbahn: wer nicht auf Zeit
  // fahren will, hat hier seinen Weg vom Gipfel ins Tal. Nur Stangen, kein
  // eingeschnittenes Band – die Piste soll offen bleiben.
  createPisteMarkers(world, route(FREE_PISTE, 5.5), { seed: 55, color: 0xe8703a })

  // Der Rueckweg traegt dieselbe Farbe wie die freie Abfahrt: von unten
  // gesehen ist beides derselbe Weg zurueck an den Lift.
  createPisteMarkers(world, route(RETURN_PATH, 5.0), { seed: 61, color: 0xe8703a })
  {
    // Ein Wegweiser am Ziel. Wer die Uhr gestoppt hat, schaut zuerst auf die
    // Zeit und dann ratlos in den Wald – dieses Schild beantwortet die Frage,
    // bevor sie entsteht.
    const [hx, hz] = RETURN_PATH[0]
    const home = createSignpost([
      { text: 'TALSTATION', background: '#e8703a', width: 2.6, height: 0.6, rotation: -0.35 },
    ], { height: 2.4 })
    world.place(home, hx + 2.6, hz + 1.4, { rotation: Math.PI * 0.25 })
    world.addCollider(hx + 2.6, hz + 1.4, 0.45)
  }

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
    { x: -24, z: 44 }, { x: -30, z: 52 }, { x: -42, z: 54 },
  ], { seed: 77 })
  createFence(world, [
    { x: 14, z: -46 }, { x: 2, z: -50 }, { x: -12, z: -48 },
  ], { seed: 93 })

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

    // Eingangsschild oben am Band, seitlich versetzt, damit es nicht im Weg
    // steht.
    const head = lane.points[0]
    const d0 = dirAt(0)
    const signX = head.x + d0.dz * 8.5 + d0.dx * 2
    const signZ = head.z - d0.dx * 8.5 + d0.dz * 2
    const sign = createParkSign({ title: 'FUNPARK', sub: 'Wellen, Kicker, Rail' })
    world.place(sign, signX, signZ, { rotation: Math.PI * 0.25 })
    world.addCollider(signX, signZ, 0.8)

    // Das Rail liegt auf der Schneekante und laeuft mit ihr.
    const ledge = PARK_FEATURES.find((f) => f.kind === 'ledge')
    const rail = createRail({ length: ledge.length - 1.6, height: 0.5 })
    // align: das Rail muss der Neigung der Kante folgen. Waagerecht steckt ein
    // Ende im Schnee und das andere haengt in der Luft – die Kante faellt auf
    // ihrer Laenge fast einen Meter.
    world.place(rail, ledge.x, ledge.z, {
      yOffset: ledge.height,
      rotation: Math.atan2(ledge.dx, ledge.dz),
      align: 1,
    })

    // Gepolsterte Marker links und rechts der Figuren – sie machen aus der
    // Schneeflaeche einen Park.
    let variant = 0
    for (const f of PARK_FEATURES) {
      const half = (f.width ?? 8) * 0.5 + 2.2
      for (const side of [-1, 1]) {
        const mx = f.x + f.dz * side * half
        const mz = f.z - f.dx * side * half
        const marker = createPadMarker(variant++)
        world.place(marker, mx, mz, { rotation: rng() * Math.PI * 2 })
      }
    }
  }

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

  return { lake, lift, race, kinderland, animated: [...stations.animated, ...animatedProps] }
}
