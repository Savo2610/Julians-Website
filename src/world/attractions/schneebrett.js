import * as THREE from 'three'
import { NORTH_LANE, terrainHeight, terrainNormal } from '../heightfield.js'
import { Spray } from '../../player/spray.js'
import { bahnTextur, brocken, scholle } from '../props/schneebrett.js'

// Das Schneebrett auf der Nordabfahrt. Wie oft es abgeht, sagt die
// Lawinenwarnstufe des Tages (props/map-board.js, an der Panoramatafel):
// bei Stufe 1 praktisch nie, bei 5 fast bei jeder Fahrt. Gewuerfelt wird
// einmal je Einfahrt.
//
// Es reisst am Suedhang neben der Bahn an, 16 Meter von der Mitte und drei
// bis vier Meter hoeher, zerbricht in Schollen und rauscht quer ueber die
// Piste, bis es am Gratruecken auf der anderen Seite liegen bleibt. Die
// Schollen laufen auf einer gefuehrten Bahn quer zur Piste und nicht nach
// dem Gefaelle: gemessen rutschten sie so, wie das Gelaende faellt, in drei
// von vier Faellen nach Sueden in Kar und Klamm statt ueber die Piste.
//
// Abgehen laesst es sich nur, waehrend man faehrt, und zwar so, dass es bei
// vollem Tempo knapp hinter einem ueber die Bahn geht. Wer bremst oder
// trödelt, ist drin – und wird verschuettet: eine Wolke, „ERWISCHT“, und
// man faehrt eingeschneit und abgebremst weiter (Skier.verschuetten).

const CHANCE = [0, 0.01, 0.06, 0.2, 0.5, 0.85]   // je Warnstufe 1–5
// 16 m neben der Mitte reisst es an, drei bis vier Meter ueber der Piste.
// Bei 22 lag die Kante aus der festen Kamera links ausserhalb des Bildes
// (gemessen x = -1,4 in Bildkoordinaten), man sah nur Staub.
const ABSTAND = 16
const BREITE = 7          // m zu jeder Seite entlang der Bahn
// Vom Anriss bis zur Pistenmitte braucht die Front knapp 2,9 s (0,35 s
// Wumm, dann 6 m/s² bis 9 m/s ueber 16 m). Sie soll bei vollem Tempo gut
// eine halbe Sekunde hinter dem Fahrer ueber die Bahn gehen: so weit voraus
// liegt der Anriss, dass er das Ende der Schollen 2,3 s nach dem Ausloesen
// passiert.
const VORLAUF = 2.3
const VMAX = [8, 10.5]    // m/s
const BESCHL = 6          // m/s²
const BREMS = 5           // m/s² auf der Piste und dahinter
const GEFAHR = 1.6        // m: so nah an einem rutschenden Stueck ist man drin
const LIEGT = 45          // s bleiben die Brocken liegen

const zufall = (a, b) => a + Math.random() * (b - a)

// Punkt, Richtung und Normale (nach Norden, zum Grat) der Bahn bei s.
function bahn(s) {
  const segs = NORTH_LANE.segments
  let g = segs[segs.length - 1]
  for (const seg of segs) if (s <= seg.s0 + seg.len) { g = seg; break }
  const t = Math.max(0, Math.min(1, (s - g.s0) / g.len))
  const tx = g.dx / g.len
  const tz = g.dz / g.len
  return { x: g.x + g.dx * t, z: g.z + g.dz * t, tx, tz, nx: tz, nz: -tx }
}

export class Schneebrett {
  constructor({ scene, northRun, stufe, camera, trail = null, world = null }) {
    this.scene = scene
    this.world = world
    this.trail = trail
    this._stempel = 0
    this.northRun = northRun
    this.camera = camera
    this.stufe = stufe
    this.chance = CHANCE[stufe] ?? 0
    this.staub = new Spray({ max: 1600, color: 0xf2f6fc })
    scene.add(this.staub.points)
    this.stuecke = []
    this.zeit = 0
    this.laeuft = false
    this.liegt = 0
    this._warAktiv = false
    this._wurf = false
    this.onErwischt = null
    // main.js: Abgang meldet sich bei der Pistenraupe, und solange sie noch
    // kommt (halten), bleibt alles liegen, statt nach LIEGT zu verschwinden.
    this.onAbgang = null
    this.halten = () => false
    this._bahnen = []
    this._erwischt = false
    this.abgegangen = 0
  }

