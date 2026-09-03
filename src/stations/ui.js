import * as THREE from 'three'

// Der Hinweis zu einer Station ist bewusst HTML und kein 3D-Text: er bleibt
// dadurch bei jeder Zoomstufe gestochen scharf und laesst sich wie der Rest
// der Seite gestalten. Positioniert wird er ueber die Projektion der
// Weltkoordinate.

export class StationUI {
  constructor(container, camera) {
    this.camera = camera
    this.current = null

    this.el = document.createElement('div')
    this.el.className = 'station-card'
    this.el.innerHTML = `
      <div class="station-dot"></div>
      <div class="station-body">
        <div class="station-title"></div>
        <div class="station-sub"></div>
      </div>
      <div class="station-key"><kbd>E</kbd></div>
      <div class="station-choices"></div>
    `
    container.appendChild(this.el)

    this.titleEl = this.el.querySelector('.station-title')
    this.subEl = this.el.querySelector('.station-sub')
    this.dotEl = this.el.querySelector('.station-dot')
    this.keyEl = this.el.querySelector('.station-key')
    this.choicesEl = this.el.querySelector('.station-choices')

    this._world = new THREE.Vector3()
  }

  update(station) {
    if (station !== this.current) {
      this.current = station
      if (station) {
        // Verdrahtet ist eine Station, wenn irgendein Weg von ihr wegfuehrt –
        // eine Adresse, eine eigene Handlung oder wenigstens eine Auswahl, in
        // der etwas steht.
        const wired = !!(station.url || station.onUse
          || station.choices?.some((c) => c.url))
        this.titleEl.textContent = station.label
        this.subEl.textContent = wired ? station.hint : 'noch nicht verlinkt'
        this.dotEl.style.background = station.color || '#4a6c93'
        // Eine Station mit mehreren Zielen zeigt sie beide an, mit der Ziffer
        // davor, mit der man sie waehlt. Der Tastenknopf E entfaellt dann –
        // sonst stuenden drei Tasten auf einer Karte, von denen eine nichts
        // Eigenes tut.
        this._renderChoices(station)
        const hasChoices = this.choicesEl.childElementCount > 0
        this.keyEl.style.display = !hasChoices && wired ? '' : 'none'
        this.el.classList.add('visible')
        // Neustart der Einblend-Animation.
        this.el.classList.remove('pop')
        void this.el.offsetWidth
        this.el.classList.add('pop')
      } else {
        this.el.classList.remove('visible')
      }
    }
    if (!station) return

    this._world.set(station.position.x, station.labelHeight ?? 2.4, station.position.z)
    this._world.project(this.camera)
    const x = (this._world.x * 0.5 + 0.5) * window.innerWidth
    const y = (-this._world.y * 0.5 + 0.5) * window.innerHeight
    this.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`
  }

  // Die Zeilen einer Auswahlstation. Ein Ziel ohne Adresse bleibt sichtbar,
  // aber blass und ohne Ziffer: man soll sehen, dass es das gibt und dass es
  // noch nicht verdrahtet ist, statt zu raten, warum die Taste nichts tut.
  _renderChoices(station) {
    this.choicesEl.replaceChildren()
    if (!station.choices?.length) return
    station.choices.slice(0, 2).forEach((choice, i) => {
      const row = document.createElement('div')
      row.className = choice.url ? 'station-choice' : 'station-choice off'
      row.innerHTML = `<kbd>${i + 1}</kbd><span></span>`
      row.querySelector('span').textContent = choice.label
      if (choice.color) row.style.setProperty('--choice', choice.color)
      this.choicesEl.appendChild(row)
    })
  }

  flash() {
    this.el.classList.remove('used')
    void this.el.offsetWidth
    this.el.classList.add('used')
  }
}
