import * as THREE from 'three'
import { CAMERA } from '../config.js'

// Tastatur wie im Skital: A/D lenken aus Sicht des Fahrers, die Kamera
// merkt davon nichts. Was W, S und die Leertaste tun, haengt davon ab, wo man
// ist: auf dem Wasser ziehen, bremsen, einfedern; in der Luft Salto vor,
// Salto zurueck. Zwei Tastensaetze fuer zwei Zustaende waeren eine Regel
// mehr, ohne dass man je beides zugleich braucht.

const KEY_MAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'grab', ShiftRight: 'grab', KeyJ: 'grab',
  Enter: 'confirm', NumpadEnter: 'confirm',
  KeyR: 'reset',
  Escape: 'pause', KeyP: 'pause',
}

export class Input {
  constructor(dom) {
    this.dom = dom
    this.keys = new Set()
    this.pressed = new Set()
    this.released = new Set()
    this.zoom = 1
    // Touch schreibt hier hinein, siehe core/touch.js.
    this.touch = { steer: 0, jump: false, grab: false, forward: false, brake: false }
    this.onAction = null
    this._bind()
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const a = KEY_MAP[e.code]
      if (!a) return
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault()
      if (!e.repeat) {
        this.pressed.add(a)
        this.onAction?.(a)
      }
      this.keys.add(a)
    })
    window.addEventListener('keyup', (e) => {
      const a = KEY_MAP[e.code]
      if (!a) return
      if (this.keys.has(a)) this.released.add(a)
      this.keys.delete(a)
    })
    window.addEventListener('blur', () => this.keys.clear())
    this.dom.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.zoom = THREE.MathUtils.clamp(this.zoom + e.deltaY * 0.0009, CAMERA.zoomMin, CAMERA.zoomMax)
    }, { passive: false })
  }

  has(a) {
    return this.keys.has(a) || !!this.touch[a]
  }

  // Der Zustand fuer das Fahrmodell, einmal je Bild.
  sample() {
    const t = this.touch
    const jumpHeld = this.has('jump')
    const jumpReleased = this.released.has('jump') || t._jumpReleased
    t._jumpReleased = false
    return {
      steer: THREE.MathUtils.clamp((this.has('right') ? 1 : 0) - (this.has('left') ? 1 : 0) + t.steer, -1, 1),
      throttle: this.has('forward'),
      brake: this.has('brake'),
      jump: jumpHeld,
      jumpReleased: !!jumpReleased && !jumpHeld,
      grab: this.has('grab'),
    }
  }

  endFrame() {
    this.pressed.clear()
    this.released.clear()
  }
}
