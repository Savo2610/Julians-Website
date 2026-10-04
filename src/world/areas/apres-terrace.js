import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'
import { APRES, terraceWorld, terraceDistance, houseWorld, houseLocal } from './apres-layout.js'
import { Kippreihe, Wurfteil } from './umstossen.js'

const WOOD = 0x98734e, DARK = 0x574638, SNOW = 0xf7fbff
const BULBS = [0xffd27a, 0xff5a4e, 0x59d98e, 0x5aa8ff, 0xffe066]
const FLAGS = [0xc4302b, 0xf1ede4, 0x2f6b4a, 0xf2c230, 0x2c5f9e]
const SKIS = [0xd9412f, 0x1f6fd1, 0xf2c230, 0x2fae7a, 0xf06292, 0x7b4fd6, 0xff8a1f]

// Der Sonnenschirm steht fuer sich, durch die Tischmitte gesteckt: wer ihn
// trifft, wirft ihn um, und der Tisch bleibt stehen – oder umgekehrt. Als Teil
// des Tisches fiel er immer mit ihm. Ursprung am Fuss der Stange.
function schirmGeometry() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.035, 0.035, 2.5, 6), color: 0xf1ede4, position: [0, 1.25, 0] }]
  for (let i = 0; i < 8; i++) {
    const wedge = new THREE.ConeGeometry(1.3, 0.5, 1, 1, true, i * Math.PI / 4, Math.PI / 4)
    parts.push({ geo: wedge, color: i % 2 ? 0xf6efe4 : 0xc4302b, position: [0, 2.45, 0] })
  }
  parts.push({ geo: new THREE.SphereGeometry(0.06, 6, 4), color: 0xf1ede4, position: [0, 2.72, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.22, 0.26, 0.08, 10), color: DARK, position: [0, 0.04, 0] })
  const geometry = assemble(parts)
  geometry.computeBoundingBox()
  return geometry
}

// Ein Masskrug: Glas mit Bier, Schaumkrone, Henkel. Ursprung am Boden.
function becherGeometry() {
  const henkel = new THREE.TorusGeometry(0.045, 0.014, 4, 8, Math.PI)
  henkel.rotateZ(-Math.PI / 2)
  return assemble([
    { geo: new THREE.CylinderGeometry(0.062, 0.058, 0.17, 8), color: 0xf0b030, position: [0, 0.085, 0] },
    { geo: new THREE.CylinderGeometry(0.066, 0.064, 0.05, 8), color: 0xfbf6ea, position: [0, 0.19, 0] },
    { geo: henkel, color: 0xe8e2d0, position: [0.065, 0.09, 0] },
  ])
}

// Ski und Boards im Staender, stehend, Ursprung am Fuss, Bindungen nach +z
// (zur Kamera – der Belag ist nur eine Flaeche). Die Farbe kommt je Instanz
// dazu; was dunkel bleiben soll (Bindungen), ist es auch eingefaerbt.
function skiGeometry() {
  const parts = []
  for (const sx of [-0.075, 0.075]) {
    parts.push({ geo: new THREE.BoxGeometry(0.115, 1.62, 0.035), color: 0xffffff, position: [sx, 0.81, 0] })
    // Die Schaufel biegt sich nach vorn.
    parts.push({ geo: new THREE.BoxGeometry(0.115, 0.16, 0.035), color: 0xffffff, position: [sx, 1.68, 0.035], rotation: [0.5, 0, 0] })
    parts.push({ geo: new THREE.BoxGeometry(0.06, 1.3, 0.04), color: 0xd8d8d8, position: [sx, 0.85, 0.004] })
    parts.push({ geo: new THREE.BoxGeometry(0.1, 0.09, 0.07), color: 0x222222, position: [sx, 0.62, 0.04] })
    parts.push({ geo: new THREE.BoxGeometry(0.1, 0.12, 0.07), color: 0x222222, position: [sx, 0.93, 0.04] })
  }
  return assemble(parts)
}
function boardGeometry() {
  const parts = [{ geo: new THREE.BoxGeometry(0.29, 1.2, 0.03), color: 0xffffff, position: [0, 0.75, 0] }]
  for (const y of [0.15, 1.35]) {
    const ende = new THREE.CylinderGeometry(0.145, 0.145, 0.03, 12, 1, false, y < 1 ? Math.PI / 2 : -Math.PI / 2, Math.PI)
    ende.rotateX(Math.PI / 2)
    parts.push({ geo: ende, color: 0xffffff, position: [0, y, 0] })
  }
  parts.push({ geo: new THREE.BoxGeometry(0.2, 0.5, 0.032), color: 0xf4f4f4, position: [0, 0.75, 0.002] })
  for (const y of [0.52, 0.98]) {
    parts.push({ geo: new THREE.BoxGeometry(0.24, 0.13, 0.08), color: 0x1d1d1d, position: [0, y, 0.05] })
    parts.push({ geo: new THREE.BoxGeometry(0.27, 0.035, 0.1), color: 0x3a3a3a, position: [0, y + 0.04, 0.06] })
  }
  return assemble(parts)
}

