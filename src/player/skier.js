import * as THREE from 'three'
import { SKIER, WORLD } from '../config.js'
import { terrainHeight, slopeAlong, PLATEAU, playAreaDistance } from '../world/heightfield.js'
import { createSkierModel } from './skier-model.js'

const damp = (rate, dt) => 1 - Math.exp(-rate * dt)

export class Skier {
  constructor(world) {
    this.world = world
    this.group = createSkierModel()
    this.parts = this.group.userData.parts

    this.position = new THREE.Vector3(PLATEAU.x, 0, PLATEAU.z + 2)
    this.heading = Math.PI          // angesteuerte Zielrichtung
    this.facing = Math.PI           // tatsaechliche Fahrtrichtung inkl. Schwung
    this.swingPhase = 0
    this.swing = 0
    this.speed = 0
    this.turn = 0
    this.steer = 0
    this.lean = 0
    this.pitch = 0
    this.crouch = 0
    this.airborne = false
    this.vy = 0
    this._rise = 0                  // Steiggeschwindigkeit, die der Boden zuletzt vorgab
    this._prevGroundY = 0
    this.tow = null          // haengt am Schlepplift, wenn gesetzt
    this.towTarget = null
    this.height = 0                 // Hoehe ueber dem Boden
    this.slope = 0
    this.carving = 0

    this.forward = new THREE.Vector3(0, 0, -1)
    this._prevFacing = this.facing
    this._trailPrev = [new THREE.Vector2(), new THREE.Vector2()]
    this._trailInit = false

    this.position.y = terrainHeight(this.position.x, this.position.z)
    this._prevGroundY = this.position.y
    this.group.position.copy(this.position)
  }

