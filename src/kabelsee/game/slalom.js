import { GATES, offsetAt } from '../world/features.js'
import { CABLE_LENGTH } from '../world/cable-path.js'

// Der Slalom: Fahnen im Wechsel innen und aussen. Gewertet wird, wenn der
// Fahrer auf der Bahn an einer Fahne vorbeikommt, aus seinem seitlichen
// Versatz. Jede Fahne zaehlt fuer sich; wer in einer Runde alle schafft,
// bekommt den Bonus. Reine Rechnung wie tricks.js, damit der Test den
// Slalom im Terminal fahren kann.

// So weit darf man innen an der Fahne vorbei, das ist ein Streifen mit der
// Hantel und zaehlt noch.
const TOLERANCE = 0.6

export class Slalom {
  constructor(gates = GATES) {
    this.gates = gates
    this.events = []
    this.reset()
  }

  reset() {
    this.passed = new Set()   // in dieser Runde
    this.total = 0            // in der Session
    this.runs = 0             // ganze Slaloms
    this.beste = 0            // meiste Fahnen in einer Runde (Auswertung)
    this._lastS = null
  }

  update(rider) {
    if (rider.mode !== 'ride' || rider.released) {
      this._lastS = null
      return
    }
    const s = rider.s
    const last = this._lastS
    this._lastS = s
    if (last === null) return
    let ds = s - last
    if (ds > CABLE_LENGTH / 2) ds -= CABLE_LENGTH
    if (ds < -CABLE_LENGTH / 2) ds += CABLE_LENGTH
    if (ds <= 0 || ds > 20) return
    for (const g of this.gates) {
      let d = g.s - last
      if (d < 0) d += CABLE_LENGTH
      if (d > 0 && d <= ds) this.judge(g, rider)
    }
  }

  judge(g, rider) {
    if (g.index === 0) {
      this.passed.clear()
      this.events.push({ type: 'lap' })
    }
    const off = offsetAt(g.s, rider.x, rider.z)
    const ok = off * g.side >= Math.abs(g.offset) - TOLERANCE
    if (ok) {
      this.passed.add(g.index)
      this.total += 1
      this.beste = Math.max(this.beste, this.passed.size)
      const all = this.passed.size === this.gates.length
      if (all) this.runs += 1
      // streak: wie viele Fahnen in dieser Runde schon, diese mitgezaehlt.
      this.events.push({ type: 'gate', gate: g, n: g.index + 1, of: this.gates.length, all, streak: this.passed.size })
    } else if (this.passed.has(g.index - 1)) {
      // Nur melden, wer mitten im Slalom war; wer ueber die Kicker faehrt,
      // hat ihn nicht verpasst, sondern nicht gewollt.
      this.events.push({ type: 'miss', gate: g })
    }
  }
}
