import * as THREE from 'three'
import { terrainHeight, SLED_LANE } from './heightfield.js'
import { createSlalomGate, createStartArch, createFinishArch, GATE_WIDTH, readableYaw } from './props/slalom.js'
import { createHalo } from './props/screens.js'

// Die Zeitnahme einer Bahn: Start, Ziel, Tore – und die Farbe im Schnee, die
// sagt, wo man langfahren soll.
//
// Alles rechnet in den Koordinaten des Bandes: s ist die Strecke von oben,
// v der seitliche Versatz zur Mittellinie. Damit braucht die Zeitnahme keine
// Trigger-Boxen – die Uhr laeuft, sobald der Fahrer die Starthoehe von oben
// passiert, und steht, wenn er die Zielhoehe erreicht.
//
// Die Tore stehen nicht stur im Wechsel links und rechts. In einer Kurve
// wuerde ein Tor auf der Aussenseite gegen die natuerliche Linie arbeiten und
// die Fahrt zur Strafaufgabe machen. Deshalb setzt eine Kurve das Tor auf die
// Innenseite – es belohnt dann genau den Bogen, den man ohnehin faehrt – und
// nur auf den geraden Stuecken wechseln die Tore die Seite und erzeugen den
// Rhythmus.

// Vier Tore, streng im Wechsel links und rechts, gleiche Abstaende. Ein
// Versuch mit fuenf Toren im kuerzer werdenden Rhythmus und Toren, die in
// Kurven nach innen wanderten, war zu unruhig: zweimal dieselbe Seite liest
// sich im Vorbeifahren wie ein Fehler. Frueher waren es drei Tore auf 53
// Metern mit 14 Metern Abstand – das war eine Abfahrt mit Deko.
const GATE_START = 7        // erstes Tor, Abstand vom Start
const GATE_COUNT = 4
// Versatz und Nachsicht zusammen entscheiden, ob die Tore etwas verlangen.
// Frueher 3,4 Versatz bei 3,1 halber Fensterbreite: wer in der Mitte blieb,
// verfehlte das Tor um einen halben Meter. Jetzt 4,6 bei 2,7 – von einem Tor
// zum naechsten sind mindestens 3,8 Meter quer zu schaffen. Das geht nur mit
// einem echten Schwung, und die Bahn ist dafuer auf 17 Meter verbreitert
// (heightfield.js).
const GATE_OFFSET = 4.6
const GATE_TOLERANCE = 0.5  // etwas Nachsicht an den Stangen
const PENALTY = 2           // s je verfehltem Tor

// Medaillen, gemessen mit einem Testfahrer, der mit vier bis zehn Metern
// Vorausschau auf der Linie durch die Tormitten faehrt: sein bester sauberer
// Lauf war 3,58 s, ein vorsichtiger 4,05. Mit mehr Vorausschau wurde er
// schneller, schnitt aber Tore – ein verfehltes Tor kostet 2 s und damit
// jede Medaille. Die Grenzen danach (3,60 / 3,85 / 4,20) waren fuer
// Menschen zu eng: nach Tagen Uebung stand Julians Bestzeit bei 4,18 –
// knapp Bronze. Jetzt Bronze fuer einen ordentlichen Lauf, Silber knapp
// unter seiner Bestzeit, Gold zwischen ihr und dem Testfahrer: schwer,
// aber ohne dessen ideale Linie erreichbar.
export const MEDALS = [
  { name: 'Gold', time: 3.9 },
  { name: 'Silber', time: 4.2 },
  { name: 'Bronze', time: 4.5 },
]

const STORE = 'skiportfolio.slalom'
function loadBest() {
  try {
    const data = JSON.parse(localStorage.getItem(STORE))
    if (Number.isFinite(data?.best)) return data
  } catch { /* privat, gesperrt oder leer */ }
  return null
}
function saveBest(data) {
  try { localStorage.setItem(STORE, JSON.stringify(data)) } catch { /* egal */ }
}

