import * as THREE from 'three'
import { terrainHeight } from '../heightfield.js'
import { SKIER } from '../../config.js'
import { HIP } from '../../player/skier-model.js'
import { createSkischulFigur, KINDER_JACKEN, SKISCHULE_BLAU } from '../props/skischule.js'

// Die Skischulgruppe: ein Skilehrer und vier Kinder, die vom Treffpunkt aus
// ihre Runde durchs Kinderland fahren – zum Teppich, hinauf, im Pflug durch
// den Tierslalom, unten anhalten, im Bogen zum Treffpunkt, warten.
// Sie macht das Kinderland lebendig (Ansage 09.10.: es soll einladender
// aussehen) und traegt den Skilehrer-Ausweis: wer neben dem Skilehrer
// steht, kann ihn ansprechen (Station `skilehrer` in kinderland.js).
//
// Die Runde ist ein einziger Weg mit Abschnitten (gehen, teppich, fahren).
// Jede Figur hat ihre Stelle s darauf; die Kinder fahren hinter dem Lehrer
// her und kommen ihm nie naeher als ABSTAND – an Halten rueckt die Schlange
// zusammen wie eine echte Gruppe. Gehalten wird am Treffpunkt, oben vor dem
// Slalom, unten am Zielbogen, und wann immer der Fahrer vor dem Lehrer
// steht: Ruecksicht
// statt Kegelspiel. Wer in eine Figur faehrt, wird hinausgeschoben wie an
// der Pistenraupe.

const ABSTAND = 1.9          // m zwischen zwei Figuren in der Schlange
const SCHRITT = 0.25         // m, so dicht wird der Weg abgetastet
const WARTEN = [12, 22]      // s am Treffpunkt
const KOERPER = { lehrer: 0.55, kind: 0.4 }
const PLATZ = 3.2            // m vor dem Lehrer: steht dort der Fahrer, wartet die Gruppe

export class Skischulgruppe {
  // abschnitte: [{ art, tempo, punkte: [[x, z], …], halt? }]. Der letzte
  // Punkt eines Abschnitts ist der erste des naechsten; der Weg schliesst
  // sich, der letzte Abschnitt endet am Anfang des ersten.
  constructor(world, { abschnitte, teppich = null, belag = 0.14 }) {
    this.world = world
    this.teppich = teppich
    this.belag = belag
    this.weg = this._abtasten(abschnitte)
    this.laenge = this.weg.length * SCHRITT

    this.figuren = []
    const lehrer = createSkischulFigur({ jacke: SKISCHULE_BLAU, helm: 0xd6332a })
    this.figuren.push(this._figur(lehrer, false, 0))
    KINDER_JACKEN.forEach((f, i) => {
      this.figuren.push(this._figur(createSkischulFigur({ kind: true, ...f }), true, -(i + 1) * ABSTAND))
    })
    for (const f of this.figuren) world.scene.add(f.model)
    this.lehrer = this.figuren[0]

    // Die Gruppe beginnt am Treffpunkt und wartet dort schon eine Weile.
    this.pause = 6
    this.halten = false        // von aussen: der Fahrer spricht mit dem Lehrer
    this._amHalt = null
    this.zeit = 0
    for (const f of this.figuren) this._setzen(f, 0)
  }

  _figur(model, kind, s) {
    return { model, kind, s, heading: 0, lean: 0, crouch: 0, pflug: 0, winken: 0, schritt: Math.random() * 6 }
  }

  // Der Weg wird einmal fein abgetastet: Position, Abschnittsart und Tempo
  // je Stelle. Die Fahrt durch den Slalom ist eine Catmull-Rom-Kurve durch
  // die Punkte – ein Polygonzug liess die Kinder an jeder Stange knicken.
  // Ebenso Gehstrecken mit `rund` (der Bogen am Treffpunkt).
  _abtasten(abschnitte) {
    const weg = []
    for (const a of abschnitte) {
      const pts = a.punkte.map(([x, z]) => new THREE.Vector3(x, 0, z))
      const kurve = (a.art === 'fahren' || a.rund) && pts.length > 2
        ? new THREE.CatmullRomCurve3(pts, false, 'centripetal')
        : new THREE.CurvePath()
      if (!(kurve instanceof THREE.CatmullRomCurve3)) {
        for (let i = 0; i < pts.length - 1; i++) kurve.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
      }
      const len = kurve.getLength()
      const n = Math.max(1, Math.round(len / SCHRITT))
      for (let i = 0; i < n; i++) {
        const p = kurve.getPointAt(i / n)
        weg.push({ x: p.x, z: p.z, art: a.art, tempo: a.tempo, halt: i === 0 ? a.halt ?? null : null })
      }
    }
    // Richtung und Kruemmung je Stelle, fuer Blick und Schraeglage.
    for (let i = 0; i < weg.length; i++) {
      const a = weg[(i - 2 + weg.length) % weg.length]
      const b = weg[(i + 2) % weg.length]
      weg[i].heading = Math.atan2(b.x - a.x, b.z - a.z)
    }
    for (let i = 0; i < weg.length; i++) {
      let d = weg[(i + 2) % weg.length].heading - weg[(i - 2 + weg.length) % weg.length].heading
      d = Math.atan2(Math.sin(d), Math.cos(d))
      weg[i].kruemmung = d / (4 * SCHRITT)
    }
    return weg
  }

