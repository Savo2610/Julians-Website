import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { KINDER_COLORS } from '../props/kinderland.js'

// Das Skikarussell auf der Spielwiese: ein Mast mit vier Armen, an jedem
// haengt ein Griff. Man faehrt heran, Enter haengt einen an den naechsten
// Griff, das Karussell zieht einen eine Runde im Kreis und laesst einen
// dort los, wo die Tangente auf den Uebungshang zeigt – so schleudert es
// einen in den Slalom, und die Schleife des Kinderlands geht weiter.
//
// Technisch dieselbe Mechanik wie Teppich und Lift: `skier.tow` und eine
// Zielposition, die Fahrphysik ruht. Neu ist nur, dass das Ziel auf einem
// Kreis laeuft. Die Kamera dreht dabei nicht mit – ein Kreis liest sich aus
// jeder Richtung gleich, deshalb passt gerade diese Anlage zur festen Kamera.
//
// Gedreht wird im Uhrzeigersinn von oben (Winkel nimmt ab): dann liegt die
// Mitte rechts vom Fahrer, und der rechte Arm, den `grab` ohnehin hebt,
// greift nach innen zum Griff.

const ARM_RADIUS = 2.9       // Spitze der Arme
const RIDE_RADIUS = 3.25     // Fahrer; die rechte Hand liegt dann unter der Spitze
const ARM_HEIGHT = 2.25      // Hoehe der Armspitzen ueber dem Fuss des Masts
const ROPE = 0.95
const IDLE_SPIN = 0.5        // rad/s – leer dreht es langsam, daran sieht man, dass es laeuft
const RIDE_SPIN = 1.35       // rad/s – 4,4 m/s am Fahrer, eine Runde in 4,7 s
const FLING = 6.5            // Tempo beim Loslassen, etwas mehr als im Kreis
const ARMS = 4

export class SkiCarousel {
  constructor(world, { center, exit }) {
    this.world = world
    this.center = new THREE.Vector2(center.x, center.z)
    this.exit = exit
    this.groundY = terrainHeight(center.x, center.z)

    this.angle = 0
    this.spin = IDLE_SPIN
    this.rider = null

    this.group = new THREE.Group()
    this.group.position.set(center.x, this.groundY, center.z)
    world.scene.add(this.group)

    this._buildBase()
    this._buildRotor()
    this._buildHandles()

    // Nur der Mast ist ein Hindernis. Die Arme haengen ueber Kopfhoehe der
    // Kinder, und durch den Kreis darf man auch einfach hindurchfahren.
    world.addCollider(center.x, center.z, 0.7)

    this._handleSwing = new Float32Array(ARMS)
  }

  // Tempo am Fahrer – `_updateTowed` liest es als `tow.speed`.
  get speed() {
    return this.spin * RIDE_RADIUS
  }

