import * as THREE from 'three'
import './style.css'

import { CAMERA, COLORS, SKIER } from './config.js'
import { Input } from './core/input.js'
import { SnowTrail } from './world/snow-trail.js'
import { World } from './world/world.js'
import { createSky } from './world/sky.js'
import { createSnowfall } from './world/weather.js'
import { writeIntro } from './world/snow-writing.js'
import { populate, skierRef } from './world/populate.js'
import { StationRegistry } from './stations/registry.js'
import { StationUI } from './stations/ui.js'
import { Skier } from './player/skier.js'
import { TopCamera } from './player/top-camera.js'
import { Spray } from './player/spray.js'

const canvas = document.getElementById('scene')

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
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
const props = populate(world, sky, stations)
const stationUI = new StationUI(document.body, camera)

const skier = new Skier(world)
skierRef.current = skier
scene.add(skier.group)

const chase = new TopCamera(camera)
const spray = new Spray()
scene.add(spray.points)

const snowfall = createSnowfall()
scene.add(snowfall)

// --- Schneestaub aus den Ski ------------------------------------------------
let sprayAccum = 0
function emitSpray(dt) {
  if (skier.airborne || skier.speed < 1) return
  const intensity = skier.carving * 1.6 + Math.abs(skier.turn) * 1.1 + (skier.speed / SKIER.boostSpeed) * 0.35
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
      1.2 + Math.random() * 2.4 + skier.carving * 2.2,
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
trickHud.className = 'trick-hud'
document.body.appendChild(trickHud)
let trickTimer = 0

// --- Loop --------------------------------------------------------------------
const clock = new THREE.Clock()
let elapsed = 0

function advance(dt) {
  elapsed += dt
  // Der Lift laeuft vor dem Fahrer: er gibt dessen Zielposition vor, wenn
  // dieser am Buegel haengt.
  props.lift.update(dt, skier, input)
  // Der Zauberteppich laeuft nach derselben Regel: er gibt die Zielposition
  // vor, solange jemand darauf steht.
  props.kinderland.update(dt, skier, input)
  skier.update(dt, input, trail)
  emitSpray(dt)
  spray.update(dt)
  chase.update(dt, skier, input)

  // Schattenkamera dem Fahrer nachfuehren, damit die Aufloesung dort liegt,
  // wo man hinschaut.
  sky.sun.target.position.copy(skier.position)
  sky.sun.position.copy(sky.sunDir).multiplyScalar(90).add(skier.position)
  sky.dome.position.set(skier.position.x, 0, skier.position.z)

  // Trickmeldung: der Fahrer legt sie ab, sobald eine Figur steht.
  if (skier.trick) {
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

  // Stationen: Naehe pruefen, Hinweis nachfuehren, Objekte animieren.
  stations.update(dt, skier)
  stationUI.update(stations.active)
  if (input.justPressed('use') && stations.active) {
    stations.trigger()
    stationUI.flash()
  }
  for (const animate of props.animated) animate(elapsed)
  // Das Kinderland braucht zusaetzlich dt: Wackeln und Umfallen sind
  // Ausschwingvorgaenge, keine Funktionen der Uhrzeit.
  props.kinderland.animate(elapsed, dt)

  snowfall.userData.update(dt, elapsed, skier.position)
  props.lake.update(camera)
  sky.update(elapsed)
  trail.flush()
  input.endFrame()
}

function draw() {
  renderer.render(scene, camera)
}

function tick() {
  advance(Math.min(clock.getDelta(), 1 / 24))
  draw()
  requestAnimationFrame(tick)
}

// Debug-Zugriff aus der Konsole – hilft beim Justieren des Fahrgefuehls.
window.__ski = {
  skier, world, camera, renderer, scene, trail, props, sky, input, chase, stations,
  // Erlaubt es, die Welt ohne laufenden rAF-Loop vorzuspulen (Tests, Screenshots).
  step(frames = 1, dt = 1 / 60) {
    for (let i = 0; i < frames; i++) advance(dt)
    draw()
    return skier.position.toArray().map((v) => +v.toFixed(2))
  },
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Die Schrift im Schnee wird einmalig eingestempelt und bleibt dann liegen.
writeIntro(trail)

// Ein Frame vorrendern, damit beim Einblenden nichts ruckelt.
renderer.compile(scene, camera)
requestAnimationFrame(() => {
  document.getElementById('loader')?.classList.add('gone')
  clock.getDelta()
  tick()
})
