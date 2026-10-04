// Was man an der Huette umfahren kann, ohne three.js: die Reihe im
// Skistaender, die wie Dominosteine faellt, und die Becher, die vom Tisch
// fliegen. Dargestellt wird es in apres-terrace.js; hier steht nur, wie es
// sich bewegt – damit es sich ohne Szene pruefen laesst (tests/umstossen).
//
// Befriedigend heisst hier: es dauert. Ein Ski, der sofort flach liegt, ist
// ein Schalter. Einer, der erst langsam kippt, dann schneller wird, den
// naechsten mitnimmt und am Boden noch einmal nachfedert, ist ein Ereignis.

// --- Skistaender: eine Reihe, die kippt --------------------------------------
//
// Jedes Brett steht am Fuss in der Reihe und kippt seitlich um diesen Fuss,
// laengs der Reihe (winkel > 0 nach +, < 0 nach −). Wie ein umfallender Stab:
// die Beschleunigung waechst mit sin(winkel), am Anfang kaum, am Ende viel.
// Kommt die Spitze an den Nachbarn, stoesst sie ihn an und lehnt sich an ihn,
// bis er selbst weit genug ist. Das letzte liegt flach.

const FALL = 9.8 * 1.5            // 3g/(2L) fuer einen Stab, L ~ 1 m
const LIEGT = 1.42                // rad: flach am Boden, ein wenig angelehnt
export const AUFSTEHEN = 9        // s, bis jemand die Reihe wieder aufstellt

export class Kippreihe {
  constructor(anzahl, { abstand = 0.38, laenge = 1.7 } = {}) {
    this.abstand = abstand
    this.laenge = laenge
    // So weit kippt eines, bis seine Spitze am Nachbarn ist.
    this.kontakt = Math.asin(Math.min(1, abstand / laenge))
    this.teile = Array.from({ length: anzahl }, () => ({ winkel: 0, w: 0 }))
    this.ruhe = 0
    this.gefallen = 0
  }

  get steht() {
    return this.teile.every((t) => t.winkel === 0 && t.w === 0)
  }

  // Ein Stoss gegen Teil i. richtung ±1 laengs der Reihe, staerke in rad/s.
  stoss(i, richtung, staerke) {
    const t = this.teile[i]
    if (!t) return
    // Liegt es schon in die andere Richtung, bleibt es liegen.
    if (Math.abs(t.winkel) > 0.3 && Math.sign(t.winkel) !== richtung) return
    t.w += richtung * staerke
    this.ruhe = AUFSTEHEN
  }

  update(dt, { aufstellen = true } = {}) {
    const T = this.teile
    for (let i = 0; i < T.length; i++) {
      const t = T[i]
      if (t.winkel === 0 && t.w === 0) continue
      const s = Math.sign(t.winkel || t.w)
      // Ganz aufrecht faellt nichts: ein kleiner Schubs richtet sich wieder auf.
      if (Math.abs(t.winkel) < 0.06 && Math.abs(t.w) < 0.6) {
        t.w += -t.winkel * 40 * dt - t.w * 6 * dt
      } else {
        t.w += s * FALL / this.laenge * Math.sin(Math.abs(t.winkel)) * dt
      }
      t.winkel += t.w * dt

      // Am Nachbarn: anstossen und anlehnen.
      const j = i + s
      const n = T[j]
      if (n && Math.abs(t.winkel) > this.kontakt + Math.abs(n.winkel) * (Math.sign(n.winkel) === s ? 1 : 0)) {
        const halt = this.kontakt + (Math.sign(n.winkel) === s ? Math.abs(n.winkel) : 0)
        if (Math.abs(n.winkel) < LIEGT - 0.05) {
          if (Math.abs(n.w) < Math.abs(t.w) * 0.7) n.w = s * Math.max(Math.abs(t.w) * 0.7, 1.1)
          t.winkel = s * Math.min(Math.abs(t.winkel), halt)
          t.w = s * Math.min(Math.abs(t.w), Math.abs(n.w))
        }
      }
      // Am Boden: einmal nachfedern, dann liegen.
      if (Math.abs(t.winkel) >= LIEGT) {
        t.winkel = s * LIEGT
        t.w = Math.abs(t.w) > 1.2 ? -t.w * 0.28 : 0
      }
      if (Math.abs(t.winkel) < 0.0005 && Math.abs(t.w) < 0.01) {
        t.winkel = 0
        t.w = 0
      }
    }
    this.gefallen = T.filter((t) => Math.abs(t.winkel) > 1).length

    if (this.ruhe > 0) this.ruhe -= dt
    else if (aufstellen && !this.steht) {
      // Wieder hingestellt, eines nach dem anderen von oben – kein Fallen
      // rueckwaerts, sondern ein ruhiges Aufrichten.
      const k = 1 - Math.exp(-3.5 * dt)
      for (const t of T) {
        t.w = 0
        t.winkel -= t.winkel * k
        if (Math.abs(t.winkel) < 0.002) t.winkel = 0
      }
    }
  }
}

// --- Becher: fliegen, springen, rollen, liegen --------------------------------

const G = 9.8

export class Wurfteil {
  constructor() {
    this.fliegt = false
    this.liegt = false
    this.x = 0; this.y = 0; this.z = 0
    this.vx = 0; this.vy = 0; this.vz = 0
    this.kipp = 0      // rad um die Querachse: 0 steht, PI/2 liegt
    this.kippW = 0
    this.dreh = 0      // rad um die Hochachse
    this.drehW = 0
  }

  werfen(x, y, z, vx, vy, vz, drall = 0) {
    Object.assign(this, { x, y, z, vx, vy, vz, fliegt: true, liegt: false, zeit: 0 })
    this.kippW = 6 + Math.abs(drall) * 4
    this.drehW = drall * 5
  }

  // boden(x, z) liefert die Hoehe darunter.
  update(dt, boden) {
    if (!this.fliegt) return
    // Auf einem Hang hoerte das Springen nie auf: jeder Meter bergab war ein
    // neuer Fall (gemessen hinter der Huette, nach drei Sekunden noch 0,3 m/s).
    // Nach vier Sekunden liegt er, wo er ist.
    this.zeit += dt
    if (this.zeit > 4) {
      this.y = boden(this.x, this.z) + 0.05
      this.kipp = Math.PI / 2
      this.fliegt = false
      this.liegt = true
      return
    }
    this.vy -= G * dt
    this.x += this.vx * dt
    this.y += this.vy * dt
    this.z += this.vz * dt
    this.kipp += this.kippW * dt
    this.dreh += this.drehW * dt
    const g = boden(this.x, this.z) + 0.05
    if (this.y <= g) {
      this.y = g
      if (this.vy < -1.6) {
        // Aufschlag: springt kleiner wieder hoch, rutscht weiter.
        this.vy *= -0.32
        this.vx *= 0.55
        this.vz *= 0.55
        this.kippW *= 0.5
      } else {
        // Ausrollen und liegen bleiben – auf der Seite.
        this.vy = 0
        const reib = Math.exp(-4 * dt)
        this.vx *= reib
        this.vz *= reib
        this.drehW *= reib
        this.kippW = 0
        this.kipp += (Math.PI / 2 - (this.kipp % Math.PI)) * (1 - Math.exp(-10 * dt))
        if (Math.hypot(this.vx, this.vz) < 0.25) {
          this.fliegt = false
          this.liegt = true
        }
      }
    }
  }
}
