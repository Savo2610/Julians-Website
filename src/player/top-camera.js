import * as THREE from 'three'
import { CAMERA } from '../config.js'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)

// Kamera mit fester Ausrichtung von schraeg oben. Sie folgt dem Fahrer, dreht
// sich aber nie – dadurch bleiben die Himmelsrichtungen und damit die
// Tastenbelegung ueber die ganze Fahrt stabil.

export class TopCamera {
  constructor(camera) {
    this.camera = camera
    this.camera.fov = CAMERA.fov
    this.camera.updateProjectionMatrix()

    // Konstanter Versatz vom Fahrer zur Kamera.
    this.offset = new THREE.Vector3(
      Math.cos(CAMERA.elevation) * Math.sin(CAMERA.azimuth),
      Math.sin(CAMERA.elevation),
      Math.cos(CAMERA.elevation) * Math.cos(CAMERA.azimuth),
    )

    this.target = new THREE.Vector3()
    this._desired = new THREE.Vector3()
    this._shake = 0
    this._initialised = false
  }

  addShake(amount) {
    this._shake = Math.min(1, this._shake + amount)
  }

  update(dt, skier, input) {
    // Zoom weich nachziehen, damit das Scrollrad nicht springt.
    const wanted = input ? input.zoom : 1
    this._zoom = this._zoom === undefined ? wanted : this._zoom + (wanted - this._zoom) * damp(6, dt)

    // Blickpunkt laeuft der Fahrt etwas voraus, damit man sieht, wo man
    // hinfaehrt, ohne dass sich das Bild dreht.
    const leadScale = THREE.MathUtils.clamp(skier.speed / 13, 0, 1.3)
    this._desired.set(
      skier.position.x + skier.forward.x * CAMERA.lead * leadScale,
      skier.position.y + CAMERA.lookHeight,
      skier.position.z + skier.forward.z * CAMERA.lead * leadScale,
    )

    if (!this._initialised) {
      this.target.copy(this._desired)
      this._initialised = true
    }
    this.target.lerp(this._desired, damp(CAMERA.aimLerp, dt))

    const dist = CAMERA.distance * this.zoomScale
    this.camera.position.copy(this.offset).multiplyScalar(dist).add(this.target)

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
