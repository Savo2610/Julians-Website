import * as THREE from 'three'
import { terrainHeight } from '../world/heightfield.js'
import { TOUCH } from '../core/device.js'

// Der Rundflug der Drohne: einmal ums Tal, aus ihrer Sicht.
//
// Das ist die zweite Ausnahme von der festen Kamera, und sie ist auf Ansage
// gebaut (26.09.). Sie bleibt heil, weil in dieser Zeit niemand steuert: der
// Fahrer steht an der Drohne, WASD tut nichts, und es gibt keine Taste, deren
// Bedeutung sich mit dem Bild dreht. Esc oder Enter holen einen zurueck.
//
// Die Bahn ist von Hand gesetzt und nicht aus Orten errechnet: ein Flug ist
// eine Folge von Einstellungen – ueber das Kinderland aufs Plateau, am
// Loeschzug und See vorbei, die Werkzeuge von Westen, hinauf zum Gipfel,
// hinter den Berg auf die Nordabfahrt, ueber Huette und Funpark zurueck.
// Jeder Punkt traegt, wohin die Drohne dort schaut; das ist der Grund fuer
// die neuen Blickwinkel – aus der festen Kamera sieht man das Tal nur von
// Suedosten.
//
// [x, z, Hoehe ueber NN, Blick x, Blick z, Blick Hoehe]
const BAHN = [
  [51, 20, null, 30, 30, 2],
  [47, 25, 5, 22, 32, 2],
  [36, 38, 12, 4, 30, 3],
  [18, 54, 16, 0, 28, 2],
  [-8, 60, 15, -15, 43, 1],
  [-34, 60, 13, -47, 41, -2],
  [-62, 34, 14, -40, 12, 1],
  [-68, -6, 22, -42, -2, 2],
  [-82, -44, 40, -58, -64, 28],
  [-70, -90, 46, -30, -74, 14],
  [-32, -100, 36, -8, -68, 8],
  [8, -94, 32, 22, -62, 12],
  [48, -74, 28, 15, -45, 7],
  [62, -30, 20, 10, -30, 3],
  [63, 2, 14, 25, 26, 2],
  [55, 14, 5, 48, 21, 1],
  [51, 20, null, 42, 26, 1],
]

// Knapp 50 Sekunden bei 12 m/s: lang genug fuer jede Einstellung, kurz genug,
// dass niemand nach dem Ausgang sucht.
const TEMPO = 12
// Mindestabstand ueber dem Gelaende. Die Tannen sind bis gut sechs Meter hoch.
const FREI = 8
const PROBEN = 2400

const smooth = (x) => x * x * (3 - 2 * x)

export class DroneFlight {
  constructor({ camera, input, onStart, onEnd }) {
    this.camera = camera
    this.input = input
    this.onStart = onStart
    this.onEnd = onEnd
    this.active = false
    this._busy = false
    this.look = new THREE.Vector3()

    this._veil = document.createElement('div')
    this._veil.className = 'travel-veil'
    document.body.appendChild(this._veil)

    this.hud = document.createElement('div')
    this.hud.className = 'drohnen-hud'
    this.hud.innerHTML = `
      <div class="dh-top"><span class="dh-rec">REC</span><span class="dh-alt"></span></div>
      <div class="dh-end">${TOUCH ? 'Tippen beendet den Flug' : '<kbd>esc</kbd> Flug beenden'}</div>
    `
    document.body.appendChild(this.hud)
    this._alt = this.hud.querySelector('.dh-alt')
  }