export class RaceCourse {
  // startFade ist der Abstand des Startbogens vom oberen Ende des Bandes.
  // Er liegt bewusst nicht direkt an der Bergstation: wer aus dem Lift
  // kommt, faellt sonst ohne Vorwarnung in die Zeitnahme. Zwoelf Meter
  // reichen, um sich zu sortieren und den Bogen kommen zu sehen.
  constructor(world, { lane = SLED_LANE, gates = true, startFade = 12.0, finishFade = 4.0 } = {}) {
    this.world = world
    this.lane = lane
    this.withGates = gates
    this.gates = []
    this.state = 'idle'
    this.time = 0
    // Die Bestzeit ueberlebt das Neuladen: ohne sie gibt es nichts, wogegen
    // man faehrt. Mit ihr die Zwischenzeiten an jedem Tor.
    const saved = loadBest()
    this.best = saved?.best ?? null
    this.bestSplits = saved?.splits ?? null
    this.splits = []
    this.missed = 0
    this.lastRun = null
    this._prevS = null
    this._hold = 0
    // Fuer die Bestenliste (stations/bestenliste.js): Start, Ziel, Abbruch.
    this.onStart = null
    this.onFinish = null
    this.onAbort = null

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

    // Die Farbe im Schnee ist wieder weg – Banden, Bogen und Stangen sagen
    // schon alles, und die Balken darunter machten aus einer Rennstrecke
    // einen Parkplatz. Was bleibt, sind Dinge, die im Schnee stehen.
    const place = (object, x, z, heading, skew = true) => {
      const yaw = skew ? readableYaw(heading) : heading
      object.position.set(x, terrainHeight(x, z), z)
      object.rotation.y = yaw
      group.add(object)
    }

    // --- Start und Ziel ------------------------------------------------
    // Der Startbogen steht quer zur Falllinie, ohne Verdrehung: er ist die
    // Linie, ueber die die Uhr laeuft, und die liegt rechtwinklig zur
    // Fahrtrichtung oder gar nicht. Das Ziel darf sich weiter zur Kamera
    // drehen – dort zaehlt Lesbarkeit mehr als Rechtwinkligkeit, weil man
    // durchfaehrt und nicht daran wartet.
    const start = this.pointAt(this.startS)
    const finish = this.pointAt(this.finishS)

    place(createStartArch(), start.x, start.z, Math.atan2(start.dx, start.dz), false)
    place(createFinishArch(), finish.x, finish.z, Math.atan2(finish.dx, finish.dz))

    if (!this.withGates) {
      this.world.scene.add(group)
      return
    }

    // --- Tore ----------------------------------------------------------
    // Die Tore verteilen sich gleichmaessig zwischen erstem Tor und sechs
    // Metern vor dem Ziel, damit keines im Zielbogen haengt.
    const first = this.startS + GATE_START
    const gap = (this.finishS - 6 - first) / (GATE_COUNT - 1)
    for (let i = 0; i < GATE_COUNT; i++) {
      const s = first + i * gap
      const p = this.pointAt(s)
      const offset = (i % 2 === 0 ? -1 : 1) * GATE_OFFSET
      const x = p.x + p.dz * offset
      const z = p.z - p.dx * offset
      const red = i % 2 === 0
      const gate = createSlalomGate({ color: red ? 'red' : 'blue', number: i + 1 })
      place(gate, x, z, Math.atan2(p.dx, p.dz))

      // Schein im Schnee zwischen den Stangen: das naechste Tor glimmt,
      // ein getroffenes blitzt gruen, ein verfehltes rot.
      const glow = createHalo(0xffffff, 1)
      glow.scale.set(GATE_WIDTH + 1.2, 2.2, 1)
      glow.rotation.x = -Math.PI / 2
      glow.position.set(x, terrainHeight(x, z) + 0.06, z)
      glow.rotation.z = Math.atan2(p.dx, p.dz)
      group.add(glow)

      this.gates.push({ s, offset, index: i, passed: false, missed: false, glow, flash: 0 })
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
    this._glow(dt)

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
            gate.flash = 1
            // Zwischenzeit: die Zeit am Tor plus die bisherigen Strafen,
            // gegen dieselbe Zahl der Bestzeit.
            const split = this.time + this.missed * PENALTY
            this.splits[gate.index] = split
            const ref = this.bestSplits?.[gate.index]
            this._split = Number.isFinite(ref) ? { delta: split - ref, hold: 1.4 } : null
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
        let note = this.missed ? `${this.missed} Tor${this.missed > 1 ? 'e' : ''} verfehlt · +${this.missed * PENALTY}s` : ''
        let tone = this.missed ? 'warn' : ''
        if (this._split) {
          this._split.hold -= dt
          const dl = this._split.delta
          note = `${dl <= 0 ? '−' : '+'}${Math.abs(dl).toFixed(2)} zur Bestzeit`
          tone = dl <= 0 ? 'good' : 'warn'
          if (this._split.hold <= 0) this._split = null
        }
        this._showHud(this.time.toFixed(2), note, tone)
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
      this.splits = []
      this._split = null
      for (const gate of this.gates) {
        gate.passed = false
        gate.missed = false
      }
      this._hold = 0
      this.onStart?.()
      this._showHud('0.00', this.best !== null ? `Bestzeit ${this.best.toFixed(2)}` : `Gold unter ${MEDALS[0].time.toFixed(2)}`, '')
    }
  }

  // Das naechste offene Tor glimmt im Schnee, damit man die Linie vorher
  // sieht; ein eben durchfahrenes blitzt gruen oder rot und verblasst.
  _glow(dt) {
    const running = this.state === 'running'
    const next = running ? this.gates.find((g) => !g.passed && !g.missed) : null
    for (const g of this.gates) {
      g.flash = Math.max(0, g.flash - dt * 1.3)
      const m = g.glow.material
      if (g.flash > 0) {
        m.color.setHex(g.missed ? 0xff4a3a : 0x3dff8c)
        m.opacity = g.flash * 0.9
      } else if (g === next) {
        m.color.setHex(0xfff2c0)
        m.opacity = 0.28 + Math.sin(performance.now() * 0.008) * 0.1
      } else {
        m.opacity = 0
      }
    }
  }

  _finish() {
    const clean = this.missed === 0
    const total = this.time + this.missed * PENALTY
    this.state = 'idle'
    this.lastRun = { time: this.time, missed: this.missed, total, splits: [...this.splits] }
    this.onFinish?.(this.lastRun)

    const medal = MEDALS.find((m) => total <= m.time)
    const next = medal ? MEDALS[MEDALS.indexOf(medal) - 1] : MEDALS[MEDALS.length - 1]
    const parts = []
    if (medal) parts.push(medal.name)
    if (this.best === null || total < this.best) {
      this.best = total
      this.bestSplits = [...this.splits]
      saveBest({ best: this.best, splits: this.bestSplits })
      parts.push('Bestzeit')
    } else {
      parts.push(`Beste ${this.best.toFixed(2)}`)
    }
    if (!clean) parts.push(`+${this.missed * PENALTY}s Strafe`)
    else if (next) parts.push(`${next.name} unter ${next.time.toFixed(2)}`)
    this._showHud(total.toFixed(2), parts.join(' · '), medal && clean ? 'good' : clean ? '' : 'warn')
    this._hold = 6
  }

  _reset() {
    this.onAbort?.()
    this.state = 'idle'
    this.hud.classList.remove('visible')
    this._hold = 0
  }
}
