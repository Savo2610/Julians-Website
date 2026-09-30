import { CABLE, RIDER, TRICK } from '../config.js'
import { surfaceAt, slopeAt, DOCK } from '../world/features.js'
import { waterDepth } from '../world/heightfield.js'
import { nearestS, wrap, CABLE_LENGTH, cableAt } from '../world/cable-path.js'
import { landingQuality, scoreJump, rotationError } from '../game/tricks.js'

// Das Fahrmodell. Keine Physik-Engine: ein Punkt mit Geschwindigkeit, ein
// Seil als steife Feder zum Mitnehmer und Wasser, das quer zu den Ski hart
// bremst und laengs kaum. Aus diesen drei Dingen entsteht das, was Wasserski
// am Kabel ausmacht: man haengt hinter dem Mitnehmer, stellt die Ski schraeg,
// schwingt nach aussen und ist dabei schneller als das Seil.
//
// Richtungskonvention wie im Skital: heading h, vorwaerts = (sin h, cos h),
// rechts aus Sicht des Fahrers = (-cos h, sin h). Lenken nach rechts
// verkleinert h.
//
// Reine Rechnung ohne three.js – der Test faehrt damit Runden im Terminal.

const TAU = Math.PI * 2
const damp = (rate, dt) => 1 - Math.exp(-rate * dt)
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
function angleDiff(a, b) {
  let d = a - b
  while (d > Math.PI) d -= TAU
  while (d < -Math.PI) d += TAU
  return d
}

// Wo der Fahrer auf dem Steg steht: vorne an der Spitze, Blick die Bahn
// entlang (-x).
export const DOCK_SPOT = { x: DOCK.x, z: DOCK.z - 0.7, heading: -Math.PI / 2 }
export const DOCK_S = nearestS(DOCK_SPOT.x, DOCK_SPOT.z)

export class RiderPhysics {
  constructor(cable) {
    this.cable = cable
    this.events = []
    this._surf = {}
    this._car = {}
    this.toDock()
  }

  toDock() {
    this.mode = 'dock'
    this.dockFailed = false
    this.released = false
    this.x = DOCK_SPOT.x
    this.z = DOCK_SPOT.z
    this.y = DOCK.height
    this.vx = this.vy = this.vz = 0
    this.heading = DOCK_SPOT.heading
    this.airborne = false
    this.tow = -1
    this.ropeAngle = 0
    this.hooked = false
    this.ropeLength = CABLE.ropeLength
    this.dist = 0
    this.taut = 0
    this.resetAir()
    this.charge = 0
    this.crouch = 0
    this.edge = 0
    this.crashTimer = 0
    this.progress = 0
    this._sHint = DOCK_S
    this.dockReadyAt = -1
    this.dockTime = 0
    this.feature = null
    this.slide = 0
    this.groundVy = 0
    this.lastRelease = -1
    this.time = 0
    // Der naechste Mitnehmer soll in gut drei Sekunden kommen: lang genug,
    // um die Anzeige zu lesen, kurz genug, um nicht zu warten.
    this.cable.arrangeArrival(0, DOCK_S, 3.2)
    this.tow = 0
  }

  resetAir() {
    this.spin = 0
    this.spinVel = 0
    this.flip = 0
    this.flipVel = 0
    this.grabbing = false
    this.air = null
  }

  get speed() {
    return Math.hypot(this.vx, this.vz)
  }

  // Die Mitnehmer-Position fuer den gezogenen Fahrer.
  carrier() {
    return this.cable.position(this.tow, this._car)
  }

  // Wie weit der Start ist: 0 = Seil haengt durch, 1 = gleich straff.
  get dockProgress() {
    if (this.mode !== 'dock' || !this.hooked) return 0
    return Math.min(1, Math.max(0, (this.dist - this._dock0) / (this.ropeLength - this._dock0)))
  }

