import * as THREE from 'three'
import { KINDER_LANE, terrainHeight } from './heightfield.js'
import { MagicCarpet } from './magic-carpet.js'
import { readableYaw } from './props/slalom.js'
import { snowPaint } from './props/snow-paint.js'
import {
  createNoodleArch,
  createCone,
  createFlagLine,
  createSnowTunnel,
  createSnowman,
  createKinderGate,
  createBuntingFence,
  KINDER_COLORS,
} from './props/kinderland.js'

// Das Kinderland: Spielwiese oben auf der Osthoehe, Uebungshang darunter,
// Zauberteppich dazwischen.
//
// Der Aufbau folgt einem echten Kinderland, und daran haengt der ganze
// Zusammenhang: das Foerderband liegt am Westrand des praeparierten Bandes,
// die Uebungsstrecke daneben auf demselben Band. Man faehrt hinauf, spielt
// oben auf der Kuppe, faehrt durch den Slalom wieder hinunter und steht
// wieder am Teppich. Nichts steht irgendwo – alles liegt an dieser Schleife.
//
// Positionen auf dem Hang werden in Bandkoordinaten angegeben: s ist die
// Strecke von unten, off der seitliche Versatz (negativ = zum Teppich hin).
// Dadurch wandert die ganze Anlage mit, wenn das Band einmal anders liegt.

// Wo der Teppich auf dem Band liegt und wie weit er reicht.
const CARPET_OFFSET = -4.2
const CARPET_FROM = 3
const CARPET_TO = 23

// Die Spielwiese oben. Weltkoordinaten, weil die Kuppe kein Band hat – sie
// ist von selbst flach genug.
const CAP = { x: 45.5, z: -7.5 }

export class Kinderland {
  constructor(world) {
    this.world = world
    this.lane = KINDER_LANE
    this.reactors = []
    this.animated = []

    const from = this.at(CARPET_FROM, CARPET_OFFSET)
    const to = this.at(CARPET_TO, CARPET_OFFSET)
    this.carpet = new MagicCarpet(world, {
      base: { x: from.x, z: from.z },
      top: { x: to.x, z: to.z },
      speed: 5.4,
    })

    this._buildFence()
    this._buildCap()
    this._buildSlope()
    this._paint()
  }

  // --- Bandkoordinaten ----------------------------------------------------

  at(s, off = 0) {
    const segs = this.lane.segments
    let g = segs[segs.length - 1]
    let t = 1
    for (const seg of segs) {
      if (s >= seg.s0 && s <= seg.s0 + seg.len) {
        g = seg
        t = (s - seg.s0) / seg.len
        break
      }
    }
    const ux = g.dx / g.len
    const uz = g.dz / g.len
    return {
      x: g.x + g.dx * t - uz * off,
      z: g.z + g.dz * t + ux * off,
      // Bergauf, also entgegen der Fahrtrichtung beim Abfahren.
      heading: Math.atan2(ux, uz),
    }
  }

  // --- Aufbau -------------------------------------------------------------

  // Ein Objekt hinstellen und, wenn es reagieren kann, anmelden.
  add(object, x, z, { rotation = 0, collider = 0, trigger = 0, kind = null } = {}) {
    this.world.place(object, x, z, { rotation })
    if (collider > 0) this.world.addCollider(x, z, collider)
    if (object.userData.animate) this.animated.push(object.userData.animate)
    if (trigger > 0 && object.userData.react) {
      this.reactors.push({ x, z, r: trigger, obj: object, kind, cool: 0 })
    }
    return object
  }

  // Die Einfassung. Sie umschliesst Teppich, Uebungshang und Spielwiese in
  // einem Zug – erst dadurch sind die Dinge darin ein Ort und nicht eine
  // Ansammlung. Unten bleibt eine Luecke: das ist die Einfahrt.
  _buildFence() {
    const west = [1.5, 7, 13, 19, 24.5].map((s) => {
      const p = this.at(s, -7.8)
      return [p.x, p.z]
    })
    const east = [24.5, 19, 13, 7, 1.5].map((s) => {
      const p = this.at(s, 7.8)
      return [p.x, p.z]
    })
    // Um die Kuppe herum: ein Bogen, der die Spielwiese fasst.
    const cap = [
      [39.5, -5.8], [41.5, -10.5], [45.0, -14.2], [49.5, -13.6],
      [52.4, -10.0], [52.6, -5.4], [50.0, -2.2],
    ]
    const ring = [...west, ...cap, ...east]
    this.world.scene.add(createBuntingFence(ring, {
      sample: (x, z) => terrainHeight(x, z),
      spacing: 3.4,
    }))
  }

