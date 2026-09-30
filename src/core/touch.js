// Handymodus mit sichtbaren Tasten, genau wie die Tastatur belegt: links
// eine Wippe fuer A/D, rechts eine Wippe fuer W/S, daneben Sprung und Grab.
// Vorher gab es nur unsichtbare Zonen (links wischen, rechts halten, rechts
// hoch- und runterziehen, zweiter Finger) – man musste die Anleitung lesen,
// um ueberhaupt loszufahren, und der Salto loeste oft beim Einfedern aus.
//
// Die A/D-Wippe ist stufenlos: je weiter aussen der Daumen, desto staerker
// das Kanten. Ein Tipp auf das Bild ausserhalb der Tasten zaehlt auf Titel
// und Auswertung als Enter.

export function isTouch() {
  return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
}

function el(tag, cls, parent, html = '') {
  const e = document.createElement(tag)
  e.className = cls
  if (html) e.innerHTML = html
  parent.appendChild(e)
  return e
}

const clamp = (v) => Math.max(-1, Math.min(1, v))

export class TouchControls {
  constructor(input, dom, { onTap, root } = {}) {
    const t = input.touch
    const ui = el('div', 'touch-ui', root)

    const steer = el('div', 'glass t-rocker t-steer', ui, '<span>◀</span><span>▶</span>')
    const right = el('div', 't-right', ui)
    const pitch = el('div', 'glass t-rocker t-pitch', right, '<span>▲</span><span>▼</span>')
    const grab = el('button', 'glass t-btn t-grab', right, 'Grab')
    const jump = el('button', 'glass t-btn t-jump', right, 'Sprung')
    grab.type = jump.type = 'button'

    // Wer die Mitte der Wippe trifft, lenkt nicht: 20 Prozent Totzone, dann
    // bis zum Rand voll.
    this.track(steer, (e, r) => {
      const u = ((e.clientX - r.left) / r.width - 0.5) * 2
      t.steer = clamp(Math.sign(u) * Math.max(0, Math.abs(u) - 0.2) / 0.6)
      steer.dataset.dir = t.steer < 0 ? 'l' : t.steer > 0 ? 'r' : ''
    }, () => {
      t.steer = 0
      steer.dataset.dir = ''
    })
    this.track(pitch, (e, r) => {
      const v = (e.clientY - r.top) / r.height
      t.forward = v < 0.42
      t.brake = v > 0.58
      pitch.dataset.dir = t.forward ? 'u' : t.brake ? 'd' : ''
    }, () => {
      t.forward = t.brake = false
      pitch.dataset.dir = ''
    })
    this.track(jump, () => { t.jump = true }, () => {
      t.jump = false
      t._jumpReleased = true
    })
    this.track(grab, () => { t.grab = true }, () => { t.grab = false })

    dom.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'mouse') onTap?.()
    })
  }

  // Ein Finger je Taste: der Finger bleibt der Taste zugeordnet, auch wenn
  // er darueber hinausrutscht, bis er losgelassen wird.
  track(node, move, end) {
    let id = null
    node.addEventListener('pointerdown', (e) => {
      if (id !== null) return
      e.preventDefault()
      id = e.pointerId
      // Ohne Capture geht es auch, nur rutscht der Finger dann eher heraus;
      // ein Fehler hier darf die Taste nicht verschlucken.
      try {
        node.setPointerCapture(id)
      } catch {}
      node.classList.add('on')
      move(e, node.getBoundingClientRect())
    })
    node.addEventListener('pointermove', (e) => {
      if (e.pointerId === id) move(e, node.getBoundingClientRect())
    })
    const up = (e) => {
      if (e.pointerId !== id) return
      id = null
      node.classList.remove('on')
      end()
    }
    node.addEventListener('pointerup', up)
    node.addEventListener('pointercancel', up)
    node.addEventListener('contextmenu', (e) => e.preventDefault())
  }
}