  _buildBase() {
    const parts = []
    // Der weisse Teller wie unter allem im Kinderland, hier gross genug fuer
    // das Getriebe.
    parts.push({
      geo: new THREE.CylinderGeometry(1.05, 1.2, 0.1, 18),
      color: 0xf7fbff,
      position: [0, 0.05, 0],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.55, 0.62, 0.7, 14),
      color: KINDER_COLORS[1],
      position: [0, 0.45, 0],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.6, 0.6, 0.08, 14),
      color: KINDER_COLORS[2],
      position: [0, 0.82, 0],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.11, 0.13, ARM_HEIGHT - 0.6, 10),
      color: 0xd8dee6,
      position: [0, 0.8 + (ARM_HEIGHT - 0.8) / 2, 0],
    })
    const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.62 }))
    mesh.castShadow = true
    mesh.receiveShadow = true
    this.group.add(mesh)
  }

  // Alles, was sich dreht und nicht pendelt, ist ein Mesh: Nabe, Schirm, Arme.
  _buildRotor() {
    const parts = []
    parts.push({
      geo: new THREE.CylinderGeometry(0.3, 0.3, 0.32, 12),
      color: KINDER_COLORS[2],
      position: [0, ARM_HEIGHT + 0.12, 0],
    })
    // Der Schirm in acht Bahnen: von oben ist er das Erste, was man sieht,
    // und die Streifen zeigen die Drehung auch dann, wenn die Arme gerade
    // in die Blickrichtung zeigen.
    const slices = 8
    for (let i = 0; i < slices; i++) {
      parts.push({
        geo: new THREE.ConeGeometry(1.7, 0.7, 3, 1, false, (i / slices) * Math.PI * 2, (Math.PI * 2) / slices),
        color: i % 2 ? 0xf7fbff : KINDER_COLORS[(i >> 1) % KINDER_COLORS.length],
        position: [0, ARM_HEIGHT + 0.62, 0],
      })
    }
    parts.push({
      geo: new THREE.SphereGeometry(0.14, 10, 8),
      color: KINDER_COLORS[0],
      position: [0, ARM_HEIGHT + 1.0, 0],
    })
    for (let i = 0; i < ARMS; i++) {
      const a = (i / ARMS) * Math.PI * 2
      const sx = Math.sin(a)
      const sz = Math.cos(a)
      // Die Arme in der Farbe ihres Griffs und dick genug, dass sie aus 33 m
      // als Speichen tragen – bei 0,11 m sah man nur Schirm und Stiele.
      parts.push({
        geo: new THREE.BoxGeometry(0.17, 0.17, ARM_RADIUS - 0.2),
        color: KINDER_COLORS[i % KINDER_COLORS.length],
        position: [sx * (ARM_RADIUS / 2 + 0.1), ARM_HEIGHT + 0.08, sz * (ARM_RADIUS / 2 + 0.1)],
        rotation: [0, a, 0],
      })
      // Weisse Kappe an der Spitze, dort haengt der Griff.
      parts.push({
        geo: new THREE.SphereGeometry(0.17, 8, 6),
        color: 0xf7fbff,
        position: [sx * ARM_RADIUS, ARM_HEIGHT + 0.08, sz * ARM_RADIUS],
      })
    }
    this.rotor = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.6 }))
    this.rotor.castShadow = true
    this.group.add(this.rotor)
  }

  // Die vier Griffe pendeln einzeln – eine InstancedMesh, ein Zeichenaufruf.
  // Gebaut haengend: Aufhaengung im Ursprung, Seil nach -Y, Stange quer.
  _buildHandles() {
    const parts = [
      { geo: new THREE.CylinderGeometry(0.035, 0.035, ROPE, 5), color: 0xffffff, position: [0, -ROPE / 2, 0] },
      { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.62, 8), color: 0xffffff, position: [0, -ROPE, 0], rotation: [0, 0, Math.PI / 2] },
      { geo: new THREE.SphereGeometry(0.12, 8, 6), color: 0xffffff, position: [0, -ROPE - 0.1, 0] },
    ]
    const geo = assemble(parts)
    this.handles = new THREE.InstancedMesh(geo, vertexColorMaterial({ roughness: 0.55 }), ARMS)
    this.handles.castShadow = true
    // Im Weltraum gesetzt, deshalb nicht am Rotor und ohne Begrenzungskugel.
    this.handles.frustumCulled = false
    for (let i = 0; i < ARMS; i++) {
      this.handles.setColorAt(i, new THREE.Color(KINDER_COLORS[i % KINDER_COLORS.length]))
    }
    this.world.scene.add(this.handles)

    this._m = new THREE.Matrix4()
    this._x = new THREE.Vector3()
    this._y = new THREE.Vector3()
    this._z = new THREE.Vector3()
    this._p = new THREE.Vector3()
  }

  // Wo Arm i gerade zeigt (Weltwinkel, x = sin, z = cos wie das Heading).
  armAngle(i) {
    return this.angle + (i / ARMS) * Math.PI * 2
  }

  pointAt(phi, radius = RIDE_RADIUS) {
    return {
      x: this.center.x + Math.sin(phi) * radius,
      z: this.center.y + Math.cos(phi) * radius,
    }
  }

  canBoard(skier) {
    if (this.rider || skier.tow || skier.airborne) return false
    const dx = skier.position.x - this.center.x
    const dz = skier.position.z - this.center.y
    const d = Math.hypot(dx, dz)
    return d > 1.0 && d < 5.4
  }

  board(skier) {
    if (!this.canBoard(skier)) return false
    // Den Griff nehmen, der dem Fahrer am naechsten ist – der Fahrer wird
    // dann weich auf seinen Platz gezogen, nicht hingesetzt.
    const phi = Math.atan2(skier.position.x - this.center.x, skier.position.z - this.center.y)
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < ARMS; i++) {
      let d = phi - this.armAngle(i)
      d = Math.abs(Math.atan2(Math.sin(d), Math.cos(d)))
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    this.rider = { arm: best, turned: 0 }
    skier.tow = this
    return true
  }

  release(skier) {
    if (!this.rider) return
    this.rider = null
    if (!skier) return
    // Losgelassen wird immer tangential, auch vorzeitig: man fliegt dorthin
    // weiter, wohin man gerade faehrt, statt auf der Stelle zu stehen.
    const heading = skier.heading
    skier.tow = null
    skier.towTarget = null
    skier.heading = heading
    skier.facing = heading
    skier._prevFacing = heading
    skier.speed = FLING
  }

  update(dt, skier, input) {
    const wanted = this.rider ? RIDE_SPIN : IDLE_SPIN
    // Anlaufen dauert gut eine Sekunde – sichtbar, aber ohne zu warten.
    this.spin += (wanted - this.spin) * (1 - Math.exp(-1.6 * dt))
    const step = this.spin * dt
    this.angle -= step
    this.rotor.rotation.y = this.angle

    if (this.rider) {
      const r = this.rider
      r.turned += step
      // Der Fahrer haengt etwas hinter seinem Arm (+), damit das Seil schraeg
      // nach vorn zieht. Ziel und Blick laufen zusaetzlich um das voraus, was
      // das weiche Nachziehen in `_updateTowed` verliert (Raten 9 und 6),
      // sonst faehrt er innen auf der Sehne und schaut nach aussen.
      const phi = this.armAngle(r.arm) + 0.16
      const p = this.pointAt(phi - this.spin / 9)
      const tangent = phi - Math.PI / 2
      skier.towTarget = { x: p.x, z: p.z, heading: tangent - this.spin / 6, progress: r.turned / (Math.PI * 2) }

      // Losgelassen wird nach einer Runde, sobald die Tangente auf den Hang
      // zeigt. Gemessen am echten Fahrer, nicht am Ziel: der laeuft hinterher.
      let release = input.braking || input.justPressed('use')
      if (r.turned > Math.PI * 1.85) {
        const toExit = Math.atan2(this.exit.x - skier.position.x, this.exit.z - skier.position.z)
        let off = toExit - skier.heading
        off = Math.atan2(Math.sin(off), Math.cos(off))
        if (Math.abs(off) < 0.14 || r.turned > Math.PI * 4) release = true
      }
      if (release) this.release(skier)
    }

    this._updateHandles(dt, skier)
  }

  _updateHandles(dt, skier) {
    const g = 9.8
    // Leere Griffe fliegen nach aussen wie ein Kettenkarussell: tan(b) = w²r/g.
    const swing = Math.atan((this.spin * this.spin * ARM_RADIUS) / g)
    for (let i = 0; i < ARMS; i++) {
      const a = this.armAngle(i)
      const out = this._x.set(Math.sin(a), 0, Math.cos(a))
      const pivot = this._p.set(
        this.center.x + out.x * ARM_RADIUS,
        this.groundY + ARM_HEIGHT,
        this.center.y + out.z * ARM_RADIUS,
      )
      // Richtung, in die das Seil haengt (von der Aufhaengung weg).
      const down = this._y
      if (this.rider && this.rider.arm === i) {
        // Der besetzte Griff zeigt auf die rechte Hand des Fahrers.
        const h = skier.facing
        down.set(
          skier.position.x - Math.cos(h) * 0.32 + Math.sin(h) * 0.3 - pivot.x,
          skier.position.y + 1.45 - pivot.y,
          skier.position.z + Math.sin(h) * 0.32 + Math.cos(h) * 0.3 - pivot.z,
        )
        // Nicht laenger als das Seil, sonst steht die Stange im Fahrer.
        if (down.length() > ROPE + 0.1) down.setLength(ROPE + 0.1)
        this._handleSwing[i] = swing
      } else {
        // Nachschwingen statt springen, wenn ein Fahrer loslaesst.
        this._handleSwing[i] += (swing - this._handleSwing[i]) * (1 - Math.exp(-3 * dt))
        const b = this._handleSwing[i]
        down.set(out.x * Math.sin(b), -Math.cos(b), out.z * Math.sin(b))
      }
      // Basis aufbauen: Y gegen das Seil, X (die Stange) quer zum Arm.
      const up = down.normalize().negate()
      const x = this._z.set(Math.cos(a), 0, -Math.sin(a))
      x.addScaledVector(up, -x.dot(up)).normalize()
      const z = this._x.crossVectors(x, up)
      this._m.makeBasis(x, up, z).setPosition(pivot)
      this.handles.setMatrixAt(i, this._m)
    }
    this.handles.instanceMatrix.needsUpdate = true
  }
}

// Am Karussell haelt man sich fest – der rechte Arm geht hoch zum Griff.
SkiCarousel.prototype.grab = true