  _buildCap() {
    // Das Tor steht dort, wo man vom Teppich auf die Kuppe faehrt, und zeigt
    // in die Spielwiese hinein.
    const exit = this.at(CARPET_TO, CARPET_OFFSET)
    const toCap = Math.atan2(CAP.x - exit.x, CAP.z - exit.z)
    this.add(createKinderGate(), 41.8, -5.0, {
      rotation: readableYaw(toCap),
      collider: 0,
    })
    // Die Masten des Tors einzeln, damit man mittendurch faehrt statt daran
    // haengenzubleiben.
    for (const sx of [-1, 1]) {
      const yaw = readableYaw(toCap)
      this.world.addCollider(41.8 + Math.cos(yaw) * sx * 3.2, -5.0 - Math.sin(yaw) * sx * 3.2, 0.34)
    }

    // Der Tunnel liegt quer auf der flachsten Stelle der Kuppe. Er zeigt in
    // die Falllinie, damit man ihn im Vorbeifahren mitnimmt.
    this.add(createSnowTunnel(), 46.6, -6.6, {
      rotation: readableYaw(Math.atan2(0.55, -0.84)),
      trigger: 3.4,
      kind: 'tunnel',
    })

    // Zwei Nudelboegen hintereinander – ein Rhythmus, kein Einzelstueck.
    this.add(createNoodleArch({ color: KINDER_COLORS[0] }), 49.2, -9.4, {
      rotation: readableYaw(Math.atan2(0.62, -0.78)),
      trigger: 3.0,
      kind: 'arch',
    })
    this.add(createNoodleArch({ color: KINDER_COLORS[3], span: 4.6 }), 46.4, -11.2, {
      rotation: readableYaw(Math.atan2(0.9, -0.44)),
      trigger: 2.8,
      kind: 'arch',
    })

    // Die Wimpelkette markiert die Unterkante der Spielwiese: dahinter wird
    // der Hang steil, davor ist Kinderland.
    this.add(createFlagLine({ span: 7, seed: 1 }), 43.0, -10.4, {
      rotation: readableYaw(Math.atan2(0.86, 0.51)),
      trigger: 4.2,
      kind: 'flags',
    })

    // Drei Schneemaenner, aufgestellt wie Zuschauer am Rand: verschieden
    // gross, verschiedene Huete, alle mit Blick auf die Wiese.
    const snowmen = [
      { x: 43.2, z: -4.6, scale: 1.15, hat: KINDER_COLORS[0] },
      { x: 50.0, z: -5.2, scale: 0.9, hat: KINDER_COLORS[1] },
      { x: 44.2, z: -13.0, scale: 1.3, hat: KINDER_COLORS[3] },
    ]
    snowmen.forEach((s, i) => {
      const man = createSnowman({ scale: s.scale, hat: s.hat, seed: i * 2.1 })
      this.add(man, s.x, s.z, {
        rotation: Math.atan2(CAP.x - s.x, CAP.z - s.z),
        collider: 0.62 * s.scale,
        trigger: 7,
        kind: 'snowman',
      })
    })
  }

