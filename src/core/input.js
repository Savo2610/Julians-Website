import * as THREE from 'three'
import { CAMERA } from '../config.js'

// Klassische Fahrzeugsteuerung: W faehrt, A/D lenken aus Sicht des Fahrers.
// Die Kamera bleibt davon unberuehrt – sie folgt nur der Position.

const KEY_MAP = {
  KeyW: 'forward', ArrowUp: 'forward',
  KeyS: 'brake', ArrowDown: 'brake',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'carve', ShiftRight: 'carve',
  Space: 'jump',
  KeyE: 'use', Enter: 'use',
}

export class Input {
  constructor(domElement) {
    this.dom = domElement
    this.keys = new Set()
    this.pressed = new Set()   // nur im Frame des Tastendrucks gesetzt
    this.zoom = 1
    this.anyInputYet = false
    this._bind()
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const action = KEY_MAP[e.code]
      if (!action) return
      if (e.code === 'Space') e.preventDefault()
      if (!this.keys.has(action)) this.pressed.add(action)
      this.keys.add(action)
      this.anyInputYet = true
    })
    window.addEventListener('keyup', (e) => {
      const action = KEY_MAP[e.code]
      if (action) this.keys.delete(action)
    })
    window.addEventListener('blur', () => this.keys.clear())

    this.dom.addEventListener('wheel', (e) => {
      e.preventDefault()
      this.zoom = THREE.MathUtils.clamp(this.zoom + e.deltaY * 0.0009, CAMERA.zoomMin, CAMERA.zoomMax)
    }, { passive: false })
  }

  has(action) {
    return this.keys.has(action)
  }

  justPressed(action) {
    return this.pressed.has(action)
  }

  // Am Ende jedes Frames aufrufen.
  endFrame() {
    this.pressed.clear()
  }

  // Lenkung in [-1, 1]; positiv = nach rechts aus Sicht des Fahrers.
  get steer() {
    return (this.has('right') ? 1 : 0) - (this.has('left') ? 1 : 0)
  }

  get throttle() {
    return this.has('forward') ? 1 : 0
  }

  get braking() {
    return this.has('brake')
  }
}