  // Die Bahn wird erst beim ersten Flug gebaut: 2400 Proben mit je neun
  // Hoehenabfragen sind rund 20 000 Aufrufe, die niemand bezahlen soll, der
  // die Drohne nie findet.
  _bauen(start) {
    const boden = (x, z) => terrainHeight(x, z)
    const pts = BAHN.map(([x, z, y], i) => {
      // Start und Landung liegen auf der abgestuerzten Drohne selbst.
      const ende = i === 0 || i === BAHN.length - 1
      return new THREE.Vector3(ende ? start.x : x, y ?? boden(start.x, start.z) + 0.6, ende ? start.z : z)
    })
    const ziele = BAHN.map(([, , , x, z, y]) => new THREE.Vector3(x, y, z))
    this._bahn = new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    this._blick = new THREE.CatmullRomCurve3(ziele, false, 'centripetal')

    // Laengentabelle, damit die Drohne gleichmaessig fliegt – der Parameter
    // der Kurve laeuft je Stuetzpunkt gleich schnell, und die Abschnitte sind
    // zwischen 7 und 44 Meter lang.
    const lang = new Float32Array(PROBEN + 1)
    const roh = new Float32Array(PROBEN + 1)
    const p = new THREE.Vector3()
    const q = new THREE.Vector3()
    this._bahn.getPoint(0, q)
    for (let i = 0; i <= PROBEN; i++) {
      this._bahn.getPoint(i / PROBEN, p)
      if (i) lang[i] = lang[i - 1] + p.distanceTo(q)
      q.copy(p)
      let h = -Infinity
      for (const [dx, dz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5], [3.5, 3.5], [-3.5, 3.5], [3.5, -3.5], [-3.5, -3.5]]) {
        h = Math.max(h, boden(p.x + dx, p.z + dz))
      }
      roh[i] = h + FREI
    }
    // Die Untergrenze wird erst ueber ein Fenster zum Maximum gezogen und
    // dann gemittelt. Weil jedes gemittelte Fenster den eigenen Punkt enthaelt,
    // liegt das Mittel nie unter dem, was dort mindestens noetig ist – und die
    // Drohne huepft nicht ueber jeden Baumhuegel.
    const W1 = 60
    const W2 = 45
    const max = new Float32Array(PROBEN + 1)
    for (let i = 0; i <= PROBEN; i++) {
      let m = -Infinity
      for (let j = Math.max(0, i - W1); j <= Math.min(PROBEN, i + W1); j++) m = Math.max(m, roh[j])
      max[i] = m
    }
    this._boden = new Float32Array(PROBEN + 1)
    for (let i = 0; i <= PROBEN; i++) {
      let s = 0
      let n = 0
      for (let j = Math.max(0, i - W2); j <= Math.min(PROBEN, i + W2); j++) { s += max[j]; n++ }
      this._boden[i] = s / n
    }
    this._lang = lang
    this.laenge = lang[PROBEN]
    this.dauer = this.laenge / TEMPO
  }

  // Strecke → Kurvenparameter, per Halbierung in der Laengentabelle.
  _param(s) {
    const L = this._lang
    let lo = 0
    let hi = PROBEN
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (L[mid] < s) lo = mid
      else hi = mid
    }
    const f = (s - L[lo]) / Math.max(1e-6, L[hi] - L[lo])
    return { t: (lo + f) / PROBEN, i: lo, f }
  }

  start(drone) {
    if (this.active || this._busy) return
    this._busy = true
    this._drone = drone
    if (!this._bahn) this._bauen(drone.position)
    this.input.locked = true
    this._veil.classList.add('on')
    // Erst hinter der Blende umschalten, wie bei der Schnellreise.
    setTimeout(() => {
      this.active = true
      this._t = 0
      this._roll = 0
      this._kurs = null
      this._fov = this.camera.fov
      this.camera.fov = 62
      this.camera.updateProjectionMatrix()
      // Die Drohne ist jetzt in der Luft – unten liegt nur noch ihr Abdruck.
      drone.visible = false
      this.onStart?.()
      this.update(0)
      this.hud.classList.add('visible')
      document.documentElement.classList.add('rundflug')
      setTimeout(() => {
        this._veil.classList.remove('on')
        this._busy = false
      }, 120)
    }, 280)
  }

  stop() {
    if (!this.active || this._busy) return
    this._busy = true
    this._veil.classList.add('on')
    setTimeout(() => {
      this.active = false
      this.hud.classList.remove('visible')
      document.documentElement.classList.remove('rundflug')
      this.camera.fov = this._fov
      this.camera.updateProjectionMatrix()
      if (this._drone) this._drone.visible = true
      this.input.locked = false
      this.onEnd?.()
      setTimeout(() => {
        this._veil.classList.remove('on')
        this._busy = false
      }, 120)
    }, 280)
  }

  // Alles, was waehrend des Flugs gedrueckt wird, gehoert ihm.
  press(action) {
    if (action === 'back' || action === 'use' || action === 'map' || action === 'reset') this.stop()
    return true
  }

  update(dt) {
    if (!this.active) return
    this._t += dt
    const T = this.dauer
    // Sanft abheben und aufsetzen: die ersten und letzten vier Sekunden
    // wachsen bzw. schrumpfen das Tempo, dazwischen gleichmaessig.
    const rampe = 4
    // Rampen je halb so schnell im Mittel – deshalb ist der Flug insgesamt
    // eine Rampenlaenge laenger als Strecke durch Tempo.
    const t = Math.min(this._t, T + rampe)
    const v = TEMPO
    let s
    if (t < rampe) s = v * t * t / (2 * rampe)
    else if (t > T) s = v * (T - rampe / 2) + v * ((t - T) - (t - T) ** 2 / (2 * rampe))
    else s = v * (t - rampe / 2)
    s = Math.min(this.laenge, s)

    const { t: u, i, f } = this._param(s)
    const pos = this._bahn.getPoint(u)
    this._blick.getPoint(u, this.look)

    // Untergrenze nur in der Luft: am Start und bei der Landung steht die
    // Drohne auf ihrem Platz im Schnee, und dort waere acht Meter darueber
    // die richtige Hoehe fuer den Flug, aber nicht fuer den Boden.
    const boden = this._boden[i] + (this._boden[Math.min(PROBEN, i + 1)] - this._boden[i]) * f
    const luft = smooth(Math.min(1, s / 30, (this.laenge - s) / 30))
    pos.y = Math.max(pos.y, pos.y + (boden - pos.y) * luft)
    // Ein Rest von Schweben, damit es nicht wie eine Schiene wirkt.
    pos.y += Math.sin(this._t * 1.7) * 0.12 * luft
    this.camera.position.copy(pos)
    this.camera.lookAt(this.look)

    // In der Kurve legt sie sich hinein – aus dem Kurswechsel je Sekunde,
    // gedeckelt bei 0,22 rad. Mehr sah aus wie ein Absturz auf Raten.
    const kurs = Math.atan2(this.look.x - pos.x, this.look.z - pos.z)
    if (this._kurs !== null && dt > 0) {
      let d = kurs - this._kurs
      while (d > Math.PI) d -= Math.PI * 2
      while (d < -Math.PI) d += Math.PI * 2
      const soll = THREE.MathUtils.clamp(-d / dt * 0.18, -0.22, 0.22) * luft
      this._roll += (soll - this._roll) * (1 - Math.exp(-2.5 * dt))
    }
    this._kurs = kurs
    this.camera.rotateZ(this._roll)

    this._alt.textContent = `▲ ${Math.max(0, pos.y - terrainHeight(pos.x, pos.z)).toFixed(0)} m`

    if (this._t >= T + rampe + 0.6) this.stop()
  }
}