  update(dt, skier) {
    const aktiv = this.northRun.aktiv
    // Einmal je Einfahrt wuerfeln.
    if (aktiv && !this._warAktiv) this._wurf = Math.random() < this.chance
    this._warAktiv = aktiv

    if (this._wurf && aktiv && !this.laeuft && !this.stuecke.length) {
      const { s } = this.northRun.project(skier.position.x, skier.position.z)
      if (s > 8 && s < 30 && skier.speed > 5) {
        this._wurf = false
        this.ausloesen(skier)
      }
    }

    this.staub.update(dt)
    if (!this.stuecke.length) return
    this.zeit += dt
    // Hoechstens sechs Stempel je Bild: jeder ist ein eigener Renderdurchgang.
    this._stempel = 6
    let bewegt = false
    for (const st of this.stuecke) if (this._rutschen(st, dt, skier)) bewegt = true
    if (this.zeit > 0.35 && !bewegt) {
      this.laeuft = false
      this.liegt += dt
      // Erst weg, wenn die Zeit um ist, niemand hinschaut und keine
      // Pistenraupe mehr kommt, die es wegraeumen soll.
      if (this.liegt > LIEGT && !this.halten() && !this._imBild()) this._aufraeumen()
    }
  }

  // Loest das Schneebrett aus – bei vollem Tempo des Fahrers knapp hinter
  // ihm. Aus der Konsole auch ohne Fahrer: __ski.schneebrett.ausloesen().
  ausloesen(skier = window.__ski?.skier, beiS = null) {
    this._aufraeumen()
    let s = beiS
    if (s === null) {
      const p = this.northRun.project(skier.position.x, skier.position.z)
      s = p.s + Math.max(skier.speed, 6) * VORLAUF - BREITE
    }
    s = Math.max(14, Math.min(44, s))
    this.zeit = 0
    this.liegt = 0
    this.laeuft = true
    this._erwischt = false
    this.abgegangen++
    this.onAbgang?.()

    // Die Anrisslinie, quer zum Hang ein Stueck oberhalb der obersten
    // Scholle. Zu sehen ist sie nur im Staub beim Abgang: als Band im Schnee
    // las sie sich wie ein blauer Strich am Hang (05.10., weggelassen).
    const b0 = bahn(s)
    const kante = []
    for (let u = -BREITE - 0.5; u <= BREITE + 0.5; u += 0.5) {
      const x = b0.x + b0.tx * u - b0.nx * (ABSTAND + 0.8)
      const z = b0.z + b0.tz * u - b0.nz * (ABSTAND + 0.8)
      if (!this._hindernis(x, z, 0.4)) kante.push([x, terrainHeight(x, z), z])
    }

    // Zwei Reihen Schollen, die sieben Meter zu jeder Seite reichen.
    for (let reihe = 0; reihe < 2; reihe++) {
      for (let u = -BREITE + 0.9; u <= BREITE - 0.9; u += 2.1) {
        const uu = u + zufall(-0.4, 0.4) + reihe * 1.05
        // Wo schon ein Fels oder Pfosten steht, liegt keine Scholle.
        const bs = bahn(s + uu)
        const d0 = -ABSTAND + reihe * 1.9
        if (this._hindernis(bs.x + bs.nx * d0, bs.z + bs.nz * d0, 1)) continue
        const breit = zufall(1.4, 2.1)
        const lang = zufall(1.2, 1.8)
        const mesh = scholle(breit, lang, zufall(0.22, 0.3), Math.random)
        this.scene.add(mesh)
        this.stuecke.push({
          mesh, s: s + uu, d: -ABSTAND + reihe * 1.9, v: 0,
          vmax: zufall(...VMAX) - reihe * 0.6,
          // Die untere Reihe geht zuerst, die obere schiebt nach.
          start: 0.35 + reihe * 0.18 + zufall(0, 0.15),
          ende: zufall(2, 7.5),
          // Nach vier bis sieben Metern zerbricht sie: Lawinenschnee sind
          // Klumpen, keine Platten – ganz rutschend sahen sie aus wie Fels.
          bricht: -ABSTAND + zufall(4, 7),
          dick: 0.2,
          dreh: zufall(-0.4, 0.4),
          kipp: 0, roll: 0, r: 0,
          scholle: true,
        })
      }
    }
    // Wumm: entlang der Kante staubt es auf, bevor sich etwas bewegt.
    for (const [x, y, z] of kante.filter((_, i) => i % 2 === 0)) this._stauben(x, y, z, 0, 0, 4, 2.2)
  }

