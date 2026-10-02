import { terrainHeight, terrainNormal, playAreaDistance } from '../heightfield.js'
import { isSnowSurface } from '../surfaces.js'
import { createSchneehuhn } from './modelle.js'
import { abdruck, amHang, glatt, imBild, stauben, winkelDiff } from './werkzeug.js'

// Alpenschneehuehner: drei bis fuenf sitzen oberhalb der Baumgrenze im
// Schnee, picken, trippeln ein paar Schritte. Weiss auf weiss sieht man sie
// erst spaet – und dann fliegen sie auf: einer zuerst, die anderen kurz
// danach, mit schnellem Fluegelschlag und langen Gleitstrecken hangabwaerts.
// Im Schnee bleiben die Abdruecke ihrer Schwingen zurueck.

const zufall = (a, b) => a + Math.random() * (b - a)
const RUHE = 4          // m im Stand
const JE_TEMPO = 0.7    // m je m/s

export class Schneehuehner {
  constructor({ scene, trail, spray, camera, wald }, { x, z }) {
    this.scene = scene
    this.wald = wald
    // Die Gruppe zieht langsam weiter: jeder Vogel hat seinen Platz relativ
    // zur Mitte und trippelt hinterher, wenn sie sich verschiebt.
    this.mitte = { x, z }
    this.heim = { x, z }
    this.umzug = zufall(10, 20)
    this.flatterUhr = zufall(15, 35)
    this.trail = trail
    this.spray = spray
    this.camera = camera
    this.zeit = 0
    this.aufgeflogen = -1
    this.ausserBild = 0
    this.lebt = true
    this._gesehen = false

    const anzahl = 3 + Math.floor(Math.random() * 3)
    const gier0 = Math.random() * Math.PI * 2
    this.voegel = []
    for (let i = 0; i < anzahl; i++) {
      const a = (i / anzahl) * Math.PI * 2 + zufall(-0.4, 0.4)
      const r = i === 0 ? 0 : zufall(0.9, 2.4)
      const m = createSchneehuhn()
      m.root.scale.setScalar(1.15)
      scene.add(m.root)
      this.voegel.push({
        m,
        x: x + Math.cos(a) * r,
        y: 0,
        z: z + Math.sin(a) * r,
        ox: Math.cos(a) * r,
        oz: Math.sin(a) * r,
        flattern: null,
        gier: gier0 + zufall(-1, 1),
        zustand: 'sitzen',
        uhr: Math.random() * 10,
        tun: 0,
        picken: 0,
        schritt: null,
        start: 0,
        vx: 0, vy: 0, vz: 0,
        kopfX: 0,
      })
    }
  }

  get gesehen() { return this._gesehen }

  update(dt, skier) {
    if (!this.lebt) return false
    this.zeit += dt
    let sichtbar = false
    let naechster = Infinity
    if (this.aufgeflogen < 0) this._ziehen(dt)

    for (const v of this.voegel) {
      const dx = v.x - skier.position.x
      const dz = v.z - skier.position.z
      const d = Math.hypot(dx, dz)
      naechster = Math.min(naechster, d)
      const naht = d > 0.01 ? Math.max(0, (skier.forward.x * dx + skier.forward.z * dz) / d) : 0
      const flucht = RUHE + skier.speed * (0.5 + 0.5 * naht) * JE_TEMPO

      if (v.zustand === 'sitzen') {
        // Fliegt einer, fliegen alle – kurz nacheinander, nicht im Gleichschritt.
        if (d < flucht && this.aufgeflogen < 0) this.aufgeflogen = this.zeit
        if (this.aufgeflogen >= 0 && v.start === 0) v.start = this.aufgeflogen + (d < flucht ? 0 : zufall(0.12, 0.45))
        if (v.start > 0 && this.zeit >= v.start) this._auffliegen(v, skier)
        else this._sitzen(v, dt)
      } else {
        this._fliegen(v, dt)
      }

      const y = v.zustand === 'sitzen' ? terrainHeight(v.x, v.z) : v.y
      if (imBild(this.camera, v.x, y + 0.2, v.z, 1.06)) sichtbar = true
    }
    if (sichtbar) this._gesehen = true

    // Weg, sobald keiner mehr im Bild ist: nach dem Auffliegen gleich, sonst
    // erst nach drei Minuten – so lange warten sie auf jemanden.
    this.ausserBild = sichtbar ? 0 : this.ausserBild + dt
    const fertig = this.aufgeflogen >= 0 ? this.ausserBild > 0.5 || this.zeit - this.aufgeflogen > 20 : this.zeit > 180 && this.ausserBild > 1
    if (fertig || naechster > 110) this.entfernen()
    return this.lebt
  }