  update(dt, input) {
    this.time += dt
    if (this.mode === 'dock') return this.updateDock(dt, input)
    if (this.mode === 'crash') return this.updateCrash(dt)
    this.updateRide(dt, input)
  }

  // --- Start am Steg ----------------------------------------------------------
  // Der Mitnehmer kommt, das Seil haengt erst durch und strafft sich dann. Wer
  // in dem Moment in der Hocke ist (Leertaste halten), wird sauber vom Steg
  // gezogen; wer die Hocke erst in der letzten knappen halben Sekunde
  // einnimmt, bekommt den perfekten Start mit Schwung. Wer steht, faellt ins
  // Wasser und wartet auf den naechsten Buegel.
  updateDock(dt, input) {
    const c = this.carrier()
    this.dist = Math.hypot(c.x - this.x, c.z - this.z)
    const sTow = this.cable.sAt(this.tow)
    const gap = wrap(DOCK_S - sTow)
    if (!this.hooked && (gap < 1 || gap > CABLE_LENGTH - 30)) {
      this.hooked = true
      this._dock0 = this.dist
      this.events.push({ type: 'hook' })
    }
    this.crouch += ((input.jump ? 1 : 0) - this.crouch) * damp(10, dt)
    if (input.jump && this.dockReadyAt < 0) this.dockReadyAt = this.time
    if (!input.jump) this.dockReadyAt = -1
    if (!this.hooked || this.dist < this.ropeLength) return

    // Seil ist straff.
    if (this.dockReadyAt < 0) {
      this.events.push({ type: 'dockFail' })
      this.mode = 'ride'
      this.dockFailed = true
      const n = { x: (c.x - this.x) / this.dist, z: (c.z - this.z) / this.dist }
      this.vx = n.x * 5
      this.vz = n.z * 5
      this.x += n.x * 1.5
      this.z += n.z * 1.5
      this.crash('Aus dem Stand gerissen')
      return
    }
    const held = this.time - this.dockReadyAt
    const perfect = held <= 0.45
    this.mode = 'ride'
    const n = { x: (c.x - this.x) / this.dist, z: (c.z - this.z) / this.dist }
    const boost = perfect ? CABLE.speed + 3 : CABLE.speed * 0.8
    this.vx = n.x * boost
    this.vz = n.z * boost
    this.vy = 1.6
    this.airborne = true
    this.air = { time: 0, spin: 0, flip: 0, grab: 0, height: this.y, slide: 0, feature: null, fromDock: true }
    this.events.push({ type: 'start', perfect })
    this._sHint = DOCK_S
  }

  // --- Sturz -------------------------------------------------------------------
  crash(reason) {
    if (this.mode === 'crash') return
    this.mode = 'crash'
    this.crashTimer = 1.5
    this.airborne = false
    this.events.push({ type: 'crash', reason, x: this.x, z: this.z, speed: this.speed })
    this.resetAir()
    this.charge = 0
  }

  updateCrash(dt) {
    this.crashTimer -= dt
    const k = Math.exp(-2.2 * dt)
    this.vx *= k
    this.vz *= k
    this.x += this.vx * dt
    this.z += this.vz * dt
    this.y += (-0.55 - this.y) * damp(4, dt)
    if (this.crashTimer > 0 || this.released) return
    // Wer schon am Steg nicht loskommt, probiert es dort noch einmal.
    if (this.dockFailed) this.toDock()
    else this.respawn()
  }

