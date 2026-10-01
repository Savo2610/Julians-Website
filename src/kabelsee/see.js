import * as THREE from 'three'
import './kabelsee.css'

import { RIDER } from './config.js'
import { Input } from './core/input.js'
import { TouchControls } from './core/touch.js'
import { createSky } from './world/sky.js'
import { createTerrain } from './world/terrain.js'
import { Wake } from './world/wake.js'
import { createWater } from './world/water.js'
import { populate } from './world/populate.js'
import { createCableway, handleGeometry } from './props/cableway.js'
import { createObstacles, createCollectibles } from './props/obstacles.js'
import { CableSystem } from './game/cable-system.js'
import { RiderPhysics } from './player/rider-physics.js'
import { createRiderModel, poseRider, ropeAnchor } from './player/rider-model.js'
import { TopCamera } from './player/camera.js'
import { Spray } from './player/spray.js'
import { Hud } from './game/hud.js'
import { Session } from './game/session.js'
import { vertexColorMaterial } from '../core/geometry.js'
import { FEATURES } from './world/features.js'

// Der Kabelsee als Baustein: Szene, Kamera, Fahrer, Anzeige und Schleife,
// aber kein eigener Renderer. So laeuft er zweimal mit demselben Code –
// allein unter /kabelsee/ (main.js) und im Tal, wo er hinter dem Badesteg
// nachgeladen wird und im Renderer des Tals zeichnet (src/sommer/). Ein
// zweiter WebGL-Kontext waere am Handy schnell einer zu viel.
//
// eingebettet: kein Titel, die Session beginnt am Steg, Esc fuehrt zurueck
// in den Winter (onZurueck), und die Tasten hoeren nur zu, solange der See
// aktiv ist. pause: siehe core/zeitscheiben.js – im Tal baut sich der See
// in Scheiben, allein am Stueck.

export const TITLE_VIEW = { x: 30, y: 1, z: -70, distance: 46 }
const STEP = 1 / 120

