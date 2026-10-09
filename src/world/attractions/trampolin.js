import { TRAMPOLIN, terrainHeight, muldeTiefe } from '../heightfield.js'
import { SPRUNG } from '../../config.js'

// Das Trampolin im Kinderland: wer auf das Tuch faehrt oder springt, sinkt
// ein und wird senkrecht hochgeworfen – das Fangnetz, nur liegend (Ansage
// 09.10.). Gerechnet wird ohne three.js (Tests in tests/trampolin.test.js);
// das Bild baut props/trampolin.js und liest nur die Delle (delle()).
//
// Dieselbe Mechanik wie Netz, Lift und Rail: auf dem Tuch bekommt der Fahrer
// ein `tow`, die Fahrphysik ruht. Aufgefangen wird nach skier.update()
// (pruefen), im selben Bild, in dem er das Tuch erreicht; gefuehrt wird
// davor (update). Zwischen zwei Beruehrungen fliegt er frei, mit der
// Schwerkraft des Funparks und dessen Figuren (skier.figurFlug).
//
// Die Feder ist ungedaempft: was hineinfaellt, kommt mit demselben Tempo
// wieder heraus. Verloren wird erst beim Abwurf (ABGABE), und die Leertaste
// legt etwas dazu (SCHWUNG) – wie auf einem echten Trampolin, wo man unten
// durch die Knie drueckt. Gerechnet (1/240 s, ω 9, g 13): wer mit 4 m/s
// faellt, sinkt 0,63 m ein und ist nach 0,38 s wieder draussen; mit
// 11,5 m/s 1,40 m in 0,40 s. Ohne Taste wird jeder Sprung um ein Siebtel
// kleiner, mit Taste waechst er von 4 auf den Deckel in vier Spruengen.

const OMEGA = 9           // 1/s – das Tuch ist straffer als das Netz
const G = SPRUNG.schwerkraft
const ABGABE = 0.86       // so viel vom Tempo kommt ohne Taste zurueck
const SCHWUNG = 3.0       // m/s mehr, wer auf dem Tuch die Leertaste drueckt
const VORHALT = 0.18      // s: so frueh vor dem Aufsetzen zaehlt ein Druck schon
const DECKEL = 11.5       // m/s: 5,1 m Scheitel, 1,77 s Flug
const ZU_KLEIN = 2.4      // m/s: darunter springt man nicht mehr, man steht
const REIBUNG = 2.4       // 1/s, das Tuch haelt fest, was quer laeuft
const MITTE = 7           // 1/s² je Meter Delle: die Delle zieht zur Mitte
const SCHIEBEN = 3.5      // m/s², wer auf dem Tuch W drueckt, kommt voran
const DREHEN = 2.4        // rad/s, so schnell drehen A/D auf dem Tuch
const GLEITEN = 2.6       // m/s, mit so viel faehrt man im Stehen vom Tuch
const RAND = 0.12         // m innerhalb des Tuchrands faengt es

// Das Tuch ohne Fahrer schwingt kurz nach, schneller als mit ihm.
const TUCH_OMEGA = 16
const TUCH_DAEMPFUNG = 4

export class Trampolin {
  constructor(t = TRAMPOLIN) {
    this.x = t.x
    this.z = t.z
    this.r = t.r
    this.y = t.h
    this.fang = null
    // Fuer das Bild: wo die Delle sitzt und wie tief sie ist.
    this.tuch = { x: t.x, z: t.z, tiefe: 0, tempo: 0 }
    // Solange man springt oder im Sprung vom Tuch ist. Der Pistenpass
    // zaehlt Figuren von hier nicht (pass-regeln.js): ein 720 auf dem
    // Trampolin ist leichter als im Park.
    this.imSpiel = false
    this.spruenge = 0
    this._druck = -1
  }

  _abstand(x, z) {
    return Math.hypot(x - this.x, z - this.z)
  }

