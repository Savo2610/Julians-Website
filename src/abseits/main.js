import * as THREE from 'three'
import '../basis.css'
import './abseits.css'
import { CAMERA, COLORS } from '../config.js'
import { TOUCH } from '../core/device.js'
import { pointScale } from '../core/point-scale.js'
import { createSky } from '../world/sky.js'
import { createSnowfall } from '../world/weather.js'
import { Spray } from '../player/spray.js'
import { createBoden, createLoch, createNetz, createWald, hoehe, Spur, spurKurve, welt } from './gelaende.js'
import { Fahrer } from './fahrer.js'

// Die 404-Seite: abseits der Piste steckt einer kopfueber im Tiefschnee.
// Ein Klick graebt ihn aus, er schuettelt sich und faehrt ins Tal; ein
// zweiter, waehrend er noch dasteht, erschreckt ihn zurueck ins Loch. Nach
// einer Weile kommt er die alte Spur wieder herunter und landet, wo er
// herkam.
//
// Eine eigene, schlanke Seite: kein Hoehenfeld und keine Stationen des
// Tals, nur three.js, der Fahrer, Himmel, Tannen und Schneestaub. Ohne
// WebGL oder JavaScript bleibt der Text aus 404.html mit dem Link stehen.

const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

// Die Adresse, die es nicht gibt, steht im Satz. Unter /404.html selbst
// (lokal beim Pruefen) bleibt es bei „Diese Seite“.
const pfadEl = document.getElementById('pfad')
if (!/\/404(\.html)?$/.test(location.pathname)) {
  let pfad = location.pathname
  try { pfad = decodeURIComponent(pfad) } catch {}
  if (pfad.length > 42) pfad = pfad.slice(0, 41) + '…'
  pfadEl.textContent = `„${pfad}“`
}

const canvas = document.getElementById('scene')
// Wirft ohne WebGL; dann bleibt die Seite, wie sie im HTML steht.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
document.documentElement.classList.add('mit-3d')

// Wie im Tal: am Handy hoechstens 1,5, am Rechner hoechstens 4,2 Mio. Pixel.
function pixelRatio() {
  const budget = Math.sqrt(4.2e6 / (window.innerWidth * window.innerHeight))
  return Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2, Math.max(1, budget))
}
renderer.setPixelRatio(pixelRatio())
pointScale.value = renderer.getPixelRatio() / Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.setClearColor(COLORS.fog)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(CAMERA.fov, window.innerWidth / window.innerHeight, 0.4, 900)
const sky = createSky(scene, renderer)

scene.add(createBoden())
createWald(scene)
const netz = createNetz()
scene.add(netz.group)
scene.add(createLoch())

const alteSpur = new Spur()
for (const p of spurKurve()) alteSpur.punkt(p.x, p.z)
scene.add(alteSpur.mesh)

const spray = new Spray()
scene.add(spray.points)
const flocken = ruhig ? null : createSnowfall()
if (flocken) scene.add(flocken)

// Frische Spuren vom Wegfahren; die vierte nimmt die aelteste mit.
const spuren = []
function neueSpur() {
  const s = new Spur(600)
  scene.add(s.mesh)
  spuren.push(s)
  if (spuren.length > 3) {
    const alt = spuren.shift()
    scene.remove(alt.mesh)
    alt.geo.dispose()
  }
  return s
}

// --- Hinweise --------------------------------------------------------------
// Frosttext ueber dem Link, geht von selbst wieder.
const hinweis = document.getElementById('hinweis')
let hinweisBis = 0
function zeige(html, dauer) {
  hinweis.innerHTML = html
  hinweis.classList.add('an')
  hinweisBis = zeit + dauer
}
const ausgraben = TOUCH ? 'Antippen zum Ausgraben' : 'Klicken oder <kbd>Leertaste</kbd> zum Ausgraben'
let geholfen = false
let wiederda = false

const fahrer = new Fahrer({
  staub: (...a) => spray.emit(...a),
  neueSpur,
  ruhig,
  melden(zustand) {
    if (zustand === 'raus') { geholfen = true; hinweisBis = 0 }
    if (zustand === 'fort') zeige('Er ist schon mal vorgefahren.', 3.2)
    if (zustand === 'kommt') wiederda = true
  },
})
scene.add(fahrer.group)
let wackeln = 0
fahrer.einschlag = () => {
  wackeln = 0.3
  if (wiederda) zeige('… oder auch nicht.', 2.6)
}