  // Nach dem Sturz geht es mit dem naechsten Mitnehmer weiter: man wird an
  // die Stelle hinter ihm gesetzt, an der man haengen wuerde. Schwimmen bis
  // zum Steg waere echter, aber kein Spiel.
  respawn() {
    const s = nearestS(this.x, this.z, this._sHint, 60)
    // Den Mitnehmer nehmen, der als naechster an s + Seillaenge vorbeikommt.
    const next = this.cable.nextArriving(wrap(s + this.ropeLength))
    this.tow = next.index
    // Die Mitnehmer stehen fest im Abstand. Statt zu warten, wird die Uhr des
    // Seils vorgestellt, bis dieser eine Seillaenge vor dem Fahrer ist; das
    // passiert hinter der Blende und faellt nicht auf.
    this.cable.offset = wrap(this.cable.offset + next.gap)
    // Nicht auf oder kurz vor einer Schanze absetzen: dann lieber ein Stueck
    // weiter vorn, wo frei ist.
    let ahead = 0
    for (let k = 0; k < 30; k++) {
      let blocked = false
      for (let m = 0; m <= 14; m += 2) {
        const p = cableAt(this.cable.sAt(this.tow) - this.ropeLength + ahead + m)
        if (surfaceAt(p.x, p.z, this._surf).h > 0) blocked = true
      }
      if (!blocked) break
      ahead += 4
    }
    if (ahead) this.cable.offset = wrap(this.cable.offset + ahead)
    const c2 = this.carrier()
    const b2 = cableAt(this.cable.sAt(this.tow) - this.ropeLength)
    this.x = b2.x
    this.z = b2.z
    this.y = 0
    this.vx = c2.vx
    this.vz = c2.vz
    this.vy = 0
    this.heading = Math.atan2(c2.dx, c2.dz)
    this.mode = 'ride'
    this.airborne = false
    this._sHint = nearestS(this.x, this.z)
    this.events.push({ type: 'respawn' })
  }

  // Seil loslassen (Ende der Session).
  release() {
    this.released = true
    this.tow = -1
  }

  // --- Fahren ------------------------------------------------------------------
  updateRide(dt, input) {
    const L = this.ropeLength
    let ax = 0
    let az = 0
    let ropeDir = this.heading

    // Seilzug. Nur waagerecht: der Mitnehmer haengt neun Meter hoch, aber
    // wer nach oben gezogen wird, faellt nie – das waere kein Spiel.
    if (this.tow >= 0) {
      const c = this.carrier()
      const dx = c.x - this.x
      const dz = c.z - this.z
      const d = Math.hypot(dx, dz)
      this.dist = d
      this.taut = smooth(L - 1.2, L, d)
      if (d > 0.01) {
        const nx = dx / d
        const nz = dz / d
        ropeDir = Math.atan2(nx, nz)
        // Wie weit der Fahrer neben der Bahn des Mitnehmers haengt, als
        // Winkel des Seils gegen dessen Fahrtrichtung. Positiv = rechts.
        this.ropeAngle = angleDiff(ropeDir, Math.atan2(c.dx, c.dz))
        if (d > L) {
          const stretch = d - L
          const relV = (c.vx - this.vx) * nx + (c.vz - this.vz) * nz
          const f = Math.max(0, RIDER.ropeStiffness * stretch + RIDER.ropeDamping * relV)
          ax += nx * f
          az += nz * f
          if (stretch > RIDER.ropeSlackLimit) {
            // Hart begrenzen: nie weiter weg als die Seillaenge plus Dehnung.
            const back = stretch - RIDER.ropeSlackLimit
            this.x += nx * back
            this.z += nz * back
            const out = this.vx * nx + this.vz * nz
            const want = c.vx * nx + c.vz * nz
            if (out < want) {
              this.vx += nx * (want - out)
              this.vz += nz * (want - out)
            }
          }
        }
      }
    } else {
      this.taut = 0
    }

    if (this.airborne) this.updateAir(dt, input, ax, az)
    else this.updateWater(dt, input, ax, az, ropeDir)
    const sp = this.speed
    if (sp > RIDER.maxSpeed + 1) {
      this.vx *= (RIDER.maxSpeed + 1) / sp
      this.vz *= (RIDER.maxSpeed + 1) / sp
    }

    // Fortschritt auf der Bahn, fuer Runden und Wiedereinstieg.
    const s = nearestS(this.x, this.z, this._sHint, 30)
    let ds = s - this._sHint
    if (ds > CABLE_LENGTH / 2) ds -= CABLE_LENGTH
    if (ds < -CABLE_LENGTH / 2) ds += CABLE_LENGTH
    this.progress += ds
    this._sHint = s
  }

