import { LAKE, SUMMIT, lakeRadius, klammAt } from '../world/heightfield.js'
import { terraceDistance } from '../world/apres-layout.js'
import { TRAILS } from '../world/paths.js'
import { lawinenstufe } from '../world/props/map-board.js'

// Wann welches Abzeichen faellt. Fast alles wird hier im Loop abgelesen, statt
// dass jede Anlage selbst den Pass kennt: Lift, Teppich, Rennstrecke und
// Seebank haben ihren Zustand ohnehin offen liegen, und so bleibt jede
// Regel an einer Stelle. Nur Tricks kommen als Meldung herein – der Fahrer
// legt sie ab, und main.js raeumt sie im selben Bild wieder weg.

const STATIONEN = ['werkstatt', 'kontakt', 'kasse', 'upload', 'shortener', 'worktime', 'packlist', 'drone', 'firetruck']
const WEG_ENDE = Object.entries(TRAILS).map(([id, t]) => ({ id, x: t.path.at(-1)[0], z: t.path.at(-1)[1] }))

// Am Tellerlift: so weit muss man zur Seite, damit ein Wechsel zaehlt. Die
// Spur laesst 1,7 zu; 1,1 heisst deutlich ausgeschert, nicht nur gezuckt.
const LIFT_AUSSCHERT = 1.1
const LIFT_WECHSEL = 4

// Hoehenmeter: nur was pro Bild plausibel ist. Ein Versetzen (R, Schnell-
// reise) springt um Meter und darf nicht als Abfahrt zaehlen.
const HM_SPRUNG = 0.8

export class PassRegeln {
  constructor(pass, { skier, world, props, stations, lift, hints, map }) {
    this.pass = pass
    this.skier = skier
    this.world = world
    this.props = props
    this.stations = stations
    this.lift = lift
    this.hints = hints
    this.map = map

    this._t = 0
    this._y = null
    this._liftSeite = 0
    this._liftWechsel = 0
    this._pflug = 0
    this._leucht = false
    this._nordVorher = false
    this._still = 0

    // Aussicht genossen: jede Taste, jeder Klick, jede Beruehrung setzt die
    // Uhr zurueck. Eigene Horcher, weil Input nur Spieltasten kennt.
    const wach = () => { this._still = 0 }
    for (const ev of ['keydown', 'pointerdown', 'wheel']) window.addEventListener(ev, wach, { passive: true, capture: true })

    // Was schon beim Laden feststeht, meldet sich erst, wenn der Ladebildschirm
    // weg ist – sonst verpufft die Pille darunter.
    setTimeout(() => this._beimLaden(), 2200)
  }

  _beimLaden() {
    const p = this.pass
    const jetzt = new Date()
    if (jetzt.getHours() < 5) p.erreiche('nacht')
    if (p.besuch(jetzt) >= 3) p.erreiche('stammgast')
    if (lawinenstufe(jetzt) >= 4) p.erreiche('lawine')
  }

  // Aus main.js, sobald der Fahrer eine Figur ablegt.
  trick(text) {
    const p = this.pass
    const grad = parseInt(text, 10)
    if (grad >= 180) p.erreiche('d180')
    if (grad >= 360) p.erreiche('d360')
    if (grad >= 540) p.erreiche('d540')
    if (grad >= 720) p.erreiche('d720')
    if (text === 'RAILSLIDE') p.erreiche('rail')
    if (text === 'EINGESCHNEIT') p.erreiche('eingeschneit')
  }

  // Aus dem R-Weg in main.js.
  zurueck() {
    if (this.pass.zaehle('heimweh') >= 10) this.pass.erreiche('heimweh')
  }

