import * as THREE from 'three'
import { terrainHeight } from './heightfield.js'
import {
  createLiftPylon,
  createLiftBaseStation,
  createLiftTopStation,
  createLiftPlatterGeometry,
  PLATTER_LENGTH,
  LIFT_COLORS,
} from './props/lift-parts.js'
import { vertexColorMaterial } from '../core/geometry.js'

// Schlepplift als Tellerlift. Bewusst kein Sessellift: der Fahrer bleibt auf
// den Ski stehen, seine Spur reisst nicht ab und Aussteigen heisst schlicht
// loslassen. Der Lift gibt waehrend der Fahrt nur die Position vor – Pose,
// Spur und Schneestaub laufen unveraendert weiter.

const CABLE_GAUGE = 1.0      // seitlicher Abstand zwischen Auf- und Abwaertsseil
const CABLE_CLEARANCE = 3.6  // Mindesthoehe des Seils ueber dem Boden
// Sitzpunkt des Tellers im Fahrermodell (lokal, -Z ist hinten, +X die Seite
// der greifenden Hand). Das Seil liegt 5,3 hoch und 2,4 voraus genau ueber
// dem Fahrer, die gerade Stange muss also am Koerper vorbei. Mittig hinten
// lief sie 22 cm tief durch die Brust; so bleibt sie 4 cm neben Schulter,
// Rucksack und Kopf. Die Greifhand holt sie sich selbst (skier.greifen).
const SEAT = new THREE.Vector3(0.28, 0.6, -0.45)
const PLATTER_SPACING = 11   // Abstand der Teller am Seil
const PYLON_SPACING = 13

export class DragLift {
  constructor(world, { base, top, speed = 4.2, label = 'SCHLEPPLIFT' }) {
    this.world = world
    this.speed = speed

    this.base = new THREE.Vector2(base.x, base.z)
    this.top = new THREE.Vector2(top.x, top.z)

    const delta = this.top.clone().sub(this.base)
    this.length = delta.length()
    this.dir = delta.clone().normalize()
    this.side = new THREE.Vector2(-this.dir.y, this.dir.x)
    this.heading = Math.atan2(this.dir.x, this.dir.y)

    this.group = new THREE.Group()
    world.scene.add(this.group)

    this._buildProfile()
    this._buildStations(label)
    this._buildPylons()
    this._buildCable()
    this._buildPlatters()

    // Zustand des Mitfahrers
    this.rider = null          // { progress, offset }
    this.boardRadius = 4.5
  }

  // --- Geometrie ----------------------------------------------------------

  // Seilhoehe entlang der Trasse: geglaettetes Terrainprofil plus Abstand,
  // damit das Seil ueber Kuppen nicht in den Boden laeuft und in Mulden nicht
  // in den Himmel steigt.
  _buildProfile() {
    const samples = 64
    const ground = []
    for (let i = 0; i <= samples; i++) {
      const p = this.pointAt(i / samples)
      ground.push(terrainHeight(p.x, p.y))
    }

    // Gleitender Mittelwert glaettet das Profil.
    const smooth = ground.map((_, i) => {
      let sum = 0
      let n = 0
      for (let k = -6; k <= 6; k++) {
        const j = Math.min(samples, Math.max(0, i + k))
        sum += ground[j]
        n++
      }
      return sum / n
    })

    // An den Stationen sitzt das Seil auf der Scheibenhoehe, dazwischen wird
    // die Mindesthoehe erzwungen.
    this.profile = smooth.map((h, i) => {
      const t = i / samples
      // Zu den Enden hin sanft auf die Stationshoehe zulaufen.
      const ends = Math.min(1, Math.min(t, 1 - t) / 0.12)
      const target = h + CABLE_CLEARANCE + 1.0 * ends
      return Math.max(target, ground[i] + CABLE_CLEARANCE)
    })
    this.groundProfile = ground
    this.samples = samples
  }

  // Bodenpunkt der Trasse bei t in [0,1].
  pointAt(t, offset = 0) {
    const x = this.base.x + this.dir.x * this.length * t + this.side.x * offset
    const z = this.base.y + this.dir.y * this.length * t + this.side.y * offset
    return new THREE.Vector2(x, z)
  }

  cableHeightAt(t) {
    const f = THREE.MathUtils.clamp(t, 0, 1) * this.samples
    const i = Math.floor(f)
    const j = Math.min(this.samples, i + 1)
    return THREE.MathUtils.lerp(this.profile[i], this.profile[j], f - i)
  }

