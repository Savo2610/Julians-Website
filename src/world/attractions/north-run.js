import { NORTH_LANE } from '../heightfield.js'

// Die Nordabfahrt als Zustand – nicht als Gelaende, das steckt im Hoehenfeld,
// und nicht als Aufbau, der steht in populate.
//
// Ihre einzige Aufgabe: zu wissen, ob der Fahrer gerade auf ihr unterwegs ist.
// Daran haengt die Kamera. Gemessen wird das an der Bahnmitte und nicht am
// Startbogen: ein Tor liefert nur einen Moment, aber die Kamera muss ueber die
// ganze Fahrt eine Meinung haben – auch wenn jemand seitlich einfaedelt, in
// die Gegenrichtung faehrt oder auf halber Strecke in den Wald abbiegt.

// Ein und Aus liegen absichtlich weit auseinander. Bei einer einzigen Schwelle
// stuende die Kamera genau dort, wo man am ehesten faehrt – am Rand der Bahn –
// und schaltete im Sekundentakt hin und her.
const EIN = 8.0          // bis hierher neben der Mitte zaehlt als "auf der Piste"
const AUS = 12.5         // ab hier nicht mehr
const RAND = 2.0         // Sicherheitsabstand zu beiden Enden der Bahn
// Kurz daneben ist noch kein Ausstieg: ein weiter Schwung, ein Sprung oder ein
// Ausweichmanoever dauert keine halbe Sekunde.
const GEDULD = 0.4
// Wer unten angekommen ist, hat die Bahn gefahren. Ohne diese Sperre genuegte
// ein Ausrollen im Gegenhang, um wieder in die Verfolgerkamera zu rutschen:
// gemessen ging sie am Ziel zurueck auf die feste Kamera und eine Dreiviertel-
// sekunde spaeter, bei 77 von 80 Metern, wieder hinter den Fahrer. Erst
// fuenfzehn Meter zurueck den Berg hinauf zaehlt als "nochmal".
const NEUSTART = 15

export class NorthRun {
  constructor({ lane = NORTH_LANE } = {}) {
    this.lane = lane
    this.laenge = lane.total
    this.aktiv = false
    this.fortschritt = 0
    this.abstand = Infinity
    this._draussen = 0
    this._gefahren = false
  }

  // Nächster Punkt auf der Mittellinie: Bogenlaenge s und vorzeichenloser
  // Abstand. Anders als laneAt() im Hoehenfeld wird hier nicht ueber alle
  // Abschnitte gemittelt – fuer eine Ja-Nein-Frage ist der naechste Abschnitt
  // genau die richtige Antwort, und gemittelt waere sie an den Knicken falsch.
  project(x, z) {
    let bestD = Infinity
    let bestS = 0
    for (const g of this.lane.segments) {
      let t = ((x - g.x) * g.dx + (z - g.z) * g.dz) / g.len2
      t = t < 0 ? 0 : t > 1 ? 1 : t
      const px = g.x + g.dx * t
      const pz = g.z + g.dz * t
      const d = Math.hypot(x - px, z - pz)
      if (d < bestD) {
        bestD = d
        bestS = g.s0 + g.len * t
      }
    }
    return { s: bestS, d: bestD }
  }

  update(dt, skier) {
    const { s, d } = this.project(skier.position.x, skier.position.z)
    this.abstand = d
    this.fortschritt = s / this.laenge

    // Am Schlepplift ist die Frage nicht zu stellen: dort steuert man nicht,
    // und eine Kamera, die sich hinter einen haengenden Fahrer stellt, zeigt
    // die Trasse von unten.
    if (skier.tow) {
      this.aktiv = false
      this._draussen = 0
      return this.aktiv
    }

    // Die Sperre faellt erst, wenn man wieder deutlich weiter oben steht.
    if (this._gefahren && s < this.laenge - NEUSTART) this._gefahren = false

    const aufBahn = s > RAND && s < this.laenge - RAND
    if (this.aktiv) {
      const raus = !aufBahn || d > AUS
      this._draussen = raus ? this._draussen + dt : 0
      if (this._draussen > GEDULD) {
        this.aktiv = false
        this._draussen = 0
        // Unten hinaus heisst angekommen; seitlich hinaus heisst abgebogen,
        // und wer abbiegt, darf jederzeit wieder einfaedeln.
        if (s >= this.laenge - RAND) this._gefahren = true
      }
    } else if (aufBahn && d < EIN && !this._gefahren) {
      this.aktiv = true
      this._draussen = 0
    }
    return this.aktiv
  }
}
