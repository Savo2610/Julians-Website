import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { Schneekugel } from '../schneekugel.js'

// Ein Schneemann, den man umfahren kann (Ansage 10.10.): wer mit Tempo
// hineinfaehrt, zerlegt ihn. Die drei Kugeln rollen in Fahrtrichtung davon
// und den Hang hinunter, nehmen Schnee auf und werden groesser
// (schneekugel.js); Hut, Nase und Arme fliegen wie die Bretter der Seebank.
// Ist man weit genug weg und liegt alles still, schmelzen die Kugeln, und
// er steht wieder – im Spielzeugtal bleibt nichts kaputt.
//
// Das Bild des ganzen Schneemanns baut createSnowman (props/kinderland.js);
// hier kommen nur die Teile dazu, in die er zerfaellt. Die Masse muessen zu
// dessen Kugeln passen.

const SNOW = 0xf7fbff
const KOHLE = 0x2a2f36
const AST = 0x6b4f31
const MOEHRE = 0xe07a2c

// Unter 3,5 m/s schiebt man sich vorbei. Im Kinderland faehrt man langsamer
// als an der Seebank (5): wer den Hang herunterkommt, hat 4 bis 7.
const BRUCH = 3.5
const RUHE = 10            // s, bevor er sich wieder aufbaut ...
const WEG = 14             // ... und nur, wenn der Fahrer so weit weg ist
const SCHMELZEN = 1.2      // s, so lange schrumpfen die Kugeln
const AUFBAU = 0.8         // s, so lange waechst er wieder aus dem Schnee
const SCHWERE = 18

export class ZerlegbarerSchneemann {
  constructor(world, model, x, z, { scale = 1, hat = 0xe8663a, hoehe = terrainHeight } = {}) {
    this.world = world
    this.model = model
    this.x = x
    this.z = z
    this.scale = scale
    this.hoehe = hoehe
    this.zustand = 'ganz'      // ganz | kaputt | schmilzt | waechst
    this.zeit = 0
    this._skier = null

    // Dieselben Masse wie createSnowman.
    const r0 = 0.62 * scale
    const r1 = 0.44 * scale
    const r2 = 0.31 * scale
    const y0 = r0 * 0.86
    const y1 = y0 + r0 * 0.62 + r1 * 0.36
    const y2 = y1 + r1 * 0.58 + r2 * 0.34
    this._masse = { r0, r1, r2, y0, y1, y2 }

    const material = vertexColorMaterial({ roughness: 0.9 })
    // Jede Kugel traegt etwas Dunkles, sonst sieht man nicht, dass sie
    // rollt: die untere ein paar Kiesel, die mittlere die Knoepfe, der Kopf
    // die Augen.
    const kugel = (r, flecken) => {
      const parts = [{ geo: new THREE.SphereGeometry(r, 14, 10), color: SNOW }]
      for (const [px, py, pz, fr] of flecken) {
        parts.push({ geo: new THREE.SphereGeometry(fr, 6, 5), color: KOHLE, position: [px * r, py * r, pz * r] })
      }
      const mesh = new THREE.Mesh(assemble(parts), material)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.visible = false
      world.scene.add(mesh)
      return mesh
    }
    this.kugeln = [
      { mesh: kugel(r0, [[0.3, 0.2, 0.93, 0.05 * scale], [-0.6, -0.3, 0.74, 0.04 * scale], [0.1, 0.8, -0.59, 0.045 * scale]]), r: r0, y: y0, k: null },
      { mesh: kugel(r1, [-0.1, 0.26, 0.62].map((py) => [0, py, Math.sqrt(1 - py * py) * 0.97, 0.045 * scale])), r: r1, y: y1, k: null },
      { mesh: kugel(r2, [[-0.36, 0.26, 0.89, 0.04 * scale], [0.36, 0.26, 0.89, 0.04 * scale]]), r: r2, y: y2, k: null },
    ]

    // Was fliegt: Hut, Nase, zwei Arme.
    const teil = (parts) => {
      const mesh = new THREE.Mesh(assemble(parts), material)
      mesh.castShadow = true
      mesh.visible = false
      world.scene.add(mesh)
      mesh.geometry.computeBoundingBox()
      const size = mesh.geometry.boundingBox.getSize(new THREE.Vector3())
      return { mesh, rest: Math.min(size.x, size.y, size.z) / 2, v: new THREE.Vector3(), spin: new THREE.Vector3() }
    }
    this.teile = [
      teil([
        { geo: new THREE.CylinderGeometry(r2 * 1.24, r2 * 1.24, 0.05 * scale, 12), color: hat },
        { geo: new THREE.CylinderGeometry(r2 * 0.78, r2 * 0.84, 0.34 * scale, 12), color: hat, position: [0, 0.17 * scale, 0] },
      ]),
      teil([{ geo: new THREE.ConeGeometry(0.062 * scale, 0.34 * scale, 7), color: MOEHRE, rotation: [Math.PI / 2, 0, 0] }]),
      teil([{ geo: new THREE.CylinderGeometry(0.035 * scale, 0.045 * scale, 0.78 * scale, 6), color: AST, rotation: [0, 0, 1.2] }]),
      teil([{ geo: new THREE.CylinderGeometry(0.035 * scale, 0.045 * scale, 0.78 * scale, 6), color: AST, rotation: [0, 0, -1.2] }]),
    ]
    // Wo sie am Schneemann sitzen (lokal, vor der Drehung): Hut, Nase, Arme.
    this._ansatz = [
      [0, y2 + r2 * 0.95, 0], [0, y2, r2 * 1.1], [-r1 * 1.4, y1 + 0.15 * scale, 0], [r1 * 1.4, y1 + 0.15 * scale, 0],
    ]

    this.collider = world.addCollider(x, z, 0.62 * scale, {
      onHit: () => {
        const s = this._skier
        if (this.zustand !== 'ganz' || !s || s.speed < BRUCH) return
        // Nur der Fahrer zerlegt ihn, keine Kugel, die anderswo anstoesst.
        if (Math.hypot(s.position.x - x, s.position.z - z) > 0.62 * scale + 1.2) return
        this.zerlegen(s)
        return true
      },
    })
  }

