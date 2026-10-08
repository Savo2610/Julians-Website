import { terrainHeight } from '../heightfield.js'

// Das gelbe Fangnetz an der Kante der Nordabfahrt: wer hineinfaehrt, wird
// gefangen, sinkt ein und wird zurueckgeworfen wie von einem Trampolin.
//
// Gerechnet wird ohne three.js (Tests in tests/fangnetz.test.js); das Bild
// dazu baut props/fangnetz.js und liest nur, wie tief das Netz wo eingedrueckt
// ist (beule()).
//
// Technisch dieselbe Mechanik wie Lift, Teppich und Rail: im Netz bekommt der
// Fahrer ein `tow` und eine Zielposition, die Fahrphysik ruht. Gefangen wird
// nach skier.update() (pruefen), damit die Beruehrung im selben Bild zaehlt,
// in dem sie passiert – vor dem Fahrer gefragt, stuende er schon ein Bild im
// Netz, bevor es nachgibt. Gefuehrt wird vor skier.update() (update), wie
// beim Lift.
//
// Die Feder ist zum Rand hin haerter (K waechst mit p²): so geht das Netz bei
// jedem Tempo sichtbar nach, schluckt aber auch 24 m/s auf weniger als drei
// Metern. Gerechnet (1/240 s): 8 m/s → 1,30 m tief, zurueck mit 5,9;
// 13 m/s → 1,86 m, zurueck mit 9,9, nach 0,46 s; 24 m/s → 2,76 m. Eine
// erste Fassung (5 / 0,5 / 1,4) nahm bei 13 m/s nur 1,55 m und gab 9,0
// zurueck – im Bild ein Netz, das kaum nachgab. Hinter dem Netz stehen keine
// Baeume und Felsen naeher als 2,3 m (imNetz in populate.js).

const OMEGA = 4.3        // 1/s, Eigenfrequenz am Anfang
const HAERTE = 0.6       // 1/m², wie stark die Feder zum Rand hin anzieht
const DAEMPFUNG = 1.0    // 1/s – gibt gut drei Viertel des Tempos zurueck
const FANG = 0.75        // m, Abstand der Fahrermitte vom Netz bei Beruehrung
const PFOSTEN_RAND = 0.3 // m, so nah an einen Pfosten heran faengt das Netz
// Die Beule rutscht im Netz bis hierher vom Pfosten weg: direkt am Pfosten
// gibt ein Netz nicht nach. Vorher fing es erst ab 0,7 m, und wer dazwischen
// traf (gemessen am Slalomnetz bei 0,66 m), prallte an der Reihe dahinter ab
// und verlor 70 % Tempo.
const BEULE_RAND = 1.2
const RAUS_MIN = 3.5     // m/s, auch wer langsam kommt, wird sichtbar zurueckgeschubst
const RAUS_MAX = 15
const QUER_REIBUNG = 3   // 1/s, das Netz haelt fest, was quer laeuft

// Das Netz ohne Fahrer schwingt aus, leichter und schneller als mit ihm.
const NETZ_OMEGA = 13
const NETZ_DAEMPFUNG = 3.2

export class Fangnetz {
  constructor({ pfosten, innen, hoehe }) {
    this.hoehe = hoehe
    this.felder = []
    for (let i = 0; i < pfosten.length - 1; i++) {
      const a = pfosten[i], b = pfosten[i + 1]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len
      // Die Normale zeigt nach innen, zur Bahn.
      let nx = -tz, nz = tx
      if ((innen.x - a.x) * nx + (innen.z - a.z) * nz < 0) { nx = -nx; nz = -nz }
      this.felder.push({
        a, b, len, tx, tz, nx, nz,
        // Was das Bild braucht: wo die Beule sitzt, wie tief, in welcher Hoehe.
        u: len / 2, tiefe: 0, tempo: 0, y: 0.9,
      })
    }
    this.fang = null
    this._vorher = null
  }

  // Lage eines Punktes zum Netz: Feld, Strecke entlang (u) und Abstand nach
  // innen (d). Nur Felder, in deren Laenge der Punkt liegt.
  lage(x, z) {
    let best = null
    this.felder.forEach((f, i) => {
      const u = (x - f.a.x) * f.tx + (z - f.a.z) * f.tz
      if (u < 0 || u > f.len) return
      const d = (x - f.a.x) * f.nx + (z - f.a.z) * f.nz
      if (d < -3 || d > 3) return
      if (!best || Math.abs(d) < Math.abs(best.d)) best = { feld: i, u, d }
    })
    return best
  }

