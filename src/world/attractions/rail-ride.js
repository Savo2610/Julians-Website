import * as THREE from 'three'

// Die Rail im Funpark ist nicht nur ein Rohr im Schnee, sondern eine Fahrt:
// wer sie oben mit gedrueckter Leertaste erwischt, wird aufgezogen und
// rutscht quer bis ans untere Ende.
//
// Technisch ist das dieselbe Mechanik wie am Schlepplift und am Zauberteppich:
// der Fahrer bekommt ein `tow` und eine Zielposition, die Fahrphysik ruht
// solange. Der Unterschied liegt in der Richtung – hier geht es abwaerts und
// schneller, statt langsam bergauf – und in der Haltung: `slidePose` stellt
// die Ski quer, so wie beim Sliden am Boden.
//
// Aufgezogen wird nur, wer von oben kommt und tatsaechlich in der Naehe des
// oberen Endes ist. Sonst haengt man an der Rail, sobald man irgendwo unten
// die Leertaste drueckt, und das waere eine Falle statt einer Figur.

const SPEED = 15.5
const CATCH_RADIUS = 3.6
const EXIT_BOOST = 1.05

export class RailRide {
  constructor(world, feature) {
    this.world = world
    this.f = feature
    this.length = feature.length
    // Der obere Einstieg liegt eine halbe Laenge gegen die Fahrtrichtung.
    this.from = new THREE.Vector2(
      feature.x - feature.dx * this.length * 0.5,
      feature.z - feature.dz * this.length * 0.5,
    )
    this.heading = Math.atan2(feature.dx, feature.dz)
    this.rider = null
  }

  pointAt(t) {
    return {
      x: this.from.x + this.f.dx * this.length * t,
      z: this.from.y + this.f.dz * this.length * t,
    }
  }

  canBoard(skier) {
    if (this.rider || skier.tow || skier.airborne) return false
    const p = this.pointAt(0)
    const dx = skier.position.x - p.x
    const dz = skier.position.z - p.z
    if (dx * dx + dz * dz > CATCH_RADIUS * CATCH_RADIUS) return false
    // Nur wer ungefaehr in Richtung der Rail unterwegs ist. Wer quer
    // heranfaehrt, will offensichtlich nicht darauf.
    const dot = Math.sin(skier.facing) * this.f.dx + Math.cos(skier.facing) * this.f.dz
    return dot > 0.45 && skier.speed > 3
  }

  board(skier) {
    if (!this.canBoard(skier)) return false
    this.rider = { progress: 0 }
    skier.tow = this
    skier.speed = Math.max(skier.speed, SPEED * 0.7)
    return true
  }

  release(skier, atEnd) {
    if (!this.rider) return
    this.rider = null
    if (!skier) return
    skier.tow = null
    skier.towTarget = null
    if (atEnd) {
      skier.heading = this.heading
      skier.facing = this.heading
      skier._prevFacing = this.heading
      skier.speed = SPEED * EXIT_BOOST
      // Am Ende der Rail geht es ab – ein kleiner Absprung, damit die Fahrt
      // nicht einfach aufhoert.
      skier.airborne = true
      skier.vy = 4.6
      skier.trick = { text: 'RAILSLIDE', tone: 'good' }
    } else {
      skier.speed *= 0.6
    }
  }

  update(dt, skier, input) {
    if (!this.rider) {
      if (input.has('jump')) this.board(skier)
      return
    }
    const r = this.rider
    r.progress += (SPEED / this.length) * dt
    const p = this.pointAt(Math.min(r.progress, 1))
    skier.towTarget = { x: p.x, z: p.z, heading: this.heading, progress: r.progress }
    // Loslassen beendet die Fahrt – man faellt nicht herunter, man steigt ab.
    if (!input.has('jump') || input.braking || r.progress >= 1) {
      this.release(skier, r.progress >= 1)
    }
  }
}

// Der Fahrer steht quer auf der Rail und haelt sich an nichts fest. `lift`
// hebt ihn um die Hoehe des Rohrs ueber die Schneekante – ohne das faehrt er
// im Schnee statt auf dem Stahl.
RailRide.prototype.grab = false
RailRide.prototype.slidePose = true
RailRide.prototype.lift = 0.5
RailRide.prototype.speed = SPEED
