import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { terrainHeight, terrainNormal, NORTH_LANE, BRUECKE, DECK, stegLage, stegDeck, schuppenWelt, schuppenLokal, SCHUPPEN } from './heightfield.js'

// Die Pistenraupe. Sie faehrt nur nachts, nach der echten Uhr des Besuchers:
// zwischen 22 und 6 Uhr, und auch dann nur in jeder zweiten Sitzung, einmal,
// irgendwann zwischen ein und fuenf Minuten nach dem Ankommen. Fast niemand
// soll sie je zu Gesicht bekommen. Das Tal selbst bleibt dabei hell – eine
// echte Nacht waere ein Umbau an Licht und Himmel; man erkennt die
// Nachtschicht an den Scheinwerfern und der Rundumleuchte.
//
// Sie wohnt im Schuppen am Ende der Nordabfahrt (props/schuppen.js). Das Tor
// faehrt hoch, sie rueckt aus und walzt eine feste Runde: ueber die Bruecke
// die Nordabfahrt hinauf, oberhalb der Klamm hinunter und versetzt wieder
// hinauf, bis die ganze Breite gewalzt ist; oben nach links hinueber und
// gleich neben dem Lift hinunter und daneben wieder hinauf; dann die
// Nordabfahrt hinunter und ein zweites Mal ueber die Bruecke zurueck in den
// Schuppen, und das Tor geht zu. Hinter ihr ist der Schnee wieder glatt, als
// waere nie jemand gefahren. Steht jemand vor ihr, haelt sie an.

const TEMPO = 3.5        // m/s – eine echte faehrt beim Walzen 10 bis 15 km/h
const WENDEN = 0.8       // rad/s auf der Stelle, Ketten gegenlaeufig
const KNICK = 0.6        // rad: groessere Knicke wendet sie im Stand
const WARTEN = 7         // m: steht jemand naeher vor ihr, haelt sie an
const KOERPER = 2.3      // m: so nah kommt keiner an ihre Mitte
const TOR_ZEIT = 2.5     // s, bis das Tor ganz offen oder zu ist

const zufall = (a, b) => a + Math.random() * (b - a)

export function nachtschicht(date = new Date()) {
  const h = date.getHours()
  return h >= 22 || h < 6
}

// --- Die Runde ---------------------------------------------------------------
// Punkt der Nordabfahrt bei s mit seitlichem Versatz (positiv zum Grat). An
// der Klamm schwenkt jede Spur auf die Achse der Bruecke ein: die Bahn
// gabelt sich dort in Steg und Schanze, und die Bruecke liegt 4,7 m neben
// der Bahnmitte.
function nordPunkt(s, versatz) {
  const segs = NORTH_LANE.segments
  let g = segs[segs.length - 1]
  for (const seg of segs) if (s <= seg.s0 + seg.len) { g = seg; break }
  const t = Math.max(0, Math.min(1, (s - g.s0) / g.len))
  const tx = g.dx / g.len
  const tz = g.dz / g.len
  let x = g.x + g.dx * t + tz * versatz
  let z = g.z + g.dz * t - tx * versatz
  const l = stegLage(x, z)
  const reich = DECK.halbL + 7
  if (Math.abs(l.laengs) < reich && Math.abs(l.quer) < 10) {
    const w = Math.min(1, (reich - Math.abs(l.laengs)) / 5)
    const quer = l.quer * (1 - w * w * (3 - 2 * w))
    const e = BRUECKE.ebene
    x = BRUECKE.x + l.laengs * e.ux - quer * e.uz
    z = BRUECKE.z + l.laengs * e.uz + quer * e.ux
  }
  return { x, z }
}

// `versatz` ist eine Zahl oder (s) => Zahl.
function nordFahrt(von, bis, versatz) {
  const pts = []
  const schritt = von < bis ? 2 : -2
  const vs = typeof versatz === 'function' ? versatz : () => versatz
  for (let s = von; schritt > 0 ? s <= bis : s >= bis; s += schritt) pts.push(nordPunkt(s, vs(s)))
  return pts
}