  _buildStations(label) {
    const baseGround = terrainHeight(this.base.x, this.base.y)
    const topGround = terrainHeight(this.top.x, this.top.y)

    this.baseStation = createLiftBaseStation({ label })
    this.baseStation.position.set(this.base.x, baseGround, this.base.y)
    // Die Station schaut talwaerts, der Einstieg liegt auf der Talseite.
    this.baseStation.rotation.y = this.heading + Math.PI
    this.group.add(this.baseStation)

    this.topStation = createLiftTopStation()
    this.topStation.position.set(this.top.x, topGround, this.top.y)
    this.topStation.rotation.y = this.heading + Math.PI
    this.group.add(this.topStation)

    // Kollision nur fuer die Tragwerke, der Einstieg bleibt frei.
    this.world.addCollider(this.base.x, this.base.y, 2.2)
    this.world.addCollider(this.top.x, this.top.y, 1.9)

    this.wheelSpeed = 0
    this._wheels = [this.baseStation, this.topStation]
  }

  _buildPylons() {
    const count = Math.max(1, Math.round(this.length / PYLON_SPACING) - 1)
    this.pylons = []
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1)
      const p = this.pointAt(t)
      const ground = terrainHeight(p.x, p.y)
      const height = Math.max(3.4, this.cableHeightAt(t) - ground - 0.44)

