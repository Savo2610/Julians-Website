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
  // Stationen mit mehr als einem Ziel: die Karte zeigt die Ziffern an, mit
  // denen man waehlt. Ein zweiter Bestaetigungsknopf waere eine Taste mehr
  // fuer einen Fall, den es an drei Stellen im Tal gibt.
  Digit1: 'pick1', Numpad1: 'pick1',
  Digit2: 'pick2', Numpad2: 'pick2',
  KeyM: 'mute',
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

  // Steht eines der Fenster offen, gehoert die Tastatur ihm. Ohne diese
  // Sperre faehrt der Skifahrer waehrend des Tippens los: W ist vorwaerts,
  // aber auch der erste Buchstabe von "www". Geprueft wird das Fenster und
  // nicht das Ziel des Ereignisses – ein modaler Dialog faengt ohnehin alles
  // ab, und beim Oeffnen sollen auch die schon gedrueckten Tasten losgehen.
  _blocked() {
    const open = document.querySelector('dialog[open]')
    if (open && this.keys.size) this.keys.clear()
    return !!open
  }

  _bind() {
    window.addEventListener('keydown', (e) => {
      const action = KEY_MAP[e.code]
      if (!action || this._blocked()) return
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
      // Im Fenster scrollt man die Liste der Dateien, nicht die Kamera.
      if (this._blocked()) return
      e.preventDefault()
      this.zoom = THREE.MathUtils.clamp(this.zoom + e.deltaY * 0.0009, CAMERA.zoomMin, CAMERA.zoomMax)
    }, { passive: false })
  }

  has(action) {
    if (this._blocked()) return false
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