function furnitureGeometry(kind) {
  const parts = []
  const bench = kind === 'bench'
  const height = bench ? 0.46 : 0.88
  const length = bench ? 1.8 : 1.6
  const width = bench ? 0.42 : 0.9
  for (let i = 0; i < (bench ? 2 : 4); i++) {
    const n = bench ? 2 : 4
    parts.push({ geo: new THREE.BoxGeometry(length, 0.1, width / n - 0.014), color: i % 2 ? WOOD : 0xa58059, position: [0, height - 0.05, (i + 0.5) * width / n - width / 2] })
  }
  for (const x of [-length * 0.35, length * 0.35]) {
    for (const z of [-width * 0.3, width * 0.3]) parts.push({ geo: new THREE.BoxGeometry(0.1, height - 0.1, 0.1), color: DARK, position: [x, (height - 0.1) / 2, z] })
    parts.push({ geo: new THREE.BoxGeometry(0.13, 0.1, width * 0.9), color: DARK, position: [x, 0.15, 0] })
  }
  const geometry = assemble(parts)
  geometry.translate(0, -height / 2, 0)
  geometry.computeBoundingBox()
  return geometry
}

// Schneidet ein Vieleck an einer Geraden u = edge (axis 0) oder v = edge
// (axis 1) und behaelt die Seite darueber oder darunter.
function clip(poly, axis, edge, above) {
  const result = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]
    const ai = above ? a[axis] >= edge : a[axis] <= edge
    const bi = above ? b[axis] >= edge : b[axis] <= edge
    if (ai) result.push(a)
    if (ai !== bi) {
      const t = (edge - a[axis]) / (b[axis] - a[axis])
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
    }
  }
  return result
}
const band = (poly, axis, from, to) => clip(clip(poly, axis, from, true), axis, to, false)