  _buildSlope() {
    // Der Slalom: Huetchen im Wechsel, dazwischen zwei Nudelboegen. Die
    // Abstaende sind so gewaehlt, dass man bei Reisetempo einen Rhythmus
    // findet und nicht zwischen zwei Toren steht.
    const gates = [
      { s: 21.0, off: 0.8, kind: 'arch' },
      { s: 18.0, off: 3.0 },
      { s: 15.2, off: -1.2 },
      { s: 12.4, off: 3.0 },
      { s: 9.6, off: -1.2 },
      { s: 7.0, off: 1.4, kind: 'arch' },
      { s: 4.0, off: 0.8, kind: 'flags' },
    ]

    gates.forEach((g, i) => {
      const p = this.at(g.s, g.off)
      // Alles auf dem Hang schaut bergauf – also dem entgegen, der herunter
      // kommt.
      const yaw = readableYaw(p.heading + Math.PI)
      if (g.kind === 'arch') {
        this.add(createNoodleArch({ color: KINDER_COLORS[i % 4], span: 4.8, height: 2.3 }), p.x, p.z, {
          rotation: yaw, trigger: 2.9, kind: 'arch',
        })
      } else if (g.kind === 'flags') {
        this.add(createFlagLine({ span: 7.6, height: 2.3, seed: 3 }), p.x, p.z, {
          rotation: yaw, trigger: 4.4, kind: 'flags',
        })
      } else {
        // Ein Tor aus zwei Huetchen: man faehrt dazwischen durch, und wer zu
        // eng nimmt, legt eines um.
        for (const sx of [-1, 1]) {
          const cx = p.x + Math.cos(yaw) * sx * 1.6
          const cz = p.z - Math.sin(yaw) * sx * 1.6
          this.add(createCone({ color: KINDER_COLORS[i % 4] }), cx, cz, {
            trigger: 1.15, kind: 'cone',
          })
        }
      }
    })

    // Zwei kleine Schneemaenner am Rand des Uebungshangs, damit die Strecke
    // auch dort als Ort gefasst ist und nicht im Hang ausfranst.
    for (const [s, off, scale] of [[17, -6.6, 0.85], [8.5, 6.4, 0.95]]) {
      const p = this.at(s, off)
      const man = createSnowman({ scale, hat: KINDER_COLORS[2], seed: s })
      this.add(man, p.x, p.z, {
        rotation: p.heading + Math.PI,
        collider: 0.6 * scale,
        trigger: 6.5,
        kind: 'snowman',
      })
    }
  }

  // Farbe im Schnee: eine Spur aus Winkeln vom Teppichausstieg auf die Wiese
  // und wieder zurueck auf den Uebungshang. Ohne sie steht oben eine Sammlung
  // von Dingen; mit ihr ist es ein Rundweg.
  _paint() {
    const paint = snowPaint()
    const tone = new THREE.Color(KINDER_COLORS[1]).lerp(new THREE.Color(0xffffff), 0.38).getHex()

    const route = [
      this.at(CARPET_TO, CARPET_OFFSET),
      { x: 41.8, z: -5.0 },
      { x: 45.5, z: -7.0 },
      { x: 48.6, z: -9.6 },
      { x: 45.6, z: -11.6 },
      { x: 43.0, z: -9.6 },
      { x: 43.6, z: -5.4 },
      this.at(23.5, 0.8),
    ]
    // Und weiter den Uebungshang hinunter, mitten durch den Slalom: erst
    // dadurch liest sich die Reihe aus Huetchen als Strecke.
    for (const [s, off] of [[22, 0.8], [19.5, 3.0], [16.6, -1.2], [13.9, 3.0], [11, -1.2], [8.3, 1.4], [5.5, 0.8], [2.5, 0.8]]) {
      route.push(this.at(s, off))
    }
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i]
      const b = route[i + 1]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      if (len < 0.5) continue
      const dx = (b.x - a.x) / len
      const dz = (b.z - a.z) / len
      for (let d = len * 0.5; d < len; d += 5.5) {
        paint.chevron(a.x + dx * d, a.z + dz * d, dx, dz, 2.0, tone)
      }
    }
    this.world.scene.add(paint.build({ name: 'kinderland-spur' }))
  }

  // --- Ablauf -------------------------------------------------------------

  update(dt, skier, input) {
    this.carpet.update(dt, skier, input)

    const sx = skier.position.x
    const sz = skier.position.z
    const moving = skier.speed > 1.2 && !skier.tow

    for (const r of this.reactors) {
      r.cool = Math.max(0, r.cool - dt)
      const dx = sx - r.x
      const dz = sz - r.z
      const d2 = dx * dx + dz * dz
      if (d2 > r.r * r.r) continue

      if (r.kind === 'snowman') {
        // Der Schneemann schaut immer her, sobald jemand in der Naehe ist –
        // dafuer braucht es keine Ausloesesperre, nur einen Peilwinkel.
        let bearing = Math.atan2(dx, dz) - r.obj.rotation.y
        bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing))
        const near = 1 - Math.sqrt(d2) / r.r
        r.obj.userData.react(near, bearing)
        continue
      }

      if (r.cool > 0 || !moving) continue
      r.cool = r.kind === 'cone' ? 2.5 : 1.2
      const strength = THREE.MathUtils.clamp(skier.speed / 12, 0.3, 1.2)
      r.obj.userData.react(strength, skier.heading)
    }
  }

  animate(t, dt) {
    for (const fn of this.animated) fn(t, dt)
  }
}
