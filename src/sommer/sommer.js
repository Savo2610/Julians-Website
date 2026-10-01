import './sommer.css'
import { zeitscheiben } from '../core/zeitscheiben.js'
import { BADESTEG } from '../world/heightfield.js'
import { KabelseeListe } from './bestenliste.js'

// Vom Badesteg in den Sommer und zurueck.
//
// Am Steg Enter: der Fahrer stellt sich vorn auf die Bohlen, die Kamera
// faehrt heran, drei Sekunden zaehlen herunter, und waehrenddessen baut sich
// der Kabelsee im Hintergrund (nachgeladen, in Scheiben, im Renderer des
// Tals). Bei null die Verwandlung, und man steht am Startsteg des Kabelsees,
// den Buegel schon im Anflug – einen zweiten Countdown gibt es dort nicht.
// Esc oder „Zurueck in den Winter“ spielt die Verwandlung rueckwaerts, und
// man steht wieder auf dem Badesteg.
//
// Das Tal steht still, solange Sommer ist: kein Schritt, kein Bild. Der See
// bleibt nach dem ersten Besuch gebaut, der zweite Weg ist sofort da.

const COUNTDOWN = 3
// Die Talkamera steht beim Countdown so weit weg wie die Kamera des
// Kabelsees am Startsteg (26 m, gleicher Winkel, gleiche Brennweite): im
// Moment der Verwandlung sind beide Fahrer gleich gross und am selben Fleck.
const ABSTAND = 26
const DAUER = 1.6
// So lange gleitet der Fahrer an seinen Platz vorn auf dem Steg.
const HINSTELLEN = 0.7
// Buegel ab Beginn der Verwandlung: gut eine Sekunde nach ihrem Ende –
// Zeit genug, um zu sehen, wo man ist und dass unten „Leertaste halten“
// steht, und knapp genug, dass es direkt losgeht. Mit 1,6 s kam er noch
// waehrend der Verwandlung, und man wurde vom Steg gerissen, bevor man den
// See gesehen hatte.
const ANKUNFT = 2.8

const gl = (t) => t * t * (3 - 2 * t)
const winkel = (a, b, t) => a + (Math.atan2(Math.sin(b - a), Math.cos(b - a))) * t

export class Sommer {
  // eis: der zugefrorene See (props/lake.js), fuer die Risse im Countdown.
  constructor({ renderer, canvas, scene, camera, chase, skier, input, registry, steg, eis, touch }) {
    Object.assign(this, { renderer, canvas, scene, camera, chase, skier, input, registry, steg, eis, touch })
    this.zustand = 'winter'     // countdown, hin, sommer, zurueck
    this.see = null
    this._bau = null
    this._t = 0
    this._zeit = 0
    this.verwandlung = null
    // Die Bestenliste des Sees; die Uebersicht (M) zeigt sie im Winter mit.
    this.liste = new KabelseeListe()
    this.liste.onAngebot = (an) => this.see?.hud.angebot(an)

    this.zahl = document.createElement('div')
    this.zahl.className = 'frost sommer-zahl'
    document.body.appendChild(this.zahl)
    this._zahl = ''

    // Die Station sitzt vorn auf dem Steg, ohne Ring im Schnee: dort liegt
    // Holz. Kein Heranzoomen mit Auswahl – der Countdown ist die Vorfuehrung.
    registry.add({
      id: 'kabelsee',
      label: 'Kabelsee',
      hint: 'In den Sommer',
      color: '#2a8f9c',
      position: { x: steg.stand.x, z: steg.stand.z },
      radius: 2.6,
      groundY: BADESTEG.hoehe,
      labelHeight: BADESTEG.hoehe + 2.4,
      onUse: () => this.starten(),
    })
  }

  get aktiv() {
    return this.zustand !== 'winter'
  }

  // Zeichnet der Sommer gerade (ganz oder halb)?
  get imSommer() {
    return this.zustand === 'sommer'
  }

  // Tasten des Tals, solange nicht Winter ist: alle verbraucht, Esc bricht
  // den Countdown ab. Im Sommer hoert der See selbst zu (kabelsee/core/input.js).
  taste(aktion) {
    if (this.zustand === 'winter') return false
    if (this.zustand === 'countdown' && aktion === 'back') this.abbrechen()
    return true
  }

  // Das Modul schon holen, wenn man sich dem Steg naehert: 34 kB, die man
  // sonst erst im Countdown laedt. Gebaut wird erst nach Enter.
  // Die Verwandlung (ihr Shader) kommt mit: sie wird erst nach dem
  // Countdown gebraucht und muss nicht mit dem Tal geladen werden.
  vorladen() {
    this._modul ??= Promise.all([import('../kabelsee/see.js'), import('./verwandlung.js')])
    return this._modul
  }

  _bauen() {
    this._bau ??= (async () => {
      const [{ createKabelsee }, { Verwandlung }] = await this.vorladen()
      this._Verwandlung = Verwandlung
      const see = await createKabelsee({
        renderer: this.renderer,
        canvas: this.canvas,
        touch: this.touch,
        eingebettet: true,
        pause: zeitscheiben(6),
        onZurueck: () => this.zurueck(),
        onStart: () => this.liste.start(),
        onErgebnis: (e) => this.liste.ziel(e),
        onListe: () => this.liste.oeffnen(),
      })
      see.verlassen()
      // Shader im Hintergrund uebersetzen (KHR_parallel_shader_compile), sonst
      // haengt das erste Bild der Verwandlung.
      await this.renderer.compileAsync(see.scene, see.camera)
      this.see = see
      return see
    })()
    return this._bau
  }

