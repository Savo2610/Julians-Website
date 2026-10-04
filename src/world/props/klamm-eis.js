import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight, KLAMM, klammAt, bachVersatz } from '../heightfield.js'

// Ein zugefrorener Bach in der Sohle der Klamm.
//
// Er ist die Tiefe, die man sonst nicht sieht: viereinhalb Meter Rinne in
// einem Hang aus Schnee haben aus der festen Kamera keine Kante, und seit an
// Steg und Schanze kein Fels mehr liegen darf (er stuende in Spur und
// Flugbahn), fehlte ihr dort auch die. Ein blaugruenes Band unten in der
// Rinne sagt sofort: da unten ist Grund, und er ist weit weg.
//
// Das erste Band lag fuenf Zentimeter ueber dem Grund und folgte ihm – eine
// Farbe auf dem Schnee, die aussah wie aufgemalt. Jetzt liegt im Grund ein
// Bachbett (KLAMM.bach in heightfield.js), und das Eis ist darin eine ebene
// Flaeche, quer waagerecht wie gefrorenes Wasser. Wo sie die Boeschung des
// Bettes schneidet, ist das Ufer: unregelmaessig, weil es aus dem Gelaende
// kommt und nicht aus einer Breite. Dazu ein paar Steine am Ufer.
//
// Er laeuft unter der Bruecke durch: seit 04.10. traegt sie selbst (stegDeck
// in heightfield.js), und die Klamm ist darunter offen. Ein tieferes Bett
// mit Schneelippen an den Ufern (dritte Runde) sah schlechter aus als dieses
// – es las sich wie eine Strasse mit Bordstein – und ist wieder weg.

const EIS = new THREE.Color(0x9fd8e4)
const EIS_TIEF = new THREE.Color(0x6fb3c9)
const RISS = new THREE.Color(0xd9f1f6)
const STEIN = 0x7d838c
const STEIN_HELL = 0x9aa0a8
const SCHNEE = 0xf7fbff

// Wie hoch das Eis ueber der tiefsten Stelle des Bettes steht. Es schwankt
// laengs ein wenig – dadurch wird der Bach mal breiter, mal schmaler.
const pegel = (s) => 0.11 + 0.035 * Math.sin(s * 0.73) + 0.02 * Math.sin(s * 1.9 + 0.4)

export function createKlammEis(world, { schritt = 0.5 } = {}) {
  const ax = KLAMM.bis.x - KLAMM.von.x
  const az = KLAMM.bis.z - KLAMM.von.z
  const la = Math.hypot(ax, az)
  const ux = ax / la
  const uz = az / la
  const nx = -uz
  const nz = ux
  const halb = KLAMM.bach.breite

  const pos = []
  const col = []
  const idx = []
  const quer = 7
  let reihe = 0
  let offen = false
  // Das Eis beginnt an der Muendung des Rohrs (createRohr).
  const ab = rohrLage()?.s0 ?? 0
  for (let s = ab; s <= la; s += schritt) {
    const v = bachVersatz(s)
    const mx = KLAMM.von.x + ux * s + nx * v
    const mz = KLAMM.von.z + uz * s + nz * v
    // Nur, wo die Rinne wirklich tief ist.
    const tief = -klammAt(mx, mz)
    if (tief < 1.2) { offen = false; continue }
    const y = terrainHeight(mx, mz) + pegel(s)
    for (let i = 0; i < quer; i++) {
      const o = (i / (quer - 1) - 0.5) * 2 * halb
      pos.push(mx + nx * o, y, mz + nz * o)
      // Laengs dunkler und heller in Schlieren, dazu feine helle Risse quer
      // ueber das Eis – nur hier und da, nicht ueberall.
      const c = EIS.clone().lerp(EIS_TIEF, 0.5 + 0.5 * Math.sin(s * 0.9 + o * 1.7))
      if (Math.sin(s * 2.3 + o * 0.8) > 0.93 && Math.abs(o) < halb * 0.6) c.lerp(RISS, 0.6)
      col.push(c.r, c.g, c.b)
    }
    if (offen) {
      const a = (reihe - 1) * quer
      const b = reihe * quer
      for (let i = 0; i < quer - 1; i++) idx.push(a + i, b + i, a + i + 1, a + i + 1, b + i, b + i + 1)
    }
    offen = true
    reihe++
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  // Die Dreiecke laufen je nach Richtung der Klamm andersherum; einseitig
  // gezeichnet waere das halbe Band unsichtbar. Undurchsichtig, also ohne
  // die Kosten, die DoubleSide bei transparenten Materialien hat.
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.2, metalness: 0.05, side: THREE.DoubleSide,
  }))
  mesh.receiveShadow = true
  world.scene.add(mesh)

  // Steine am Ufer, abwechselnd links und rechts, mit Schneekappe. Nur, wo
  // die Rinne schon tief ist.
  const steine = []
  let k = 0
  for (let s = 6; s < la - 6; s += 3.2 + ((k * 7) % 5) * 0.6) {
    k++
    const seite = k % 2 ? 1 : -1
    const o = bachVersatz(s) + seite * (halb * 0.85 + ((k * 3) % 4) * 0.12)
    const x = KLAMM.von.x + ux * s + nx * o
    const z = KLAMM.von.z + uz * s + nz * o
    if (-klammAt(x, z) < 1.5) continue
    const r = 0.22 + ((k * 5) % 6) * 0.06
    const y = terrainHeight(x, z)
    const fels = new THREE.IcosahedronGeometry(r, 0)
    fels.scale(1.2, 0.7, 1)
    steine.push({ geo: fels, color: k % 3 ? STEIN : STEIN_HELL, position: [x, y + r * 0.25, z], rotation: [0, k * 1.7, 0] })
    const kappe = new THREE.SphereGeometry(r * 0.8, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2)
    kappe.scale(1.2, 0.35, 1)
    steine.push({ geo: kappe, color: SCHNEE, position: [x, y + r * 0.6, z], rotation: [0, k * 1.7, 0] })
    // Ein kleinerer daneben, bei jedem dritten.
    if (k % 3 === 0) {
      const r2 = r * 0.55
      const x2 = x + ux * (r + r2) * 1.1
      const z2 = z + uz * (r + r2) * 1.1
      const klein = new THREE.IcosahedronGeometry(r2, 0)
      klein.scale(1.1, 0.75, 1)
      steine.push({ geo: klein, color: STEIN_HELL, position: [x2, terrainHeight(x2, z2) + r2 * 0.2, z2], rotation: [0, k, 0] })
    }
  }
  if (steine.length) {
    const fels = new THREE.Mesh(assemble(steine), vertexColorMaterial({ roughness: 0.9 }))
    fels.castShadow = true
    fels.receiveShadow = true
    world.scene.add(fels)
  }
  // Wo der Bach anfaengt, kommt er aus einem Rohr (Wunsch 04.10.): vorher
  // begann das Eis einfach mitten im Hang. Ein Wellblechrohr in einer
  // Stirnmauer, das Eis laeuft als gefrorene Zunge heraus.
  createRohr(world)
  return mesh
}

