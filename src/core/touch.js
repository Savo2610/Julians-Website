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
  constructor(input, dom, { camera, skier, jumpVisible, onMap = null, mapVisible = () => true }) {
    this.input = input
    this.dom = dom
    this.camera = camera
    this.skier = skier
    this.jumpVisible = jumpVisible
    this.mapVisible = mapVisible
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
    // grindet.
    const down = (e) => {
      e.preventDefault()
      if (!input.keys.has('jump')) input.pressed.add('jump')
      input.keys.add('jump')
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

    // Der Kartenknopf. Am Rechner oeffnet M die Karte von ueberall; am Handy
    // gibt es kein M, und ohne Knopf kaeme man nur am Pult am Startplatz an
    // die Schnellreise. Er ist das einzige Bedienelement, das immer da ist,
    // deshalb klein, oben rechts und aus demselben Glas wie alles andere.
    this.map = document.createElement('button')
    this.map.type = 'button'
    this.map.className = 'glass touch-map'
    this.map.setAttribute('aria-label', 'Talkarte')
    this.map.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3.5 6.2 9 4l6 2.2L20.5 4v13.8L15 20l-6-2.2-5.5 2.2z M9 4v13.8 M15 6.2V20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>'
    // Im Klick und nicht im naechsten Bild – dieselbe Regel wie ueberall.
    this.map.addEventListener('click', (e) => {
      e.preventDefault()
      onMap?.()
    })
    document.body.appendChild(this.map)

    this.hint = document.createElement('div')
    this.hint.className = 'frost touch-hint'
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
    this.map.classList.toggle('visible', !!this.mapVisible())
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
    const screen = THREE.MathUtils.clamp(-err * GAIN, -1, 1)

    // Auf der Nordabfahrt steht die Kamera hinter dem Fahrer und dreht mit.
    // Dort geht "Daumen nach rechts = im Bild nach rechts" nicht: jede
    // Lenkung dreht das Bild mit, das Ziel wandert mit, und ein Daumen, der
    // rechts liegen bleibt, lenkt immer weiter – der Fahrer drehte sich im
    // Kreis. Hinter dem Fahrer ist der Stick deshalb ein Lenkrad: die
    // Seitenlage des Daumens ist der Einschlag, in der Mitte wird er weich,
    // damit man kleine Korrekturen fahren kann. Nach unten gezogen rollt man
    // aus statt zu schieben. Uebergeblendet mit derselben Kurve wie die
    // Kamera, damit am Anfang der Abfahrt nichts springt.
    const behind = this.camera.verfolgt ?? 0
    const x = THREE.MathUtils.clamp(dx / RADIUS, -1, 1)
    const wheel = x * (0.35 + 0.65 * Math.abs(x))
    const pulledBack = dy > RADIUS * 0.45
    this.input.stick = {
      steer: screen * (1 - behind) + wheel * behind,
      throttle: mag > 0.35 && !(behind > 0.5 && pulledBack) ? 1 : 0,
    }
  }
}