  update(dt, input, trail) {
    if (this.tow && this.towTarget) {
      this._updateTowed(dt, input, trail)
      return
    }

    const carveKey = input.has('carve')
    this.carving += ((carveKey ? 1 : 0) - this.carving) * damp(9, dt)

    // --- Lenkung -------------------------------------------------------
    // A/D drehen die Fahrtrichtung aus Sicht des Fahrers. Positives steer =
    // nach rechts; da forward = (sin h, cos h) ist, muss das Heading dafuer
    // abnehmen.
    const steerInput = input.steer
    this.steer += (steerInput - this.steer) * damp(SKIER.steerLerp, dt)

    const moving = this.speed > 0.15
    const fast = THREE.MathUtils.clamp(this.speed / SKIER.cruiseSpeed, 0, 1)
    // Bei wenig Tempo dreht man fast auf der Stelle, bei viel Tempo traege.
    const rate = THREE.MathUtils.lerp(SKIER.turnRateSlow, SKIER.turnRate, fast) * (1 + this.carving * 0.5)
    const turnApplied = -this.steer * rate * (this.airborne ? 0.35 : 1) * (moving ? 1 : 0.55) * dt
    this.heading += turnApplied

    const wantsMove = input.throttle > 0

    // --- Schwuenge ------------------------------------------------------
    // Ohne Lenkeingabe pendelt der Fahrer leicht um seine Richtung. Sobald
    // gelenkt wird, verschwindet der Ausschlag und man faehrt praezise.
    const swingSpeed = THREE.MathUtils.clamp(
      (this.speed - SKIER.swingMinSpeed) / (SKIER.cruiseSpeed - SKIER.swingMinSpeed), 0, 1,
    )
    if (this.speed > 0.1) {
      this.swingPhase += (this.speed / SKIER.swingWavelength) * Math.PI * 2 * dt
    }
    const swingTarget =
      Math.sin(this.swingPhase) *
      SKIER.swingAmplitude *
      swingSpeed *
      (1 + this.carving * 0.7) *
      (1 - Math.abs(this.steer) * 0.9)
    this.swing += (swingTarget - this.swing) * damp(8, dt)

    this.facing = this.heading + this.swing
    this.forward.set(Math.sin(this.facing), 0, Math.cos(this.facing))

    // Tatsaechliche Drehrate aus der Aenderung der Fahrtrichtung ableiten –
    // sie enthaelt Lenken und Schwung gleichermassen und treibt Neigung,
    // Spurbreite und Schneestaub.
    let dFacing = this.facing - this._prevFacing
    dFacing = Math.atan2(Math.sin(dFacing), Math.cos(dFacing))
    this._prevFacing = this.facing
    const turnNorm = dt > 0 ? THREE.MathUtils.clamp(dFacing / dt / SKIER.turnRate, -1, 1) : 0
    this.turn += (turnNorm - this.turn) * damp(14, dt)

    // --- Tempo ---------------------------------------------------------
    // Konstantes Grundtempo, nur vom Gefaelle moduliert. Ohne Eingabe rollt
    // man aus und bleibt stehen – man soll sich Dinge ansehen koennen.
    this.slope = slopeAlong(this.position.x, this.position.z, this.forward.x, this.forward.z)
    let target = 0
    if (wantsMove) {
      target = carveKey ? SKIER.carveSpeed : SKIER.cruiseSpeed
      // Enge Kurven kosten Tempo, das macht Carven spuerbar.
      target -= Math.abs(this.turn) * (2.6 + this.carving * 2.2)
    }
    target += this.slope * SKIER.slopeInfluence
    if (input.braking) target = Math.min(target, 0)
    // Mit gedruecktem W kommt man auch den steilsten Hang noch hinauf – nur
    // sehr langsam. Sonst bleibt man vor Gegenhaengen einfach kleben.
    target = THREE.MathUtils.clamp(
      target,
      wantsMove && !input.braking ? SKIER.minClimbSpeed : 0,
      SKIER.boostSpeed + 8,
    )

    const accelRate = target > this.speed
      ? SKIER.accel
      : input.braking
        ? SKIER.brakeDrag
        : wantsMove
          ? 3.0
          : SKIER.coastDrag
    this.speed += (target - this.speed) * damp(this.airborne ? 0.5 : accelRate, dt)
    if (this.speed < 0.06) this.speed = 0

    // --- Bewegung ------------------------------------------------------
    const stepX = this.forward.x * this.speed * dt
    const stepZ = this.forward.z * this.speed * dt
    let nx = this.position.x + stepX
    let nz = this.position.z + stepZ

    const resolved = this.world.resolve(nx, nz, SKIER.bodyRadius, stepX, stepZ)
    nx = resolved.x
    nz = resolved.z
    if (resolved.hit) {
      // Nur frontale Treffer bremsen wirklich. Wer einen Baum streift, soll
      // an ihm entlangschrammen statt im Kontakt stehenzubleiben – sonst
      // frisst jeder Frame im Kontakt weitere 28 Prozent Tempo.
      const len = Math.hypot(resolved.pushX, resolved.pushZ) || 1
      const frontal = Math.max(
        0,
        -(this.forward.x * (resolved.pushX / len) + this.forward.z * (resolved.pushZ / len)),
      )
      this.speed *= 1 - frontal * frontal * 0.8
      this.impact = Math.max(this.impact || 0, frontal)
    }

    // Weiche Talgrenze, falls jemand den Gebirgsrand hochkriecht. Die Flaeche
    // ist keine Scheibe mehr, deshalb wird ueber den Abstandsgradienten
    // zurueckgeschoben statt zum Mittelpunkt hin.
    const bound = 9
    const edge = playAreaDistance(nx, nz)
    if (edge > bound) {
      const e = 0.6
      const gx = playAreaDistance(nx + e, nz) - playAreaDistance(nx - e, nz)
      const gz = playAreaDistance(nx, nz + e) - playAreaDistance(nx, nz - e)
      const len = Math.hypot(gx, gz) || 1
      const push = edge - bound
      nx -= (gx / len) * push
      nz -= (gz / len) * push
      this.speed *= 0.9
    }

    this.position.x = nx
    this.position.z = nz

    // --- Boden / Luft ---------------------------------------------------
    const G = 22
    const groundY = terrainHeight(nx, nz)
    // Wie schnell der Boden den Fahrer gerade anhebt. Auf einer Schanze ist
    // das die Steiggeschwindigkeit, mit der er ueber die Kante geht.
    const climb = dt > 0 ? (groundY - this._prevGroundY) / dt : 0

    if (!this.airborne) {
      if (input.has('jump') && this.speed > 1) {
        this.airborne = true
        this.vy = 6.4
      } else if (this._rise > 3.2) {
        // Faellt der Boden hinter der Kante schneller weg, als die Schwerkraft
        // den Fahrer holt, hebt er ab. Kein Sprungknopf noetig – die Schanze
        // macht die Arbeit, so wie im Gelaende auch.
        const free = this._prevGroundY + this._rise * dt - 0.5 * G * dt * dt
        if (free > groundY + 0.03) {
          this.airborne = true
          // Nach oben begrenzt: eine Kante, die der Fahrer mit ueberhoehtem
          // Tempo trifft, soll ihn abheben lassen und nicht abschiessen.
          this.vy = Math.min(this._rise - G * dt, 11)
          this.height = Math.min(free - groundY, 0.6)
        }
      }
    }

    if (this.airborne) {
      this.vy -= G * dt
      this.height += this.vy * dt
      if (this.height <= 0) {
        this.height = 0
        this.airborne = false
        this.landImpact = Math.min(1, -this.vy / 12)
        this.vy = 0
      }
    } else {
      this.landImpact = (this.landImpact || 0) * (1 - damp(6, dt))
      this.height = 0
    }
    // Die Steigrate merkt man sich nur am Boden – in der Luft gibt der Boden
    // nichts mehr vor.
    this._rise = this.airborne ? 0 : Math.min(Math.max(0, climb), 24)
    this._prevGroundY = groundY
    this.position.y = groundY + this.height

    // --- Haltung --------------------------------------------------------
    const speedNorm = THREE.MathUtils.clamp(this.speed / SKIER.cruiseSpeed, 0, 1.4)
    const leanTarget = -this.turn * SKIER.leanMax * speedNorm * (1 + this.carving * 0.3)
    this.lean += (leanTarget - this.lean) * damp(SKIER.leanLerp, dt)

    const pitchTarget = THREE.MathUtils.clamp(-this.slope * 0.5, -SKIER.pitchMax, SKIER.pitchMax)
    this.pitch += (pitchTarget - this.pitch) * damp(4, dt)

    const crouchTarget = this.carving * 0.55 + Math.abs(this.turn) * 0.35 + (this.landImpact || 0) * 0.9
    this.crouch += (crouchTarget - this.crouch) * damp(10, dt)

    this._applyPose(dt)
    this._stampTrail(trail, groundY)
  }

