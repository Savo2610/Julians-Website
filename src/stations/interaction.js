import { CAMERA } from '../config.js'

// Was an einer Station passiert, wenn man Enter drueckt (oder tippt).
//
// Eine Station mit einem Ziel oeffnet es sofort. Eine mit mehreren – die
// Skikasse, die Werkstatt – zoomt heran: der Fahrer bleibt stehen, die Kamera
// faehrt auf das Objekt zu, unten klappt die Auswahl auf, und die Pfeiltasten
// wechseln zwischen den Zielen. Das Objekt zeigt mit, welches gewaehlt ist.
//
// Alles hier laeuft *im* Tasten- oder Klickereignis und nicht im naechsten
// Bild. Das ist der Grund, warum Safari die Links jetzt oeffnet: dort zaehlt
// window.open nur waehrend einer Nutzergeste, und eine Geste endet mit ihrem
// Ereignis.

export class StationInteraction {
  constructor({ registry, ui, input, camera, skier, map = null, flight = null, bestenliste = null }) {
    this.map = map
    this.bestenliste = bestenliste
    this.flight = flight
    this.registry = registry
    this.ui = ui
    this.input = input
    this.camera = camera
    this.skier = skier
    this.focus = null
    this.selected = 0
    this.rohrpost = null

    ui.onUse = () => this.press('use')
    ui.onPick = (i) => this._open(i)
    ui.onHover = (i) => this._select(i)
    ui.onClose = () => this.leave()
  }

  // true = die Aktion ist hier verbraucht und bewegt den Fahrer nicht.
  press(action) {
    if (this.flight?.active) return this.flight.press(action)
    // Waehrend die Kamera der Rohrpost folgt: Esc, Enter oder die Karte
    // holen sie zurueck; Lenken ist ohnehin gesperrt.
    if (this.rohrpost?.aktiv && this.input.locked) {
      if (action === 'back' || action === 'use' || action === 'map') this.rohrpost.ueberspringen()
      return true
    }
    if (this.map?.open) return this.map.press(action)
    if (action === 'map' && this.map && !this.skier.tow) {
      this.leave()
      this.map.show('links')
      return true
    }
    if (action === 'reset' && this.map && !this.skier.tow) {
      this.leave()
      this.onReset?.()
      return true
    }
    if (action === 'tab') return false
    if (this.focus) {
      const n = this.focus.choices.length
      switch (action) {
        case 'left': this._select((this.selected + n - 1) % n); return true
        case 'right': this._select((this.selected + 1) % n); return true
        case 'use': this._open(this.selected); return true
        case 'pick1': this._open(0); return true
        case 'pick2': this._open(1); return true
        case 'pick3': if (n > 2) this._open(2); return true
        case 'back': this.leave(); return true
        // W und S fuehren aus der Auswahl hinaus – und W faehrt gleich los,
        // deshalb wird es nicht verbraucht.
        case 'forward': case 'brake': this.leave(); return false
        default: return false
      }
    }

    const s = this.registry.active
    // Gleich nach dem Slalom-Ziel: Enter traegt ein. Eine Station davor
    // hat Vorrang, aber am Zielbogen steht keine.
    if (action === 'use' && !s && this.bestenliste?.angebotOffen) return this.bestenliste.oeffnen()
    // Am Lift und am Teppich gehoert Enter dem Ausstieg.
    if (!s || this.skier.tow) return false
    if (action === 'use') {
      if (s.map && this.map) this.map.show('karte')
      else if (s.choices?.length) this.enter(s)
      else {
        this.registry.trigger()
        this.ui.flash()
      }
      return true
    }
    if ((action === 'pick1' || action === 'pick2') && s.choices) {
      this.registry.trigger(action === 'pick1' ? 0 : 1)
      this.ui.flash()
      return true
    }
    return false
  }

  enter(station) {
    this.focus = station
    this.selected = 0
    this.input.locked = true
    const f = station.focus ?? {}
    // Der Blickpunkt rueckt ein Stueck zur Kamera hin. Dadurch steht das
    // Objekt im oberen Teil des Bildes und nicht hinter der Auswahl.
    const vor = f.vor ?? 1.2
    this.camera.fokus({
      x: station.position.x + Math.sin(CAMERA.azimuth) * vor,
      y: station.groundY + (f.hoehe ?? 1.2),
      z: station.position.z + Math.cos(CAMERA.azimuth) * vor,
      abstand: f.abstand ?? 10,
    })
    this.ui.openSheet(station, this.selected)
    station.object?.userData.select?.(this.selected)
  }

  leave() {
    if (!this.focus) return
    this.focus.object?.userData.select?.(null)
    this.focus = null
    this.input.locked = false
    this.camera.fokus(null)
    this.ui.closeSheet()
  }

  _select(i) {
    if (!this.focus || i === this.selected) return
    this.selected = i
    this.ui.select(i)
    this.focus.object?.userData.select?.(i)
  }

  _open(i) {
    if (!this.focus) return
    this._select(i)
    const focus = this.focus
    if (this.registry.trigger(i)) {
      this.ui.flash(i)
      focus.object?.userData.press?.(i)
    } else {
      this.ui.nope(i)
    }
    // Untertitel koennen vom Zustand abhaengen (Ticket geloest).
    if (this.focus) this.ui.refresh(this.focus)
  }

  // Jedes Bild: faehrt der Fahrer doch irgendwie weg (Lift, Rutschen), klappt
  // die Auswahl von selbst zu.
  update() {
    if (this.focus && this.registry.active !== this.focus) this.leave()
    // Aus der Luft schwebte sonst die Einladung der Drohne ueber dem Tal.
    this.ui.update(this.flight?.active ? null : this.registry.active)
  }
}
