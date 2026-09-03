import * as THREE from 'three'
import { terrainHeight, SLED_LANE } from './heightfield.js'
import { createSlalomGate, createStartArch, createFinishArch, GATE_WIDTH } from './props/slalom.js'

// Die Zeitnahme einer Bahn: Start, Ziel, optional Tore.
//
// Alles rechnet in den Koordinaten des Bandes: s ist die Strecke von oben,
// v der seitliche Versatz zur Mittellinie. Damit braucht die Zeitnahme keine
// Trigger-Boxen – die Uhr laeuft, sobald der Fahrer die Starthoehe von oben
// passiert, und steht, wenn er die Zielhoehe erreicht.
//
// Die Rodelbahn faehrt ohne Tore: sie ist eine Rinne mit Banden, in der man
// ohnehin nur einen Weg hat. Wer Tore setzt (gateCount > 0), bekommt die
// Slalom-Auswertung samt Strafsekunden dazu.

const GATE_START = 4        // erstes Tor, Abstand vom Start
const GATE_SPACING = 7.5
// Versatz und Abstand haengen zusammen: um von Tor zu Tor zu kommen, muss der
// Fahrer 2*Versatz seitlich schaffen, waehrend er den Abstand faehrt. Bei
// Tempo 13 und einer Drehrate von 3,1 rad/s ist bei diesen Werten gerade noch
// ein sauberer Rhythmus moeglich – enger wird es unfahrbar.
const GATE_OFFSET = 2.6
const GATE_TOLERANCE = 1.2  // etwas Nachsicht an den Stangen

export class RaceCourse {
  constructor(world, { lane = SLED_LANE, gates = true, startFade = 3.0, finishFade = 4.0 } = {}) {
    this.world = world
    this.lane = lane
    this.withGates = gates
    this.gates = []
    this.state = 'idle'
    this.time = 0
    this.best = null
    this.missed = 0
    this.lastRun = null
    this._prevS = null
    this._hold = 0

    this.startS = startFade
    this.finishS = lane.total - finishFade

    this._build()
    this._buildHud()
  }

  // --- Geometrie ---------------------------------------------------------

  // Punkt auf der Mittellinie bei Bogenlaenge s, plus Richtung.
  pointAt(s) {
    const segs = this.lane.segments
    let g = segs[segs.length - 1]
    let t = 1
    for (const seg of segs) {
      if (s >= seg.s0 && s <= seg.s0 + seg.len) {
        g = seg
        t = (s - seg.s0) / seg.len
        break
      }
    }
    return {
      x: g.x + g.dx * t,
      z: g.z + g.dz * t,
      dx: g.dx / g.len,
      dz: g.dz / g.len,
    }
  }