  update(dt) {
    const p = this.pass
    const s = this.skier
    const { x, z } = s.position

    // --- jedes Bild: was an einem Moment haengt ------------------------

    // Hoehenmeter nur bergab und nur im freien Fahren; am Lift geht es
    // ohnehin bergauf, auf der Rail zaehlt es mit.
    if (this._y !== null && !s.tow) {
      const fall = this._y - s.position.y
      if (fall > 0 && fall < HM_SPRUNG) {
        const hm = p.zaehle('hm', fall)
        if (hm >= 300) p.erreiche('hm300')
        if (hm >= 8848) p.erreiche('everest')
      }
    }
    this._y = s.position.y

    // Schlepplift: Seitenwechsel waehrend einer Fahrt zaehlen.
    const r = this.lift.rider
    if (r) {
      const seite = r.offset > LIFT_AUSSCHERT ? 1 : r.offset < -LIFT_AUSSCHERT ? -1 : 0
      if (seite && seite !== this._liftSeite) {
        if (this._liftSeite) this._liftWechsel++
        this._liftSeite = seite
        if (this._liftWechsel >= LIFT_WECHSEL) p.erreiche('schwarzfahrt')
      }
      if (r.progress >= 0.9) p.erreiche('lift')
    } else {
      this._liftSeite = 0
      this._liftWechsel = 0
    }

    // Pflug: S am Stueck halten. Nicht an Fahrt gebunden – der Pflug bremst
    // in gut einer Sekunde auf null, fuenf Sekunden Pflug in Fahrt gibt es
    // im Fahrmodell nicht.
    this._pflug = s.plough > 0.6 && !s.tow ? this._pflug + dt : 0
    if (this._pflug >= 5) p.erreiche('pizza')

    // Ueber einen Stein: world.resolve hat ihn im Sprung ausgelassen.
    if (this.world.uebersprungen) {
      this.world.uebersprungen = 0
      p.erreiche('stein')
    }

    // Leuchtstrecke: vom Anfang bis zum Ende in der Gasse, ohne sie zu
    // verlassen. Wer seitlich einfaedelt, hat sie nicht durchfahren.
    const lr = this.props.kinderland.lightRun
    const { s: along, off } = lr.project(x, z)
    const drin = Math.abs(off) < 4.5
    if (drin && along > -2 && along < 4) this._leucht = true
    else if (!drin || along < -2) this._leucht = false
    if (this._leucht && along > lr.length - 3) {
      this._leucht = false
      p.erreiche('leucht')
    }

    const nord = this.props.northRun._gefahren
    if (nord && !this._nordVorher) p.erreiche('nord')
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
    const kmh = this.props.speedCheck.last
    if (kmh >= 50) p.erreiche('kmh50')
    if (kmh >= 58) p.erreiche('kmh58')

    // Aussicht: kein Menue, kein Fenster, nur schauen.
    const offen = this.map.open || !!document.querySelector('dialog[open]')
    this._still = offen ? 0 : this._still + dt
    if (this._still >= 60) p.erreiche('aussicht')

    // --- viermal pro Sekunde: Orte --------------------------------------
    this._t += dt
    if (this._t < 0.25) return
    this._t = 0

    const zumSee = Math.hypot(x - LAKE.x, z - LAKE.z)
    if (zumSee < lakeRadius(Math.atan2(z - LAKE.z, x - LAKE.x)) - 1.5) p.erreiche('see')
    if (Math.hypot(x - SUMMIT.x, z - SUMMIT.z) < 7) p.erreiche('gipfel')
    if (terraceDistance(x, z) < 0) p.erreiche('huette')
    if (this.props.kinderland.carpet.rider?.progress >= 0.9) p.erreiche('teppich')

    for (const w of WEG_ENDE) {
      if (Math.hypot(x - w.x, z - w.z) < 5 && p.merke('wege', w.id) >= 4) p.erreiche('wege')
    }

    const st = this.stations.active
    if (st && STATIONEN.includes(st.id)) {
      if (p.merke('stationen', st.id) >= STATIONEN.length) p.erreiche('stationen')
      if (st.id === 'drone') p.erreiche('drohne')
      if (st.id === 'firetruck') p.erreiche('loeschzug')
    }

    if (this.props.landscape.bursts > 0) p.erreiche('schauer')
    if (this.props.landscape.bench.broken) p.erreiche('bankrott')
    // Drei auf einmal: eine Fackel liegt gut drei Sekunden, und die Abstaende
    // im Kranz sind 7,2 m – mehr schafft man nur, wenn man genau auf dem
    // Kreis bleibt.
    if (this.props.torches.filter((t) => t.obj.userData.liegt()).length >= 3) p.erreiche('lichter')

    // In der Klamm: am Grund, nicht im Flug darueber.
    if (!s.airborne && klammAt(x, z) < -3) p.erreiche('klamm')

    // Verfranzt ist die eine Haelfte der R-Pille: abseits zwischen Baeumen.
    if (this.hints._lost >= 7) p.erreiche('verfranzt')
  }
}