      const pylon = createLiftPylon({ height, rollers: 5 })
      pylon.position.set(p.x, ground, p.y)
      // Die Traverse steht quer zur Trasse, damit beide Seile darauf laufen.
      pylon.rotation.y = this.heading + Math.PI / 2
      this.group.add(pylon)
      this.world.addCollider(p.x, p.y, 0.5)
      this.pylons.push(pylon)
    }
  }

  _buildCable() {
    const points = (offset) => {
      const list = []
      for (let i = 0; i <= this.samples; i++) {
        const t = i / this.samples
        const p = this.pointAt(t, offset)
        list.push(new THREE.Vector3(p.x, this.cableHeightAt(t), p.y))
      }
      return list
    }

    const material = new THREE.MeshStandardMaterial({
      color: LIFT_COLORS.cable, roughness: 0.45, metalness: 0.6,
    })

    for (const offset of [CABLE_GAUGE, -CABLE_GAUGE]) {
      const curve = new THREE.CatmullRomCurve3(points(offset))
      const geo = new THREE.TubeGeometry(curve, this.samples, 0.045, 5, false)
      this.group.add(new THREE.Mesh(geo, material))
    }

    // Bogen um die Stationsscheiben, damit das Seil nicht abgeschnitten wirkt.
    for (const [t, station] of [[0, this.baseStation], [1, this.topStation]]) {
      const r = station.userData.wheelRadius
      const p = this.pointAt(t)
      const arc = []
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI
        const sign = t === 0 ? -1 : 1
        const along = Math.sin(a) * r * sign
        const across = Math.cos(a) * CABLE_GAUGE
        arc.push(new THREE.Vector3(
          p.x + this.dir.x * along + this.side.x * across,
          this.cableHeightAt(t),
          p.y + this.dir.y * along + this.side.y * across,
        ))
      }
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arc), 16, 0.045, 5, false)
      this.group.add(new THREE.Mesh(geo, material))
    }
  }

  _buildPlatters() {
    // Der Umlauf ist doppelt so lang wie die Trasse: hinauf und zurueck.
    this.loopLength = this.length * 2
    this.platterCount = Math.max(4, Math.round(this.loopLength / PLATTER_SPACING))

    const geo = createLiftPlatterGeometry()
    this.platters = new THREE.InstancedMesh(
      geo,
      vertexColorMaterial({ roughness: 0.5, metalness: 0.3 }),
      this.platterCount,
    )
    this.platters.castShadow = true
    this.platters.frustumCulled = false
    this.group.add(this.platters)

    this.cursor = 0
    this._dummy = new THREE.Object3D()
    this._from = new THREE.Vector3()
    this._to = new THREE.Vector3()
    this._delta = new THREE.Vector3()
    this._down = new THREE.Vector3(0, -1, 0)
    this._quat = new THREE.Quaternion()
  }

  // --- Mechanik -----------------------------------------------------------

  // Wandelt die Umlaufposition eines Tellers in Weltkoordinaten.
  _platterState(s) {
    const wrapped = ((s % this.loopLength) + this.loopLength) % this.loopLength
    const climbing = wrapped < this.length
    const t = climbing ? wrapped / this.length : 1 - (wrapped - this.length) / this.length
    const offset = climbing ? CABLE_GAUGE : -CABLE_GAUGE
    const p = this.pointAt(t, offset)
    return { t, climbing, x: p.x, z: p.y, y: this.cableHeightAt(t) }
  }

  update(dt, skier, input) {
    this.cursor += this.speed * dt
    this.wheelSpeed = this.speed

    const dummy = this._dummy
    for (let i = 0; i < this.platterCount; i++) {
      const s = this.cursor + (i / this.platterCount) * this.loopLength
      const state = this._platterState(s)

      if (this.rider && this.rider.index === i && skier) {
        // Wird erst nach dem Fahrer gespannt, siehe spannen().
        this._riderState = state
        continue
      }
      dummy.position.set(state.x, state.y, state.z)
      dummy.rotation.set(0, this.heading, 0)
      // Leerlaufende Teller sind eingezogen und pendeln leicht.
      dummy.quaternion.setFromEuler(dummy.rotation)
      const sway = Math.sin(this.cursor * 0.4 + i * 1.7) * 0.14
      dummy.quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), sway),
      )
      dummy.scale.set(1, 0.62, 1)

      dummy.updateMatrix()
      this.platters.setMatrixAt(i, dummy.matrix)
    }
    this.platters.instanceMatrix.needsUpdate = true

    if (this.rider) this._updateRider(dt, skier, input)
  }

  // Der benutzte Teller wird zwischen Seil und Fahrer gespannt: die Stange
  // zeigt exakt dorthin und wird auf die noetige Laenge gezogen, wie das
  // Teleskopgehaenge eines echten Schlepplifts. Laeuft nach skier.update() –
  // mit der Haltung aus dem vorigen Bild hing der Teller 13 cm neben der Hand.
  spannen(skier) {
    if (!this.rider || !this._riderState) return
    const state = this._riderState
    const dummy = this._dummy
    // Angriffspunkt im Fahrer selbst, damit der Teller jedes Zuruecklehnen
    // und Ausscheren mitgeht. Ein fester Weltpunkt (0,86 hoch, 0,3
    // zurueck) lag im Ruecken, die Scheibe schnitt durch den Rucksack.
    this._from.set(state.x, state.y, state.z)
    skier.group.updateMatrixWorld()
    this._to.copy(SEAT).applyMatrix4(skier.group.matrixWorld)
    this._delta.copy(this._to).sub(this._from)
    const len = Math.max(1.2, this._delta.length())
    this._quat.setFromUnitVectors(this._down, this._delta.normalize())

    dummy.position.copy(this._from)
    dummy.quaternion.copy(this._quat)
    dummy.scale.set(1, len / PLATTER_LENGTH, 1)
    dummy.updateMatrix()
    this.platters.setMatrixAt(this.rider.index, dummy.matrix)
    this.platters.instanceMatrix.needsUpdate = true
    skier.greifen(this._from, this._to)
  }

  // Kann hier eingestiegen werden?
  canBoard(skier) {
    if (this.rider) return false
    const dx = skier.position.x - this.base.x
    const dz = skier.position.z - this.base.y
    return dx * dx + dz * dz < this.boardRadius * this.boardRadius
  }

  board(skier) {
    if (!this.canBoard(skier)) return false
    // Den Teller nehmen, der der Talstation am naechsten ist und noch steigt.
    let best = 0
    let bestT = Infinity
    for (let i = 0; i < this.platterCount; i++) {
      const s = this.cursor + (i / this.platterCount) * this.loopLength
      const state = this._platterState(s)
      if (!state.climbing) continue
      if (state.t < bestT) {
        bestT = state.t
        best = i
      }
    }
    this.rider = { index: best, progress: Math.max(0.01, bestT), offset: 0 }
    this._riderState = null
    skier.tow = this
    skier.speed = this.speed
    return true
  }

  release(skier, atTop = false) {
    if (!this.rider) return
    this.rider = null
    if (!skier) return
    skier.tow = null
    // Mit Schwung aus dem Lift heraus.
    skier.speed = Math.max(skier.speed, this.speed * 0.8)
    if (atTop) {
      // An der Bergstation schwenkt man quer zur Trasse aus, statt in das
      // Tragwerk zu fahren – und faehrt dabei die Hoehenlinie entlang, nicht
      // stur weiter den Hang hinauf.
      skier.heading = Math.atan2(this.side.x, this.side.y)
      skier.facing = skier.heading
      skier._prevFacing = skier.heading
    }
  }

  _updateRider(dt, skier, input) {
    const r = this.rider
    r.progress += (this.speed / this.length) * dt

    // Seitliches Ausscheren wie im echten Lift: man darf ein Stueck nach
    // links und rechts wandern, ohne die Spur zu verlassen.
    const wanted = THREE.MathUtils.clamp(input.steer * 1.7, -1.7, 1.7)
    r.offset += (wanted - r.offset) * (1 - Math.exp(-3.5 * dt))

    // Der Teller haengt am Aufwaertsseil; der Fahrer laeuft darunter versetzt.
    const p = this.pointAt(Math.min(r.progress, 1), CABLE_GAUGE + r.offset)
    skier.towTarget = {
      x: p.x - this.dir.x * 1.1,
      z: p.y - this.dir.y * 1.1,
      heading: this.heading,
      progress: r.progress,
    }

    // Loslassen: von Hand oder automatisch kurz vor der Bergstation.
    if (input.braking || input.justPressed('use') || r.progress >= 0.94) {
      this.release(skier, r.progress >= 0.94)
    }
  }
}
