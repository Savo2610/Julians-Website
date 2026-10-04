import * as THREE from 'three'
import { isSnowSurface } from './world/surfaces.js'
import './style.css'
import './dialogs/dialogs.css'

import { CAMERA, CHASE, COLORS, SKIER } from './config.js'
import { Input } from './core/input.js'
import { TOUCH } from './core/device.js'
import { pointScale } from './core/point-scale.js'
import { TouchControls } from './core/touch.js'
import { Antippen } from './stations/antippen.js'
import { inFunpark, PLATEAU } from './world/heightfield.js'
import { SnowTrail } from './world/snow-trail.js'
import { World } from './world/world.js'
import { createSky } from './world/sky.js'
import { createSnowfall } from './world/weather.js'
import { writeIntro, stampTrack } from './world/snow-writing.js'
import { populate, skierRef } from './world/populate.js'
import { StationRegistry } from './stations/registry.js'
import { StationUI } from './stations/ui.js'
import { StationInteraction } from './stations/interaction.js'
import { MapMenu, ORTE } from './menu/map-menu.js'
import { createTrailGlints } from './world/trail-glints.js'
import { TRAILS } from './world/paths.js'
import { Hints } from './menu/hints.js'
import { Pistenpass } from './menu/pistenpass.js'
import { PassRegeln } from './menu/pass-regeln.js'
import { Skier } from './player/skier.js'
import { TopCamera } from './player/top-camera.js'
import { DroneFlight } from './player/drone-flight.js'
import { Bestenliste } from './menu/bestenliste.js'
import { Spray } from './player/spray.js'
import { RohrpostNetz } from './world/rohrpost-netz.js'
import { Sommer } from './sommer/sommer.js'
import { Wildnis } from './world/tiere/wildnis.js'

const canvas = document.getElementById('scene')

// Ohne WebGL gibt es kein Tal. Dann uebernimmt die Linkliste aus index.html
// (menu/linkliste.js), und der Fehler bleibt in der Konsole stehen, wo man
// ihn beim Nachsehen braucht.
let renderer
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
} catch (e) {
  document.documentElement.classList.add('ohne-3d')
  throw e
}

// Auf dem Handy hoechstens 1,5: bei 3 (iPhone) rechnet die Grafik sonst
// viermal so viele Pixel wie bei 1,5, fuer einen Unterschied, den man auf
// sechs Zoll nicht sieht.
// Am Desktop hoechstens 4,2 Mio. Pixel: ein MacBook im Vollbild bei 2 sind
// 7,5 Mio., und ein Bild dauerte 18 ms – auf 120 Hz ruckelte es alle 1–2 s.
// Mit 1,5 sind es 4,2 Mio. und ~9 ms; mit Kantenglaettung sieht man es nicht.
const MAX_PIXELS = 4.2e6
function pixelRatio() {
  const budget = Math.sqrt(MAX_PIXELS / (window.innerWidth * window.innerHeight))
  return Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2, Math.max(1, budget))
}
function applyPixelRatio() {
  const r = pixelRatio()
  renderer.setPixelRatio(r)
  pointScale.value = r / Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2)
}
applyPixelRatio()
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
// PCF statt PCFSoft: r185 ersetzt PCFSoft beim Zeichnen ohnehin durch PCF
// und warnt dabei – das Bild war also schon PCF. Der Kabelsee muss dieselbe
// Art nehmen (siehe kabelsee/main.js).
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.setClearColor(COLORS.fog)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.4, 900)

const input = new Input(canvas)
const trail = new SnowTrail(renderer)
const world = new World(scene, trail.texture)
const sky = createSky(scene, renderer)
const stations = new StationRegistry()
// Der Rundflug steht vor der Welt, weil die Drohne ihn beim Aufbau schon
// kennen muss; seine Kamera bekommt er erst unten.
let flight = null
const props = populate(world, sky, stations, { rundflug: (drone) => { interaction.leave(); flight.start(drone) } })
const stationUI = new StationUI(document.body, camera)

const skier = new Skier(world)
skierRef.current = skier
scene.add(skier.group)

const chase = new TopCamera(camera)
const spray = new Spray()
scene.add(spray.points)
const goldstaub = new Spray({ max: 260, color: 0xf0a400 })
scene.add(goldstaub.points)

