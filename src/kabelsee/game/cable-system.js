import { CABLE } from '../config.js'
import { CABLE_LENGTH, cableAt, wrap } from '../world/cable-path.js'

// Die Mitnehmer auf dem Seil. Sie laufen gleichmaessig verteilt mit fester
// Geschwindigkeit um; einer davon zieht den Fahrer. Die Zeit laeuft nur
// vorwaerts, damit die Abstaende nie auseinanderdriften.

export class CableSystem {
  constructor() {
    this.count = CABLE.carriers
    this.spacing = CABLE_LENGTH / this.count
    this.speed = CABLE.speed
    // Versatz so, dass der erste Mitnehmer kurz nach dem Laden am Steg ist:
    // man soll nicht sieben Sekunden auf den ersten Buegel warten.
    this.offset = 0
    this._tmp = {}
  }

  sAt(i) {
    return wrap(this.offset + i * this.spacing)
  }

  update(dt) {
    this.offset = wrap(this.offset + this.speed * dt)
  }

  position(i, out = {}) {
    cableAt(this.sAt(i), out)
    out.vx = out.dx * this.speed
    out.vz = out.dz * this.speed
    return out
  }

  // Welcher Mitnehmer erreicht die Stelle s als naechster, und in wie vielen
  // Metern? Fuer den Start am Steg.
  nextArriving(s) {
    let best = 0
    let bestGap = Infinity
    for (let i = 0; i < this.count; i++) {
      const gap = wrap(s - this.sAt(i))
      if (gap < bestGap) {
        bestGap = gap
        best = i
      }
    }
    return { index: best, gap: bestGap, seconds: bestGap / this.speed }
  }

  // Stellt die Mitnehmer so, dass Nummer i in `seconds` Sekunden bei s ist.
  arrangeArrival(i, s, seconds) {
    this.offset = wrap(s - seconds * this.speed - i * this.spacing)
  }
}
