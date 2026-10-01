import * as THREE from 'three'
import { CAMERA, RIDER } from '../config.js'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)

// Die Kamera aus dem Skital: fest von schraeg oben, sie folgt dem Fahrer und
// dreht sich nie. So bleiben die Himmelsrichtungen stehen, und der See liest
// sich wie eine Karte, auf der man faehrt.
//
// Neu ist nur, dass sie mit dem Tempo atmet: bei 86 km/h geht sie vier Meter
// zurueck und oeffnet den Bildwinkel um sieben Grad. Das ist kein Effekt,
// den man bemerkt, aber ohne ihn fuehlten sich 20 m/s an wie 12. Am Steg
// kommt sie naeher heran, damit man den Start sieht.
export class TopCamera {
  constructor(camera) {
    this.camera = camera
    this.target = new THREE.Vector3()
    this._desired = new THREE.Vector3()
    this._offset = new THREE.Vector3()
    this._shake = 0
    this._speed = 0
    this._focus = 0
    this._initialised = false
    this.zoom = 1
    this._zoom = 1
    this._fov = 0
  }

  // focus: gleich am Ziel stehen statt hinzufahren. Aus dem Tal kommt man
  // mitten in der Verwandlung am Steg an, und dort muss das Bild sofort
  // stimmen – sonst fuhr die Kamera eine Sekunde lang von 34 auf 26 m heran.
  snap(focus = null) {
    this._initialised = false
    if (focus !== null) this._focus = focus
  }

  addShake(amount) {
    this._shake = Math.min(1, this._shake + amount)
  }

  // focus 0..1 zieht die Kamera an den Fahrer heran (Start am Steg).
  // showcase: fester Blickpunkt fuer den Titel, dann ist man weiter weg.
  update(dt, rider, { focus = 0, zoom = 1, showcase = null } = {}) {
    this._zoom += (zoom - this._zoom) * damp(6, dt)
    this._focus += (focus - this._focus) * damp(focus > this._focus ? 2.4 : 1.6, dt)
    const speed = rider.mode === 'crash' ? 0 : rider.speed
    this._speed += (speed - this._speed) * damp(1.8, dt)
    // Ab etwas ueber Seiltempo (15 m/s): wer nur haengt, sieht das ruhige
    // Bild, wer ausschwingt, das weite.
    const k = THREE.MathUtils.clamp((this._speed - 14) / (RIDER.maxSpeed - 14), 0, 1)
    const f = this._focus * this._focus * (3 - 2 * this._focus)

    let fov = CAMERA.fov + CAMERA.fovSpeed * k
    // Hochformat wie im Skital: erst den Bildwinkel oeffnen, dann zuruecktreten.
    const aspect = this.camera.aspect
    let portrait = 1
    if (aspect < 0.8) {
      const halfRad = THREE.MathUtils.degToRad(fov / 2)
      const need = Math.tan(halfRad) * 0.8 / aspect
      const limit = Math.tan(THREE.MathUtils.degToRad(28))
      fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.min(need, limit)))
      portrait = Math.min(1.35, need / Math.min(need, limit))
    }
    if (Math.abs(fov - this._fov) > 0.01) {
      this._fov = fov
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }

    let dist = ((CAMERA.distance + CAMERA.distSpeed * k) * this._zoom * (1 - f) + 26 * f) * portrait

    // Blickpunkt laeuft der Fahrt voraus. Die Hoehe folgt nur halb, sonst
    // huepft das ganze Bild bei jedem Sprung mit.
    const vx = rider.vx || 0
    const vz = rider.vz || 0
    const lead = CAMERA.lead * THREE.MathUtils.clamp(speed / 15, 0, 1.4) * (1 - f)
    const sp = Math.hypot(vx, vz) || 1
    this._desired.set(
      rider.x + (vx / sp) * lead,
      Math.max(0, rider.y) * 0.5 + CAMERA.lookHeight,
      rider.z + (vz / sp) * lead,
    )
    if (showcase) {
      this._desired.set(showcase.x, showcase.y, showcase.z)
      dist = showcase.distance * portrait
    }
    this._dist = this._dist === undefined || !this._initialised ? dist : this._dist + (dist - this._dist) * damp(2.2, dt)
    dist = this._dist
    if (!this._initialised) {
      this.target.copy(this._desired)
      this._initialised = true
    }
    this.target.lerp(this._desired, damp(CAMERA.aimLerp, dt))

    this._offset.set(
      Math.cos(CAMERA.elevation) * Math.sin(CAMERA.azimuth),
      Math.sin(CAMERA.elevation),
      Math.cos(CAMERA.elevation) * Math.cos(CAMERA.azimuth),
    )
    this.camera.position.copy(this._offset).multiplyScalar(dist).add(this.target)

    if (this._shake > 0.001) {
      const s = this._shake * 0.35
      this.camera.position.x += (Math.random() - 0.5) * s
      this.camera.position.y += (Math.random() - 0.5) * s
      this._shake *= 1 - damp(6, dt)
    }
    this.camera.lookAt(this.target)
  }
}
