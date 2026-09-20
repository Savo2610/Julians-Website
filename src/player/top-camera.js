import * as THREE from 'three'
import { CAMERA, CHASE } from '../config.js'
import { terrainHeight } from '../world/heightfield.js'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)

// Der kuerzeste Weg von einem Winkel zum anderen. Immer vom *aktuellen* Wert
// aus gerechnet und nie vom Sollwert her – dadurch kann der Azimut nicht
// springen, egal wie der Fahrer gerade steht. Rechnete man stattdessen jedes
// Bild neu zwischen fester und mitdrehender Ausrichtung, dann kippte das
// Vorzeichen in dem Moment, in dem der Fahrer genau von der festen Kamera
// wegzeigt, und die Kamera schwenkte einmal ganz herum.
function kuerzerWeg(von, nach) {
  let d = nach - von
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

// Kamera mit zwei Betriebsarten.
//
// Im Regelfall steht sie fest von schraeg oben: sie folgt dem Fahrer, dreht
// sich aber nie. Dadurch bleiben die Himmelsrichtungen und damit die
// Tastenbelegung ueber die ganze Fahrt stabil.
//
// Auf der Nordabfahrt geht sie hinter den Fahrer und dreht mit ihm. Dazwischen
// wird nicht geschnitten, sondern geschwenkt: Azimut, Hoehe, Abstand und
// Bildwinkel wandern ueber gut eine Sekunde von der einen Einstellung in die
// andere. Ein harter Schnitt waere billiger zu haben, aber der Zuschauer
// verloere die Orientierung genau in dem Moment, in dem er sie braucht – er
// faehrt ja weiter, waehrend die Kamera umzieht.
export class TopCamera {
  constructor(camera) {
    this.camera = camera
    this.camera.fov = CAMERA.fov
    this.camera.updateProjectionMatrix()

    this.target = new THREE.Vector3()
    this._desired = new THREE.Vector3()
    this._offset = new THREE.Vector3()
    this._shake = 0
    this._initialised = false

    // Azimut der Kamera als fortlaufender Winkel – er wird nie normiert,
    // damit ein mehrfaches Umrunden keine Sprungstelle erzeugt.
    this._az = CAMERA.azimuth
    this.verfolgt = 0      // 0 = feste Kamera, 1 = hinter dem Fahrer
    this._will = 0
    this._fov = CAMERA.fov
  }

  // Von der Nordabfahrt gerufen. Nur ein Wunsch – die Ueberblendung besorgt
  // update(), und zwar in beide Richtungen gleich.
  verfolgen(an) {
    this._will = an ? 1 : 0
  }

  addShake(amount) {
    this._shake = Math.min(1, this._shake + amount)
  }

  update(dt, skier, input) {
    // Zoom weich nachziehen, damit das Scrollrad nicht springt.
    const wanted = input ? input.zoom : 1
    this._zoom = this._zoom === undefined ? wanted : this._zoom + (wanted - this._zoom) * damp(6, dt)

    const t = this.verfolgt
    this.verfolgt += (this._will - this.verfolgt) * damp(CHASE.blende, dt)

    // Hinter dem Fahrer heisst: entgegen seiner Fahrtrichtung. Gefolgt wird
    // dem angesteuerten Heading und nur zu einem knappen Drittel dem Schwung –
    // der Fahrer pendelt von selbst um bis zu 0,55 rad, und diese Bewegung
    // gehoert ins Bild und nicht in die Kamera.
    const hinten = skier.heading + skier.swing * CHASE.swingAnteil + Math.PI
    const ziel = this._will ? hinten : CAMERA.azimuth
    // Beim Umschalten langsam, danach zuegig: der Schwenk soll als Bewegung
    // lesbar sein, die laufende Verfolgung aber nicht hinterherhaengen.
    const rate = this._will ? 1.9 + 3.4 * t : 2.4
    this._az += kuerzerWeg(this._az, ziel) * damp(rate, dt)

    const elevation = CAMERA.elevation + (CHASE.elevation - CAMERA.elevation) * t
    const lookHeight = CAMERA.lookHeight + (CHASE.lookHeight - CAMERA.lookHeight) * t
    const lead = CAMERA.lead + (CHASE.lead - CAMERA.lead) * t
    // Der Zoom wirkt nur auf die feste Kamera. Hinter dem Fahrer hat ein
    // Mausrad nichts zu suchen: dort ist der Abstand Teil des Fahrgefuehls.
    const dist = CAMERA.distance * this.zoomScale * (1 - t) + CHASE.distance * t

    const fov = CAMERA.fov + (CHASE.fov - CAMERA.fov) * t
    if (Math.abs(fov - this._fov) > 0.01) {
      this._fov = fov
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }

    // Blickpunkt laeuft der Fahrt etwas voraus, damit man sieht, wo man
    // hinfaehrt.
    const leadScale = THREE.MathUtils.clamp(skier.speed / 13, 0, 1.3)
    this._desired.set(
      skier.position.x + skier.forward.x * lead * leadScale,
      skier.position.y + lookHeight,
      skier.position.z + skier.forward.z * lead * leadScale,
    )

    if (!this._initialised) {
      this.target.copy(this._desired)
      this._az = this._will ? hinten : CAMERA.azimuth
      this.verfolgt = this._will
      this._initialised = true
    }
    this.target.lerp(this._desired, damp(CAMERA.aimLerp, dt))

    this._offset.set(
      Math.cos(elevation) * Math.sin(this._az),
      Math.sin(elevation),
      Math.cos(elevation) * Math.cos(this._az),
    )
    this.camera.position.copy(this._offset).multiplyScalar(dist).add(this.target)

    // Bodenfreiheit – nur fuer die Verfolgerkamera noetig. Sie steht bei 17
    // Grad nur gut vier Meter ueber dem Blickpunkt und dreizehn dahinter; auf
    // dem Steilstueck am Einstieg liegt der Hang hinter dem Fahrer schon drei
    // Meter hoeher, und bei einem Sprung oder einer Kuppe taucht sie sonst in
    // den Schnee. Die feste Kamera aus dreiunddreissig Metern hat das Problem
    // nie – deshalb wirkt die Anhebung mit der Ueberblendung und nicht immer.
    if (t > 0.01) {
      const boden = terrainHeight(this.camera.position.x, this.camera.position.z) + 1.3
      if (this.camera.position.y < boden) {
        this.camera.position.y += (boden - this.camera.position.y) * t
      }
    }

    if (this._shake > 0.001) {
      const s = this._shake * 0.3
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
      this._shake *= 1 - damp(6, dt)
    }

    this.camera.lookAt(this.target)
  }

  get zoomScale() {
    return this._zoom ?? 1
  }
}