  // Am Schlepplift gibt der Lift die Position vor. Alles andere laeuft
  // unveraendert weiter: der Fahrer steht auf den Ski, hinterlaesst seine Spur
  // und wird ganz normal beleuchtet – nur lenken kann er nicht mehr frei.
  _updateTowed(dt, input, trail) {
    const target = this.towTarget
    const groundY = terrainHeight(target.x, target.z)

    // Weich nachziehen statt hart setzen, sonst ruckt der Einstieg.
    const k = damp(9, dt)
    this.position.x += (target.x - this.position.x) * k
    this.position.z += (target.z - this.position.z) * k
    this.position.y = groundY
    this.height = 0
    this.airborne = false
    this._rise = 0
    this._prevGroundY = groundY

    let diff = target.heading - this.heading
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.heading += diff * damp(6, dt)

    // Kein Schwung am Lift – man steht ruhig in der Spur.
    this.swing += (0 - this.swing) * damp(5, dt)
    this.steer += (input.steer - this.steer) * damp(SKIER.steerLerp, dt)
    this.facing = this.heading + this.swing
    this.forward.set(Math.sin(this.facing), 0, Math.cos(this.facing))

    let dFacing = this.facing - this._prevFacing
    dFacing = Math.atan2(Math.sin(dFacing), Math.cos(dFacing))
    this._prevFacing = this.facing
    this.turn += (0 - this.turn) * damp(6, dt)

    this.speed = this.tow.speed
    this.slope = slopeAlong(this.position.x, this.position.z, this.forward.x, this.forward.z)

    // Haltung: leicht zurueckgelehnt, wie wenn man am Buegel haengt.
    const hanging = this.tow.grab !== false
    this.lean += ((hanging ? this.steer * 0.12 : 0) - this.lean) * damp(4, dt)
    this.pitch += ((hanging ? -0.1 : 0.02) - this.pitch) * damp(4, dt)
    this.crouch += ((hanging ? 0.28 : 0.06) - this.crouch) * damp(5, dt)
    this.carving += (0 - this.carving) * damp(6, dt)

    this._applyPose(dt)
    // Am Schlepplift greift der aussenliegende Arm nach oben zur Zugstange.
    // Der Zauberteppich traegt dagegen – dort steht man nur.
    if (this.tow.grab !== false) {
      const arm = this.parts.arms.right
      arm.rotation.x = -1.15
      arm.rotation.z = -0.25
    }

    this._stampTrail(trail, groundY)
  }

  _applyPose(dt) {
    const g = this.group
    g.position.copy(this.position)
    g.rotation.set(0, 0, 0)
    g.rotateY(this.facing)
    g.rotateX(this.pitch + (this.airborne ? -this.vy * 0.012 : 0))
    g.rotateZ(this.lean)

    const { torso, legs, skis, head, arms } = this.parts
    if (!this.tow) {
      arms.right.rotation.x += (0 - arms.right.rotation.x) * damp(6, dt)
      arms.right.rotation.z += (0 - arms.right.rotation.z) * damp(6, dt)
    }
    // Kniebeugen: Torso runter, Ski leicht aufkanten.
    torso.position.y = 0.98 - this.crouch * 0.22
    torso.rotation.x = 0.12 + this.crouch * 0.42
    legs.position.y = 0.1 - this.crouch * 0.05
    legs.scale.y = 1 - this.crouch * 0.12
    skis.rotation.z = -this.lean * 0.55
    head.rotation.x = -this.crouch * 0.3
    // Beim Kanten stellt sich der Oberkoerper gegen die Kurve.
    torso.rotation.y = this.turn * 0.28
  }

  _stampTrail(trail, groundY) {
    if (!trail || this.airborne || this.speed < 0.25) {
      this._trailInit = false
      return
    }
    const cos = Math.cos(this.facing)
    const sin = Math.sin(this.facing)
    // Beim Kanten laufen die Ski weiter auseinander.
    const spread = 0.19 + this.carving * 0.14 + Math.abs(this.turn) * 0.1

    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -spread : spread
      const wx = this.position.x + cos * side
      const wz = this.position.z - sin * side
      const prev = this._trailPrev[i]
      if (this._trailInit) {
        const width = 0.5 + this.carving * 0.5 + Math.abs(this.turn) * 0.3
        trail.stamp(prev.x, prev.y, wx, wz, width)
      }
      prev.set(wx, wz)
    }
    this._trailInit = true
  }
}