  get kaputt() {
    return this.zustand !== 'ganz'
  }

  zerlegen(s) {
    this.zustand = 'kaputt'
    this.zeit = 0
    this.collider.off = true
    this.model.visible = false
    const fx = s.forward.x * s.speed
    const fz = s.forward.z * s.speed
    const rot = this.model.rotation.y
    const cos = Math.cos(rot), sin = Math.sin(rot)
    const boden = this.hoehe(this.x, this.z)

    // Die Kugeln: die untere bekommt den Stoss am staerksten ab und bleibt
    // am Boden, die oberen fallen herunter und kugeln weiter.
    this.kugeln.forEach((b, i) => {
      const quer = (Math.random() - 0.5) * 1.2
      b.k = new Schneekugel({ x: this.x, z: this.z, r: b.r, hoehe: this.hoehe })
      b.k.y = boden + b.y
      b.k.stossen(
        fx * (0.55 - i * 0.08) + -fz / (s.speed || 1) * quer,
        fz * (0.55 - i * 0.08) + fx / (s.speed || 1) * quer,
        i === 0 ? 0 : 1.5 + i,
      )
      b.k.luft = true
      b.mesh.visible = true
      b.mesh.scale.setScalar(1)
      b.mesh.quaternion.identity()
      b.mesh.position.set(b.k.x, b.k.y, b.k.z)
    })
    this.teile.forEach((t, i) => {
      const [lx, ly, lz] = this._ansatz[i]
      t.mesh.position.set(this.x + lx * cos + lz * sin, boden + ly, this.z - lx * sin + lz * cos)
      t.mesh.rotation.set(0, rot, 0)
      t.mesh.visible = true
      t.mesh.scale.setScalar(1)
      t.v.set(fx * (0.35 + Math.random() * 0.3) + (Math.random() - 0.5) * 2, 3 + Math.random() * 3, fz * (0.35 + Math.random() * 0.3) + (Math.random() - 0.5) * 2)
      t.spin.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12)
      t.liegt = false
    })
  }

  update(dt, skier) {
    this._skier = skier
    const dist = skier ? Math.hypot(skier.position.x - this.x, skier.position.z - this.z) : Infinity
    // Stand der Fahrer beim Aufbau im Schneemann, bleibt die Kollision aus,
    // bis er draussen ist.
    if (this.collider.off && this.zustand === 'ganz' && dist > 0.62 * this.scale + 0.8) this.collider.off = false
    if (this.zustand === 'ganz') return
    this.zeit += dt

    for (const b of this.kugeln) {
      if (!b.k) continue
      b.k.update(dt, this.world)
      const vx = b.k.vx, vz = b.k.vz
      const v = Math.hypot(vx, vz)
      if (v > 0.001 && !b.k.luft) {
        // Rollen: um die Achse quer zur Fahrt, ein Bogen je Halbmesser.
        _achse.set(vz / v, 0, -vx / v)
        _q.setFromAxisAngle(_achse, v * dt / b.k.r)
        b.mesh.quaternion.premultiply(_q)
      }
      b.mesh.position.set(b.k.x, b.k.y, b.k.z)
      if (this.zustand === 'kaputt') b.mesh.scale.setScalar(b.k.r / b.r)
      // Wer in eine Kugel faehrt, wird hinausgeschoben.
      if (skier && !skier.tow && skier.height < b.k.r) {
        const ax = skier.position.x - b.k.x
        const az = skier.position.z - b.k.z
        const ad = Math.hypot(ax, az)
        const min = b.k.r + 0.35
        if (ad < min && ad > 0.01) {
          skier.position.x = b.k.x + ax / ad * min
          skier.position.z = b.k.z + az / ad * min
          // Und schubst sie ein Stueck an.
          b.k.stossen(-ax / ad * skier.speed * 0.25, -az / ad * skier.speed * 0.25)
        }
      }
    }

    for (const t of this.teile) {
      if (t.liegt) continue
      const m = t.mesh
      t.v.y -= SCHWERE * dt
      m.position.addScaledVector(t.v, dt)
      m.rotation.x += t.spin.x * dt
      m.rotation.y += t.spin.y * dt
      m.rotation.z += t.spin.z * dt
      const floor = this.hoehe(m.position.x, m.position.z) + t.rest
      if (m.position.y <= floor) {
        m.position.y = floor
        t.v.set(t.v.x * 0.4, Math.max(0, -t.v.y * 0.15), t.v.z * 0.4)
        t.spin.multiplyScalar(0.4)
        if (Math.hypot(t.v.x, t.v.z) < 0.3 && t.v.y < 0.5) t.liegt = true
      }
    }

    if (this.zustand === 'kaputt') {
      const still = this.kugeln.every((b) => b.k.ruht)
      if (still && this.zeit > RUHE && dist > WEG) {
        this.zustand = 'schmilzt'
        this.zeit = 0
        for (const b of this.kugeln) b.gross = b.k.r / b.r
      }
    } else if (this.zustand === 'schmilzt') {
      const f = Math.max(0, 1 - this.zeit / SCHMELZEN)
      for (const b of this.kugeln) {
        b.mesh.scale.setScalar(b.gross * f)
        b.mesh.position.y = b.k.y - b.k.r * (1 - f)
      }
      for (const t of this.teile) t.mesh.scale.setScalar(Math.max(0.001, f))
      if (f === 0) {
        for (const b of this.kugeln) { b.mesh.visible = false; b.k = null }
        for (const t of this.teile) t.mesh.visible = false
        this.zustand = 'waechst'
        this.zeit = 0
        this.model.visible = true
        this.model.scale.setScalar(0.001)
      }
    } else if (this.zustand === 'waechst') {
      const f = Math.min(1, this.zeit / AUFBAU)
      // Mit einem kleinen Ueberschwingen, wie aus dem Schnee gesprungen.
      this.model.scale.setScalar(Math.max(0.001, f < 1 ? 1 + 1.4 * (f - 1) ** 3 + 0.4 * (f - 1) ** 2 : 1))
      if (f === 1) {
        this.model.scale.setScalar(1)
        this.zustand = 'ganz'
        // Die Kollision kommt zurueck, sobald der Fahrer nicht darin steht.
        this.collider.off = true
      }
    }
  }
}

const _achse = new THREE.Vector3()
const _q = new THREE.Quaternion()