  updateWater(dt, input, ax, az, ropeDir) {
    const speed = this.speed
    const velDir = speed > 3 ? Math.atan2(this.vx, this.vz) : this.heading
    // Grundrichtung: am straffen Seil zeigen die Ski zum Mitnehmer, am
    // schlaffen dorthin, wohin man faehrt. Gelenkt wird relativ dazu.
    const base = velDir + angleDiff(ropeDir, velDir) * this.taut
    const steer = input.steer
    const brake = input.brake ? 1 : 0
    // Weiter als gut 60 Grad neben den Mitnehmer kommt man nicht: dort
    // flachen die Ski von selbst ab. Ohne diese Grenze lief man mit voller
    // Kante neben den Mitnehmer, stand dort fast (0,6 m/s) und wurde dann mit
    // einem Ruck auf 22 m/s gerissen.
    let scale = this.taut > 0.2 ? 1 : 0.6
    if (steer * this.ropeAngle > 0) scale *= 1 - 0.9 * smooth(0.7, 1.1, Math.abs(this.ropeAngle))
    const target = base - steer * RIDER.edgeMax * scale
    // Die Ski drehen hoechstens so schnell, wie man die Kanten wechselt, und
    // nie weiter als gut 60 Grad gegen die Fahrtrichtung. Beim Wechsel von
    // voller Kante links auf rechts sprang die Zielrichtung um 120 Grad; die
    // Ski standen danach fast quer, und das Tempo fiel fuer zwei Bilder auf 1.
    let dh = angleDiff(target, this.heading) * damp(RIDER.steerLerp, dt)
    const maxTurn = RIDER.turnRate * dt
    dh = Math.max(-maxTurn, Math.min(maxTurn, dh))
    this.heading += dh
    if (speed > 3) {
      const rel = angleDiff(this.heading, velDir)
      const lim = RIDER.edgeMax
      if (rel > lim) this.heading = velDir + lim
      else if (rel < -lim) this.heading = velDir - lim
    }
    this.edge += (angleDiff(this.heading, velDir) - this.edge) * damp(8, dt)

    const fx = Math.sin(this.heading)
    const fz = Math.cos(this.heading)
    const rx = -fz
    const rz = fx

    // Beschleunigung aus dem Seil und dem Ziehen an der Hantel.
    this.vx += ax * dt
    this.vz += az * dt
    if (input.throttle && this.taut > 0.5) {
      this.vx += fx * RIDER.pullAccel * dt
      this.vz += fz * RIDER.pullAccel * dt
    }

    let vf = this.vx * fx + this.vz * fz
    let vs = this.vx * rx + this.vz * rz
    const grip = RIDER.lateralGrip * (1 + brake * 0.4)
    // Was quer gebremst wird, geht zum groessten Teil in die Laengsrichtung:
    // die Ski wirken wie ein Kiel und lenken den Schwung um. Ganz ohne das
    // fiel das Tempo bei jedem Kantenwechsel von 24 auf 4 m/s.
    const lost = vs * (1 - Math.exp(-grip * dt))
    vs -= lost
    vf += Math.sign(vf || 1) * Math.abs(lost) * RIDER.carveKeep * (1 - brake * 0.6)
    // Am schlaffen Seil bremst das Wasser staerker: der Fahrer richtet sich
    // auf und sinkt tiefer ein. Sonst ueberholte er nach einem Schwung den
    // eigenen Mitnehmer bis auf einen Meter.
    const slack = this.tow >= 0 ? 1 - this.taut : 0
    const drag = RIDER.dragLinear + RIDER.dragQuad * Math.abs(vf) + brake * RIDER.brakeDrag * 0.18 + slack * RIDER.slackDrag
    vf *= Math.exp(-drag * dt)
    // Ohne Seil (nach der Session) laeuft man aus.
    if (this.tow < 0) vf *= Math.exp(-0.6 * dt)
    const sp = Math.hypot(vf, vs)
    if (sp > RIDER.maxSpeed) {
      vf *= RIDER.maxSpeed / sp
      vs *= RIDER.maxSpeed / sp
    }
    this.vx = fx * vf + rx * vs
    this.vz = fz * vf + rz * vs

    const nx = this.x + this.vx * dt
    const nz = this.z + this.vz * dt
    const surf = surfaceAt(nx, nz, this._surf)

    // Seitlich gegen eine Kante: Sturz.
    if (surf.h - this.y > RIDER.stepUpCrash) {
      this.x = nx
      this.z = nz
      this.crash(surf.feature === DOCK ? 'Gegen den Steg' : 'Gegen die Kante')
      return
    }

    this.x = nx
    this.z = nz
    const prevY = this.y
    const prevFeature = this.feature

    // Absprung: Leertaste halten laedt, loslassen springt.
    if (input.jump) this.charge = Math.min(1, this.charge + dt / RIDER.chargeTime)
    this.crouch += ((input.jump ? 1 : 0) - this.crouch) * damp(12, dt)
    const released = input.jumpReleased
    if (released) this.lastRelease = this.time

    if (surf.feature) {
      this.groundVy = (surf.h - prevY) / dt
      this.feature = surf.feature
      this.y = surf.h
      if (surf.feature.type === 'slider' && surf.h >= surf.feature.height - 0.01) {
        this.slide += speed * dt
      }
      if (released && speed > 4) {
        this.launch(this.groundVy + RIDER.popBase * 0.7 + RIDER.popCharge * this.charge, surf.feature)
      }
      return
    }

    // Kein Hindernis unter den Ski.
    if (prevFeature && prevY > 0.05) {
      // Ueber die Kante hinaus: Flug. Wer genau an der Kante loslaesst oder
      // noch geladen haelt, springt hoeher.
      const recent = this.time - this.lastRelease < 0.18
      let vy = Math.max(0, this.groundVy)
      if (prevFeature.type === 'kicker') {
        const slope = slopeAt(prevFeature, this.x - this.vx * dt, this.z - this.vz * dt)
        vy = Math.max(vy, speed * slope / Math.hypot(1, slope))
      }
      vy += (input.jump ? RIDER.popCharge * this.charge * 0.8 : 0) + (recent ? RIDER.popBase : 0)
      this.launch(vy, prevFeature, prevY)
      // Wer noch haelt, darf kurz nach der Kante loslassen und bekommt den
      // Absprung trotzdem: 0,12 s Nachsicht, sonst verpasste man ihn bei 45
      // km/h schon um zwei Bilder.
      this.air.lateP = recent ? 0 : 0.12
      return
    }
    this.feature = null
    this.groundVy = 0
    this.y = 0

    if (released && speed > 4) {
      this.launch(RIDER.popBase + RIDER.popCharge * this.charge, null)
      return
    }
    if (!input.jump) this.charge = 0

    // Ufer und Insel: wer ins Flache faehrt, liegt.
    if (waterDepth(this.x, this.z) < 0.18) this.crash('Aufgelaufen')
  }

