// Handymodus, bewusst schlicht: links wischen lenkt (wie ein Daumenstick an
// der Stelle, an der der Finger aufsetzt), rechts halten federt ein und
// loslassen springt. Rechts nach oben oder unten ziehen ist in der Luft
// Salto vor oder zurueck, ein zweiter Finger rechts ist der Grab. Ein Tipp
// ohne Ziehen auf den Titel oder die Auswertung zaehlt als Enter.

export function isTouch() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}

export class TouchControls {
  constructor(input, dom, { onTap } = {}) {
    this.input = input
    this.left = null
    this.right = new Map()
    this.onTap = onTap
    const t = input.touch
    const width = () => window.innerWidth

    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return
      dom.setPointerCapture?.(e.pointerId)
      if (e.clientX < width() * 0.45 && !this.left) {
        this.left = { id: e.pointerId, x: e.clientX, y: e.clientY }
      } else {
        this.right.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() })
        if (this.right.size === 1) t.jump = true
        else t.grab = true
      }
    })
    dom.addEventListener('pointermove', (e) => {
      if (this.left && e.pointerId === this.left.id) {
        t.steer = Math.max(-1, Math.min(1, (e.clientX - this.left.x) / 55))
      }
      const r = this.right.get(e.pointerId)
      if (r && this.right.size === 1) {
        const dy = e.clientY - r.y
        t.forward = dy < -35
        t.brake = dy > 35
      }
    })
    const up = (e) => {
      if (this.left && e.pointerId === this.left.id) {
        this.left = null
        t.steer = 0
      }
      const r = this.right.get(e.pointerId)
      if (r) {
        this.right.delete(e.pointerId)
        if (this.right.size === 0) {
          t.jump = false
          t._jumpReleased = true
          t.forward = t.brake = false
          t.grab = false
          if (performance.now() - r.t < 250) this.onTap?.()
        } else if (this.right.size === 1) {
          t.grab = false
        }
      }
    }
    dom.addEventListener('pointerup', up)
    dom.addEventListener('pointercancel', up)
  }
}