// Der Pistenpass: Abzeichen im Hintergrund, Reiter in der Uebersicht.
const pass = new Pistenpass()
pass.onGold = () => skier.vergolden()
if (pass.gold) skier.vergolden()

// Die Bestenliste haengt an der Zeitnahme: Marken holen, nach dem Ziel
// anbieten, im Reiter der Uebersicht zeigen.
const bestenliste = new Bestenliste()
props.race.onStart = () => bestenliste.start()
props.race.onFinish = (run) => bestenliste.ziel(run)
props.race.onAbort = () => bestenliste.abbruch()

const mapMenu = new MapMenu({ registry: stations, input, skier, world, camera: chase, pass, bestenliste, race: props.race })
flight = new DroneFlight({ camera, input, onEnd: () => chase.snap() })
const interaction = new StationInteraction({ registry: stations, ui: stationUI, input, camera: chase, skier, map: mapMenu, flight, bestenliste })
// Der Badesteg am Eissee fuehrt in den Sommer an den Kabelsee. Solange er
// laeuft (Countdown, Verwandlung, See), gehoeren ihm die Tasten des Tals.
const sommer = new Sommer({
  renderer, canvas, scene, camera, chase, skier, input, registry: stations, steg: props.badesteg, eis: props.lake, touch: TOUCH,
})
interaction.sommer = sommer
sommer.onAbzeichen = (id) => pass.erreiche(id)
mapMenu.kabelseeListe = sommer.liste
// Drei Meter vor dem Steg auf der Boeschung, Blick zur Spitze.
mapMenu.zumBadesteg = () => {
  const s = props.badesteg.stand
  mapMenu.travelTo({ x: s.x - Math.sin(s.heading) * 5.5, z: s.z - Math.cos(s.heading) * 5.5, heading: s.heading })
}
input.onAction = (action) => sommer.taste(action) || interaction.press(action)

// Die Rohrpost verschickt, wenn das Upload-Fenster zugeht: Kapseln in den
// Trichter, dann unter dem Schnee zum Funkmast. Das Fenster meldet sich per
// Ereignis, damit dialogs/upload.js nichts vom Tal wissen muss.
const rohrpost = new RohrpostNetz({
  pipe: props.rohrpost, tower: props.landscape.tower, world, camera: chase, input,
  quelle: stations.stations.find((s) => s.id === 'broadcast'), feed: props.broadcast,
})
interaction.rohrpost = rohrpost
addEventListener('rohrpost', (e) => rohrpost.versenden(e.detail))

// R und der Rueckweg-Hinweis: zurueck zum Startplatz, hinter derselben Blende
// wie die Schnellreise. Solange die Slalomzeit eingeblendet ist, geht es
// stattdessen an den Slalom-Start (race.zeitSichtbar).
const start = ORTE.find((o) => o.id === 'start')
const hints = new Hints({
  map: mapMenu, input, skier, world,
  onReset: () => {
    if (skier.tow) return
    interaction.leave()
    mapMenu.close()
    if (props.race.zeitSichtbar()) {
      props.race.abbrechen()
      mapMenu.zumSlalom()
    } else mapMenu.travelTo(start)
    hints.afterReset()
  },
})
const regeln = new PassRegeln(pass, { skier, props, stations, map: mapMenu, flight })
interaction.onReset = hints.onReset
mapMenu.onShow = () => hints.seen()

// Handymodus: Daumenstick, Sprungknopf und Zwei-Finger-Zoom. Ein Tipp in den
// Schnee klappt eine offene Auswahl wieder zu – das ist am Handy das Esc.
const touch = TOUCH
  ? new TouchControls(input, canvas, {
    camera: chase,
    skier,
    jumpVisible: () => inFunpark(skier.position.x, skier.position.z) || !!props.railRide.rider,
    onMap: () => interaction.press('map'),
    mapVisible: () => !mapMenu.open && !interaction.focus && !skier.tow && !flight.active,
  })
  : null
if (TOUCH) document.documentElement.classList.add('touch')
// Vor dem Horcher darunter, damit es noch sieht, ob eine Auswahl offen war.
new Antippen(canvas, camera, stations, {
  onUse: () => interaction.press('use'),
  darf: () => !interaction.focus && !mapMenu.open && !flight.active && !skier.tow && !sommer.aktiv,
})
canvas.addEventListener('pointerdown', () => {
  if (flight.active) flight.stop()
  if (rohrpost.aktiv) rohrpost.ueberspringen()
  interaction.leave()
})