  starten() {
    if (this.zustand !== 'winter') return
    this.zustand = 'countdown'
    this._t = 0
    this._von = { x: this.skier.position.x, z: this.skier.position.z, heading: this.skier.heading }
    this.input.locked = true
    this.chase.fokus({ x: this.steg.stand.x, y: BADESTEG.hoehe + 0.6, z: this.steg.stand.z, abstand: ABSTAND })
    this._bauen().catch((e) => {
      // Netz weg oder WebGL am Ende: zurueck in den Winter, und beim
      // naechsten Enter wird neu versucht statt am alten Fehler zu haengen.
      console.error(e)
      this._modul = this._bau = null
      this.abbrechen()
    })
  }

  abbrechen() {
    if (this.zustand !== 'countdown') return
    this.zustand = 'winter'
    this.input.locked = false
    this.chase.fokus(null)
    this._setzeZahl('')
    this.eis.risse(0)
  }

  zurueck() {
    if (this.zustand !== 'sommer') return
    this.zustand = 'zurueck'
    this._t = 0
    this.see.verlassen()
    this.verwandlung.mitteAus(this._fahrerSommer(), this.see.camera)
  }

  _setzeZahl(text) {
    if (text === this._zahl) return
    this._zahl = text
    this.zahl.textContent = text
    this.zahl.classList.remove('beat')
    void this.zahl.offsetWidth
    if (text) this.zahl.classList.add('beat')
  }

  _fahrerSommer() {
    const r = this.see.rider
    return { x: r.x, y: Math.max(0, r.y) + 0.9, z: r.z }
  }

  // Jedes Bild, aus der Schleife des Tals. Im Sommer ruft main.js nur noch
  // advance() und draw() von hier.
  update(dt) {
    this._zeit += dt
    if (this.zustand === 'winter') {
      const s = this.steg.stand
      // Ein Fehler hier zeigt sich erst, wenn jemand Enter drueckt (_bauen).
      if (!this._modul && Math.hypot(this.skier.position.x - s.x, this.skier.position.z - s.z) < 30) this.vorladen().catch(() => {})
      return
    }
    this._t += dt

    if (this.zustand === 'countdown') {
      // Hinstellen: vorn auf den Steg, Blick uebers Eis.
      const k = gl(Math.min(1, this._t / HINSTELLEN))
      const s = this.steg.stand
      this.skier.versetzen(
        this._von.x + (s.x - this._von.x) * k,
        this._von.z + (s.z - this._von.z) * k,
        winkel(this._von.heading, s.heading, k),
      )
      // Risse: mit jedem Schlag ein Ruck, dazwischen wachsen sie nach.
      const schlag = Math.min(COUNTDOWN, this._t)
      const ganz = Math.floor(schlag)
      this.eis.risse((ganz + gl(Math.min(1, (schlag - ganz) * 3)) * 0.8 + (schlag >= COUNTDOWN ? 0.2 : 0)) / COUNTDOWN, s.x, s.z)
      const rest = COUNTDOWN - this._t
      if (rest > 0) this._setzeZahl(String(Math.ceil(rest)))
      else if (this.see) this._hin()
      // Ist der See bei null noch nicht fertig (langsames Netz), bleibt die
      // Eins stehen, bis er da ist.
      return
    }

    if (this.zustand === 'hin' || this.zustand === 'zurueck') {
      this.see.advance(dt)
      // Die Anzeige des Sees kommt erst, wenn der Sommer das Bild hat.
      const p = Math.min(1, this._t / DAUER)
      this.see.root.style.opacity = this.zustand === 'hin' ? gl(Math.max(0, (p - 0.6) / 0.4)).toFixed(3) : '0'
      if (this._t >= DAUER) {
        if (this.zustand === 'hin') {
          this.zustand = 'sommer'
        } else {
          this.zustand = 'winter'
          this.see.root.style.opacity = ''
          // Ueber den Sommer ist das Eis wieder zugefroren.
          this.eis.risse(0)
          this.input.locked = false
          this.chase.fokus(null)
          document.documentElement.classList.remove('sommer')
        }
      }
    }
  }

  _hin() {
    this._setzeZahl('')
    this.zustand = 'hin'
    this._t = 0
    this.verwandlung ??= new this._Verwandlung(this.renderer)
    // Mitte: der Fahrer im Winterbild. Der Kabelsee-Fahrer steht im
    // Sommerbild am selben Fleck (gleiche Kamera, gleicher Abstand).
    const p = this.skier.position
    this.verwandlung.mitteAus({ x: p.x, y: p.y + 0.9, z: p.z }, this.camera)
    document.documentElement.classList.add('sommer')
    this.see.betreten({ ankunft: ANKUNFT })
  }

  // Im Sommer: nur der See.
  advance(dt) {
    this._zeit += dt
    this.see.advance(dt)
  }

  // true, wenn hier gezeichnet wurde; sonst zeichnet main.js das Tal.
  draw() {
    if (this.zustand === 'sommer') {
      this.see.draw()
      return true
    }
    if (this.zustand !== 'hin' && this.zustand !== 'zurueck') return false
    const p = Math.min(1, this._t / DAUER)
    this.verwandlung.zeichnen(this.zustand === 'hin' ? p : 1 - p, this._zeit,
      (ziel) => {
        this.renderer.setRenderTarget(ziel)
        this.renderer.render(this.scene, this.camera)
      },
      (ziel) => this.see.draw(ziel),
    )
    return true
  }

  resize() {
    this.see?.resize()
  }
}