  // Nach skier.update(): ist der Fahrer eben auf das Tuch gekommen?
  pruefen(skier) {
    if (this.fang || skier.tow) return false
    const { x, z } = skier.position
    if (this._abstand(x, z) >= this.r - RAND) {
      // Ein Sprung, der neben dem Tuch endet, beendet das Spiel.
      if (!skier.airborne) this.imSpiel = false
      return false
    }
    const imFlug = skier.airborne
    let fallen
    if (imFlug) {
      // Im Flug: erst, wenn er von oben durch das Tuch kaeme.
      if (skier.vy > 0 || skier.position.y > this.y + 0.02) return false
      fallen = Math.max(0.8, -skier.vy)
    } else {
      // Hineingefahren: das Tuch gibt unter dem Gewicht nach, mehr bei Tempo.
      // Mit 6 m/s hinein gibt das einen Hopser von 0,45 m – mit 0,3 statt
      // 0,45 je m/s waren es 0,2 m, und man sah kaum, dass es ein Trampolin ist.
      fallen = Math.min(7, 1.6 + skier.speed * 0.45)
    }
    const quali = skier.aufgefangen()
    // Wer quer oder kopfueber landet, bringt das Tuch nicht zum Schwingen.
    if (quali === 'crash') fallen = Math.min(fallen, 1.5)
    const vx = skier._fahrt.x * skier.speed
    const vz = skier._fahrt.z * skier.speed
    this.fang = {
      x, z,
      vx: imFlug ? vx : vx * 0.8, vz: imFlug ? vz : vz * 0.8,
      // Im Flug ist er hoechstens ein Bild weit durchs Tuch; wer am Boden
      // steht (versetzt), steht auf dem Grund der Mulde – das Tuch faengt
      // trotzdem oben an.
      p: imFlug ? Math.min(0.3, Math.max(0, this.y - skier.position.y)) : 0,
      v: fallen,
      stehen: fallen < ZU_KLEIN && this._druck < 0,
      schwung: this._druck >= 0,
      heading: skier.heading,
    }
    this._druck = -1
    this.imSpiel = true
    skier.tow = this
    skier.towTarget = this._ziel()
    skier.airborne = false
    skier.vy = 0
    skier.height = 0
    this.gefangen?.(this.fang)
    return true
  }

  // Vor skier.update(): Tuch rechnen, Fahrer fuehren, oben loslassen.
  update(dt, skier, input) {
    // Ein Druck kurz vor dem Aufsetzen zaehlt noch.
    if (!this.fang && skier?.figurFlug && input?.justPressed?.('jump')) this._druck = 0
    if (this._druck >= 0) {
      this._druck += dt
      if (this._druck > VORHALT) this._druck = -1
    }

    const t = this.tuch
    const g = this.fang
    if (!g) {
      // Freies Nachschwingen.
      const n = 4
      for (let k = 0; k < n; k++) {
        const h = dt / n
        t.tempo += (-TUCH_OMEGA * TUCH_OMEGA * t.tiefe - TUCH_DAEMPFUNG * t.tempo) * h
        t.tiefe += t.tempo * h
      }
      return
    }
    if (!skier || skier.tow !== this) { this.fang = null; return }

    if (input?.justPressed?.('jump')) g.schwung = true
    const steer = input?.steer ?? 0
    g.heading -= steer * DREHEN * dt

    const n = 4
    const h = dt / n
    for (let k = 0; k < n; k++) {
      if (g.stehen) {
        // Im Stehen federt das Tuch auf seine Ruhelage, und der Fahrer
        // gleitet in Blickrichtung davon.
        const ruhe = G / (OMEGA * OMEGA)
        g.v += (-OMEGA * OMEGA * (g.p - ruhe) - 2 * OMEGA * g.v) * h
        g.p += g.v * h
        const fx = Math.sin(g.heading), fz = Math.cos(g.heading)
        const tempo = Math.max(GLEITEN, Math.hypot(g.vx, g.vz) * 0.98)
        g.vx += (fx * tempo - g.vx) * (1 - Math.exp(-4 * h))
        g.vz += (fz * tempo - g.vz) * (1 - Math.exp(-4 * h))
      } else {
        g.v += (G - OMEGA * OMEGA * g.p) * h
        g.p += g.v * h
        // Die Delle zieht zur Mitte, das Tuch bremst, was quer laeuft.
        const reib = Math.exp(-REIBUNG * h)
        g.vx = g.vx * reib - (g.x - this.x) * MITTE * Math.max(0, g.p) * h
        g.vz = g.vz * reib - (g.z - this.z) * MITTE * Math.max(0, g.p) * h
        if ((input?.throttle ?? 0) > 0) {
          g.vx += Math.sin(g.heading) * SCHIEBEN * h
          g.vz += Math.cos(g.heading) * SCHIEBEN * h
        }
      }
      g.x += g.vx * h
      g.z += g.vz * h
    }

    t.x = g.x
    t.z = g.z
    t.tiefe = this._sichtbar(g)
    t.tempo = g.v

    if (g.stehen) {
      // Leertaste im Stehen: man stoesst sich ab und springt wieder.
      if (g.schwung) {
        g.stehen = false
        g.schwung = false
        g.v = -(SCHWUNG + 1.5)
        this._loslassen(skier, -g.v)
        return
      }
      if (this._abstand(g.x, g.z) >= this.r) { this._absteigen(skier); return }
    } else if (g.p <= 0 && g.v < 0) {
      const raus = Math.min(DECKEL, -g.v * ABGABE + (g.schwung ? SCHWUNG : 0))
      if (raus < ZU_KLEIN) {
        g.stehen = true
        g.p = 0
        g.v = 0
      } else {
        this._loslassen(skier, raus)
        return
      }
    }
    skier.towTarget = this._ziel()
  }