// Seltene Tiere: Hase, Schneehuehner, Fuchs, Eichhoernchen, Dohle, Steinbock
// (world/tiere/). Sie stauben mit dem Schnee der Ski und stempeln in
// dieselbe Spurkarte.
const tiere = new Wildnis({ scene, trail, spray, camera, world, baeume: props.trees, stationen: stations, huette: props.huette, kreuz: props.kreuz, felsen: props.felsen })

const snowfall = createSnowfall()
scene.add(snowfall)

// Leuchtschleier auf den vier Wegen, siehe world/trail-glints.js.
const glints = createTrailGlints(Object.values(TRAILS))
scene.add(glints.points)

// --- Goldstaub ---------------------------------------------------------------
// Nur mit goldenen Ski (voller Pistenpass). Aus 33 Metern ist ein Brett nur
// ein paar Pixel breit; ein feiner Funkenschweif hinter den Enden sagt es
// auch dann, wenn man die Farbe kaum sieht.
// Normal gemischt und kraeftig gefaerbt: additiv wurde er auf Tagschnee weiss
// und war nicht mehr zu sehen, wie frueher die Leuchtschleier.
let goldAccum = 0
function emitGold(dt) {
  if (!skier.gold || skier.speed < 2) return
  goldAccum += (10 + skier.speed * 2.2) * dt
  while (goldAccum >= 1) {
    goldAccum -= 1
    const side = Math.random() < 0.5 ? -0.19 : 0.19
    const cos = Math.cos(skier.facing)
    const sin = Math.sin(skier.facing)
    goldstaub.emit(
      skier.position.x + cos * side - skier.forward.x * 0.8,
      skier.position.y + 0.08,
      skier.position.z - sin * side - skier.forward.z * 0.8,
      (Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.8,
      // Groesse 0,45–0,75: aus 33 m sind das 4–7 Pixel. Bei 0,16 waren es
      // zwei, und der Schweif war nicht da.
      0.45 + Math.random() * 0.3, 0.8 + Math.random() * 0.2,
    )
  }
}

// --- Schneestaub aus den Ski ------------------------------------------------
let sprayAccum = 0
function emitSpray(dt) {
  // Auf dem Holz einer Box staubt nichts.
  if (skier.airborne || skier._box || skier.speed < 1 || !isSnowSurface(skier.position.x, skier.position.z, 0.7)) {
    sprayAccum = 0
    return
  }
  // Der Pflug schiebt Schnee vor den Innenkanten her – bei Schritttempo kaum.
  const intensity = Math.abs(skier.turn) * 1.1 + (skier.speed / SKIER.boostSpeed) * 0.35 +
    skier.plough * Math.min(1, skier.speed / 6) * 1.4
  sprayAccum += intensity * 130 * dt
  const count = Math.floor(sprayAccum)
  sprayAccum -= count

  const cos = Math.cos(skier.facing)
  const sin = Math.sin(skier.facing)
  const back = 0.5
  for (let i = 0; i < count; i++) {
    const side = (Math.random() < 0.5 ? -1 : 1) * (0.16 + Math.random() * 0.3)
    const x = skier.position.x + cos * side - skier.forward.x * back
    const z = skier.position.z - sin * side - skier.forward.z * back
    const y = skier.position.y + 0.06
    const spd = skier.speed * (0.18 + Math.random() * 0.3)
    // Schnee spritzt nach hinten-aussen weg.
    const outX = cos * Math.sign(side)
    const outZ = -sin * Math.sign(side)
    spray.emit(
      x, y, z,
      -skier.forward.x * spd + outX * spd * 0.6 + (Math.random() - 0.5),
      1.2 + Math.random() * 2.4,
      -skier.forward.z * spd + outZ * spd * 0.6 + (Math.random() - 0.5),
      0.28 + Math.random() * 0.5,
      0.75 + Math.random() * 0.5,
    )
  }

  // Ein Schwall, wenn die Kanone einen erwischt – sonst wuerde man nur
  // merken, dass man weiss ist, aber nicht, wovon.
  if (skier.snowBurst > 0) {
    skier.snowBurst = 0
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 1.1
      spray.emit(
        skier.position.x + Math.cos(a) * r,
        skier.position.y + 0.4 + Math.random() * 1.4,
        skier.position.z + Math.sin(a) * r,
        Math.cos(a) * 2.2, 1.5 + Math.random() * 2.5, Math.sin(a) * 2.2,
        0.6 + Math.random() * 0.7, 1,
      )
    }
  }

  if (skier.landImpact > 0.25) {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.random() * 1.4
      spray.emit(
        skier.position.x + Math.cos(a) * r,
        skier.position.y + 0.1,
        skier.position.z + Math.sin(a) * r,
        Math.cos(a) * 3.5, 2.5 + Math.random() * 3, Math.sin(a) * 3.5,
        0.5 + Math.random() * 0.6, 1,
      )
    }
    chase.addShake(skier.landImpact * 0.7)
    skier.landImpact = 0
  }
}