  entfernen() {
    if (!this.lebt) return
    this.lebt = false
    for (const v of this.voegel) {
      this.scene.remove(v.m.root)
      v.m.root.traverse((o) => o.geometry?.dispose())
    }
  }

  // Die Mitte der Gruppe wandert alle 10–25 s ein, zwei Meter weiter, und
  // ab und zu flattert einer kurz auf. Mehr nicht: sie sollen leben, aber
  // ein Schwarm, der dauernd unterwegs ist, waere ein Gewimmel.
  _ziehen(dt) {
    this.umzug -= dt
    if (this.umzug <= 0) {
      this.umzug = zufall(10, 25)
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2
        const r = zufall(1.5, 3.5)
        const x = this.mitte.x + Math.sin(a) * r
        const z = this.mitte.z + Math.cos(a) * r
        if (playAreaDistance(x, z) > -2 || !isSnowSurface(x, z, 1.5)) continue
        // Hoechstens sechs Meter vom ersten Platz: sonst wanderten sie in
        // zwei Minuten fast neun Meter und am Ende womoeglich ins Bild.
        if (Math.hypot(x - this.heim.x, z - this.heim.z) > 6) continue
        if (terrainHeight(x, z) < 14 || this.wald.naechster(x, z, 5) < 5) continue
        this.mitte = { x, z }
        break
      }
    }
    this.flatterUhr -= dt
    if (this.flatterUhr <= 0) {
      this.flatterUhr = zufall(20, 45)
      const v = this.voegel[Math.floor(Math.random() * this.voegel.length)]
      const a = Math.random() * Math.PI * 2
      const nx = v.x + Math.sin(a) * zufall(1, 1.5)
      const nz = v.z + Math.cos(a) * zufall(1, 1.5)
      if (isSnowSurface(nx, nz, 0.5)) {
        v.flattern = { t: 0, von: { x: v.x, z: v.z }, nach: { x: nx, z: nz } }
        v.gier = a
      }
    }
  }

  _sitzen(v, dt) {
    const m = v.m
    v.uhr += dt
    v.tun -= dt
    if (v.flattern) return this._flattern(v, dt)
    if (v.tun <= 0) {
      // Hinter der Gruppe her, sonst picken, umschauen oder trippeln.
      const px = this.mitte.x + v.ox
      const pz = this.mitte.z + v.oz
      const weg = Math.hypot(px - v.x, pz - v.z)
      const w = Math.random()
      if (weg > 0.7) v.schritt = { rest: Math.min(4, weg / 0.5), gier: Math.atan2(px - v.x, pz - v.z) }
      else if (w < 0.5) v.picken = zufall(0.8, 2)
      else if (w < 0.75) v.schritt = { rest: zufall(0.3, 0.8), gier: v.gier + zufall(-1.2, 1.2) }
      v.tun = zufall(0.8, 2.5)
    }
    let hub = 0
    if (v.schritt) {
      v.gier += winkelDiff(v.gier, v.schritt.gier) * glatt(6, dt)
      const s = 0.5 * dt
      v.x += Math.sin(v.gier) * s
      v.z += Math.cos(v.gier) * s
      v.schritt.rest -= dt
      hub = Math.abs(Math.sin(v.uhr * 16)) * 0.025
      if (v.schritt.rest <= 0) v.schritt = null
    }
    let kopf = -0.1
    if (v.picken > 0) {
      v.picken -= dt
      kopf = Math.max(0, Math.sin(v.uhr * 9)) * 0.9
    }
    v.kopfX += (kopf - v.kopfX) * glatt(18, dt)

    m.root.position.set(v.x, terrainHeight(v.x, v.z) + hub, v.z)
    amHang(m.root, v.x, v.z, v.gier, 0.6)
    m.kopf.rotation.x = v.kopfX
    m.rumpf.rotation.x = v.kopfX * 0.2
    for (const f of m.fluegel) {
      const s = f.anlegen.userData.seite
      f.anlegen.rotation.y = s * 1.45
      f.schlag.rotation.z = -s * 0.2
    }
    m.schwanz.scale.set(1, 1, 1)
  }

  // Ein kurzer Hopser mit ein paar Fluegelschlaegen, gut einen Meter weit.
  _flattern(v, dt) {
    const m = v.m
    const f = v.flattern
    f.t = Math.min(1, f.t + dt / 0.55)
    v.x = f.von.x + (f.nach.x - f.von.x) * f.t
    v.z = f.von.z + (f.nach.z - f.von.z) * f.t
    m.root.position.set(v.x, terrainHeight(v.x, v.z) + 0.45 * Math.sin(Math.PI * f.t), v.z)
    m.root.rotation.set(0, v.gier, 0)
    m.rumpf.rotation.x = -0.2
    m.kopf.rotation.x = -0.2
    m.schwanz.scale.set(1.4, 1, 1.1)
    for (const fl of m.fluegel) {
      const s = fl.anlegen.userData.seite
      fl.anlegen.rotation.y = s * 0.3
      fl.schlag.rotation.z = s * (Math.sin(v.uhr * 50) * 0.9 + 0.2)
    }
    if (f.t >= 1) {
      v.flattern = null
      stauben(this.spray, v.x, terrainHeight(v.x, v.z), v.z, 3, 0.6)
    }
  }

  _auffliegen(v, skier) {
    v.zustand = 'flug'
    v.y = terrainHeight(v.x, v.z)
    // Weg vom Fahrer, aber mit dem Hang: Schneehuehner fliegen ab, nicht auf.
    let rx = v.x - skier.position.x
    let rz = v.z - skier.position.z
    const l = Math.hypot(rx, rz) || 1
    const n = terrainNormal(v.x, v.z)
    const hl = Math.hypot(n.x, n.z) || 1
    rx = rx / l + (n.x / hl) * 0.6
    rz = rz / l + (n.z / hl) * 0.6
    const a = Math.atan2(rx, rz) + zufall(-0.45, 0.45)
    v.gier = a
    const tempo = zufall(6, 7.5)
    v.vx = Math.sin(a) * tempo
    v.vz = Math.cos(a) * tempo
    v.vy = zufall(3.2, 4.2)
    v.schlaegt = true
    v.takt = 0
    v.phase = 0
    v.flugzeit = 0
    abdruck(this.trail, 'fluegel', v.x, v.z, a, 0.38)
    stauben(this.spray, v.x, v.y, v.z, 8, 1.2)
  }

  _fliegen(v, dt) {
    const m = v.m
    v.flugzeit += dt
    // Schnell schlagen, dann lange gleiten – das typische Flugbild. Gut
    // neun Schlaege je Sekunde; langsamer sah es aus wie eine Taube.
    v.takt -= dt
    if (v.takt <= 0 && v.flugzeit > 0.9) {
      v.schlaegt = !v.schlaegt
      v.takt = v.schlaegt ? zufall(0.4, 0.65) : zufall(0.5, 0.9)
    }
    const schlaegt = v.flugzeit <= 0.9 || v.schlaegt
    if (schlaegt) v.phase += dt * 58

    const ziel = terrainHeight(v.x, v.z) + 3.5
    v.vy += ((ziel - v.y) * 1.4 - v.vy) * glatt(2.2, dt)
    const speed = Math.hypot(v.vx, v.vz)
    const soll = Math.min(13, speed + dt * 4)
    v.vx *= soll / speed
    v.vz *= soll / speed
    v.x += v.vx * dt
    v.y += v.vy * dt
    v.z += v.vz * dt
    v.y = Math.max(v.y, terrainHeight(v.x, v.z) + 0.4)

    m.root.position.set(v.x, v.y, v.z)
    m.root.rotation.set(0, v.gier, 0)
    m.rumpf.rotation.x = -Math.max(-0.3, Math.min(0.3, v.vy * 0.1))
    m.kopf.rotation.x = -0.25
    // Im Flug gefaechert: der schwarze Schwanz ist von oben das Erkennungszeichen.
    m.schwanz.scale.set(1.6, 1, 1.15)
    const schlag = schlaegt ? Math.sin(v.phase) * 1.05 + 0.15 : 0.1
    for (const f of m.fluegel) {
      const s = f.anlegen.userData.seite
      f.anlegen.rotation.y = s * 0.12
      f.schlag.rotation.z = s * schlag
    }
  }
}