  _stelle(s) {
    const n = this.weg.length
    const i = ((Math.floor(s / SCHRITT) % n) + n) % n
    return this.weg[i]
  }

  // Wie weit voraus der naechste Halt liegt (hoechstens bis), sonst null.
  _haltVoraus(s, bis, art = null) {
    for (let d = SCHRITT; d <= bis; d += SCHRITT) {
      const h = this._stelle(s + d).halt
      if (h && (!art || h === art)) return d
    }
    return null
  }

  update(dt, skier) {
    this.zeit += dt
    const fahrer = skier?.position
    const lehrer = this.lehrer
    const hier = this._stelle(lehrer.s)

    // --- Der Lehrer bestimmt, ob es weitergeht ------------------------
    let steht = this.halten
    if (!hier.halt) this._amHalt = null
    else if (this._amHalt !== Math.floor(lehrer.s / SCHRITT)) {
      // An einem Halt: erst, wenn alle aufgeschlossen haben, laeuft die
      // Pause. Am Treffpunkt eine lange, vor der Bremslinie eine kurze.
      this._amHalt = Math.floor(lehrer.s / SCHRITT)
      // Oben vor dem Slalom nur sammeln: vom Teppich kommen die Kinder
      // einzeln, und ohne Halt fuhr das letzte 20 m hinter dem Lehrer los.
      this.pause = hier.halt === 'treffpunkt'
        ? WARTEN[0] + Math.random() * (WARTEN[1] - WARTEN[0])
        : hier.halt === 'oben' ? 0.8 : 2.2
      this._haltArt = hier.halt
    }
    if (this.pause > 0) {
      const zu = this.figuren.every((f, i) => lehrer.s - f.s <= i * ABSTAND + 0.6)
      if (zu) this.pause -= dt
      steht = true
    }
    // Der Fahrer steht vorn im Weg: warten, auf dem Teppich nicht.
    if (fahrer && hier.art !== 'teppich' && !skier.tow) {
      const dx = fahrer.x - lehrer.model.position.x
      const dz = fahrer.z - lehrer.model.position.z
      const vor = dx * Math.sin(lehrer.heading) + dz * Math.cos(lehrer.heading)
      const quer = Math.abs(-dx * Math.cos(lehrer.heading) + dz * Math.sin(lehrer.heading))
      if (vor > 0 && vor < PLATZ && quer < 1.6) steht = true
    }
    // Vor dem Teppich warten, solange der Fahrer unten draufsteht.
    const naechste = this._stelle(lehrer.s + 1)
    const tr = this.teppich?.rider
    if (hier.art !== 'teppich' && naechste.art === 'teppich' && tr && tr.progress < 0.3) steht = true

    // --- Alle ziehen nach ---------------------------------------------
    this.figuren.forEach((f, i) => {
      const st = this._stelle(f.s)
      let v = st.tempo
      if (st.art !== 'teppich') {
        // Vor einem Halt abbremsen statt auf der Stelle stehen – nur der
        // Lehrer: die Kinder halten, weil er haelt. Bremsten sie an jedem
        // Halt selbst noch einmal, fiel jedes ein Stueck weiter zurueck, das
        // letzte im Slalom 21 m.
        const bis = i === 0 ? this._haltVoraus(f.s, 5) : null
        if (bis !== null) v = Math.min(v, Math.max(0.35, Math.sqrt(2 * 2.2 * bis)))
        // Anfahren mit 2 m/s², nicht aus dem Stand auf Reisetempo.
        v = Math.min(v, (f.v ?? 0) + 2 * dt)
      }
      if (i === 0) {
        if (steht && st.art !== 'teppich') v = 0
      } else {
        const vorne = this.figuren[i - 1].s - ABSTAND
        if (st.art !== 'teppich') {
          // Am Teppich steigt man einzeln auf: wer noch nicht drauf ist,
          // wartet, bis der Fahrer unten weg ist.
          const n2 = this._stelle(f.s + 1)
          if (n2.art === 'teppich' && tr && tr.progress < 0.3) v = 0
          // Und mit Abstand: das Band traegt mit 5,4 m/s, oben geht man mit
          // 1,2 weiter. Wer 1,9 m hinter dem Vordermann aufstieg, stand oben
          // in ihm. So viel Vorsprung, dass es oben wieder 1,9 m sind.
          if (n2.art === 'teppich' && this.figuren[i - 1].s - f.s < ABSTAND * n2.tempo / 1.2) v = 0
          // Hinterher darf ein Kind so schnell wie das vor ihm: sonst ging
          // es oben noch Schritt fuer Schritt, waehrend der Lehrer schon im
          // Slalom war, und die Schlange zog sich auf 20 m.
          // Nicht hinter dem Teppich her: dort ginge man mit 5,4 m/s zu Fuss.
          const vorne2 = this.figuren[i - 1]
          const vor = this._stelle(vorne2.s).art === 'fahren' ? vorne2.v ?? 0 : 0
          v = Math.min(Math.max(v, Math.min(vor, (f.v ?? 0) + 2 * dt)), Math.max(0, (vorne - f.s) * 3))
        }
      }
      f.v = v
      f.s += v * dt
      this._setzen(f, dt, fahrer && !skier.tow ? skier : null, i)
    })
  }

