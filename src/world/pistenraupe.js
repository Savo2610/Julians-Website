import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { terrainHeight, terrainNormal } from './heightfield.js'

// Die Pistenraupe. Sie faehrt nur nachts, nach der echten Uhr des Besuchers:
// zwischen 22 und 6 Uhr, und auch dann nur in jeder zweiten Sitzung, einmal,
// irgendwann zwischen ein und fuenf Minuten nach dem Ankommen. Fast niemand
// soll sie je zu Gesicht bekommen. Das Tal selbst bleibt dabei hell – eine
// echte Nacht waere ein Umbau an Licht und Himmel; man erkennt die
// Nachtschicht an den Scheinwerfern und der Rundumleuchte.
//
// Sie walzt die freie Abfahrt, vier Minuten lang hinauf und hinunter, und
// legt dabei feinen Cord in den Schnee. Steht jemand vor ihr, haelt sie an
// und wartet. Kommen und gehen tut sie wie die Tiere nur ausser Bild.

// Die freie Abfahrt aus populate.js, an beiden Enden ein Stueck verlaengert:
// oben bis auf die Gipfelschulter, unten bis vor die Talstation. Bei Meter
// 23 lief sie mitten durch die Schneekanone (−35,1, −36,3); jetzt westlich
// daran vorbei, drei Meter Luft.
const ROUTE = [
  [-46, -57], [-44, -52], [-41, -46], [-38, -40], [-38.9, -36.5],
  [-36, -31.5], [-31.5, -28.3], [-28.5, -22], [-27, -14], [-26, -9],
]
const TEMPO = 3          // m/s – eine echte faehrt beim Walzen 10 bis 15 km/h
const WENDEN = 0.8       // rad/s auf der Stelle, Ketten gegenlaeufig
const DAUER = 240        // s Schicht, dann faehrt sie am naechsten Ende davon
const WARTEN = 7         // m: steht jemand naeher vor ihr, haelt sie an
const KOERPER = 2.3      // m: so nah kommt keiner an ihre Mitte

const zufall = (a, b) => a + Math.random() * (b - a)

export function nachtschicht(date = new Date()) {
  const h = date.getHours()
  return h >= 22 || h < 6
}

// --- Gestalt -----------------------------------------------------------------
const ROT = 0xc42027
const ROT_DUNKEL = 0x991a20
const KETTE = 0x2a2c31
const STEG = 0x4a4d54
const GLAS = 0x1d2a36
const WEISS = 0xeef1f4
const GRAU = 0xc9cdd2
const GELB = 0xffe7a8