// Das Rohr am oberen Ende des Bachs: ein Betonrohr, das bachab aus dem Hang
// kommt, dort, wo die Rinne zwei Meter tief ist – flacher, und das Rohr
// (1,8 m aussen) ragte oben aus der Klamm. Erst war es ein Wellblechrohr in
// einer Mauer, dann kam es seitlich aus der hinteren Wand; gewuenscht ist
// es links aus dem Berg, massiv, und gerade bachab – man sieht es von der
// Seite (04.10.).
const ROHR = { aussen: 0.9, innen: 0.62, tief: 2.0 }

// Wo das Rohr sitzt, ohne Szene – populate.js haelt dort Baeume weg, und das
// Eis beginnt an seiner Muendung.
export function rohrLage() {
  const kx = KLAMM.bis.x - KLAMM.von.x
  const kz = KLAMM.bis.z - KLAMM.von.z
  const la = Math.hypot(kx, kz)
  const ux = kx / la, uz = kz / la, nx = -uz, nz = ux
  let s0 = null
  for (let s = 0; s <= la; s += 0.25) {
    const v = bachVersatz(s)
    if (-klammAt(KLAMM.von.x + ux * s + nx * v, KLAMM.von.z + uz * s + nz * v) >= ROHR.tief) { s0 = s; break }
  }
  if (s0 === null) return null
  let ax = ux, az = uz
  const l = Math.hypot(ax, az)
  ax /= l; az /= l
  const v0 = bachVersatz(s0)
  const mx = KLAMM.von.x + ux * s0 + nx * v0
  const mz = KLAMM.von.z + uz * s0 + nz * v0
  return { s0, ax, az, mx, mz, bettY: terrainHeight(mx, mz) }
}