// Neben dem Lift: Spuren parallel zur Trasse, im Abstand `versatz` auf der
// Seite zur freien Abfahrt (positiv, auf dem Bild rechts). Auf der Trasse
// selbst stehen die Stuetzen (Radius 0,5), bei 4,8 m ein Pistenpfahl; mit
// 2,6 und 7 m bleiben zu beiden mindestens 1,9 m. Unten endet sie 6 m vor
// der Talstation, oben 5 m unter der Bergstation.
const LIFT_BASE = { x: -34, z: -8 }
const LIFT_TOP = { x: -63, z: -55 }
function liftFahrt(versatz, hinauf) {
  const L = Math.hypot(LIFT_TOP.x - LIFT_BASE.x, LIFT_TOP.z - LIFT_BASE.z)
  const ux = (LIFT_TOP.x - LIFT_BASE.x) / L
  const uz = (LIFT_TOP.z - LIFT_BASE.z) / L
  const pts = []
  for (let a = L - 5; a >= 6; a -= 2) pts.push({ x: LIFT_BASE.x + ux * a - uz * versatz, z: LIFT_BASE.z + uz * a + ux * versatz })
  return hinauf ? pts.reverse() : pts
}

// Unterhalb der Bruecke gibt es nur Hin- und Rueckweg; die beiden liegen
// dort symmetrisch bei ±2,4 m, damit die 6,4 m der Fraese die Mitte und
// beide Seiten erreichen. Oben bleibt Platz fuer drei Spuren. Gewechselt
// wird auf der Bruecke, wo ohnehin jede Spur auf der Achse liegt.
const unten = (s, tal, berg) => (s > 52 ? tal : berg)

// Ueber den Gipfel zum Lift: aus dem Startbogen schraeg hinunter, oestlich
// am Gipfelkreuz vorbei (2 m) und innen an der Bande der Rodelbahn entlang
// (3 m), dann nach links. Vorher fuhr sie bei (−52, −66) mitten durch den
// ersten Bandenpfosten.
const OBEN = [{ x: -55.5, z: -67.5 }, { x: -53.5, z: -62 }, { x: -53, z: -58 }]