  // Lage und Haltung einer Figur aus ihrer Stelle.
  _setzen(f, dt, skier = null, i = 0) {
    const st = this._stelle(f.s)
    const naechste = this._stelle(f.s + SCHRITT)
    const t = (f.s / SCHRITT) % 1
    const x = st.x + (naechste.x - st.x) * t
    const z = st.z + (naechste.z - st.z) * t
    const k = dt ? 1 - Math.exp(-8 * dt) : 1
    const steht = (f.v ?? 0) < 0.05

    // Blick: den Weg entlang; am Treffpunkt dreht sich der Lehrer zu den
    // Kindern um, waehrend er wartet.
    let ziel = st.heading
    if (i === 0 && steht && this._haltArt === 'treffpunkt' && this.pause > 0) ziel = st.heading + Math.PI
    let d = ziel - f.heading
    d = Math.atan2(Math.sin(d), Math.cos(d))
    f.heading += d * (dt ? 1 - Math.exp(-4 * dt) : 1)

    const fahren = st.art === 'fahren' && !steht
    const v = f.v ?? 0
    f.lean += ((fahren ? THREE.MathUtils.clamp(-st.kruemmung * v * v * 0.08, -0.4, 0.4) : 0) - f.lean) * k
    f.crouch += ((fahren ? 0.32 : st.art === 'teppich' ? 0.05 : 0.15) - f.crouch) * k
    // Alle fahren im Pflug hinunter, auch der Lehrer: er zeigt es vor
    // (Ansage 10.10.; vorher fuhr er parallel und nur die Kinder pflugten).
    const bremsen = this._haltVoraus(f.s, 3, 'bremsen') !== null
    f.pflug += ((fahren || bremsen ? 1 : 0) - f.pflug) * k

    const boden = terrainHeight(x, z) + (st.art === 'teppich' && !steht ? this.belag : 0)
    f.model.position.set(x, boden, z)
    f.model.rotation.set(0, f.heading, f.lean, 'YXZ')

    const { torso, legSides, skiLeft, skiRight, arms } = f.model.userData.parts
    torso.position.y = 0.98 - f.crouch * 0.22
    torso.rotation.x = 0.12 + f.crouch * 0.42
    const spreadOut = f.pflug * 0.09
    const yaw = f.pflug * SKIER.ploughYaw
    for (const [side, ski, hip] of [[-1, skiLeft, legSides.left], [1, skiRight, legSides.right]]) {
      ski.position.x = side * (0.19 + spreadOut)
      ski.rotation.y = -side * yaw
      ski.rotation.z = side * f.pflug * 0.2
      hip.rotation.z = side * Math.asin(spreadOut / HIP.y)
    }
    // Im Gehen schieben die Ski abwechselnd vor.
    if (st.art === 'gehen' && !steht && dt) {
      f.schritt += dt * 5
      const vor = Math.sin(f.schritt) * 0.16
      skiLeft.position.z = vor
      skiRight.position.z = -vor
      legSides.left.position.z = vor
      legSides.right.position.z = -vor
    } else {
      for (const o of [skiLeft, skiRight, legSides.left, legSides.right]) o.position.z *= 0.8
    }

    // Der Lehrer winkt, wenn man ihn anspricht.
    if (i === 0 && dt) {
      f.winken += ((this.halten ? 1 : 0) - f.winken) * (1 - Math.exp(-6 * dt))
      const arm = arms.right
      arm.rotation.x = -f.winken * (2.3 + Math.sin(this.zeit * 9) * 0.25)
      arm.rotation.z = -f.winken * 0.3
    }

    // Wer hineinfaehrt, wird hinausgeschoben.
    if (skier) {
      const r = f.kind ? KOERPER.kind : KOERPER.lehrer
      const ax = skier.position.x - x
      const az = skier.position.z - z
      const ad = Math.hypot(ax, az)
      if (ad < r + 0.35 && ad > 0.01 && skier.height < 1) {
        skier.position.x = x + (ax / ad) * (r + 0.35)
        skier.position.z = z + (az / ad) * (r + 0.35)
      }
    }
  }
}
