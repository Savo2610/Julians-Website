import * as THREE from 'three'
import { KINDER_LANE, SHOOT_RUN, terrainHeight } from '../heightfield.js'
import { MagicCarpet } from '../attractions/magic-carpet.js'
import { readableYaw } from '../props/slalom.js'
import { LightRun } from '../attractions/light-run.js'
import { createMarker } from '../../stations/marker.js'
import { createSnowCannon } from '../props/snow-cannon.js'
import {
  createNoodleArch,
  createCone,
  createSnowTunnel,
  createSnowman,
  createBuntingFence,
  KINDER_COLORS,
} from '../props/kinderland.js'

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
//
// Westlich davon, ausserhalb der Wimpelkette, faellt der Hang von selbst
// gleichmaessig mit 8 bis 16 Grad – dort liegt die Leuchtstrecke. Sie braucht
// kein eigenes Pistenband: ein zweites Band so dicht neben dem ersten wuerde
// nur dagegen ziehen, und noetig ist es nicht.

// Wo der Teppich auf dem Band liegt und wie weit er reicht.
const CARPET_OFFSET = -4.2
const CARPET_FROM = 3
const CARPET_TO = 23

// Die Spielwiese oben. Weltkoordinaten, weil die Kuppe kein Band hat – sie
// ist von selbst flach genug.
const CAP = { x: 45.5, z: -7.5 }

export class Kinderland {
  constructor(world, registry) {
    this.world = world
    this.registry = registry
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

    // Der Teppich meldet sich als Station an. Damit bekommt er denselben
    // Ring im Schnee und dieselbe Einblendung wie alles andere, das man mit E
    // benutzt – man muss nicht wissen, dass er faehrt, man sieht es.
    const marker = this.at(CARPET_FROM - 1.2, CARPET_OFFSET)
    if (registry) world.scene.add(createMarker(marker.x, marker.z, 5.5, '#2f6bd8'))
    registry?.add({
      id: 'zauberteppich',
      label: 'Zauberteppich',
      hint: 'Aufsteigen',
      color: '#2f6bd8',
      position: { x: marker.x, z: marker.z },
      radius: 5.5,
      labelHeight: terrainHeight(marker.x, marker.z) + 2.6,
      onUse: () => this.carpet.board(this._skier),
    })

    this._buildFence()
    this._buildCap()
    this._buildSlope()
    this._buildLightRun()
    this._buildCannon()
  }

  // Die Leuchtstrecke: gerade, links am Teppich vorbei, aus dem Kinderland
  // heraus ins Tal. Der Tunnel steht darin – er stand vorher allein auf der
  // Kuppe und sah dort aus wie hingestellt; hier hat er eine Aufgabe.
  _buildLightRun() {
    // Anfang und Ende kommen aus dem Hoehenfeld, nicht aus den
    // Bandkoordinaten des Kinderlands: die Strecke hat dort inzwischen ihr
    // eigenes Band, und beides muss dieselbe Linie meinen, sonst laufen
    // Leuchtleisten und Aufschuettung auseinander.
    this.lightRun = new LightRun(this.world, { from: SHOOT_RUN.from, to: SHOOT_RUN.to })

    const mid = this.lightRun.pointAt(this.lightRun.length * 0.5)
    this.add(createSnowTunnel({ length: 6.0, width: 5.0, height: 2.7 }), mid.x, mid.z, {
      rotation: this.lightRun.heading,
      trigger: 3.6,
      kind: 'tunnel',
    })
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
    // Drei Nudelboegen im Bogen ueber die Wiese – ein Rhythmus, kein Einzelstueck.
    this.add(createNoodleArch({ color: KINDER_COLORS[1], span: 5.6 }), 45.6, -6.2, {
      rotation: readableYaw(Math.atan2(0.72, -0.69)),
      trigger: 3.2,
      kind: 'arch',
    })
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

    // Hier stand eine grosse Wimpelkette zwischen zwei Masten. Sie hing frei
    // im Hang und gehoerte zu nichts – die Unterkante der Wiese markiert
    // schon der Wimpelzaun, und zwei Sorten Wimpel nebeneinander sind eine zu
    // viel. Der niedrige Zaun bleibt, die freistehende Kette ist weg.

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

  // Die Schneekanone steht am oberen Drittel des Uebungshangs, hinter der
  // Absperrung, und blaest ueber den Zaun hinweg quer auf die Strecke. Quer
  // ist hier zweimal richtig: man faehrt zwangslaeufig hindurch, und die
  // Fahne laeuft bei fester Kamera fast vollstaendig ueber den Bildschirm,
  // statt als Fleck in die Blickachse zu zeigen. Hinter dem Zaun ist sie,
  // weil ein Geraet mit einem Geblaese nicht dort steht, wo Kinder fahren.
  _buildCannon() {
    const p = this.at(13, 10.5)
    const cannon = createSnowCannon({ heading: p.heading + Math.PI / 2 })
    this.world.place(cannon, p.x, p.z, {})
    this.world.addCollider(p.x, p.z, 1.0)
    this.animated.push(cannon.userData.animate)
    this.cannon = cannon
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
      { s: 4.0, off: 0.8, kind: 'arch' },
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

  // --- Ablauf -------------------------------------------------------------

  update(dt, skier, input) {
    this._skier = skier
    this.carpet.update(dt, skier, input)
    this.lightRun.update(dt, skier)

    const sx = skier.position.x
    const sz = skier.position.z
    const moving = skier.speed > 1.2 && !skier.tow

    // Die Kanone nimmt den Fahrer ins Visier, sobald er in ihr Feld faehrt,
    // und geht sonst aus. Wer in der Fahne steht, wird eingeschneit; der Wert
    // steigt, solange man drin bleibt, und taut danach von selbst wieder ab.
    // Am Seil des Zauberteppichs bleibt sie stumm, und sie springt auch nicht
    // bei jeder Vorbeifahrt an – siehe snow-cannon.js.
    this.cannon.userData.aimAt(sx, sz, !skier.tow)
    const hit = this.cannon.userData.inPlume(sx, sz)
    if (hit > 0) skier.dustWithSnow(Math.min(1, skier.snowed + hit * dt * 2.2))

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