function createRohr(world) {
  const lage = rohrLage()
  if (!lage) return
  const { ax, az, mx, mz, bettY } = lage
  const { aussen: RO, innen: RI } = ROHR
  const yc = bettY + RI - 0.06
  const dreh = Math.atan2(ax, az)          // lokal +z zeigt aus dem Rohr heraus
  // q quer (nach rechts, wenn man herausschaut), l aus dem Rohr heraus.
  const qx = az, qz = -ax
  const welt = (q, h, l) => [mx + qx * q + ax * l, h, mz + qz * q + az * l]
  const teile = []
  const BETON = 0xa3a39c, BETON_HELL = 0xb9b8b0, BETON_DUNKEL = 0x5e5f5c, INNEN = 0x1f2326
  const rohr = (geo, color, l) => {
    geo.rotateX(Math.PI / 2)
    geo.rotateY(dreh)
    teile.push({ geo, color, position: welt(0, yc, l) })
  }

  // Ein langes Stueck, das im Hang verschwindet: aussen, innen, die Stirn.
  const L = 5
  rohr(new THREE.CylinderGeometry(RO, RO, L, 24, 1, true), BETON, -L / 2)
  rohr(new THREE.CylinderGeometry(RI, RI, L, 24, 1, true), BETON_DUNKEL, -L / 2)
  const stirn = new THREE.RingGeometry(RI, RO + 0.12, 24)
  stirn.rotateY(dreh)
  teile.push({ geo: stirn, color: BETON_HELL, position: welt(0, yc, 0.01) })
  // Muffe an der Muendung und eine Fuge weiter hinten: so liest es sich als
  // gegossenes Rohr und nicht als Zylinder.
  rohr(new THREE.CylinderGeometry(RO + 0.12, RO + 0.12, 0.45, 24, 1, true), BETON_HELL, -0.22)
  rohr(new THREE.CylinderGeometry(RO + 0.04, RO + 0.04, 0.08, 24, 1, true), BETON_DUNKEL, -1.6)
  const dunkel = new THREE.CircleGeometry(RI - 0.01, 24)
  dunkel.rotateY(dreh)
  teile.push({ geo: dunkel, color: INNEN, position: welt(0, yc, -0.9) })

  // Schnee auf dem Rohr, ein flacher Wulst laengs.
  const kappe = new THREE.CylinderGeometry(RO * 0.75, RO * 0.75, L - 0.2, 12, 1, false, -Math.PI / 2, Math.PI)
  kappe.scale(1, 1, 0.35)
  kappe.rotateX(Math.PI / 2)
  kappe.rotateY(dreh)
  teile.push({ geo: kappe, color: SCHNEE, position: welt(0, yc + RO - 0.02, -L / 2 - 0.15) })

  // Der Hang, aus dem es kommt: eine Schneewehe ueber dem hinteren Teil.
  // Die Rinne steigt bachauf zu langsam an, und ohne sie lag das Rohr drei
  // Meter frei mit abgeschnittenem Ende im Schnee.
  const wehe = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
  wehe.scale(RO + 1.3, RO * 2 + 0.25, 3.2)
  wehe.rotateY(dreh)
  teile.push({ geo: wehe, color: SCHNEE, position: welt(0, bettY - 0.3, -3.6) })

  // Steine, wo das Rohr aus dem Hang kommt und neben der Muendung.
  for (const [q, l, r] of [[-1.15, -0.7, 0.42], [1.2, -0.9, 0.38], [-1.0, 0.35, 0.26], [1.05, 0.25, 0.3]]) {
    const p = welt(q, 0, l)
    const fels = new THREE.IcosahedronGeometry(r, 0)
    fels.scale(1.2, 0.75, 1)
    const y = terrainHeight(p[0], p[2])
    teile.push({ geo: fels, color: (q > 0) ? STEIN : STEIN_HELL, position: [p[0], y + r * 0.3, p[2]], rotation: [0, q * 2, 0] })
    const hut = new THREE.SphereGeometry(r * 0.8, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2)
    hut.scale(1.2, 0.35, 1)
    teile.push({ geo: hut, color: SCHNEE, position: [p[0], y + r * 0.62, p[2]], rotation: [0, q * 2, 0] })
  }

  // Die gefrorene Zunge: aus dem Rohr hinunter aufs Eis.
  const a = welt(0, yc - RI + 0.04, -0.6)
  const b = welt(0, bettY + 0.1, 1.4)
  b[1] = terrainHeight(b[0], b[2]) + 0.11
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const zunge = new THREE.BoxGeometry(RI * 1.5, 0.1, len)
  zunge.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.atan2(a[1] - b[1], Math.hypot(b[0] - a[0], b[2] - a[2]))))
  zunge.rotateY(dreh)
  teile.push({ geo: zunge, color: 0x9fd8e4, position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] })
  // Eiszapfen am oberen Rand der Oeffnung.
  for (let i = 0; i < 9; i++) {
    const w = -1.0 + i * 0.25
    const l = 0.14 + ((i * 5) % 3) * 0.09
    const zapfen = new THREE.ConeGeometry(0.035, l, 5)
    zapfen.rotateX(Math.PI)
    teile.push({ geo: zapfen, color: 0xdff3ff, position: welt(Math.sin(w) * RI, yc + Math.cos(w) * RI - l / 2, -0.05) })
  }

  const m = new THREE.Mesh(assemble(teile), vertexColorMaterial({ roughness: 0.9, side: THREE.DoubleSide }))
  m.castShadow = true
  m.receiveShadow = true
  m.name = 'bach-rohr'
  world.scene.add(m)
  // Das Rohr ist fest, soweit es aus dem Hang ragt.
  for (const l of [-0.4, -1.6, -2.8]) {
    const p = welt(0, 0, l)
    if (terrainHeight(p[0], p[2]) < yc + RO - 0.3) world.addCollider?.(p[0], p[2], RO)
  }
}
