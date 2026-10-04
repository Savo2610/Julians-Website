import * as THREE from 'three'
import { terrainNormal } from '../heightfield.js'
import { isSnowSurface } from '../surfaces.js'

// Was alle Tiere brauchen: wissen, ob die Kamera sie sieht, wo der Wald
// ist, wie man am Hang steht, und wie ein Abdruck in den Schnee kommt.

export const glatt = (rate, dt) => 1 - Math.exp(-rate * dt)

// Ein Buckel von a bis b: 0 ausserhalb, dazwischen eine halbe Sinuswelle.
// Daraus setzt sich jede Bewegung im Sprung zusammen.
export function buckel(p, a, b) {
  if (p <= a || p >= b) return 0
  return Math.sin(Math.PI * (p - a) / (b - a))
}

export function winkelDiff(a, b) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

// Bildschirmlage eines Weltpunkts. Die Tiere kommen und gehen nur dort, wo
// die Kamera nicht hinschaut – ein Hase, der mitten im Bild entsteht oder
// verschwindet, ist ein Fehler und kein Wildtier.
const v = new THREE.Vector3()
export function imBild(camera, x, y, z, rand = 1) {
  v.set(x, y, z).project(camera)
  return v.z < 1 && Math.abs(v.x) < rand && Math.abs(v.y) < rand
}
export function bildLage(camera, x, y, z) {
  return v.set(x, y, z).project(camera)
}

// Am Hang steht ein Tier nicht senkrecht, sondern leicht mit dem Gelaende
// geneigt – ganz angelegt (1,0) sah es im Steilhang aus wie aufgeklebt.
const oben = new THREE.Vector3(0, 1, 0)
const n = new THREE.Vector3()
const qHang = new THREE.Quaternion()
const qGier = new THREE.Quaternion()
const eins = new THREE.Quaternion()
export function amHang(obj, x, z, gier, anteil = 0.7) {
  terrainNormal(x, z, n)
  qHang.setFromUnitVectors(oben, n)
  qHang.slerpQuaternions(eins, qHang, anteil)
  qGier.setFromAxisAngle(oben, gier)
  obj.quaternion.copy(qHang).multiply(qGier)
}

// --- Wald ----------------------------------------------------------------------
// Die Baumstandorte aus populate als grobes Raster. Fragen: wie viele Baeume
// stehen hier, und wo ist es am dichtesten? Dorthin fluechtet ein Tier.
export class Waldkarte {
  constructor(baeume, zelle = 6) {
    this.zelle = zelle
    this.raster = new Map()
    for (const b of baeume) {
      const k = `${Math.floor(b.x / zelle)}:${Math.floor(b.z / zelle)}`
      let liste = this.raster.get(k)
      if (!liste) this.raster.set(k, (liste = []))
      liste.push(b)
    }
  }

  *um(x, z, r) {
    const z0 = this.zelle
    const reach = Math.ceil(r / z0)
    const cx = Math.floor(x / z0)
    const cz = Math.floor(z / z0)
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const liste = this.raster.get(`${cx + i}:${cz + j}`)
        if (!liste) continue
        for (const b of liste) {
          const dx = b.x - x
          const dz = b.z - z
          if (dx * dx + dz * dz < r * r) yield b
        }
      }
    }
  }

  anzahl(x, z, r) {
    let k = 0
    for (const _ of this.um(x, z, r)) k++
    return k
  }

  naechster(x, z, r) {
    let best = null
    let bd = r * r
    for (const b of this.um(x, z, r)) {
      const d = (b.x - x) ** 2 + (b.z - z) ** 2
      if (d < bd) { bd = d; best = b }
    }
    return best ? Math.sqrt(bd) : Infinity
  }

  // Der naechste Baum selbst (mit Lage und Groesse), oder null.
  naechsterBaum(x, z, r) {
    let best = null
    let bd = r * r
    for (const b of this.um(x, z, r)) {
      const d = (b.x - x) ** 2 + (b.z - z) ** 2
      if (d < bd) { bd = d; best = b }
    }
    return best
  }

  // Richtung zum Schwerpunkt der Baeume im Umkreis, gewichtet nach Naehe.
  // Null, wenn dort keiner steht.
  richtung(x, z, r) {
    let sx = 0
    let sz = 0
    for (const b of this.um(x, z, r)) {
      const dx = b.x - x
      const dz = b.z - z
      const d = Math.hypot(dx, dz) || 1
      const w = 1 / (1 + d * 0.3)
      sx += (dx / d) * w
      sz += (dz / d) * w
    }
    const l = Math.hypot(sx, sz)
    return l < 1e-3 ? null : { x: sx / l, z: sz / l }
  }
}