// --- Trickmeldung ------------------------------------------------------------
const trickHud = document.createElement('div')
trickHud.className = 'frost trick-hud'
document.body.appendChild(trickHud)
let trickTimer = 0

// --- Loop --------------------------------------------------------------------
// Timer statt Clock (in r185 veraltet). update() ohne Zeitstempel misst wie
// Clock mit performance.now(): der rAF-Zeitstempel liegt vor dem Bildbeginn
// und koennte nach reset() ein negatives dt geben. Bewusst ohne connect():
// das setzt dt auf 0, solange document.hidden gilt – in eingebetteten
// Ansichten laeuft rAF aber auch dann (gemessen 217 Bilder in 1,5 s), und das
// Tal stuende still. Den Sprung nach dem Tabwechsel deckelt 1/24 s ohnehin.
const timer = new THREE.Timer()
let elapsed = 0

function advance(dt) {
  // Im Sommer steht das Tal still; es laeuft nur der See.
  if (sommer.imSommer) {
    sommer.advance(dt)
    return
  }
  elapsed += dt
  // Der Lift laeuft vor dem Fahrer: er gibt dessen Zielposition vor, wenn
  // dieser am Buegel haengt.
  props.lift.update(dt, skier, input)
  // Der Zauberteppich laeuft nach derselben Regel: er gibt die Zielposition
  // vor, solange jemand darauf steht.
  props.kinderland.update(dt, skier, input)
  // Und die Rail im Funpark – dieselbe Mechanik, nur abwaerts und schneller.
  props.railRide.update(dt, skier, input)
  touch?.update()
  skier.update(dt, input, trail)
  props.lift.spannen(skier)
  emitSpray(dt)
  spray.update(dt)
  emitGold(dt)
  goldstaub.update(dt)
  // Die Nordabfahrt entscheidet vor der Kamera, ob sie hinter den Fahrer geht.
  // Sie muss nach skier.update() laufen, sonst urteilt sie ueber die Position
  // des vorigen Bildes – und am Tor waere das genau ein Bild zu spaet.
  // update() laeuft auch ohne Verfolger weiter: der Pistenpass liest daraus,
  // ob die Nordabfahrt bis unten gefahren wurde.
  const aufNord = props.northRun.update(dt, skier)
  chase.verfolgen(CHASE.an && aufNord)
  // Im Rundflug gehoert die Kamera der Drohne; die feste Kamera wartet und
  // springt nach der Landung ohne Anfahrt zurueck (snap).
  if (flight.active) flight.update(dt)
  else chase.update(dt, skier, input)

  // Schattenkamera dem Fahrer nachfuehren, damit die Aufloesung dort liegt,
  // wo man hinschaut – im Rundflug also dorthin, wo die Drohne hinsieht.
  const blick = flight.active ? flight.look : skier.position
  sky.sun.target.position.copy(blick)
  sky.sun.position.copy(sky.sunDir).multiplyScalar(90).add(blick)
  const mitte = flight.active ? camera.position : skier.position
  sky.dome.position.set(mitte.x, 0, mitte.z)

  // Trickmeldung: der Fahrer legt sie ab, sobald eine Figur steht.
  if (skier.trick) {
    regeln.trick(skier.trick.text)
    trickHud.textContent = skier.trick.text
    trickHud.classList.add('visible')
    trickTimer = 1.1
    skier.trick = null
  } else if (trickTimer > 0) {
    trickTimer -= dt
    if (trickTimer <= 0) trickHud.classList.remove('visible')
  }

  // Rennstrecke: Zeitnahme laeuft mit, ohne dass man etwas starten muesste.
  props.race.update(dt, skier)
  // Die Weite an der Klammschanze, ebenfalls ohne Startknopf.
  props.klammSprung.update(dt, skier)
  bestenliste.update(dt)
  // Dasselbe auf der freien Abfahrt, nur eine Zahl statt einer Uhr.
  props.speedCheck.update(dt, skier)

  // Stationen: Naehe pruefen, Hinweis nachfuehren, Objekte animieren.
  // Ausgeloest wird nicht hier, sondern im Tastenereignis selbst – siehe
  // stations/interaction.js, warum.
  stations.update(dt, skier)
  interaction.update()
  rohrpost.update(dt)
  // Neue Tiere nur beim freien Fahren; wer schon da ist, lebt weiter.
  tiere.update(dt, skier, !flight.active && !interaction.focus && !mapMenu.open && !sommer.aktiv)
  sommer.update(dt)
  hints.update(dt)
  regeln.update(dt)
  // dt kommt mit, weil inzwischen nicht mehr alles eine Funktion der Uhrzeit
  // ist – umgestossene Fackeln richten sich ueber eine Dauer wieder auf.
  for (const animate of props.animated) animate(elapsed, dt)
  // Das Kinderland braucht dt aus demselben Grund: Wackeln und Umfallen sind
  // Ausschwingvorgaenge, keine Funktionen der Uhrzeit.
  props.kinderland.animate(elapsed, dt)

  snowfall.userData.update(dt, elapsed, flight.active ? camera.position : skier.position)
  glints.update(dt, elapsed, camera, renderer,
    Math.hypot(skier.position.x - PLATEAU.x, skier.position.z - PLATEAU.z) < 20)
  props.lake.update(camera)
  sky.update(elapsed)
  trail.flush()
  input.endFrame()
}