// Den Helm hat es ihm am Netz vom Kopf gerissen, die Stoecke liegen im Schnee.
fahrer.helm.position.copy(netz.helmPlatz).add(new THREE.Vector3(0, -0.16, 0))
fahrer.helm.rotation.set(0.5, Math.PI * 0.25, 0.25)
scene.add(fahrer.helm)
const [steckt, liegt] = fahrer.stoecke
let p = welt(-1.3, 2.0)
steckt.position.set(p.x, hoehe(p.x, p.z) + 0.3, p.z)
steckt.rotation.set(0.45, 0.4, -0.4)
p = welt(3.0, -1.7)
liegt.position.set(p.x, hoehe(p.x, p.z) + 0.03, p.z)
liegt.rotation.set(0, 0.9, Math.PI / 2 + 0.12)
for (const o of [fahrer.helm, steckt, liegt]) {
  o.traverse((m) => { if (m.isMesh) m.castShadow = true })
  scene.add(o)
}

// --- Kamera ------------------------------------------------------------------
// Dieselbe wie im Tal: Azimut und Hoehe fest, nur naeher dran. Im Hochformat
// geht sie so weit zurueck, dass gut neun Meter in die Breite passen.
const blick = new THREE.Vector3(
  Math.cos(CAMERA.elevation) * Math.sin(CAMERA.azimuth),
  Math.sin(CAMERA.elevation),
  Math.cos(CAMERA.elevation) * Math.cos(CAMERA.azimuth),
)
p = welt(0, 0.3)
const ruhe = new THREE.Vector3(p.x, hoehe(p.x, p.z), p.z)
const ziel = ruhe.clone()
const soll = new THREE.Vector3()
const breite = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA.fov / 2))
const abstand = () => Math.max(14, 8.5 / (breite * camera.aspect))

function kamera(dt) {
  soll.copy(ruhe)
  // Faehrt er, geht der Blick ein Stueck mit – ohne Schwenk, nur verschoben.
  if (fahrer.group.visible && ['weg', 'kommt', 'fliegt'].includes(fahrer.zustand)) {
    soll.addScaledVector(fahrer.position.clone().sub(ruhe).setY(0), 0.3)
    if (soll.distanceTo(ruhe) > 5) soll.sub(ruhe).setLength(5).add(ruhe)
  }
  ziel.lerp(soll, 1 - Math.exp(-1.6 * dt))
  camera.position.copy(ziel).addScaledVector(blick, abstand())
  if (wackeln > 0) {
    wackeln = Math.max(0, wackeln - dt)
    camera.position.x += (Math.random() - 0.5) * wackeln
    camera.position.y += (Math.random() - 0.5) * wackeln
  }
  camera.lookAt(ziel.x, ziel.y + CAMERA.lookHeight, ziel.z)
}

// --- Eingabe -----------------------------------------------------------------
canvas.addEventListener('pointerdown', (e) => {
  if (e.button === 0 && !ruhig) fahrer.aktion()
})
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || ruhig) return
  e.preventDefault()
  fahrer.aktion()
})

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setPixelRatio(pixelRatio())
  renderer.setSize(window.innerWidth, window.innerHeight)
  if (ruhig) { kamera(1); renderer.render(scene, camera) }
})

// --- Schleife ----------------------------------------------------------------
const uhr = new THREE.Clock()
let zeit = 0
function schritt(dt) {
  zeit += dt
  fahrer.update(dt)
  spray.update(dt)
  flocken?.userData.update(dt, zeit, ziel)
  sky.update(zeit)
  kamera(dt)
  if (!geholfen && zeit > 5 && fahrer.zustand === 'steckt' && !hinweis.classList.contains('an')) zeige(ausgraben, 7)
  if (hinweisBis && zeit > hinweisBis) { hinweis.classList.remove('an'); hinweisBis = 0 }
  if (!hinweisBis) hinweis.classList.remove('an')
}

if (ruhig) {
  kamera(1)
  renderer.render(scene, camera)
} else {
  renderer.setAnimationLoop(() => {
    schritt(Math.min(0.05, uhr.getDelta()))
    renderer.render(scene, camera)
  })
}
requestAnimationFrame(() => canvas.classList.add('da'))

// Zum Pruefen im Browser, wie __ski im Tal.
window.__abseits = {
  fahrer,
  step(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) schritt(dt)
    renderer.render(scene, camera)
  },
  // Haelt die eigene Schleife an, damit nur noch step() die Zeit macht.
  anhalten() { renderer.setAnimationLoop(null) },
}
