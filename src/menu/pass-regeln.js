import { LAKE, SUMMIT, lakeRadius, klammAt, inFunpark } from '../world/heightfield.js'
import { terraceDistance } from '../world/areas/apres-layout.js'

// Wann was im Pistenpass faellt. Alles wird hier im Loop abgelesen, statt
// dass jede Anlage selbst den Pass kennt: Lift, Rennstrecke und Seebank
// haben ihren Zustand ohnehin offen liegen, und so bleibt jede Regel an einer
// Stelle. Nur Tricks kommen als Meldung herein – der Fahrer legt sie ab, und
// main.js raeumt sie im selben Bild wieder weg.

const STATIONEN = ['werkstatt', 'kontakt', 'kasse', 'upload', 'shortener', 'worktime', 'packlist', 'drone', 'firetruck']

// Am Tellerlift: so weit muss man zur Seite, damit ein Wechsel zaehlt. Die
// Spur laesst 1,7 zu; 1,1 heisst deutlich ausgeschert, nicht nur gezuckt.
const LIFT_AUSSCHERT = 1.1
const LIFT_WECHSEL = 4

export class PassRegeln {
  constructor(pass, { skier, props, stations, map, flight = null }) {
    this.flight = flight
    this.pass = pass
    this.skier = skier
    this.props = props
    this.stations = stations
    this.map = map

    this._t = 0
    this._liftSeite = 0
    this._liftWechsel = 0
    this._nordVorher = false
    this._still = 0

    // Aussicht genossen: jede Taste, jeder Klick, jede Beruehrung setzt die
    // Uhr zurueck. Eigene Horcher, weil Input nur Spieltasten kennt.
    const wach = () => { this._still = 0 }
    for (const ev of ['keydown', 'pointerdown', 'wheel']) window.addEventListener(ev, wach, { passive: true, capture: true })

    // Erst wenn der Ladebildschirm weg ist – sonst verpufft die Meldung darunter.
    setTimeout(() => { if (new Date().getHours() < 5) pass.erreiche('nacht') }, 2200)
  }

  // Aus main.js, sobald der Fahrer eine Figur ablegt.
  trick(text) {
    // „540°“, aber auch „CORK 540° · PERFEKT“: es zaehlt die Drehung.
    const grad = Number(/(\d+)°/.exec(text)?.[1] ?? 0)
    if (grad >= 540) this.pass.erreiche('d540')
    if (grad >= 720) this.pass.erreiche('d720')
  }

  update(dt) {
    const p = this.pass
    const s = this.skier
    const { x, z } = s.position

    // --- jedes Bild: was an einem Moment haengt ------------------------

    // Schlepplift: Seitenwechsel waehrend einer Fahrt zaehlen.
    const r = this.props.lift.rider
    if (r) {
      const seite = r.offset > LIFT_AUSSCHERT ? 1 : r.offset < -LIFT_AUSSCHERT ? -1 : 0
      if (seite && seite !== this._liftSeite) {
        if (this._liftSeite) this._liftWechsel++
        this._liftSeite = seite
        if (this._liftWechsel >= LIFT_WECHSEL) p.erreiche('schwarzfahrt')
      }
    } else {
      this._liftSeite = 0
      this._liftWechsel = 0
    }

    const nord = this.props.northRun._gefahren
    if (nord && !this._nordVorher) p.entdecke('nord')
    this._nordVorher = nord

    const race = this.props.race.lastRun
    if (race && race !== this._rennen) {
      this._rennen = race
      if (race.total <= 4.5) p.erreiche('bronze')
      if (race.total <= 4.2) p.erreiche('silber')
      if (race.total <= 3.9) p.erreiche('gold')
    }

    // Mit schnurgerader Ideallinie zeigt der Speedcheck 59–60 km/h, aus 20
    // bis 50 Metern Anlauf gemessen. 60 hiesse: nur ein Autopilot.
    if (this.props.speedCheck.last >= 58) p.erreiche('kmh58')

    // Aussicht: kein Menue, kein Fenster, nur schauen. Der Rundflug zaehlt
    // nicht – er dauert fast eine Minute, und die Aussicht waere geschenkt.
    const offen = this.map.open || !!document.querySelector('dialog[open]') || this.flight?.active
    this._still = offen ? 0 : this._still + dt
    if (this._still >= 60) p.erreiche('aussicht')

    // --- viermal pro Sekunde: Orte --------------------------------------
    this._t += dt
    if (this._t < 0.25) return
    this._t = 0

    const zumSee = Math.hypot(x - LAKE.x, z - LAKE.z)
    if (zumSee < lakeRadius(Math.atan2(z - LAKE.z, x - LAKE.x)) - 1.5) p.entdecke('see')
    if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < 7) p.entdecke('gipfel')
    if (terraceDistance(x, z) < 0) p.entdecke('huette')
    if (inFunpark(x, z)) p.entdecke('park')
    // Teppich oder Karussell: wer eines davon benutzt, war im Kinderland.
    const kl = this.props.kinderland
    if (kl.carpet.rider || kl.carousel?.rider) p.entdecke('kinderland')

    const st = this.stations.active
    if (st && STATIONEN.includes(st.id)) p.entdecke(st.id)

    if (this.props.landscape.bench.broken) p.erreiche('bankrott')

    // In der Klamm: am Grund, nicht im Flug darueber.
    if (!s.airborne && klammAt(x, z) < -3) p.erreiche('klamm')
  }
}
