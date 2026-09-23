import * as THREE from 'three'
import { CAMERA } from '../config.js'

// Handymodus: ein Daumenstick, der dort entsteht, wo der Finger den Schnee
// beruehrt, und ein Sprungknopf, der nur im Funpark auftaucht.
//
// Der Stick lenkt *bildschirmbezogen*: Daumen nach oben heisst, der Fahrer
// faehrt im Bild nach oben. Mit der Tastatur lenkt man klassisch aus Sicht
// des Fahrers, und das bleibt so – aber mit einem Daumen gibt es kein Links
// und Rechts, nur ein Wohin. Weil die Kamera fest steht, ist ein Wohin auf
// dem Bildschirm genau eine Himmelsrichtung, und der Stick muss nur den
// Winkel zwischen ihr und der Fahrtrichtung ausregeln. Auf der Nordabfahrt
// dreht die Kamera mit; dann gilt ihr aktueller Azimut, und oben bleibt
// trotzdem vorn.

const RADIUS = 56          // px bis Vollausschlag
const DEAD = 0.18          // Anteil am Radius, unter dem nichts passiert
const GAIN = 2.1           // Lenkeinschlag je rad Winkelfehler

export class TouchControls {
  constructor(input, dom, { camera, skier, jumpVisible }) {
    this.input = input
    this.dom = dom
    this.camera = camera
    this.skier = skier
    this.jumpVisible = jumpVisible
    this._stick = null         // { id, ox, oy, x, y }
    this._pinch = null         // { a, b, dist, zoom }
    this._pointers = new Map()

    this.base = document.createElement('div')
    this.base.className = 'glass touch-stick'
    this.base.innerHTML = '<span class="touch-knob"></span>'
    document.body.appendChild(this.base)
    this.knob = this.base.firstElementChild

    this.jump = document.createElement('button')
    this.jump.type = 'button'
    this.jump.className = 'glass touch-jump'
    this.jump.setAttribute('aria-label', 'Springen')
    this.jump.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 15l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    document.body.appendChild(this.jump)
    // Gehalten statt getippt: auf der Rail haelt man die Taste, solange man
    // grindet, und in der Luft dreht man, solange sie gedrueckt ist.
    const down = (e) => {
      e.preventDefault()
      if (!input.keys.has('jump')) input.pressed.add('jump')
      input.keys.add('jump')
      input.anyInputYet = true
      this.jump.classList.add('down')
    }
    const up = () => {
      input.keys.delete('jump')
      this.jump.classList.remove('down')
    }
    this.jump.addEventListener('pointerdown', down)
    this.jump.addEventListener('pointerup', up)
    this.jump.addEventListener('pointercancel', up)
    this.jump.addEventListener('pointerleave', up)

    this.hint = document.createElement('div')
    this.hint.className = 'glass touch-hint'
    this.hint.innerHTML = '<span class="touch-hint-dot"></span>Daumen auf den Schnee und ziehen'
    document.body.appendChild(this.hint)

    this._bind()
  }

  _bind() {
    const dom = this.dom
    dom.addEventListener('pointerdown', (e) => {
      // Wirft, wenn der Zeiger schon weg ist (schnelles Tippen) – dann eben
      // ohne Einfangen weiter, statt den ganzen Stick zu verlieren.
      try { dom.setPointerCapture(e.pointerId) } catch { /* egal */ }
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (this._pointers.size === 2) {
        // Zweiter Finger: aus dem Stick wird ein Zoom.
        const [a, b] = [...this._pointers.values()]
        this._pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.input.zoom }
        this._release()
        return
      }
      if (this._stick || this._pinch) return
      this._stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY }
      this.base.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`
      this.knob.style.transform = ''
      this.base.classList.add('visible')
      this.input.anyInputYet = true
      this.hint.classList.add('gone')
    })
    dom.addEventListener('pointermove', (e) => {
      const p = this._pointers.get(e.pointerId)
      if (!p) return
      p.x = e.clientX
      p.y = e.clientY
      if (this._pinch && this._pointers.size >= 2) {
        const [a, b] = [...this._pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        this.input.zoom = THREE.MathUtils.clamp(
          this._pinch.zoom * (this._pinch.dist / Math.max(d, 1)), CAMERA.zoomMin, CAMERA.zoomMax,
        )
        return
      }
      const s = this._stick
      if (!s || s.id !== e.pointerId) return
      s.x = e.clientX
      s.y = e.clientY
      // Zieht der Daumen weit ueber den Rand hinaus, wandert der Stick mit –
      // sonst muesste man zum Umlenken erst zurueck in die Mitte.
      const dx = s.x - s.ox
      const dy = s.y - s.oy
      const len = Math.hypot(dx, dy)
      if (len > RADIUS * 1.6) {
        const k = (len - RADIUS * 1.6) / len
        s.ox += dx * k
        s.oy += dy * k
        this.base.style.transform = `translate(${s.ox}px, ${s.oy}px) translate(-50%, -50%)`
      }
      const kx = THREE.MathUtils.clamp(s.x - s.ox, -RADIUS, RADIUS)
      const ky = THREE.MathUtils.clamp(s.y - s.oy, -RADIUS, RADIUS)
      const kl = Math.hypot(kx, ky)
      const f = kl > RADIUS ? RADIUS / kl : 1
      this.knob.style.transform = `translate(${kx * f}px, ${ky * f}px)`
    })
    const end = (e) => {
      this._pointers.delete(e.pointerId)
      if (this._pointers.size < 2) this._pinch = null
      if (this._stick?.id === e.pointerId) this._release()
    }
    dom.addEventListener('pointerup', end)
    dom.addEventListener('pointercancel', end)
  }

  _release() {
    this._stick = null
    this.input.stick = null
    this.base.classList.remove('visible')
  }

  // Jedes Bild: aus dem Daumenvektor Lenkung und Schub machen.
  update() {
    this.jump.classList.toggle('visible', !!this.jumpVisible())
    const s = this._stick
    if (!s) return
    const dx = s.x - s.ox
    const dy = s.y - s.oy
    const mag = Math.min(1, Math.hypot(dx, dy) / RADIUS)
    if (mag < DEAD) {
      this.input.stick = { steer: 0, throttle: 0 }
      return
    }
    // Bildschirm-oben ist die Blickrichtung der Kamera auf dem Boden,
    // Bildschirm-rechts steht senkrecht dazu (siehe HANDOVER, Abschnitt 2).
    const az = this.camera.azimuthNow
    const fx = -Math.sin(az)
    const fz = -Math.cos(az)
    const rx = Math.cos(az)
    const rz = -Math.sin(az)
    const wx = rx * dx - fx * dy
    const wz = rz * dx - fz * dy
    const wanted = Math.atan2(wx, wz)
    let err = wanted - this.skier.heading
    err = Math.atan2(Math.sin(err), Math.cos(err))
    // Positiver Fehler heisst Heading erhoehen, und das ist links – also
    // negatives steer.
    this.input.stick = {
      steer: THREE.MathUtils.clamp(-err * GAIN, -1, 1),
      throttle: mag > 0.35 ? 1 : 0,
    }
  }
}