export function createApresTerrace(world) {
  const parts = []
  const at = (u, v, lift = 0) => {
    const { x, z } = terraceWorld(u, v)
    return [x, terrainHeight(x, z) + lift, z]
  }
  function panel(poly, color, lift) {
    if (poly.length < 3) return
    const shape = new THREE.Shape(poly.map(([u, v]) => new THREE.Vector2(u, v)))
    const geo = new THREE.ShapeGeometry(shape)
    geo.rotateX(-Math.PI / 2)
    const p = geo.attributes.position
    for (let i = 0; i < p.count; i++) p.setXYZ(i, ...at(p.getX(i), -p.getZ(i), lift))
    // Die Spiegelung der lokalen Tiefe kehrt die Dreiecksrichtung um.
    const idx = geo.index
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a)
    }
    geo.computeVertexNormals()
    parts.push({ geo, color })
  }
  // Jede Bohle wird an der gemeinsamen Grundrisskontur abgeschnitten und
  // quer in 0,6-m-Stuecke geteilt: ein Vieleck hat nur an seinen Ecken eine
  // Hoehe, und ueber die Rampe zwischen den Ebenen haette eine ungeteilte
  // Bohle bis 20 cm im Schnee gesteckt.
  const outline = APRES.outline
  const upper = clip(outline, 0, APRES.split, true)
  const lower = clip(outline, 0, APRES.split, false)
  for (let u = -9.6; u < 5; u += 0.6) for (let v = -7; v < 8.5; v += 0.6) panel(band(band(outline, 0, u, u + 0.6), 1, v, v + 0.6), DARK, 0.016)
  // Beide Ebenen mit Bohlen quer zum Bild; laengs liefen sie aus der
  // Spielkamera als senkrechte Streifen und das Sonnendeck las sich als
  // Bretterwand. Unten ist das Holz heller (Sonne), und die Stosskante
  // trennt die Ebenen.
  for (const [poly, light, dark] of [[upper, 0x96704e, 0x886044], [lower, 0xa88259, 0x987050]]) {
    for (let v = -7, i = 0; v < 8.2; v += 0.28, i++) {
      const row = band(poly, 1, v, v + 0.263)
      for (let u = -9.6; u < 5; u += 0.6) panel(band(row, 0, u, u + 0.6), i % 3 ? light : dark, 0.025)
    }
  }
  const floor = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.94, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }))
  floor.name = 'apres-terrassenboden'
  floor.receiveShadow = true
  world.scene.add(floor)

  // Zwei Gruppen oben neben dem Haus, eine auf dem Sonnendeck. Seit die
  // Huette mit der Tuer zur Piste steht, liegt ihre rechte Flanke dort, wo
  // vorher die Front war; die Gruppen sind davon weggerueckt, vor der Tuer
  // bleiben gut zwei Meter frei.
  const layouts = [[-1.9, 5.2, 0, 'parasol'], [2.4, 5.0, 0.08, 'table'], [-7.4, -1.8, Math.PI / 2 - 0.06, 'parasol']].map(([u, v, angle, kind]) => {
    const { x, z } = terraceWorld(u, v)
    return [x, z, APRES.house.yaw + angle, kind]
  })
  const material = vertexColorMaterial({ roughness: 0.85 })
  const geometries = { table: furnitureGeometry('table'), bench: furnitureGeometry('bench'), schirm: schirmGeometry() }
  const bodies = []
  const v = new THREE.Vector3()
  const neu = (kind, home, radius) => {
    const mesh = new THREE.Mesh(geometries[kind], material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.name = `terrasse-${kind}`
    const body = { mesh, kind, home, x: home.x, z: home.z, yaw: home.yaw, tiltX: 0, tiltZ: 0, targetX: 0, targetZ: 0, vx: 0, vz: 0, spin: 0, hold: 0, cooldown: 0, radius }
    bodies.push(body)
    world.scene.add(mesh)
    place(body)
    return body
  }
  // Auf jedem Tisch drei Kruege, wie beim Dosenwerfen: wer den Tisch trifft,
  // raeumt sie ab.
  const AUF_TISCH = [[-0.5, 0.18], [0.12, -0.22], [0.56, 0.12]]
  const becher = []
  for (const [x, z, yaw, art] of layouts) {
    let tisch = null
    for (const offset of [0, -1.15, 1.15]) {
      const home = { x: x + Math.sin(yaw) * offset, z: z + Math.cos(yaw) * offset, yaw }
      const body = neu(offset ? 'bench' : 'table', home, offset ? 0.7 : 0.82)
      if (!offset) tisch = body
    }
    if (art === 'parasol') tisch.schirm = neu('schirm', { x, z, yaw }, 0.3)
    for (const [bx, bz] of AUF_TISCH) becher.push({ tisch, bx, bz, teil: new Wurfteil(), weg: false })
  }
  const becherMesh = new THREE.InstancedMesh(becherGeometry(), material, becher.length)
  becherMesh.castShadow = true
  becherMesh.name = 'terrasse-becher'
  world.scene.add(becherMesh)

  const fixtures = [], bulbs = []
  const tube = (points, radius, color, segments = points.length * 2) =>
    fixtures.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 4, false), color })

  // Masten an der Aussenkante. Die Lichterketten spannen sich von Traufe und
  // Giebel zu ihnen und laufen die Kante entlang – Haus und beide Ebenen
  // gehoeren damit sichtbar zusammen. Die Birnen bunt wie in der Vorlage.
  const MAST = 3.1
  const masts = [[-8.4, -3.7], [-7.2, 2.9], [-2.4, 7.1], [3.4, 6.6]].map(([u, w]) => {
    const [x, y, z] = at(u, w)
    fixtures.push({ geo: new THREE.CylinderGeometry(0.055, 0.085, MAST, 7), color: DARK, position: [x, y + MAST / 2, z] })
    fixtures.push({ geo: new THREE.CylinderGeometry(0.1, 0.1, 0.1, 7), color: SNOW, position: [x, y + MAST + 0.05, z] })
    // Kein Hindernis: zwoelf Zentimeter Stange am Rand der Durchfahrt hielten
    // nur auf, ohne dass man sah, woran man haengen blieb (Wunsch 04.10.).
    return [x, y + MAST - 0.05, z]
  })
  const H = APRES.house, eave = H.height + 2.0, run = H.width / 2 + 0.4
  const corner = (hx, hz, y) => { const p = houseWorld(hx, hz); return [p.x, y, p.z] }
  const roofFL = corner(-run, H.depth / 2 + 0.3, eave), roofFR = corner(run, H.depth / 2 + 0.3, eave)
  const roofBL = corner(-run, -H.depth / 2, eave)
  let bulbIndex = 0
  function strand(a, b, sag) {
    const points = []
    for (let j = 0; j <= 20; j++) {
      const t = j / 20
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t])
    }
    tube(points, 0.015, 0x1b1b1b, 24)
    const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
    const n = Math.max(2, Math.round(length / 0.6))
    for (let j = 1; j < n; j++) {
      const t = j / n
      bulbs.push({
        geo: new THREE.SphereGeometry(0.07, 6, 4),
        color: BULBS[bulbIndex++ % BULBS.length],
        position: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t) - 0.07, a[2] + (b[2] - a[2]) * t],
      })
    }
  }
  strand(masts[0], masts[1], 0.4)
  strand(masts[1], masts[2], 0.45)
  strand(masts[2], masts[3], 0.45)
  strand(roofBL, masts[0], 0.35)
  strand(roofFL, masts[1], 0.4)
  strand(roofFR, masts[3], 0.35)

  // Wimpelkette tiefer zwischen den vorderen Masten, zur Kamera hin: dort,
  // wo das Gelaender der Vorlage war, ohne der Durchfahrt im Weg zu stehen.
  const flag = new THREE.Shape([new THREE.Vector2(-0.15, 0), new THREE.Vector2(0.15, 0), new THREE.Vector2(0, -0.32)])
  let flagIndex = 0
  for (const [a, b] of [[masts[1], masts[2]], [masts[2], masts[3]]]) {
    const low = 1.0, sag = 0.35
    const points = []
    const length = Math.hypot(b[0] - a[0], b[2] - a[2])
    const yaw = Math.atan2(a[2] - b[2], b[0] - a[0])
    for (let j = 0; j <= 12; j++) {
      const t = j / 12
      points.push([a[0] + (b[0] - a[0]) * t, a[1] - low + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t])
    }
    tube(points, 0.012, 0xe8e2d6, 16)
    for (let t = 0.4 / length; t < 1 - 0.2 / length; t += 0.42 / length) {
      fixtures.push({
        geo: new THREE.ExtrudeGeometry(flag, { depth: 0.012, bevelEnabled: false }),
        color: FLAGS[flagIndex++ % FLAGS.length],
        position: [a[0] + (b[0] - a[0]) * t, a[1] - low + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t],
        rotation: [0, yaw, 0],
      })
    }
  }

  // Gelaender mit Schneehaube nur an der hangseitigen Kante. Die Seite zur
  // Piste bleibt offen: dort faehrt man auf und ab.
  for (const [from, to] of [[[3.8, 2.6], [4.6, 4.4]], [[4.6, 4.4], [3.8, 6.8]]]) {
    const a = terraceWorld(...from), b = terraceWorld(...to)
    const top = [], mid = []
    for (let i = 0; i <= 4; i++) {
      const x = a.x + (b.x - a.x) * i / 4, z = a.z + (b.z - a.z) * i / 4, y = terrainHeight(x, z)
      fixtures.push({ geo: new THREE.BoxGeometry(0.12, 0.95, 0.12), color: DARK, position: [x, y + 0.475, z] })
      top.push([x, y + 0.95, z]); mid.push([x, y + 0.5, z])
      world.addCollider(x, z, 0.16)
    }
    tube(top, 0.06, WOOD, 8)
    tube(mid, 0.04, WOOD, 8)
    tube(top.map(([x, y, z]) => [x, y + 0.07, z]), 0.055, SNOW, 8)
  }

  // Die Stosskante zwischen den Ebenen: ein dunkler Balken quer ueber die
  // Rampe, hinten zwei Blumenkaesten mit Geranien. Sie lassen vorn gut sechs
  // Meter frei, dort faehrt man von einer Ebene auf die andere.
  const seam = []
  for (let w = -7; w < 8.5; w += 0.25) {
    const { x, z } = terraceWorld(APRES.split, w)
    if (terraceDistance(x, z) < -0.05) seam.push([x, terrainHeight(x, z) + 0.03, z])
  }
  if (seam.length > 1) tube(seam, 0.05, 0x46301f)
  for (const w of [-5.2, -3.4]) {
    const [x, y, z] = at(APRES.split, w)
    fixtures.push({ geo: new THREE.BoxGeometry(0.5, 0.45, 1.5), color: WOOD, position: [x, y + 0.22, z], rotation: [0, APRES.house.yaw, 0] })
    for (let i = 0; i < 5; i++) {
      const [fx, fy, fz] = at(APRES.split + (i % 2 ? 0.1 : -0.1), w - 0.6 + i * 0.3)
      fixtures.push({ geo: new THREE.SphereGeometry(0.13, 6, 4), color: i % 2 ? 0xd7263d : 0xe8452c, position: [fx, Math.max(fy, y) + 0.52, fz] })
    }
    for (const d of [-0.5, 0, 0.5]) {
      const p = terraceWorld(APRES.split, w + d)
      world.addCollider(p.x, p.z, 0.32)
    }
  }

  // Skistaender vorn an der rechten Kante, schraeg mit ihr: fuenf Paar Ski
  // und zwei Boards, angelehnt, die Belaege zur Kamera. Aus 33 m die bunteste
  // Stelle – und eine Reihe Dominosteine (umstossen.js). An der Rueckkante
  // des Sonnendecks stand er genau in der Linie von der Nordabfahrt nach
  // Osten; dort blieb ein Fahrer bei (14,9, −65,3) haengen.
  const staender = (() => {
    let A = terraceWorld(0.7, 7.6), B = terraceWorld(3.3, 6.55)
    // Lokal +z soll nach aussen zeigen, zur Kamera: dort stehen die Bretter
    // vor dem Holm, Bindungen nach vorn.
    const aussen = terraceWorld(0, 1)
    const ox = aussen.x - APRES.house.x, oz = aussen.z - APRES.house.z
    if (-(B.z - A.z) * ox + (B.x - A.x) * oz < 0) [A, B] = [B, A]
    const lx = B.x - A.x, lz = B.z - A.z, L = Math.hypot(lx, lz)
    const rx = lx / L, rz = lz / L
    const yaw = Math.atan2(-rz, rx)
    const fx = Math.sin(yaw), fz = Math.cos(yaw)
    const welt = (s, f) => ({ x: A.x + rx * s + fx * f, z: A.z + rz * s + fz * f })
    // Der Holm sitzt so hoch, dass nur die Spitzen darueber lehnen; bei 1,22 m
    // standen die oberen Drittel dahinter, und der Holm las sich als davor.
    const BAR = 1.45, LEHNE = 0.2, VOR = BAR * Math.tan(LEHNE)
    // Gestell: zwei Pfosten mit Kappe, Holm oben (mit Schnee), Querlatte
    // unten mit Kerben fuer die Enden, ein Brett als Fussleiste.
    const ya = terrainHeight(A.x, A.z), yb = terrainHeight(B.x, B.z)
    for (const [p, y] of [[A, ya], [B, yb]]) {
      fixtures.push({ geo: new THREE.BoxGeometry(0.13, BAR + 0.12, 0.13), color: DARK, position: [p.x, y + (BAR + 0.12) / 2, p.z], rotation: [0, yaw, 0] })
      fixtures.push({ geo: new THREE.BoxGeometry(0.19, 0.06, 0.19), color: SNOW, position: [p.x, y + BAR + 0.15, p.z], rotation: [0, yaw, 0] })
      for (const f of [-0.28, 0.28]) {
        const q = welt(p === A ? 0 : L, f)
        fixtures.push({ geo: new THREE.BoxGeometry(0.1, 0.08, 0.6), color: DARK, position: [q.x, y + 0.04, q.z], rotation: [0, yaw, 0] })
      }
    }
    tube([[A.x, ya + BAR, A.z], [B.x, yb + BAR, B.z]], 0.055, WOOD, 4)
    tube([[A.x, ya + BAR + 0.08, A.z], [B.x, yb + BAR + 0.08, B.z]], 0.05, SNOW, 4)
    const unten = [welt(0, VOR * 0.55), welt(L, VOR * 0.55)]
    tube([[unten[0].x, ya + 0.32, unten[0].z], [unten[1].x, yb + 0.32, unten[1].z]], 0.04, DARK, 4)
    const mitte = welt(L / 2, VOR + 0.06)
    fixtures.push({ geo: new THREE.BoxGeometry(L, 0.08, 0.2), color: WOOD, position: [mitte.x, (ya + yb) / 2 + 0.04, mitte.z], rotation: [0, yaw, 0] })
    // Kein Hindernis: vorher hielt eine Kette hinter dem Holm alle auf, die
    // von hinten kamen, und man blieb am Staender haengen statt ihn
    // abzuraeumen. Jetzt faehrt man durch und nimmt die Reihe mit, von
    // beiden Seiten (Wunsch 04.10.).

    const ARTEN = ['ski', 'ski', 'board', 'ski', 'ski', 'board', 'ski']
    const teile = ARTEN.map((art, i) => {
      const s = 0.3 + i * (L - 0.6) / (ARTEN.length - 1)
      const p = welt(s, VOR)
      return { art, s, x: p.x, z: p.z, y: terrainHeight(p.x, p.z) + 0.03 }
    })
    const reihe = new Kippreihe(teile.length, { abstand: (L - 0.6) / (ARTEN.length - 1) })
    const meshes = {}
    for (const [art, geo] of [['ski', skiGeometry()], ['board', boardGeometry()]]) {
      const n = teile.filter((t) => t.art === art).length
      const m = new THREE.InstancedMesh(geo, material, n)
      m.castShadow = true
      m.name = `terrasse-${art}`
      world.scene.add(m)
      meshes[art] = m
    }
    const FARBEN = { ski: [0xd9412f, 0x1f6fd1, 0xf2c230, 0x2fae7a, 0xf06292], board: [0x7b4fd6, 0xff8a1f] }
    const zaehler = { ski: 0, board: 0 }
    for (const t of teile) {
      t.slot = zaehler[t.art]++
      meshes[t.art].setColorAt(t.slot, new THREE.Color(FARBEN[t.art][t.slot % FARBEN[t.art].length]))
    }
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3()
    const zeichnen = () => {
      teile.forEach((t, i) => {
        const w = reihe.teile[i].winkel
        // Beim Kippen loest es sich vom Holm: die Lehne geht mit dem Winkel weg.
        const lehne = LEHNE * Math.max(0, 1 - Math.abs(w) / 0.6)
        e.set(-lehne, yaw, -w, 'YZX')
        q4.setFromEuler(e)
        m4.compose(pos.set(t.x, t.y, t.z), q4, one)
        meshes[t.art].setMatrixAt(t.slot, m4)
      })
      for (const m of Object.values(meshes)) m.instanceMatrix.needsUpdate = true
    }
    zeichnen()
    return { teile, reihe, zeichnen, rx, rz, ruhig: true }
  })()

  const frame = new THREE.Mesh(assemble(fixtures), material)
  frame.castShadow = true
  world.scene.add(frame)
  world.scene.add(new THREE.Mesh(assemble(bulbs), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })))

  function place(body) {
    const mesh = body.mesh
    // Ruhende Moebel brauchen keine 12 teuren Gelaendeproben pro Frame.
    const pose = [body.x, body.z, body.yaw, body.tiltX, body.tiltZ]
    if (body.lastPose && pose.every((value, i) => Math.abs(value - body.lastPose[i]) < 0.00001)) return
    body.lastPose = pose
    const c = Math.cos(body.yaw), s = Math.sin(body.yaw)
    const gx = (terrainHeight(body.x + 0.15, body.z) - terrainHeight(body.x - 0.15, body.z)) / 0.3
    const gz = (terrainHeight(body.x, body.z + 0.15) - terrainHeight(body.x, body.z - 0.15)) / 0.3
    mesh.rotation.set(body.tiltX - Math.atan(gx * s + gz * c), body.yaw, body.tiltZ + Math.atan(gx * c - gz * s), 'YXZ')
    const box = mesh.geometry.boundingBox
    let support = -Infinity
    // Der jeweils tiefste Punkt stuetzt das gekippte Moebel. Ohne diese
    // Rechnung verschwanden die Beine beim Umfallen unter den Bohlen.
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).applyEuler(mesh.rotation)
      support = Math.max(support, terrainHeight(body.x + v.x, body.z + v.z) - v.y)
    }
    mesh.position.set(body.x, support + 0.02, body.z)
  }

  // Becher folgen dem Tisch, bis er getroffen wird; dann fliegen sie selbst.
  const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), be = new THREE.Euler(), bp = new THREE.Vector3(), bs = new THREE.Vector3(1, 1, 1)
  function becherZeichnen() {
    becher.forEach((b, i) => {
      if (b.weg) {
        const t = b.teil
        be.set(t.kipp, t.dreh, 0, 'YXZ')
        bq.setFromEuler(be)
        bm.compose(bp.set(t.x, t.y, t.z), bq, bs)
      } else {
        b.tisch.mesh.updateMatrixWorld()
        bm.makeTranslation(b.bx, 0.44, b.bz).premultiply(b.tisch.mesh.matrixWorld)
      }
      becherMesh.setMatrixAt(i, bm)
    })
    becherMesh.instanceMatrix.needsUpdate = true
  }
  becherZeichnen()
  const boden = (x, z) => terrainHeight(x, z)
  // Das Haus ist fuer alles, was umfaellt, eine Wand. Vorher hielt nur der
  // Terrassenrand die Moebel auf, und ein getroffener Tisch rutschte durch
  // die Blockwand hinein.
  const imHaus = (x, z, rand = 0) => {
    const { hx, hz } = houseLocal(x, z)
    return Math.abs(hx) < APRES.house.width / 2 + 0.45 + rand && Math.abs(hz) < APRES.house.depth / 2 + 0.45 + rand
  }

  let previous = null, hits = 0
  // Ein Treffer: Moebel rutscht und kippt in Fahrtrichtung. Am Tisch fliegen
  // die Becher, und der Schirm darin bekommt seinen eigenen Stoss – er kippt
  // langsamer und weiter, weil oben das Gewicht sitzt.
  function treffen(b, skier, current, faktor = 1) {
    const force = Math.min(8.5, 1.5 + skier.speed * 0.5) * faktor
    b.vx = skier.forward.x * force
    b.vz = skier.forward.z * force
    b.spin = ((b.x - current.x) * skier.forward.z - (b.z - current.z) * skier.forward.x) * faktor
    // Gekippt wird im eigenen Rahmen des Moebels (die Neigungen liegen in
    // place() hinter der Drehung). In Weltkoordinaten gerechnet fiel alles
    // um seine eigene Drehung schraeg zur Fahrtrichtung, hier gut 45 Grad.
    const kipp = b.kind === 'schirm' ? 1.5 : 1.35
    const c = Math.cos(b.yaw), sn = Math.sin(b.yaw)
    const lx = skier.forward.x * c - skier.forward.z * sn
    const lz = skier.forward.x * sn + skier.forward.z * c
    b.targetX = lz * kipp
    b.targetZ = -lx * kipp
    b.hold = 10
    b.cooldown = 0.6
    hits++
    if (b.kind !== 'table') return
    for (const k of becher) {
      if (k.tisch !== b || k.weg) continue
      b.mesh.updateMatrixWorld()
      bp.set(k.bx, 0.44, k.bz).applyMatrix4(b.mesh.matrixWorld)
      const streu = (Math.random() - 0.5) * 2.4
      k.teil.werfen(bp.x, bp.y, bp.z,
        skier.forward.x * force * 0.8 + skier.forward.z * streu,
        2.2 + Math.random() * 1.6,
        skier.forward.z * force * 0.8 - skier.forward.x * streu,
        (Math.random() - 0.5) * 2)
      k.weg = true
    }
    if (b.schirm && b.schirm.cooldown === 0 && Math.hypot(b.schirm.x - b.home.x, b.schirm.z - b.home.z) < 0.6) {
      treffen(b.schirm, skier, current, 0.55)
    }
  }

  return {
    bodies,
    becher,
    staender,
    get hits() { return hits },
    update(dt, skier) {
      if (!skier || dt <= 0) return
      const current = skier.position
      const old = previous && previous.distanceTo(current) < 4 ? previous : current
      const dx = current.x - old.x, dz = current.z - old.z
      const length2 = dx * dx + dz * dz
      const faehrt = skier.speed > 1.2 && !skier.tow
      for (const b of bodies) {
        b.cooldown = Math.max(0, b.cooldown - dt)
        const t = length2 ? THREE.MathUtils.clamp(((b.x - old.x) * dx + (b.z - old.z) * dz) / length2, 0, 1) : 0
        const distance = Math.hypot(b.x - old.x - dx * t, b.z - old.z - dz * t)
        const near = Math.hypot(current.x - b.x, current.z - b.z)
        if (distance < b.radius + 0.55 && Math.abs(current.y - terrainHeight(b.x, b.z)) < 1.35 && faehrt && b.cooldown === 0) {
          treffen(b, skier, current)
        }
        if (b.hold > 0) {
          b.hold = Math.max(0, b.hold - dt)
          const k = b.kind === 'schirm' ? 5 : 12
          b.tiltX += (b.targetX - b.tiltX) * (1 - Math.exp(-k * dt))
          b.tiltZ += (b.targetZ - b.tiltZ) * (1 - Math.exp(-k * dt))
          b.x += b.vx * dt; b.z += b.vz * dt; b.yaw += b.spin * dt
          const drag = Math.exp(-2.2 * dt)
          b.vx *= drag; b.vz *= drag; b.spin *= drag
          // Moebel bleiben im Vorplatz, statt in die Park-Landungen zu driften,
          // und draussen vor der Hauswand.
          if (terraceDistance(b.x, b.z) > -0.6 || imHaus(b.x, b.z, b.kind === 'schirm' ? 0 : 0.35)) {
            b.x -= b.vx * dt; b.z -= b.vz * dt
            b.vx *= -0.25; b.vz *= -0.25
          }
          // Der Schirm lehnt sich an die Wand, statt mit dem Dach durch sie
          // hindurch zu kippen: so weit, wie Platz bis zur Wand ist.
          if (b.kind === 'schirm') {
            const tilt = Math.hypot(b.targetX, b.targetZ)
            if (tilt > 0) {
              // Kipprichtung zurueck in die Welt, wie in treffen().
              const lx = -b.targetZ / tilt, lz = b.targetX / tilt
              const c = Math.cos(b.yaw), sn = Math.sin(b.yaw)
              const dx = lx * c + lz * sn, dz = -lx * sn + lz * c
              let frei = 2.6
              for (let d = 0.2; d <= 2.6; d += 0.1) if (imHaus(b.x + dx * d, b.z + dz * d, -0.2)) { frei = d; break }
              const grenze = Math.asin(Math.min(1, frei / 2.5))
              if (tilt > grenze) { b.targetX *= grenze / tilt; b.targetZ *= grenze / tilt }
            }
          }
        } else if (near > 7 && Math.hypot(current.x - b.home.x, current.z - b.home.z) > 7) {
          const blend = 1 - Math.exp(-2.5 * dt)
          b.x += (b.home.x - b.x) * blend; b.z += (b.home.z - b.z) * blend
          b.yaw += Math.atan2(Math.sin(b.home.yaw - b.yaw), Math.cos(b.home.yaw - b.yaw)) * blend
          b.tiltX *= 1 - blend; b.tiltZ *= 1 - blend
        }
        place(b)
      }

      // Becher: fliegen, liegen, und wenn ihr Tisch wieder steht und keiner
      // hinschaut, stehen sie wieder darauf.
      let becherBewegt = false
      for (const k of becher) {
        if (!k.weg) { becherBewegt ||= k.tisch.hold > 0 || k.tisch.lastMove; continue }
        // Was am Boden liegt, raeumt man noch einmal ab: wie beim Dosenwerfen
        // fliegt ein liegender Krug weiter, wenn man durchfaehrt. Vorher lag
        // er nach dem ersten Treffer still und war fuer Ski nur Luft.
        if (!k.teil.fliegt && faehrt) {
          const q = k.teil
          const f = length2 ? THREE.MathUtils.clamp(((q.x - old.x) * dx + (q.z - old.z) * dz) / length2, 0, 1) : 0
          if (Math.hypot(q.x - old.x - dx * f, q.z - old.z - dz * f) < 0.5 && Math.abs(current.y - q.y) < 1) {
            const wucht = Math.min(9, 1.5 + skier.speed * 0.6)
            const streu = (Math.random() - 0.5) * 2
            q.werfen(q.x, q.y + 0.05, q.z,
              skier.forward.x * wucht + skier.forward.z * streu,
              1.6 + Math.random() * 1.8,
              skier.forward.z * wucht - skier.forward.x * streu,
              (Math.random() - 0.5) * 3)
          }
        }
        if (k.teil.fliegt) {
          const { x, z } = k.teil
          k.teil.update(dt, boden)
          if (imHaus(k.teil.x, k.teil.z, -0.3) && k.teil.y < APRES.house.height + 2.6) {
            k.teil.x = x; k.teil.z = z
            k.teil.vx *= -0.4; k.teil.vz *= -0.4
          }
          becherBewegt = true
        }
        const t = k.tisch
        if (t.hold === 0 && Math.hypot(t.x - t.home.x, t.z - t.home.z) < 0.05 && Math.hypot(current.x - t.home.x, current.z - t.home.z) > 7) {
          k.weg = false
          k.teil.liegt = false
          becherBewegt = true
        }
      }
      for (const b of bodies) if (b.kind === 'table') b.lastMove = b.hold > 0 || Math.hypot(b.x - b.home.x, b.z - b.home.z) > 0.001
      if (becherBewegt) becherZeichnen()

      // Skistaender: wer an einem Brett vorbeifaehrt, stoesst es laengs der
      // Reihe an – in Fahrtrichtung, oder von der Seite weg, wenn man quer
      // durch kommt. Von vorn oder hinten ist gleich: gemessen wird am
      // Wegstueck dieses Frames, sonst rutschte man mit 15 m/s (25 cm je
      // Frame) zwischen zwei Brettern durch.
      const st = staender
      if (faehrt) {
        st.teile.forEach((t, i) => {
          const r = st.reihe.teile[i]
          if (Math.abs(r.winkel) > 0.3) return
          const k = length2 ? THREE.MathUtils.clamp(((t.x - old.x) * dx + (t.z - old.z) * dz) / length2, 0, 1) : 0
          if (Math.hypot(t.x - old.x - dx * k, t.z - old.z - dz * k) > 0.6 || Math.abs(current.y - t.y) > 1.5) return
          const laengs = skier.forward.x * st.rx + skier.forward.z * st.rz
          const seite = (t.x - current.x) * st.rx + (t.z - current.z) * st.rz
          const richtung = Math.abs(laengs) > 0.25 ? Math.sign(laengs) : (Math.sign(seite) || 1)
          st.reihe.stoss(i, richtung, 1.4 + skier.speed * 0.22)
        })
      }
      const fern = st.teile.every((t) => Math.hypot(current.x - t.x, current.z - t.z) > 6)
      const vorher = st.reihe.steht
      st.reihe.update(dt, { aufstellen: fern })
      if (!vorher || !st.reihe.steht) st.zeichnen()

      if (!previous) previous = current.clone()
      else previous.copy(current)
    },
  }
}