function draw() {
  if (sommer.draw()) return
  renderer.setRenderTarget(null)
  renderer.render(scene, camera)
}

function tick() {
  advance(Math.min(timer.update().getDelta(), 1 / 24))
  draw()
  requestAnimationFrame(tick)
}

// Debug-Zugriff aus der Konsole – hilft beim Justieren des Fahrgefuehls.
window.__ski = {
  skier, world, camera, renderer, scene, trail, props, sky, input, chase, stations, interaction, mapMenu, hints, glints, pass, regeln, goldstaub, flight, bestenliste, sommer, tiere,
  // Erlaubt es, die Welt ohne laufenden rAF-Loop vorzuspulen (Tests, Screenshots).
  step(frames = 1, dt = 1 / 60) {
    for (let i = 0; i < frames; i++) advance(dt)
    draw()
    return skier.position.toArray().map((v) => +v.toFixed(2))
  },
  // Stellt den Fahrer vor eine Station.
  goto(id, dx = 2.5, dz = 2.5) {
    const s = stations.stations.find((st) => st.id === id)
    if (!s) return null
    skier.versetzen(s.position.x + dx, s.position.z + dz)
    return this.step(30)
  },
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  applyPixelRatio()
  renderer.setSize(window.innerWidth, window.innerHeight)
  sommer.resize()
})

// Die Schrift im Schnee wird einmalig eingestempelt und bleibt dann liegen.
writeIntro(trail, { touch: TOUCH })

// Wildspuren auf der Rueckseite. Zwei queren die Nordabfahrt, eine zieht unten
// am Grat entlang. Sie stehen hier und nicht in populate, weil sie in den
// Schnee gestempelt werden und nicht in die Szene gestellt – und die Spurkarte
// gehoert dem Hauptmodul.
for (const [von, nach] of [
  [[-28, -70], [-16, -89]],
  [[-4, -65], [-15, -83]],
  [[-38, -99], [-52, -91]],
]) stampTrack(trail, von, nach)

// Ein Frame vorrendern, damit beim Einblenden nichts ruckelt.
renderer.compile(scene, camera)
requestAnimationFrame(() => {
  document.getElementById('loader')?.classList.add('gone')
  timer.reset()
  tick()
})