  _rutschen(st, dt, skier) {
    // Zerbrochen: die Brocken laufen als eigene Eintraege weiter.
    if (!st.mesh) return false
    if (this.zeit < st.start) {
      this._setzen(st, 0)
      return true
    }
    const vorher = st.v
    if (st.d < st.ende) {
      st.v = Math.min(st.vmax, st.v + BESCHL * dt)
      // Ab der Bahnmitte gebremst, so dass es bei `ende` steht.
      if (st.d > -2) st.v = Math.min(st.v, Math.sqrt(2 * BREMS * Math.max(0, st.ende - st.d)) + 0.15)
      const neu = Math.min(st.ende, st.d + st.v * dt)
      // Vor einem Hindernis bleibt es haengen, die naechsten stauen sich
      // dahinter. Ohne das rutschten die Schollen hinter Meter 28 durch
      // Zaun, Felsen und Gefahrkreuze an der Klamm hindurch.
      const b = bahn(st.s)
      if (this._hindernis(b.x + b.nx * neu, b.z + b.nz * neu, st.r + 0.5)) {
        st.ende = st.d
        st.v = 0
      } else st.d = neu
    } else st.v = 0
    const bewegt = st.v > 0.05 || vorher > 0.05

    // Zerbrechen: eine Scholle wird zu drei Brocken, die rollen.
    if (st.scholle && st.d > st.bricht) {
      this._zerbrechen(st)
      return true
    }

    this._setzen(st, dt)
    if (bewegt) {
      const p = st.mesh.position
      const b = bahn(st.s)
      // Die Wolke: gross und weich. Mit 0,9 bis 1,6, auch noch mit 3, waren
      // es einzelne Kuegelchen statt Staub.
      if (Math.random() < 0.7) this._stauben(p.x, p.y, p.z, b.nx * st.v * 0.6, b.nz * st.v * 0.6, 1, 2.6 + st.v * 0.3)
      // Die Bahn hinter sich: aufgewuehlter Schnee, alle gut 1,2 Meter.
      st.weg = (st.weg || 0) + st.v * dt
      if (this.trail && st.weg > 1.2 && this._stempel > 0) {
        st.weg = 0
        this._stempel--
        // Schwach: mit 0,55 lag nach drei Lawinen ein Leopardenmuster am Hang.
        const dreh = Math.random() * 6.3
        this.trail.stampDecal(bahnTextur(), p.x, p.z, 2, 2, dreh, 0.3, 0.6)
        this._bahnen.push({ x: p.x, z: p.z, dreh })
      }
      if (!this._erwischt && st.v > 2.5 && Math.hypot(p.x - skier.position.x, p.z - skier.position.z) < GEFAHR + st.r) {
        this._erwischt = true
        for (let i = 0; i < 40; i++) this._stauben(skier.position.x, skier.position.y + 0.5, skier.position.z, b.nx * 2, b.nz * 2, 1, 1.4)
        this.onErwischt?.()
      }
    }
    return bewegt
  }

  _zerbrechen(st) {
    st.scholle = false
    this.scene.remove(st.mesh)
    st.mesh.geometry.dispose()
    const teile = 3 + Math.floor(Math.random() * 2)
    for (let i = 0; i < teile; i++) {
      const r = zufall(0.24, 0.45)
      const mesh = brocken(r)
      this.scene.add(mesh)
      this.stuecke.push({
        mesh, s: st.s + zufall(-0.8, 0.8), d: st.d + zufall(-0.4, 0.4), v: st.v * zufall(0.85, 1.1),
        vmax: st.vmax * zufall(0.9, 1.08), start: 0, ende: st.ende + zufall(-1.5, 1.5),
        bricht: Infinity, dick: r * 0.75, dreh: zufall(-Math.PI, Math.PI), kipp: 0, roll: zufall(0, 6), r,
        scholle: false,
      })
    }
    // Die alte Scholle bleibt als leerer Eintrag stehen, bis aufgeraeumt
    // wird; sie bewegt sich nicht mehr.
    st.v = 0
    st.ende = st.d
    st.mesh = null
  }