export async function createKabelsee({ renderer, canvas, touch = false, eingebettet = false, onZurueck = null, onErgebnis = null, onStart = null, onListe = null, pause = null }) {
  const weiter = pause ?? (() => null)
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.4, 900)

  const sky = createSky(scene, renderer)
  // Sommerdunst: etwas duenner als der Winterdunst im Tal.
  scene.fog.density = 0.0042
  await createTerrain(scene, { pause })
  const wake = new Wake()
  const water = createWater(scene, { wake, sky })
  await weiter()
  const world = populate(scene)
  await weiter()
  createObstacles(scene)
  const items = createCollectibles(scene)

  const cable = new CableSystem()
  const cableway = createCableway(scene, cable)
  const rider = new RiderPhysics(cable)
  const model = createRiderModel(handleGeometry(), vertexColorMaterial({ roughness: 0.5 }))
  model.traverse((o) => { if (o.isMesh) o.castShadow = true })
  scene.add(model)

  const chase = new TopCamera(camera)
  const spray = new Spray({ max: 1400, color: 0xf4fbff })
  scene.add(spray.points)
  const sparkle = new Spray({ max: 200, color: 0xf6c24a })
  scene.add(sparkle.points)

  const input = new Input(canvas)
  // Im Tal gehoeren die Tasten dem See nur, solange er da ist.
  input.aktiv = !eingebettet
  const root = document.createElement('div')
  root.className = 'kabelsee-hud'
  root.dataset.mode = 'title'
  document.body.appendChild(root)
  const hud = new Hud(root, { touch, eingebettet })

  // --- Effekte ---------------------------------------------------------------
  function burst(x, y, z, n, speed, up, size = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.4 + Math.random() * 0.6)
      spray.emit(x + Math.cos(a) * 0.4, y, z + Math.sin(a) * 0.4, Math.cos(a) * s, up * (0.5 + Math.random()), Math.sin(a) * s, size * (0.6 + Math.random() * 0.8), 0.8 + Math.random() * 0.3)
    }
  }

  const fx = {
    snapCamera: () => chase.snap(),
    hook: () => {},
    start: () => {
      chase.addShake(0.35)
      burst(rider.x, 0.2, rider.z, 30, 3, 3)
    },
    launch: () => {},
    land: (e) => {
      const k = Math.min(1.5, e.impact / 8)
      burst(rider.x, 0.1, rider.z, Math.round(20 + 40 * k), 4 * k + 1.5, 3 + 3 * k)
      wake.splash(rider.x, rider.z, 0.6 + k * 0.6)
      chase.addShake(0.12 + k * 0.35)
    },
    crash: (e) => {
      burst(e.x, 0.3, e.z, 90, 5, 6, 0.9)
      wake.splash(e.x, e.z, 1.6)
      chase.addShake(0.8)
    },
    collect: (it) => {
      const y = it.kind === 'ring' ? it.y : 0.6
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2
        const up = Math.random() * 2 - 0.3
        sparkle.emit(it.x, y, it.z, Math.cos(a) * 2.2, 1.5 + up * 2, Math.sin(a) * 2.2, 0.5 + Math.random() * 0.4, 1)
      }
      if (it.kind === 'buoy') wake.splash(it.x, it.z, 0.5)
    },
    glance: (e) => {
      burst(e.x, 0.2, e.z, 24, 3, 2.5, 0.6)
      chase.addShake(0.25)
    },
    gate: (g) => {
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2
        sparkle.emit(g.x, 4.2, g.z, Math.cos(a) * 1.6, 1 + Math.random() * 1.5, Math.sin(a) * 1.6, 0.45 + Math.random() * 0.3, 0.9)
      }
    },
  }

  const session = new Session({ rider, cable, collectibles: items, hud, fx, eingebettet, onErgebnis, onStart })

  const zurueck = () => { if (input.aktiv) onZurueck?.() }
  input.onAction = (a) => {
    if (a === 'confirm') session.confirm()
    if (a === 'reset') session.restart()
    if (a === 'back' && eingebettet) zurueck()
    if (a === 'liste' && session.state === 'results') return !!onListe?.()
    return false
  }
  hud.titleGo.addEventListener('click', () => session.confirm())
  hud.resultsGo.addEventListener('click', () => session.confirm())
  hud.resultsBack?.addEventListener('click', zurueck)
  hud.resultsListe?.addEventListener('click', () => onListe?.())
  hud.winter?.addEventListener('click', zurueck)
  if (touch) new TouchControls(input, canvas, { root, onTap: () => { if (input.aktiv && session.state !== 'play') session.confirm() } })

  // --- Gischt -------------------------------------------------------------------
  // Hinter den Ski spritzt es nach aussen, beim Kanten als Faecher. Die
  // Menge haengt an Tempo und Kantenwinkel: auf der Geraden ein Schleier, im
  // Schwung eine Wand.
  let sprayAcc = 0
  function emitSpray(dt) {
    if (rider.airborne || rider.mode !== 'ride' || rider.speed < 3 || rider.y > 0.05) {
      sprayAcc = 0
      return
    }
    const edge = Math.min(1, Math.abs(rider.edge) / 0.8)
    const intensity = 0.4 + edge * 1.8 + (rider.speed / RIDER.maxSpeed) * 0.8
    sprayAcc += intensity * 90 * dt
    const n = Math.floor(sprayAcc)
    sprayAcc -= n
    const fx_ = Math.sin(rider.heading)
    const fz_ = Math.cos(rider.heading)
    // Die Gischt fliegt zur Aussenseite des Schwungs.
    const out = rider.edge > 0 ? -1 : 1
    for (let i = 0; i < n; i++) {
      const side = (Math.random() < 0.5 ? -1 : 1) * (0.1 + Math.random() * 0.25)
      const x = rider.x - fz_ * side * -1 - fx_ * 0.55
      const z = rider.z + fx_ * side * -1 - fz_ * 0.55
      const sp = rider.speed * (0.12 + Math.random() * 0.25)
      const lat = edge * rider.speed * (0.25 + Math.random() * 0.35) * out
      spray.emit(
        x, 0.05, z,
        -fx_ * sp + fz_ * lat + (Math.random() - 0.5), 1.4 + Math.random() * 2.2 + edge * 2.5, -fz_ * sp - fx_ * lat + (Math.random() - 0.5),
        0.3 + Math.random() * 0.45 + edge * 0.3, 0.7 + Math.random() * 0.4,
      )
    }
  }

  // --- Schleife ---------------------------------------------------------------
  let elapsed = 0
  const hand = new THREE.Vector3()

  function advance(dt) {
    elapsed += dt
    const inp = input.sample()
    const playing = session.state === 'play'
    if (!playing) {
      inp.steer = 0
      inp.jump = inp.jumpReleased = inp.throttle = inp.brake = inp.grab = false
    }
    // Feste Teilschritte: das Seil ist eine steife Feder, und bei 30 Bildern
    // je Sekunde schwang sie sonst auf.
    let left = dt
    let first = true
    while (left > 1e-6) {
      const h = Math.min(STEP, left)
      // Im Titel faehrt die Anlage leer, der Fahrer wartet am Steg und haengt
      // sich erst nach Enter ein.
      if (playing || rider.mode !== 'dock') rider.update(h, first ? inp : { ...inp, jumpReleased: false })
      cable.update(h)
      first = false
      left -= h
    }
    session.update(dt)

    poseRider(model, rider, dt, elapsed)
    model.updateMatrixWorld(true)
    ropeAnchor(model, hand)
    cableway.update(elapsed, rider, hand)

    emitSpray(dt)
    spray.update(dt)
    sparkle.update(dt)
    items.update(elapsed, dt)
    if (rider.mode === 'ride' && !rider.airborne && rider.y < 0.05) {
      wake.add(dt, rider.x, rider.z, Math.sin(rider.heading), Math.cos(rider.heading), Math.min(1, rider.speed / 12))
    }
    wake.update(dt)
    water.update(elapsed, rider)
    for (const f of world.animated) f(elapsed, dt)

    const focus = rider.mode === 'dock' ? 1 : 0
    // Im Titel ein ruhiger Blick auf Station und Steg, danach zum Fahrer.
    const showcase = session.state === 'title' ? TITLE_VIEW : null
    chase.update(dt, rider, { focus, zoom: input.zoom, showcase })

    // Schattenkamera dem Fahrer nachfuehren.
    const at = chase.target
    sky.sun.target.position.copy(at)
    sky.sun.position.copy(sky.sunDir).multiplyScalar(90).add(at)
    sky.dome.position.set(camera.position.x, 0, camera.position.z)
    sky.update(elapsed)
    input.endFrame()
  }

  // Ziel null zeichnet ins Bild, sonst in die Flaeche der Verwandlung.
  function draw(target = null) {
    wake.paint()
    renderer.setRenderTarget(target)
    renderer.render(scene, camera)
  }

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }

  return {
    scene, camera, renderer, rider, cable, session, input, chase, items, wake, water, hud, sky, root, FEATURES,
    advance, draw, resize,
    // Im Tal: Tasten an, Anzeige sichtbar, Session sofort am Steg. Der
    // Buegel kommt nach `ankunft` Sekunden – der Countdown lief schon am
    // Badesteg, hier soll man nicht noch einmal warten.
    betreten({ ankunft = 1.4 } = {}) {
      input.aktiv = true
      input.keys.clear()
      root.hidden = false
      // Auch mitten aus einer Session heraus (Esc, spaeter wieder hin).
      session.starten({ ankunft })
      chase.snap(1)
      chase.update(0, rider, { focus: 1 })
    },
    verlassen() {
      input.aktiv = false
      input.keys.clear()
      root.hidden = true
    },
    // Ein Bild aus derselben Richtung wie die Spielkamera, nur weit weg: der
    // ganze See auf einen Blick. Nur fuer Bilder; im Spiel gibt es das nicht.
    overview(distance = 230, x = 0, z = 4) {
      const el = 0.63
      const az = Math.PI * 0.25
      camera.position.set(x + Math.cos(el) * Math.sin(az) * distance, Math.sin(el) * distance, z + Math.cos(el) * Math.cos(az) * distance)
      camera.lookAt(x, 0, z)
      sky.sun.target.position.set(x, 0, z)
      sky.sun.position.copy(sky.sunDir).multiplyScalar(160).add(sky.sun.target.position)
      const cam = sky.sun.shadow.camera
      const keep = [cam.left, cam.right, cam.top, cam.bottom, cam.far]
      cam.left = cam.bottom = -150
      cam.right = cam.top = 150
      cam.far = 400
      cam.updateProjectionMatrix()
      // Aus 230 m laege sonst ein Schleier ueber allem.
      const fog = scene.fog.density
      scene.fog.density = fog * 0.35
      water.mesh.material.uniforms.uFogDensity.value = scene.fog.density
      draw()
      scene.fog.density = fog
      water.mesh.material.uniforms.uFogDensity.value = fog
      ;[cam.left, cam.right, cam.top, cam.bottom, cam.far] = keep
      cam.updateProjectionMatrix()
    },
  }
}