  // Bogenlaenge und Seitenversatz eines Weltpunkts.
  project(x, z) {
    let bestD = Infinity
    let s = 0
    let v = 0
    for (const g of this.lane.segments) {
      let t = ((x - g.x) * g.dx + (z - g.z) * g.dz) / g.len2
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const px = g.x + g.dx * t
      const pz = g.z + g.dz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < bestD) {
        bestD = d
        s = g.s0 + g.len * t
        // Vorzeichen: links der Fahrtrichtung negativ, rechts positiv.
        v = ((x - px) * g.dz - (z - pz) * g.dx) / g.len
      }
    }
    return { s, v, d: bestD }
  }

  _build() {
    const group = new THREE.Group()
    this.group = group

    const place = (object, x, z, heading) => {
      object.position.set(x, terrainHeight(x, z), z)
      object.rotation.y = heading
      group.add(object)
    }

    const start = this.pointAt(this.startS)
    place(createStartArch(), start.x, start.z, Math.atan2(start.dx, start.dz))

    const finish = this.pointAt(this.finishS)
    place(createFinishArch(), finish.x, finish.z, Math.atan2(finish.dx, finish.dz))

    if (!this.withGates) {
      this.world.scene.add(group)
      return
    }

    // Tore im Wechsel links und rechts. Die letzte Torhoehe muss vor dem Ziel
    // liegen, sonst haengt ein Tor im Zielbogen.
    let s = this.startS + GATE_START
    let i = 0
    while (s < this.finishS - 5) {
      const p = this.pointAt(s)
      const side = i % 2 === 0 ? -1 : 1
      const offset = side * GATE_OFFSET
      const x = p.x + p.dz * offset
      const z = p.z - p.dx * offset
      const gate = createSlalomGate({ color: i % 2 === 0 ? 'red' : 'blue', number: i + 1 })
      place(gate, x, z, Math.atan2(p.dx, p.dz))
      this.gates.push({ s, offset, index: i, passed: false })
      s += GATE_SPACING
      i++
    }

    this.world.scene.add(group)
  }

  // --- Anzeige -----------------------------------------------------------

  _buildHud() {
    const el = document.createElement('div')
    el.className = 'race-hud'
    el.innerHTML = `
      <div class="race-time">0.00</div>
      <div class="race-note"></div>
    `
    document.body.appendChild(el)
    this.hud = el
    this.timeEl = el.querySelector('.race-time')
    this.noteEl = el.querySelector('.race-note')
  }

  _showHud(time, note, tone) {
    this.timeEl.textContent = time
    this.noteEl.textContent = note
    this.hud.dataset.tone = tone || ''
    this.hud.classList.add('visible')
  }

  // --- Ablauf ------------------------------------------------------------

  update(dt, skier) {
    const { s, v, d } = this.project(skier.position.x, skier.position.z)
    const prev = this._prevS
    this._prevS = s

    if (this.state === 'running') {
      this.time += dt

      // Tore pruefen: sobald die Torhoehe ueberfahren wird, zaehlt der
      // seitliche Abstand zur Torachse.
      if (prev !== null) {
        for (const gate of this.gates) {
          if (gate.passed || gate.missed) continue
          if (prev < gate.s && s >= gate.s) {
            const inside = Math.abs(v - gate.offset) <= GATE_WIDTH / 2 + GATE_TOLERANCE
            if (inside) gate.passed = true
            else {
              gate.missed = true
              this.missed++
            }
          }
        }
      }

      if (prev !== null && prev < this.finishS && s >= this.finishS) {
        this._finish()
      } else if (d > 26 || (prev !== null && s < this.startS - 6)) {
        // Wer die Strecke verlaesst, bricht ab. Kein Strafgericht, nur ein
        // stilles Zuruecksetzen.
        this._reset()
      } else {
        const note = this.missed ? `${this.missed} Tor${this.missed > 1 ? 'e' : ''} verfehlt` : ''
        this._showHud(this.time.toFixed(2), note, this.missed ? 'warn' : '')
      }
      return
    }

    if (this._hold > 0) {
      this._hold -= dt
      if (this._hold <= 0) this.hud.classList.remove('visible')
    }

    // Start: von oben durch den Startbogen, nicht zu weit daneben.
    if (
      this.state !== 'running' &&
      prev !== null &&
      prev < this.startS &&
      s >= this.startS &&
      Math.abs(v) < 9 &&
      skier.speed > 1.5 &&
      !skier.tow
    ) {
      this.state = 'running'
      this.time = 0
      this.missed = 0
      for (const gate of this.gates) {
        gate.passed = false
        gate.missed = false
      }
      this._hold = 0
      this._showHud('0.00', '', '')
    }
  }

  _finish() {
    const clean = this.missed === 0
    // Verfehlte Tore kosten zwei Sekunden – das ist ueberschaubar und macht
    // den Unterschied zwischen durchfahren und Kurve fahren spuerbar.
    const total = this.time + this.missed * 2
    this.state = 'idle'
    this.lastRun = { time: this.time, missed: this.missed, total }

    let note
    if (this.best === null || total < this.best) {
      this.best = total
      note = clean ? 'Bestzeit' : `Bestzeit (+${this.missed * 2}s Strafe)`
    } else {
      note = clean ? `Beste: ${this.best.toFixed(2)}` : `+${this.missed * 2}s Strafe`
    }
    this._showHud(total.toFixed(2), note, clean ? 'good' : 'warn')
    this._hold = 5
  }

  _reset() {
    this.state = 'idle'
    this.hud.classList.remove('visible')
    this._hold = 0
  }
}