// Die ganze Runde als Linienzug. Ueber die Bruecke (Bahnmeter 45 bis 60)
// faehrt sie genau zweimal, hin und zurueck; das Hin und Her liegt ganz
// oberhalb, wo die Spuren noch nicht auf die Brueckenachse einschwenken
// (ab Meter 38).
export function runde() {
  const S = SCHUPPEN
  // Das Tor liegt hinten und oeffnet direkt auf den Auslauf der Nordabfahrt.
  const innen = schuppenWelt(0, 0.9)
  const tor = schuppenWelt(0, -S.halbT - 1)
  const vorTor = schuppenWelt(0, -S.halbT - 4)
  const pts = [
    innen, tor, vorTor,
    ...nordFahrt(78, 5, (s) => unten(s, 2.4, 3.4)),
    ...nordFahrt(5, 36, 0),
    ...nordFahrt(36, 5, -3.4),
    // Oben durch die Mitte des Startbogens (quer hinueber streifte sie den
    // oestlichen Pfosten).
    nordPunkt(0, 0), ...OBEN,
    ...liftFahrt(2.6, false),
    ...liftFahrt(7, true),
    ...[...OBEN].reverse(), nordPunkt(0, 0),
    ...nordFahrt(2, 78, (s) => unten(s, -2.4, -1.6)),
    vorTor, tor, innen,
  ]
  return pts
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
  // Die Fraese hinten mit dem Finisher, der den Schnee glattzieht.
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

// --- Fahren ------------------------------------------------------------------
const n = new THREE.Vector3()
const v = new THREE.Vector3()
const oben = new THREE.Vector3(0, 1, 0)
const qHang = new THREE.Quaternion()
const qGier = new THREE.Quaternion()

export class Pistenraupe {
  constructor({ scene, camera, trail, world = null, schuppen = null, erzwungen = new URLSearchParams(location.search).has('raupe') }) {
    this.scene = scene
    this.camera = camera
    this.trail = trail
    this.schuppen = schuppen
    const m = bauen()
    this.m = m
    scene.add(m.group)

    this.punkte = runde()
    this.abschnitte = []
    this.laenge = 0
    for (let i = 0; i < this.punkte.length - 1; i++) {
      const a = this.punkte[i]
      const b = this.punkte[i + 1]
      const l = Math.hypot(b.x - a.x, b.z - a.z)
      if (l < 0.01) continue
      this.abschnitte.push({ a, b, s0: this.laenge, l, gier: Math.atan2(b.x - a.x, b.z - a.z) })
      this.laenge += l
    }

    // Kommt sie heute? Nachts in jeder zweiten Sitzung, sonst nie.
    this.heute = erzwungen || (nachtschicht() && Math.random() < 0.5)
    this.uhr = erzwungen ? 2 : zufall(60, 300)
    this.zustand = 'parkt'   // tor_auf, faehrt, tor_zu
    this.fertig = false
    this.s = 0
    this.gier = this.abschnitte[0].gier
    this.wenden = false
    this.glattWeg = 0
    this.zeit = 0
    this.torZeit = 0
    this.wartet = false
    this._setzen()
  }

  get aktiv() { return this.zustand !== 'parkt' }

  _abschnitt(s) {
    let g = this.abschnitte[this.abschnitte.length - 1]
    for (const a of this.abschnitte) if (s < a.s0 + a.l) { g = a; break }
    return g
  }

  _punkt(s) {
    s = Math.max(0, Math.min(this.laenge, s))
    const g = this._abschnitt(s)
    const t = Math.min(1, (s - g.s0) / g.l)
    return { x: g.a.x + (g.b.x - g.a.x) * t, z: g.a.z + (g.b.z - g.a.z) * t, gier: g.gier }
  }

  // Aus der Konsole: __ski.raupe.losfahren() – auch am Tag.
  losfahren() {
    this.heute = true
    this.fertig = false
    this.uhr = 0
  }

  update(dt, skier, darf = true) {
    this.zeit += dt
    this._leuchte()
    if (this.zustand === 'parkt') {
      if (this.fertig || !this.heute || !darf) return
      this.uhr -= dt
      if (this.uhr > 0) return
      this.s = 0
      this.zustand = 'tor_auf'
      this.torZeit = 0
    }
    if (this.zustand === 'tor_auf' || this.zustand === 'tor_zu') {
      this.torZeit += dt
      const k = Math.min(1, this.torZeit / TOR_ZEIT)
      this.schuppen?.setzeTor(this.zustand === 'tor_auf' ? k : 1 - k)
      if (k >= 1) {
        if (this.zustand === 'tor_auf') this.zustand = 'faehrt'
        else {
          this.zustand = 'parkt'
          this.fertig = true
        }
      }
      return
    }

    const p = this._punkt(this.s)
    let d = p.gier - this.gier
    d = Math.atan2(Math.sin(d), Math.cos(d))

    // Steht jemand vor ihr, wartet sie.
    const dx = skier.position.x - this.m.group.position.x
    const dz = skier.position.z - this.m.group.position.z
    const vor = dx * Math.sin(this.gier) + dz * Math.cos(this.gier)
    this.wartet = vor > 0 && vor < WARTEN && Math.abs(-dx * Math.cos(this.gier) + dz * Math.sin(this.gier)) < 2.6

    if (this.wenden || Math.abs(d) > KNICK) {
      // Im Stand wenden, Ketten gegenlaeufig. Die kleinen Knicke der Spur
      // nimmt sie dagegen im Fahren.
      this.wenden = true
      this.gier += Math.sign(d) * Math.min(Math.abs(d), WENDEN * dt)
      if (Math.abs(d) < 0.02) this.wenden = false
    } else if (!this.wartet) {
      const vorher = this.s
      // Im Schuppen und am Tor langsam.
      const lokal = schuppenLokal(p.x, p.z)
      const amSchuppen = lokal.lz < SCHUPPEN.halbT + 1 && lokal.lz > -SCHUPPEN.halbT - 5 && Math.abs(lokal.lx) < SCHUPPEN.halbB + 2
      const tempo = amSchuppen ? TEMPO * 0.45 : TEMPO
      this.s = Math.min(this.laenge, this.s + tempo * dt)
      // Vorausschauen: der naechste Abschnitt soll keinen Ruck geben.
      const q = this._punkt(this.s + 1.5)
      let d2 = Math.atan2(q.x - p.x, q.z - p.z) - this.gier
      d2 = Math.atan2(Math.sin(d2), Math.cos(d2))
      this.gier += (Math.abs(d2) < KNICK ? d2 : d) * Math.min(1, dt * 2.5)
      this._walzen(Math.abs(this.s - vorher))
      if (this.s >= this.laenge) {
        this.zustand = 'tor_zu'
        this.torZeit = 0
      }
    }

    this._setzen()

    // Niemand faehrt durch sie hindurch: wer ihr zu nahe kommt, wird
    // hinausgeschoben, wie an einem Baum.
    const g = this.m.group.position
    const ax = skier.position.x - g.x
    const az = skier.position.z - g.z
    const ad = Math.hypot(ax, az)
    if (ad < KOERPER && ad > 0.01) {
      skier.position.x = g.x + (ax / ad) * KOERPER
      skier.position.z = g.z + (az / ad) * KOERPER
    }
  }

  // Hinter der Fraese alle 0,8 Meter ein Stueck glatter Schnee, 6,4 m breit
  // wie bei einer echten: mit 5,6 m blieb zwischen zwei Spuren im Abstand
  // von 5,2 m ein Streifen Rillen stehen, nur zu einem Drittel geglaettet.
  _walzen(weg) {
    this.glattWeg += weg
    if (!this.trail?.glaetten || this.glattWeg < 0.8) return
    this.glattWeg = 0
    const g = this.m.group.position
    this.trail.glaetten(g.x - Math.sin(this.gier) * 2.4, g.z - Math.cos(this.gier) * 2.4, 6.4, 1.6, -this.gier)
  }

  _leuchte() {
    // Rundumleuchte und Scheinwerfer nur, solange sie ausgerueckt ist.
    const an = this.zustand === 'faehrt' || this.zustand === 'tor_auf' || this.zustand === 'tor_zu'
    this.m.leuchte.visible = an
    this.m.kegel.visible = an && this.zustand === 'faehrt'
    const u = this.zeit * 5.2
    this.m.leuchte.rotation.y = u
    this.m.blitz.material.opacity = an ? Math.pow(Math.max(0, Math.sin(u)), 6) * 0.55 : 0
  }

  _setzen() {
    const p = this._punkt(this.s)
    const g = this.m.group
    const deck = stegDeck(p.x, p.z)
    const lokal = schuppenLokal(p.x, p.z)
    const imSchuppen = Math.abs(lokal.lx) < SCHUPPEN.halbB && Math.abs(lokal.lz) < SCHUPPEN.halbT
    if (deck) {
      // Auf der Bruecke traegt das Deck, nicht das Gelaende – darunter ist
      // die Klamm. Geneigt nach dem Gefaelle der Bohlenebene.
      const e = BRUECKE.ebene
      g.position.set(p.x, deck.y, p.z)
      n.set(-e.gefaelle * e.ux, 1, -e.gefaelle * e.uz).normalize()
    } else if (imSchuppen) {
      g.position.set(p.x, SCHUPPEN.h, p.z)
      n.set(0, 1, 0)
    } else {
      g.position.set(p.x, terrainHeight(p.x, p.z), p.z)
      terrainNormal(p.x, p.z, n)
    }
    qHang.setFromUnitVectors(oben, n)
    qGier.setFromAxisAngle(oben, this.gier)
    g.quaternion.copy(qHang).multiply(qGier)
  }
}