// --- Abdruecke -----------------------------------------------------------------
// Dieselbe Kanalsprache wie die Wildspuren in snow-writing.js: Gruen ist der
// zur Seite gedrueckte Schnee, Gelb die Vertiefung. Canvas-oben ist vorn –
// mit rotation = -gier zeigt Textur-+Y in Laufrichtung (sin, cos).
function leinwand(b, h, zeichne) {
  const c = document.createElement('canvas')
  c.width = b
  c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, b, h)
  for (const [farbe, wachs] of [['#00ff00', 3], ['#ffff00', 0]]) {
    ctx.fillStyle = farbe
    zeichne(ctx, wachs)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return tex
}

const oval = (ctx, x, y, rx, ry, dreh = 0) => {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, dreh, 0, Math.PI * 2)
  ctx.fill()
}

// Hasenspur: die langen Hinterlaeufe landen nebeneinander *vor* den
// Vorderpfoten, die hintereinander aufsetzen – das typische Y, an dem jeder
// Jaeger einen Hasen erkennt, auch ohne ihn je zu sehen.
let _hase = null
function haseTextur() {
  return (_hase ||= leinwand(96, 160, (ctx, w) => {
    oval(ctx, 30, 34, 9 + w, 22 + w, -0.12)
    oval(ctx, 66, 34, 9 + w, 22 + w, 0.12)
    oval(ctx, 46, 92, 7 + w, 9 + w)
    oval(ctx, 50, 128, 7 + w, 9 + w)
  }))
}

// Fuchs: er schnuert – jede Pfote setzt in die Linie der vorigen, die Spur
// ist eine einzige Perlenkette. Vier Zehen vor dem Ballen.
let _fuchs = null
function fuchsTextur() {
  return (_fuchs ||= leinwand(48, 160, (ctx, w) => {
    for (const y of [40, 120]) {
      oval(ctx, 24, y + 6, 9 + w, 8 + w)
      for (const [dx, dy] of [[-8, -9], [8, -9], [-3, -15], [3, -15]]) oval(ctx, 24 + dx, y + dy, 3.2 + w * 0.6, 4 + w * 0.6)
    }
  }))
}

// Schneehuehner hinterlassen beim Auffliegen die Abdruecke ihrer
// Schwungfedern, zwei Faecher links und rechts. Das gibt es wirklich, und
// es bleibt liegen, wenn die Voegel laengst weg sind.
let _fluegel = null
function fluegelTextur() {
  return (_fluegel ||= leinwand(192, 96, (ctx, w) => {
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const a = -0.2 + i * 0.22
        const x = 96 + s * (22 + Math.cos(a) * 44)
        const y = 52 + Math.sin(a) * 30
        oval(ctx, x, y, 22 + w, 3 + w, s * a)
      }
    }
    oval(ctx, 96, 52, 16 + w, 18 + w)
  }))
}

// Das Loch nach dem Maeuselsprung: wo die Schnauze eingetaucht ist.
let _loch = null
function lochTextur() {
  return (_loch ||= leinwand(96, 112, (ctx, w) => {
    oval(ctx, 48, 50, 26 + w, 34 + w)
  }))
}

// Groesser als in echt, und zwar deutlich: die Spurkarte hat 2560 Texel auf
// 230 Meter, also 9 cm je Texel. Eine echte Hasenpfote (8 cm) war darin
// unsichtbar; erst ab gut 15 cm je Abdruck liest man die Form.
const ABDRUCK = {
  hase: { textur: haseTextur, breite: 0.75, laenge: 1.2 },
  // Das Eichhoernchen huepft wie der Hase – dasselbe Y, nur halb so gross.
  hoernchen: { textur: haseTextur, breite: 0.4, laenge: 0.62 },
  fuchs: { textur: fuchsTextur, breite: 0.32, laenge: 1.0 },
  fluegel: { textur: fluegelTextur, breite: 1.5, laenge: 0.75 },
  loch: { textur: lochTextur, breite: 0.5, laenge: 0.58 },
}

export function abdruck(trail, art, x, z, gier, staerke = 0.6) {
  if (!isSnowSurface(x, z, 0.4)) return
  const a = ABDRUCK[art]
  trail.stampDecal(a.textur(), x, z, a.breite, a.laenge, -gier, staerke, 0.55)
}

// Ein Hauch Schnee beim Aufsetzen oder Abspringen.
export function stauben(spray, x, y, z, menge, kraft = 1) {
  if (!spray) return
  for (let i = 0; i < menge; i++) {
    const a = Math.random() * Math.PI * 2
    spray.emit(
      x + Math.cos(a) * 0.12, y + 0.04, z + Math.sin(a) * 0.12,
      Math.cos(a) * 1.1 * kraft, (0.8 + Math.random() * 1.2) * kraft, Math.sin(a) * 1.1 * kraft,
      0.18 + Math.random() * 0.22, 0.6 + Math.random() * 0.3,
    )
  }
}
