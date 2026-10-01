import * as THREE from 'three'
import '../basis.css'
import '../menu/bestenliste.css'
import '../dialogs/dialogs.css'

import { TOUCH } from '../core/device.js'
import { pointScale } from '../core/point-scale.js'
import { COLORS } from './config.js'
import { createKabelsee, TITLE_VIEW } from './see.js'
import { KabelseeListe } from './bestenliste.js'
import { abzeichenVermerken } from '../menu/pistenpass.js'

// Der Kabelsee allein, unter veerka.mp/kabelsee/: eigener Renderer, Titel
// als Menue (losfahren, Bestenliste, ins Skital), eigene Schleife. Im Tal
// laeuft derselbe See ohne all das, siehe src/sommer/. Bestenliste und
// Pistenpass sind dieselben wie im Tal – gleiche Adresse, gleicher Speicher.

const canvas = document.getElementById('scene')

let renderer
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
} catch (e) {
  document.documentElement.classList.add('ohne-3d')
  throw e
}

// Pixelbudget wie im Skital: am Handy hoechstens 1,5, am Desktop hoechstens
// 4,2 Mio. Pixel – darueber kostet es Bilder, ohne dass man es sieht.
const MAX_PIXELS = 4.2e6
function applyPixelRatio() {
  const budget = Math.sqrt(MAX_PIXELS / (window.innerWidth * window.innerHeight))
  const r = Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2, Math.max(1, budget))
  renderer.setPixelRatio(r)
  pointScale.value = r / Math.min(window.devicePixelRatio, TOUCH ? 1.5 : 2)
}
applyPixelRatio()
renderer.setSize(window.innerWidth, window.innerHeight)
// Dieselben Schatten wie im Tal: im eingebetteten See zeichnet derselbe
// Renderer, und ein Wechsel der Schattenart haette jedes Material neu
// uebersetzt.
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.05
renderer.setClearColor(COLORS.fog)

if (TOUCH) document.documentElement.classList.add('touch')
const see = await createKabelsee({
  renderer, canvas, touch: TOUCH,
  liste: new KabelseeListe(),
  onAbzeichen: abzeichenVermerken,
})

// Bildzeit aus performance.now(); THREE.Clock gilt als veraltet.
let last = performance.now()
function tick(now = performance.now()) {
  const dt = Math.max(0, (now - last) / 1000)
  last = now
  see.advance(Math.min(dt, 1 / 20))
  see.draw()
  requestAnimationFrame(tick)
}

window.addEventListener('resize', () => {
  see.resize()
  applyPixelRatio()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Zugriff aus der Konsole und fuer die Bilder im README: die Welt ohne
// laufende Schleife vorspulen und Tasten druecken.
window.__kabel = {
  ...see,
  step(frames = 1, dt = 1 / 60, render = true) {
    for (let i = 0; i < frames; i++) see.advance(dt)
    if (render) see.draw()
    return [see.rider.x, see.rider.y, see.rider.z].map((v) => +v.toFixed(2))
  },
  keys(list = []) {
    see.input.keys.clear()
    for (const k of list) see.input.keys.add(k)
  },
  release(k) {
    see.input.keys.delete(k)
    see.input.released.add(k)
  },
}

renderer.compile(see.scene, see.camera)
see.chase.update(0, see.rider, { focus: 1, showcase: TITLE_VIEW })
requestAnimationFrame(() => {
  document.getElementById('loader')?.classList.add('gone')
  last = performance.now()
  tick(last)
})
