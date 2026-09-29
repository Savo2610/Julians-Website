import * as THREE from 'three'

// Die Station selbst antippen, nicht nur ihre Einladung.
//
// Beobachtet (29.09.): Wer die Seite am Handy zum ersten Mal sieht, tippt auf
// die Huette, das Terminal, die Kasse – auf das Ding, das er sieht, und nicht
// auf die Schrift darueber. Das Tippen ging bisher in den Schnee und schloss
// hoechstens eine offene Auswahl. Jetzt zaehlt es wie die Einladung.
//
// Nur die Station, vor der man gerade steht: ein Tipp auf eine ferne Huette
// soll nicht quer durchs Tal etwas oeffnen, und am Rechner bleibt ein Klick
// ins Bild sonst folgenlos.
//
// Getroffen wird kein Mesh, sondern eine Kugel um die Station. Nicht jede
// Station hat ein einzelnes Objekt (die Werkstatt fuehrt als object nur die
// Bank, getippt wird aber auf die Huette), und eine Kugel ist nachsichtig mit
// dicken Fingern. 3,4 m Radius deckt Huette, Kasse und Kontaktpodest; mehr
// griffe am Handy schon den Fahrer davor mit.

const RADIUS = 3.4        // m
const HOEHE = 1.8         // m ueber dem Boden: Mitte der Kugel
const TIPP_PX = 10        // mehr Weg zwischen Druecken und Loslassen ist Ziehen
const TIPP_MS = 450       // laenger ist Halten (Daumenstick)

export class Antippen {
  constructor(dom, camera, registry, { onUse, darf = () => true }) {
    this.dom = dom
    this.camera = camera
    this.registry = registry
    this.onUse = onUse
    this.darf = darf
    this._ray = new THREE.Raycaster()
    this._ndc = new THREE.Vector2()
    this._kugel = new THREE.Sphere()
    this._down = null

    dom.addEventListener('pointerdown', (e) => {
      // Ob getippt werden darf, entscheidet der Moment des Drueckens: main.js
      // schliesst beim Druecken eine offene Auswahl, und beim Loslassen
      // saehe es dann so aus, als waere nie eine offen gewesen.
      this._down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId, darf: this.darf() }
    })
    dom.addEventListener('pointerup', (e) => {
      const d = this._down
      this._down = null
      if (!d || d.id !== e.pointerId || !d.darf) return
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > TIPP_PX) return
      if (performance.now() - d.t > TIPP_MS) return
      // Im Ereignis selbst, nicht im naechsten Bild: Safari oeffnet Links
      // nur waehrend einer Nutzergeste.
      if (this.trifft(e.clientX, e.clientY)) this.onUse()
    })
    // Am Rechner zeigt der Zeiger, dass man klicken kann.
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return
      dom.style.cursor = this.darf() && this.trifft(e.clientX, e.clientY) ? 'pointer' : ''
    })
  }

  // Liegt der Punkt auf der Station, vor der man steht?
  trifft(x, y) {
    const s = this.registry.active
    if (!s) return false
    const r = this.dom.getBoundingClientRect()
    this._ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    this._ray.setFromCamera(this._ndc, this.camera)
    this._kugel.center.set(s.position.x, (s.groundY ?? 0) + HOEHE, s.position.z)
    this._kugel.radius = RADIUS
    return this._ray.ray.intersectsSphere(this._kugel)
  }
}