  // Pfosten und eine Reihe Kreise knapp hinter dem Netz. Sie halten, wo das
  // Netz nicht faengt – am Pfosten, wer quer hineinrutscht, wer von hinten
  // kommt. Wer frei von innen kommt, faehrt hindurch (onHit sagt true) und
  // wird im selben Bild gefangen; sonst kostete der Anprall bis zu 80 %
  // Tempo, bevor das Netz es zurueckgeben kann.
  kollision(world) {
    const offen = { onHit: () => this._offen }
    for (const f of this.felder) {
      world.addCollider(f.a.x, f.a.z, 0.2)
      const n = Math.ceil(f.len / 0.5)
      for (let k = 1; k < n; k++) {
        const u = f.len * k / n
        world.addCollider(f.a.x + f.tx * u - f.nx * 0.25, f.a.z + f.tz * u - f.nz * 0.25, 0.3, offen)
      }
    }
    const b = this.felder.at(-1).b
    world.addCollider(b.x, b.z, 0.2)
  }

  _faengt(l) {
    if (!l || l.d < FANG - 0.05) return false
    const f = this.felder[l.feld]
    return l.u >= PFOSTEN_RAND && l.u <= f.len - PFOSTEN_RAND
  }

  // Nach skier.update(): ist der Fahrer eben ins Netz gefahren?
  pruefen(skier) {
    const l = this.lage(skier.position.x, skier.position.z)
    const vorher = this._vorher
    this._vorher = l
    this._offen = !this.fang && this._faengt(l)
    if (this.fang || skier.tow || !l || l.d >= FANG) return false
    // Nur wer von innen kommt: im Bild davor stand er noch davor.
    if (!this._faengt(vorher) || vorher.feld !== l.feld) return false
    const f = this.felder[l.feld]
    if (l.u < PFOSTEN_RAND || l.u > f.len - PFOSTEN_RAND) return false
    // Auch wer ueber das Netz fliegt, wird gefangen: vor dem Netz liegt eine
    // Schulter, die bei 24 m/s gut zwei Meter hoch wirft. Ohne Fang hielten
    // ihn die Kreise dahinter auf wie eine Wand.
    const vx = skier._fahrt.x * skier.speed, vz = skier._fahrt.z * skier.speed
    const hinein = -(vx * f.nx + vz * f.nz)
    const quer = vx * f.tx + vz * f.tz
    const boden = terrainHeight(skier.position.x, skier.position.z)
    this.fang = {
      feld: l.feld, u: l.u,
      p: FANG - l.d, v: Math.max(0.5, hinein), quer,
      heading: skier.heading,
      // Wer im Sprung hineinfliegt, sinkt im Netz auf den Schnee.
      luft: Math.max(0, skier.position.y - boden),
      y: Math.max(0.5, Math.min(1.3, 0.85 + skier.height)),
      boden,
      zeit: 0,
      stoss: Math.max(0.5, hinein),
    }
    // Das Netz uebernimmt: dieselbe Mechanik wie am Lift.
    skier.tow = this
    skier.towTarget = this._ziel()
    skier.airborne = false
    skier.vy = 0
    skier.height = 0
    skier._luftY = null
    this.gefangen?.(this.fang, f)
    return true
  }

  // Vor skier.update(): Feder rechnen, Fahrer fuehren, am Ende loslassen.
  update(dt, skier) {
    const n = 4
    const h = dt / n
    for (let k = 0; k < n; k++) {
      for (const [i, f] of this.felder.entries()) {
        if (this.fang?.feld === i) continue
        // Freies Ausschwingen
        const a = -NETZ_OMEGA * NETZ_OMEGA * f.tiefe - NETZ_DAEMPFUNG * f.tempo
        f.tempo += a * h
        f.tiefe += f.tempo * h
      }
      const g = this.fang
      if (!g) continue
      const a = -OMEGA * OMEGA * (1 + HAERTE * g.p * g.p) * g.p - DAEMPFUNG * g.v
      g.v += a * h
      g.p += g.v * h
      g.quer *= Math.exp(-QUER_REIBUNG * h)
      g.u += g.quer * h
    }
    const g = this.fang
    if (!g) return
    g.zeit += dt
    const f = this.felder[g.feld]
    const ziel = Math.max(BEULE_RAND, Math.min(f.len - BEULE_RAND, g.u))
    g.u += (ziel - g.u) * (1 - Math.exp(-8 * dt))
    g.luft *= Math.exp(-7 * dt)
    f.u = g.u
    f.tiefe = Math.max(0, g.p)
    f.tempo = g.v
    f.y = g.y
    if (!skier) return
    if (skier.tow !== this) { this.fang = null; return }
    if (g.p <= 0 && g.v < 0) this._loslassen(skier)
    else skier.towTarget = this._ziel()
  }