  launch(vy, feature, fromY = this.y) {
    this.airborne = true
    this.vy = vy
    this.y = fromY
    this.air = {
      time: 0, spin: 0, flip: 0, grab: 0, height: fromY, slide: this.slide,
      feature: feature ? feature.name : null,
    }
    this.slide = 0
    this.charge = 0
    this.feature = null
    this.events.push({ type: 'launch', vy, feature: feature?.name || null })
  }

  updateAir(dt, input, ax, az) {
    const air = this.air
    air.time += dt
    if (air.lateP > 0) {
      air.lateP -= dt
      if (input.jumpReleased) {
        this.vy += RIDER.popBase
        air.lateP = 0
      }
    }
    this.vx += ax * dt
    this.vz += az * dt
    const k = Math.exp(-0.05 * dt)
    this.vx *= k
    this.vz *= k
    this.vy -= RIDER.gravity * dt
    this.crouch += ((input.grab ? 1 : 0.3) - this.crouch) * damp(10, dt)

    // Drehen: A/D um die Hochachse, W/S ueberschlagen. Der Hopser vom Steg
    // zaehlt nicht: dort lenkt man noch, und ein halber Dreher waere Sturz.
    const steer = air.fromDock ? 0 : input.steer
    if (steer) {
      this.spinVel = Math.max(-TRICK.spinMax, Math.min(TRICK.spinMax, this.spinVel - steer * TRICK.spinAccel * dt))
    } else {
      this.spinVel *= Math.exp(-TRICK.spinDecay * dt)
    }
    const flipIn = air.fromDock ? 0 : (input.throttle ? 1 : 0) - (input.brake ? 1 : 0)
    if (flipIn) {
      this.flipVel = Math.max(-TRICK.flipMax, Math.min(TRICK.flipMax, this.flipVel + flipIn * TRICK.flipAccel * dt))
    } else {
      this.flipVel *= Math.exp(-TRICK.flipDecay * dt)
    }
    this.spin += this.spinVel * dt
    this.flip += this.flipVel * dt
    this.grabbing = input.grab
    if (input.grab) air.grab += dt

    const nx = this.x + this.vx * dt
    const nz = this.z + this.vz * dt
    const ny = this.y + this.vy * dt
    const surf = surfaceAt(nx, nz, this._surf)

    // Landehilfe: ohne Eingabe dreht der Fahrer von selbst auf die naechste
    // volle Umdrehung, wenn sie nah genug ist – sacht auf dem Weg nach oben,
    // entschieden kurz vor dem Aufsetzen. Nur kurz vor dem Wasser zu helfen
    // reichte nicht: wer bei 320 Grad losliess, drehte mit Restschwung auf 420
    // weiter und lag dann quer.
    const above = ny - surf.h
    const snap = this.vy < 0 && above < 1.6 ? 9 : 3.5
    if (!steer && rotationError(this.spin) < TRICK.assist) {
      const t = Math.round(this.spin / TAU) * TAU
      this.spin += (t - this.spin) * damp(snap, dt)
      this.spinVel *= Math.exp(-8 * dt)
    }
    if (!flipIn && rotationError(this.flip) < TRICK.assist) {
      const t = Math.round(this.flip / TAU) * TAU
      this.flip += (t - this.flip) * damp(snap, dt)
      this.flipVel *= Math.exp(-8 * dt)
    }

    // Flach gegen die Seite eines Hindernisses.
    if (surf.h - ny > 0.45 && surf.h - this.y > 0.45) {
      this.x = nx
      this.z = nz
      this.crash('Gegen die Kante')
      return
    }

    this.x = nx
    this.z = nz
    this.y = ny
    air.height = Math.max(air.height, ny)

    if (ny <= surf.h && this.vy <= 0) this.land(surf)
  }

  land(surf) {
    const air = this.air
    if (air) {
      air.spin = this.spin
      air.flip = this.flip
    }
    const quality = landingQuality(this.spin, this.flip)
    const impact = -this.vy
    this.y = surf.h
    this.vy = 0
    this.airborne = false
    this.feature = surf.feature
    if (quality.key === 'crash') {
      this.crash(rotationError(this.flip) > rotationError(this.spin) ? 'Kopfueber gelandet' : 'Quer gelandet')
      return
    }
    const result = air ? scoreJump(air) : null
    if (quality.key === 'sketchy') {
      this.vx *= 0.78
      this.vz *= 0.78
    }
    this.events.push({ type: 'land', result, quality, impact, air })
    this.resetAir()
  }
}