  _setzen(st, dt) {
    if (!st.mesh) return
    const b = bahn(st.s)
    const x = b.x + b.nx * st.d
    const z = b.z + b.nz * st.d
    const y = terrainHeight(x, z)
    st.mesh.position.set(x, y + st.dick, z)
    const gier = Math.atan2(b.nx, b.nz) + st.dreh
    if (st.scholle) {
      // Platt am Hang, mit etwas Ruetteln, solange sie rutscht.
      terrainNormal(x, z, n)
      q.setFromUnitVectors(oben, n)
      qg.setFromAxisAngle(oben, gier)
      st.kipp += (Math.sin(this.zeit * 9 + st.s) * 0.08 * Math.min(1, st.v / 4) - st.kipp) * Math.min(1, dt * 8)
      qk.setFromAxisAngle(quer.set(1, 0, 0), st.kipp)
      st.mesh.quaternion.copy(q).multiply(qg).multiply(qk)
    } else {
      // Brocken rollen: Drehung um die Achse quer zur Bewegung.
      st.roll += (st.v / Math.max(0.2, st.r)) * dt
      qg.setFromAxisAngle(oben, Math.atan2(b.nx, b.nz))
      qk.setFromAxisAngle(quer.set(1, 0, 0), st.roll)
      q.setFromAxisAngle(oben, st.dreh)
      st.mesh.quaternion.copy(qg).multiply(qk).multiply(q)
    }
  }

  _stauben(x, y, z, vx, vz, menge, groesse) {
    for (let i = 0; i < menge; i++) {
      const a = Math.random() * Math.PI * 2
      this.staub.emit(
        x + Math.cos(a) * 0.6, y + 0.2, z + Math.sin(a) * 0.6,
        vx + Math.cos(a) * 1.4, zufall(1.8, 4.2), vz + Math.sin(a) * 1.4,
        groesse * zufall(0.8, 1.3), zufall(0.8, 1),
      )
    }
  }

  // Die Pistenraupe raeumt: Brocken und Schollen im Umkreis verschwinden in
  // einer Staubwolke, die Bahn darunter wird mitsamt ihrer Faerbung glatt
  // (glaetten nimmt sonst nur das Relief; stampDecal faerbt Blau).
  raeumen(x, z, radius) {
    if (this.laeuft) return
    for (const st of this.stuecke) {
      if (!st.mesh) continue
      const p = st.mesh.position
      if (Math.hypot(p.x - x, p.z - z) > radius) continue
      this._stauben(p.x, p.y, p.z, 0, 0, 3, 1.6)
      this.scene.remove(st.mesh)
      st.mesh.geometry.dispose()
      st.mesh = null
    }
    for (let i = this._bahnen.length - 1; i >= 0; i--) {
      const b = this._bahnen[i]
      if (Math.hypot(b.x - x, b.z - z) > radius) continue
      // stampDecal zieht 2 × 2 auf 1 × 1 auf; 1,6 wegen des weichen Rands.
      this.trail?.glaetten(b.x, b.z, 1.6, 1.6, b.dreh, true)
      this._bahnen.splice(i, 1)
    }
  }

  // Steht hier etwas mit Kollision – Fels, Zaunpfosten, Baum, Kreuz?
  // Die volle Liste, nicht world.nearby(): das liefert nur die eigene
  // Rasterzelle, und ein Fels knapp hinter der Zellgrenze fehlte dann.
  _hindernis(x, z, rand) {
    if (!this.world) return false
    for (const c of this.world.colliders) if (Math.hypot(c.x - x, c.z - z) < c.r + rand) return true
    return false
  }

  _imBild() {
    for (const st of this.stuecke) {
      if (!st.mesh) continue
      v.copy(st.mesh.position).project(this.camera)
      if (v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1) return true
    }
    return false
  }

  _aufraeumen() {
    for (const st of this.stuecke) {
      if (!st.mesh) continue
      this.scene.remove(st.mesh)
      st.mesh.geometry.dispose()
    }
    this.stuecke = []
    this._bahnen = []
    this.laeuft = false
  }
}

const n = new THREE.Vector3()
const v = new THREE.Vector3()
const oben = new THREE.Vector3(0, 1, 0)
const quer = new THREE.Vector3()
const q = new THREE.Quaternion()
const qg = new THREE.Quaternion()
const qk = new THREE.Quaternion()