function bauen() {
  const teile = []
  const p = (geo, color, position, rotation) => teile.push({ geo, color, position, rotation })
  // Ketten mit Stegen obenauf: von oben das, woran man eine Raupe erkennt.
  for (const s of [-1, 1]) {
    p(new THREE.BoxGeometry(0.75, 0.62, 3.5), KETTE, [s * 1.1, 0.31, 0])
    for (let i = 0; i < 12; i++) p(new THREE.BoxGeometry(0.78, 0.05, 0.12), STEG, [s * 1.1, 0.645, -1.65 + i * 0.3])
  }
  // Wanne und Aufbau.
  p(new THREE.BoxGeometry(1.5, 0.7, 2.9), ROT_DUNKEL, [0, 0.85, -0.1])
  p(new THREE.BoxGeometry(1.6, 0.25, 3.0), ROT, [0, 1.3, -0.1])
  // Fuehrerhaus vorn, rundum verglast.
  p(new THREE.BoxGeometry(1.5, 0.95, 1.35), ROT, [0, 1.9, 0.55])
  p(new THREE.BoxGeometry(1.36, 0.6, 0.05), GLAS, [0, 2.0, 1.23])
  for (const s of [-1, 1]) p(new THREE.BoxGeometry(0.05, 0.55, 1.15), GLAS, [s * 0.76, 2.0, 0.55])
  p(new THREE.BoxGeometry(1.56, 0.1, 1.42), WEISS, [0, 2.42, 0.55])
  // Motorhaube hinten mit Gitter.
  p(new THREE.BoxGeometry(1.4, 0.45, 1.2), ROT, [0, 1.65, -1.0])
  for (let i = 0; i < 4; i++) p(new THREE.BoxGeometry(1.1, 0.03, 0.08), STEG, [0, 1.88, -0.6 - i * 0.2])
  // Das Schild vorn: breiter als die Ketten, leicht schraeg.
  p(new THREE.BoxGeometry(3.4, 0.75, 0.14), GRAU, [0, 0.5, 2.25], [0.15, 0, 0])
  for (const s of [-1, 1]) p(new THREE.BoxGeometry(0.12, 0.12, 0.9), STEG, [s * 0.5, 0.65, 1.8])
  // Die Fraese hinten mit dem Finisher, der den Cord zieht.
  p(new THREE.BoxGeometry(3.1, 0.4, 0.6), GRAU, [0, 0.38, -2.1])
  p(new THREE.BoxGeometry(3.1, 0.05, 0.5), KETTE, [0, 0.12, -2.55], [-0.25, 0, 0])
  for (const s of [-1, 1]) p(new THREE.BoxGeometry(0.12, 0.12, 0.7), STEG, [s * 0.5, 0.65, -1.75])

  const group = new THREE.Group()
  group.name = 'pistenraupe'
  const mesh = new THREE.Mesh(assemble(teile), vertexColorMaterial({ roughness: 0.6 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  // Scheinwerfer: vier auf dem Dach, zwei am Kuehler. Unbeleuchtet wie die
  // Fenster der Huette – ein echtes Licht kostete jedes Pixel.
  const lampen = []
  for (const x of [-0.55, -0.2, 0.2, 0.55]) lampen.push({ geo: new THREE.BoxGeometry(0.16, 0.12, 0.06), color: GELB, position: [x, 2.52, 1.24] })
  for (const x of [-0.6, 0.6]) lampen.push({ geo: new THREE.BoxGeometry(0.2, 0.12, 0.06), color: GELB, position: [x, 1.3, 1.42] })
  group.add(new THREE.Mesh(assemble(lampen), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })))

  // Lichtkegel nach vorn auf den Schnee, additiv und nach vorn auslaufend.
  // Mit fester Deckkraft war er ein harter weisser Faecher; jetzt nimmt er
  // mit der Entfernung ab und wird an den Raendern duenn.
  const kegel = new THREE.Mesh(
    new THREE.ConeGeometry(2.6, 9, 20, 1, true),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uFarbe: { value: new THREE.Color(0xfff1c9) } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vBlick;
        void main() {
          vUv = uv;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vBlick = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 uFarbe;
        varying vec2 vUv;
        varying vec3 vN;
        varying vec3 vBlick;
        void main() {
          // uv.y: 1 an der Lampe, 0 am fernen Ende.
          float laengs = pow(vUv.y, 1.6);
          float rand = pow(abs(dot(vN, vBlick)), 1.5);
          gl_FragColor = vec4(uFarbe * laengs * rand * 0.22, 1.0);
        }`,
    }),
  )
  kegel.geometry.translate(0, -4.5, 0)
  kegel.rotation.x = -Math.PI / 2 - 0.2
  kegel.position.set(0, 2.3, 1.3)
  group.add(kegel)

  // Die Rundumleuchte: orange, sie dreht sich, und von oben blinkt sie.
  const leuchte = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, 0.22), new THREE.MeshBasicMaterial({ color: 0xff8a1f, toneMapped: false }))
  leuchte.position.set(0, 2.56, 0.1)
  group.add(leuchte)
  const blitz = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
  )
  blitz.position.copy(leuchte.position)
  group.add(blitz)

  return { group, leuchte, blitz, kegel }
}

// Cord in der Spurkarte: feine Rillen laengs, wie hinter dem Finisher.
let _cord = null
function cordTextur() {
  if (_cord) return _cord
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 128, 64)
  for (let i = 0; i < 16; i++) {
    const x = 4 + i * 7.6
    ctx.fillStyle = '#00ff00'
    ctx.fillRect(x - 1.5, 0, 5, 64)
    ctx.fillStyle = '#ffff00'
    ctx.fillRect(x, 0, 2, 64)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return (_cord = tex)
}

// --- Fahren ------------------------------------------------------------------
const n = new THREE.Vector3()
const v = new THREE.Vector3()
const oben = new THREE.Vector3(0, 1, 0)
const qHang = new THREE.Quaternion()
const qGier = new THREE.Quaternion()

export class Pistenraupe {
  constructor({ scene, camera, trail, erzwungen = new URLSearchParams(location.search).has('raupe') }) {
    this.scene = scene
    this.camera = camera
    this.trail = trail
    const m = bauen()
    this.m = m
    m.group.visible = false
    scene.add(m.group)

    // Die Strecke als Abschnitte mit Laenge.
    this.punkte = ROUTE.map(([x, z]) => ({ x, z }))
    this.laenge = 0
    this.abschnitte = []
    for (let i = 0; i < this.punkte.length - 1; i++) {
      const a = this.punkte[i]
      const b = this.punkte[i + 1]
      const l = Math.hypot(b.x - a.x, b.z - a.z)
      this.abschnitte.push({ a, b, s0: this.laenge, l })
      this.laenge += l
    }

    // Kommt sie heute? Nachts in jeder zweiten Sitzung, sonst nie.
    this.heute = erzwungen || (nachtschicht() && Math.random() < 0.5)
    this.uhr = erzwungen ? 2 : zufall(60, 300)
    this.aktiv = false
    this.fertig = false
    this.s = 0
    this.richtung = 1
    this.gier = 0
    this.wenden = null
    this.schicht = 0
    this.cordWeg = 0
    this.zeit = 0
    this.wartet = false
  }

  _punkt(s) {
    s = Math.max(0, Math.min(this.laenge, s))
    let g = this.abschnitte[this.abschnitte.length - 1]
    for (const a of this.abschnitte) if (s <= a.s0 + a.l) { g = a; break }
    const t = (s - g.s0) / g.l
    return { x: g.a.x + (g.b.x - g.a.x) * t, z: g.a.z + (g.b.z - g.a.z) * t, gier: Math.atan2(g.b.x - g.a.x, g.b.z - g.a.z) }
  }

  _imBild(x, z, rand = 1.25) {
    v.set(x, terrainHeight(x, z) + 1.5, z).project(this.camera)
    return v.z < 1 && Math.abs(v.x) < rand && Math.abs(v.y) < rand
  }

  // Aus der Konsole: __ski.raupe.losfahren() – auch am Tag.
  losfahren() {
    this.heute = true
    this.fertig = false
    this.uhr = 0
  }

  update(dt, skier, darf = true) {
    this.zeit += dt
    if (this.fertig || !this.heute) return
    if (!this.aktiv) {
      if (!darf) return
      this.uhr -= dt
      if (this.uhr > 0) return
      // An dem Ende anfangen, das keiner sieht.
      const enden = [0, this.laenge].filter((s) => { const p = this._punkt(s); return !this._imBild(p.x, p.z) })
      if (!enden.length) { this.uhr = 3; return }
      this.s = enden[Math.floor(Math.random() * enden.length)]
      this.richtung = this.s === 0 ? 1 : -1
      this.gier = this._punkt(this.s).gier + (this.richtung < 0 ? Math.PI : 0)
      this.aktiv = true
      this.schicht = 0
      this.m.group.visible = true
    }

    this.schicht += dt
    const sichtbar = this._imBild(this.m.group.position.x, this.m.group.position.z, 1.1)

    // Feierabend: am Ende der Strecke und ausser Bild ist sie weg.
    const amEnde = this.s <= 0.01 || this.s >= this.laenge - 0.01
    if (this.schicht > DAUER && amEnde && !sichtbar && !this.wenden) {
      this.aktiv = false
      this.fertig = true
      this.m.group.visible = false
      return
    }

    const p = this._punkt(this.s)
    const soll = p.gier + (this.richtung < 0 ? Math.PI : 0)
    let d = soll - this.gier
    d = Math.atan2(Math.sin(d), Math.cos(d))

    // Steht jemand vor ihr, wartet sie.
    const dx = skier.position.x - p.x
    const dz = skier.position.z - p.z
    const vor = dx * Math.sin(this.gier) + dz * Math.cos(this.gier)
    this.wartet = vor > 0 && vor < WARTEN && Math.abs(-dx * Math.cos(this.gier) + dz * Math.sin(this.gier)) < 2.6

    if (this.wenden || Math.abs(d) > 0.6) {
      // Am Ende auf der Stelle wenden, Ketten gegenlaeufig. Die Knicke der
      // Strecke (0,1 bis 0,2 rad) nimmt sie dagegen im Fahren.
      this.wenden = true
      this.gier += Math.sign(d) * Math.min(Math.abs(d), WENDEN * dt)
      if (Math.abs(d) < 0.02) this.wenden = false
    } else if (!this.wartet) {
      const vorher = this.s
      this.s += this.richtung * TEMPO * dt
      if (this.s <= 0 || this.s >= this.laenge) {
        this.s = Math.max(0, Math.min(this.laenge, this.s))
        // Am Ende umdrehen – oder Feierabend, siehe oben.
        if (this.schicht <= DAUER) this.richtung *= -1
      }
      this.gier += d * Math.min(1, dt * 2.5)
      // Cord hinter der Fraese, alle 0,8 Meter.
      this.cordWeg += Math.abs(this.s - vorher)
      if (this.trail && this.cordWeg > 0.8) {
        this.cordWeg = 0
        const h = this._punkt(this.s)
        const bx = h.x - Math.sin(this.gier) * 2.4
        const bz = h.z - Math.cos(this.gier) * 2.4
        this.trail.stampDecal(cordTextur(), bx, bz, 3.0, 1.2, -this.gier, 0.45, 0.5)
      }
    }

    this._setzen()

    // Niemand faehrt durch sie hindurch: wer ihr zu nahe kommt, wird
    // hinausgeschoben, wie an einem Baum.
    const q = this.m.group.position
    const ax = skier.position.x - q.x
    const az = skier.position.z - q.z
    const ad = Math.hypot(ax, az)
    if (ad < KOERPER && ad > 0.01) {
      skier.position.x = q.x + (ax / ad) * KOERPER
      skier.position.z = q.z + (az / ad) * KOERPER
    }

    // Rundumleuchte: dreht sich, und einmal je Umlauf zeigt sie her.
    const u = this.zeit * 5.2
    this.m.leuchte.rotation.y = u
    this.m.blitz.material.opacity = Math.pow(Math.max(0, Math.sin(u)), 6) * 0.55
  }

  _setzen() {
    const p = this._punkt(this.s)
    const g = this.m.group
    g.position.set(p.x, terrainHeight(p.x, p.z), p.z)
    terrainNormal(p.x, p.z, n)
    qHang.setFromUnitVectors(oben, n)
    qGier.setFromAxisAngle(oben, this.gier)
    g.quaternion.copy(qHang).multiply(qGier)
  }
}
