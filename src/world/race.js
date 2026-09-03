import * as THREE from 'three'
import { CAMERA } from '../config.js'
import { terrainHeight, SLED_LANE } from './heightfield.js'
import { createSlalomGate, createStartArch, createFinishArch, GATE_WIDTH } from './props/slalom.js'
import { snowPaint } from './props/snow-paint.js'

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

const GATE_START = 6        // erstes Tor, Abstand vom Start
const GATE_SPACING = 9
// Versatz und Abstand haengen zusammen: um von Tor zu Tor zu kommen, muss der
// Fahrer 2*Versatz seitlich schaffen, waehrend er den Abstand faehrt. Bei
// Tempo 15 und einer Drehrate von 3,1 rad/s ist bei diesen Werten ein sauberer
// Rhythmus moeglich – enger wird es in der Rinne unfahrbar.
// Der Versatz muss groesser sein als halbe Torbreite plus Nachsicht, sonst
// trifft man jedes Tor allein dadurch, dass man in der Rinne bleibt – die
// Tore waeren dann Dekoration. Bei 3,4 zu 3,1 muss man sich bewegen, aber nur
// gut einen halben Meter aus der Mitte.
const GATE_OFFSET = 3.4
const GATE_TOLERANCE = 0.9  // etwas Nachsicht an den Stangen
// Ab dieser Kruemmung gilt ein Stueck als Kurve und das Tor wandert nach innen.
const BEND = 0.022          // rad pro Meter, entspricht etwa 45 m Radius

const RED = 0xd8402f
const BLUE = 0x2f6bd8

// Bei fester Kamera ist eine Achse, die in die Blickrichtung zeigt, nur ein
// Strich. Ein Bogen quer zur Fahrtrichtung kann genau so stehen. Deshalb darf
// er sich um bis zu 40 Grad aus der Senkrechten drehen, wenn er dadurch ueber
// den Bildschirm laeuft – als Tor bleibt er lesbar, als Strich waere er weg.
const MAX_SKEW = 0.7
function readableYaw(heading) {
  // Die Breite des Bogens auf dem Bildschirm ist |cos(gier - azimut)|. Am
  // breitesten steht er also, wenn der Gierwinkel dem Kamera-Azimut folgt.
  let a = CAMERA.azimuth - heading
  // Eine Achse ist symmetrisch: eine halbe Drehung aendert nichts.
  a -= Math.PI * Math.round(a / Math.PI)
  return heading + THREE.MathUtils.clamp(a, -MAX_SKEW, MAX_SKEW)
}

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

  // Kruemmung bei s: Richtungsaenderung pro Meter, positiv = Rechtskurve.
  curvatureAt(s) {
    const a = this.pointAt(Math.max(0, s - 5))
    const b = this.pointAt(Math.min(this.lane.total, s + 5))
    let d = Math.atan2(b.dx, b.dz) - Math.atan2(a.dx, a.dz)
    d = Math.atan2(Math.sin(d), Math.cos(d))
    return d / 10
  }

  _build() {
    const group = new THREE.Group()
    this.group = group
    const paint = snowPaint()

    // Bogen und Farbe muessen dieselbe Achse haben, sonst liegt der Balken
    // schraeg unter dem Tor und das Paar liest sich als Kreuz statt als
    // Durchfahrt. Deshalb liefert place die tatsaechlich benutzte Achse
    // zurueck: `through` ist die Richtung hindurch, `span` die Querachse.
    const place = (object, x, z, heading) => {
      const yaw = readableYaw(heading)
      object.position.set(x, terrainHeight(x, z), z)
      object.rotation.y = yaw
      group.add(object)
      return { tx: Math.sin(yaw), tz: Math.cos(yaw), sx: Math.cos(yaw), sz: -Math.sin(yaw) }
    }

    // --- Start und Ziel ------------------------------------------------
    // Beide bekommen einen Karobalken quer im Schnee. Der Bogen darueber ist
    // Schmuck und Wegweiser aus der Ferne, gelesen wird der Balken.
    const start = this.pointAt(this.startS)
    const finish = this.pointAt(this.finishS)
    const band = this.lane.width * 0.86

    for (const [p, arch] of [[start, createStartArch()], [finish, createFinishArch()]]) {
      const a = place(arch, p.x, p.z, Math.atan2(p.dx, p.dz))
      paint.checker(p.x, p.z, a.tx, a.tz, 2.4, band, { cells: 9 })
    }

    // Ein paar Winkel vor dem Start: sie zeigen, in welche Richtung die Bahn
    // laeuft, bevor man sie sehen kann.
    for (let s = this.startS - 9; s < this.startS - 2; s += 3) {
      if (s < 0) continue
      const p = this.pointAt(s)
      paint.chevron(p.x, p.z, p.dx, p.dz, 2.6, 0x9fb4cc)
    }

    if (!this.withGates) {
      group.add(paint.build({ name: 'bahn-markierung' }))
      this.world.scene.add(group)
      return
    }

    // --- Tore ----------------------------------------------------------
    // Die letzte Torhoehe muss vor dem Ziel liegen, sonst haengt ein Tor im
    // Zielbogen.
    let alternate = -1
    let i = 0
    for (let s = this.startS + GATE_START; s < this.finishS - 6; s += GATE_SPACING) {
      const p = this.pointAt(s)
      const bend = this.curvatureAt(s)
      // In der Kurve nach innen, auf der Geraden im Wechsel. Innen heisst:
      // auf die Seite, zu der die Bahn dreht – dorthin faehrt man ohnehin.
      let side
      if (Math.abs(bend) > BEND) {
        side = Math.sign(bend)
      } else {
        side = alternate
        alternate = -alternate
      }
      // Nach einer Kurve soll der Wechsel weitergehen, nicht die Seite
      // wiederholen, auf der man gerade schon war.
      if (Math.abs(bend) > BEND) alternate = -side

      const offset = side * GATE_OFFSET
      const x = p.x + p.dz * offset
      const z = p.z - p.dx * offset
      const red = i % 2 === 0
      const gate = createSlalomGate({ color: red ? 'red' : 'blue', number: i + 1 })
      const a = place(gate, x, z, Math.atan2(p.dx, p.dz))

      // Die Durchfahrt im Schnee: ein Balken in der Torfarbe zwischen den
      // Stangen, auf derselben Achse wie das Tor. Von oben sieht man dadurch
      // die Linie und nicht nur die Stangen.
      const half = GATE_WIDTH / 2 - 0.3
      paint.bar(
        x - a.sx * half, z - a.sz * half,
        x + a.sx * half, z + a.sz * half,
        0.7, red ? RED : BLUE,
      )

      this.gates.push({ s, offset, index: i, passed: false, missed: false })
      i++
    }

    group.add(paint.build({ name: 'bahn-markierung' }))
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