  // So tief, wie das Tuch an dieser Stelle nachgeben kann: zum Rahmen hin
  // haelt es, und der Grund der Mulde soll nie durchscheinen.
  _sichtbar(g) {
    return Math.max(0, Math.min(g.p, muldeTiefe(this._abstand(g.x, g.z)) - 0.12))
  }

  _ziel() {
    const g = this.fang
    return { x: g.x, z: g.z, heading: g.heading }
  }

  // Vom Tuch in die Luft.
  _loslassen(skier, vy) {
    const g = this.fang
    this.fang = null
    this.spruenge++
    this.tuch.tiefe = 0
    this.tuch.tempo = -vy * 0.5
    const tempo = Math.hypot(g.vx, g.vz)
    skier.tow = null
    skier.towTarget = null
    skier.heading = g.heading
    skier.facing = g.heading
    skier._prevFacing = g.heading
    skier.swing = 0
    skier.forward.set(Math.sin(g.heading), 0, Math.cos(g.heading))
    if (tempo > 0.01) {
      skier._fahrt.x = g.vx / tempo
      skier._fahrt.z = g.vz / tempo
    } else {
      skier._fahrt.x = skier.forward.x
      skier._fahrt.z = skier.forward.z
    }
    skier.speed = tempo
    skier.airborne = true
    skier.figurFlug = true
    skier.vy = vy
    // Die Hoehe zaehlt ueber dem Boden der Mulde; geflogen wird frei
    // (freiFlug in heightfield.js), also auf fester Hoehe ueber Null.
    skier.height = this.y - terrainHeight(skier.position.x, skier.position.z)
    skier._luftY = null
    skier._rise = 0
    this.losgelassen?.({ vy })
  }

  // Im Stehen ueber den Rand: weiter auf Ski, ohne Sprung.
  _absteigen(skier) {
    const g = this.fang
    this.fang = null
    this.imSpiel = false
    const tempo = Math.hypot(g.vx, g.vz)
    skier.tow = null
    skier.towTarget = null
    skier.heading = g.heading
    skier.facing = g.heading
    skier._prevFacing = g.heading
    skier.forward.set(Math.sin(g.heading), 0, Math.cos(g.heading))
    skier._fahrt.x = skier.forward.x
    skier._fahrt.z = skier.forward.z
    skier.speed = tempo
  }

  delle() {
    return this.tuch
  }
}

// Was der Fahrer ueber `tow` liest. Das Tuch traegt, es zieht nicht.
Trampolin.prototype.grab = false
Trampolin.prototype.direkt = true
Object.defineProperty(Trampolin.prototype, 'speed', {
  get() { return this.fang ? Math.hypot(this.fang.vx, this.fang.vz) : 0 },
})
Object.defineProperty(Trampolin.prototype, 'lift', {
  get() {
    const g = this.fang
    if (!g) return 0
    // Unter dem Tuch liegt die Mulde: der Fahrer steht auf dem Tuch, nicht
    // auf ihrem Grund.
    return this.y - this._sichtbar(g) - terrainHeight(g.x, g.z)
  },
})
Object.defineProperty(Trampolin.prototype, 'haltung', {
  // In die Knie, je tiefer das Tuch nachgibt; beim Abdruecken gestreckt.
  get() {
    const g = this.fang
    if (!g) return null
    return { pitch: 0.06, crouch: Math.min(1.1, 0.2 + Math.max(0, g.p) * 0.75) }
  },
})