  _ziel() {
    const g = this.fang
    const f = this.felder[g.feld]
    const d = FANG - g.p
    return {
      x: f.a.x + f.tx * g.u + f.nx * d,
      z: f.a.z + f.tz * g.u + f.nz * d,
      // Er schaut ins Netz, solange es ihn haelt.
      heading: g.heading,
    }
  }

  _loslassen(skier) {
    const g = this.fang
    const f = this.felder[g.feld]
    this.fang = null
    // Das Netz schnellt mit, aber leichter als mit dem Fahrer darin: es
    // schwingt ueber die Ruhelage hinaus nach innen und pendelt aus.
    f.tiefe = 0
    f.tempo = g.v * 0.55
    const raus = Math.max(RAUS_MIN, Math.min(RAUS_MAX, -g.v))
    const quer = g.quer * 0.6
    const vx = f.nx * raus + f.tx * quer
    const vz = f.nz * raus + f.tz * quer
    const tempo = Math.hypot(vx, vz)
    const richtung = Math.atan2(vx, vz)

    skier.tow = null
    skier.towTarget = null
    // Die Fahrt geht zurueck, die Figur dreht sich erst in der Luft herum:
    // `spin` haelt die alte Blickrichtung fest und laeuft von selbst auf
    // null (skier._updateTrick) – eine halbe Pirouette nach dem Abwurf.
    const alt = skier.facing
    skier.heading = richtung
    skier.swing = 0
    skier.facing = richtung
    skier._prevFacing = richtung
    skier.forward.set(Math.sin(richtung), 0, Math.cos(richtung))
    let dreh = alt - richtung
    dreh = Math.atan2(Math.sin(dreh), Math.cos(dreh))
    skier.spin = dreh
    skier._fahrt.x = vx / tempo
    skier._fahrt.z = vz / tempo
    skier.speed = tempo
    // Ein kleiner Hopser: das Netz wirft, es schiebt nicht.
    skier.airborne = true
    skier.vy = 2.4 + raus * 0.14
    skier._luftY = null
    skier._rise = 0
    this.losgelassen?.({ raus, feld: f })
  }

  // Fuer das Bild: Beule je Feld (Lage entlang, Tiefe nach aussen, Hoehe).
  beule(i) {
    const f = this.felder[i]
    return { u: f.u, tiefe: f.tiefe, y: f.y }
  }
}

// Was der Lift ueber `tow` liest. Das Netz greift nicht nach dem Fahrer,
// es haelt ihn; die Position setzt es direkt, ohne Nachziehen – sonst
// hinge der Fahrer der Beule eine Handbreit hinterher.
Fangnetz.prototype.grab = false
Fangnetz.prototype.direkt = true
Object.defineProperty(Fangnetz.prototype, 'speed', {
  get() { return this.fang ? Math.abs(this.fang.v) : 0 },
})
Object.defineProperty(Fangnetz.prototype, 'lift', {
  get() {
    const g = this.fang
    if (!g) return 0
    // Hinter der Linie faellt der Hang weg: der Fahrer bleibt auf der Hoehe,
    // auf der er hineinkam, und sinkt nicht mit dem Gelaende ins Netz.
    const t = this._ziel()
    return Math.max(0, g.boden - terrainHeight(t.x, t.z)) + g.luft
  },
})
Object.defineProperty(Fangnetz.prototype, 'haltung', {
  // Ins Netz gelehnt, solange es nachgibt; beim Zurueckfedern hinten.
  get() { return this.fang ? { pitch: this.fang.v > 0 ? 0.32 : -0.18, crouch: 0.55 } : null },
})
