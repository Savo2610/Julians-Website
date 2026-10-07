import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'

// Die Bande der Rodelbahn: Pfosten mit zwei Brettern, die der Bahn folgen.
// Sie steht auf der Bandenkrone, also dort, wo das Gelaende schon von selbst
// ansteigt – zusammen liest man das als Rinne und nicht als Zaun.
//
// Gebaut wird in zwei Schritten: erst die gueltigen Pfostenplaetze sammeln,
// dann die Bretter nur zwischen zwei Pfosten spannen, die es beide gibt.
// Andernfalls haengen Bretter ins Leere, wo ein Pfosten ausgelassen wurde.
//
// Alles wird zu einer einzigen Geometrie verschmolzen. Bei ueber hundert
// Pfosten waere jedes Brett sonst ein eigener Zeichenaufruf.

const WOOD = 0x8a6a44
const WOOD_DARK = 0x6b4f31
const SNOW = 0xf4f9ff

// `brechbar` ({ side, von, bis, hindernis }) nimmt eine Seite aus dem festen
// Bau heraus: dort steht der Zaun zwischen Slalom und Nordabfahrt, und der
// bricht (props/park-fence.js). Er laeuft von einem fremden Pfosten (`von`,
// Starttor der Nordabfahrt) die Bahn entlang bis zu einem zweiten (`bis`,
// Ende des Funparkzauns) und wird als Pfostenliste in
// `mesh.userData.brechbar` zurueckgegeben.
export function createSledFence(lane, { spacing = 3.6, inset = 0.4, height = 0.92, brechbar = null } = {}) {
  const parts = []
  const segs = lane.segments
  const half = lane.width * 0.5 - inset

  const at = (s) => {
    let g = segs[segs.length - 1]
    let t = 1
    for (const seg of segs) {
      if (s >= seg.s0 && s <= seg.s0 + seg.len) {
        g = seg
        t = (s - seg.s0) / seg.len
        break
      }
    }
    return { x: g.x + g.dx * t, z: g.z + g.dz * t, dx: g.dx / g.len, dz: g.dz / g.len }
  }

  // Die Bande beginnt und endet innerhalb der Ausblendzonen des Bandes –
  // dort, wo die Rinne schon Form hat.
  const from = lane.endFade * 0.8
  const to = lane.total - lane.endFade * 0.8

  for (const side of [-1, 1]) {
    if (brechbar?.side === side) continue
    const posts = []
    let index = 0
    for (let s = from; s <= to; s += spacing) {
      const p = at(s)
      const nx = -p.dz * side
      const nz = p.dx * side
      const x = p.x + nx * half
      const z = p.z + nz * half
      const y = terrainHeight(x, z)
      // Auf der Bergseite ist der Hang selbst die Bande – dort steckt ein
      // Brett nur im Anschnitt. Ein Pfosten kommt nur hin, wo das Gelaende
      // hinter der Bahn abfaellt.
      const outside = terrainHeight(x + nx * 3, z + nz * 3)
      posts.push({
        x, y, z,
        yaw: Math.atan2(p.dx, p.dz),
        ok: outside <= y + 0.35,
        tall: height + (index % 3 === 0 ? 0.1 : 0),
        dark: index % 4 === 0,
      })
      index++
    }

    // Einzelne Pfosten sehen aus wie vergessen. Erst Luecken von einem
    // Pfosten schliessen, dann Ausreisser entfernen – uebrig bleiben
    // zusammenhaengende Bandenstuecke.
    const raw = posts.map((q) => q.ok)
    for (let i = 1; i < posts.length - 1; i++) {
      if (!raw[i] && raw[i - 1] && raw[i + 1]) posts[i].ok = true
    }
    for (let i = 0; i < posts.length; i++) {
      const before = i > 0 && posts[i - 1].ok
      const after = i < posts.length - 1 && posts[i + 1].ok
      if (posts[i].ok && !before && !after) posts[i].ok = false
    }

    const lean = side * 0.09
    for (let i = 0; i < posts.length; i++) {
      const a = posts[i]
      if (!a.ok) continue

      if (!a.fremd) parts.push({
        geo: new THREE.BoxGeometry(0.13, a.tall, 0.13),
        color: a.dark ? WOOD_DARK : WOOD,
        position: [a.x, a.y + a.tall * 0.5 - 0.12, a.z],
        rotation: [0, a.yaw, lean],
      })
      if (!a.fremd) parts.push({
        geo: new THREE.BoxGeometry(0.17, 0.06, 0.17),
        color: SNOW,
        position: [a.x, a.y + a.tall - 0.09, a.z],
        rotation: [0, a.yaw, lean],
      })

      const b = posts[i + 1]
      if (!b || !b.ok) continue

      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const pitch = Math.atan2(b.y - a.y, len)
      const dir = Math.atan2(b.x - a.x, b.z - a.z)
      const mx = (a.x + b.x) / 2
      const mz = (a.z + b.z) / 2
      const my = (a.y + b.y) / 2
      for (const [rel, thick] of [[0.78, 0.17], [0.42, 0.15]]) {
        parts.push({
          geo: new THREE.BoxGeometry(0.05, thick, len + 0.1),
          color: WOOD,
          position: [mx, my + a.tall * rel - 0.12, mz],
          rotation: [-pitch, dir, lean],
        })
      }
    }
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.88 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.userData.brechbar = brechbar ? zaunLinie(lane, half, { spacing, height, ...brechbar }) : null
  return mesh
}

// Die Linie des brechbaren Zauns. Nicht wie die feste Bande in festen
// Schritten entlang der Mittellinie abgetragen: in der Innenkurve bei
// (-26, -45) liefen die Pfosten dann ein Stueck rueckwaerts, und wo das
// Gelaende nicht abfaellt, liess die Bande Luecken (zwischen 38 und 46 m).
// Hier ist es ein durchgehender Parallelzug mit Gehrung an den Ecken.
function zaunLinie(lane, half, { side, von, bis, hindernis, spacing, height }) {
  const P = lane.points
  const normale = (a, b) => {
    const l = Math.hypot(b.x - a.x, b.z - a.z)
    return { x: -(b.z - a.z) / l * side, z: (b.x - a.x) / l * side }
  }
  const zug = P.map((p, i) => {
    const n1 = normale(P[Math.max(0, i - 1)], P[Math.max(1, i)])
    const n2 = normale(P[Math.min(i, P.length - 2)], P[Math.min(i + 1, P.length - 1)])
    let mx = n1.x + n2.x
    let mz = n1.z + n2.z
    const ml = Math.hypot(mx, mz)
    mx /= ml
    mz /= ml
    const k = half / (mx * n1.x + mz * n1.z)
    return { x: p.x + mx * k, z: p.z + mz * k }
  })
  // Von beiden fremden Pfosten aus geht es gerade zur naechsten Ecke des
  // Zugs; die Ecke am Ende ersetzt `bis` selbst.
  const naechste = (q) => zug.reduce((m, p, i) => (Math.hypot(p.x - q.x, p.z - q.z) < Math.hypot(zug[m].x - q.x, zug[m].z - q.z) ? i : m), 0)
  const linie = [{ ...von, fremd: true }, ...zug.slice(naechste(von), naechste(bis)), { ...bis, fremd: true }]

  // Wo die Linie durch einen Felsen liefe, endet der Zaun an ihm und setzt
  // dahinter wieder an. Gekappt wird bei 90 % des Kollisionskreises: der
  // Fels ist kantig, und so steckt das letzte Brett sichtbar in ihm, ohne
  // eine Luecke zum Durchschluepfen zu lassen.
  const stuecke = []
  let stueck = []
  let zuletzt = null   // letzter Punkt vor dem Felsen
  const drin = (x, z) => hindernis(x, z).some((c) => Math.hypot(c.x - x, c.z - z) < c.r * 0.9)
  for (let i = 0; i < linie.length - 1; i++) {
    const a = linie[i]
    const b = linie[i + 1]
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.25))
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const p = k === 0 ? a : k === n ? b : { x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n }
      if (drin(p.x, p.z)) {
        if (stueck.length && zuletzt) stueck.push(zuletzt)
        if (stueck.length > 1) stuecke.push(stueck)
        stueck = []
        zuletzt = null
        continue
      }
      // Stehen bleiben Ecken, Enden und die Raender an Felsen.
      if (!stueck.length || k === n) stueck.push(p)
      zuletzt = k === n ? null : p
    }
  }
  if (stueck.length > 1) stuecke.push(stueck)

  // Pfosten je Abschnitt gleichmaessig, hoechstens `spacing` auseinander.
  const pfosten = []
  let nr = 0
  for (const st of stuecke) {
    for (let i = 0; i < st.length; i++) {
      const a = st[i]
      const b = st[i + 1]
      pfosten.push({ x: a.x, z: a.z, h: height + (nr % 3 === 0 ? 0.1 : 0), fremd: !!a.fremd })
      nr++
      if (!b) break
      const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / spacing)
      for (let k = 1; k < n; k++) {
        pfosten.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n, h: height + (nr % 3 === 0 ? 0.1 : 0) })
        nr++
      }
    }
    pfosten[pfosten.length - 1].ende = true
  }
  return pfosten
}
