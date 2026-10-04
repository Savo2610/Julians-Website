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
  for (let s = 0; s <= la; s += schritt) {
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

// Das Rohr am oberen Ende des Bachs. Es kommt seitlich aus der Wand der
// Klamm, aus der, die zur Kamera schaut: zuerst stand es quer in der Sohle
// und zeigte bachab – aus der festen Kamera sah man dann nur die Rueckseite
// der Mauer und das Rohr dahinter. Seitlich steckt es im Hang, wie ein
// Durchlass unter einem Weg, und das Eis faellt als Zunge in das Bett.
// Wo das Rohr sitzt, ohne Szene – populate.js haelt dort Baeume weg.
export function rohrLage() {
  const ax0 = KLAMM.bis.x - KLAMM.von.x
  const az0 = KLAMM.bis.z - KLAMM.von.z
  const la = Math.hypot(ax0, az0)
  const ux = ax0 / la, uz = az0 / la, nx = -uz, nz = ux
  let s0 = null
  for (let s = 0; s <= la; s += 0.25) {
    const v = bachVersatz(s)
    if (-klammAt(KLAMM.von.x + ux * s + nx * v, KLAMM.von.z + uz * s + nz * v) >= 1.2) { s0 = s + 0.4; break }
  }
  if (s0 === null) return null
  // Heraus zeigt das Rohr zur Kamera hin (sie schaut von +x, +z).
  const vs = nx + nz > 0 ? 1 : -1
  const ax = nx * vs, az = nz * vs
  const v0 = bachVersatz(s0)
  const bx = KLAMM.von.x + ux * s0 + nx * v0
  const bz = KLAMM.von.z + uz * s0 + nz * v0
  const bettY = terrainHeight(bx, bz)
  // Die Muendung dort in der Wand, wo der Hang 0,35 m ueber dem Bett liegt.
  let d = 0.8
  while (d < 4 && terrainHeight(bx - ax * d, bz - az * d) < bettY + 0.35) d += 0.05
  return { ux, uz, ax, az, bx, bz, bettY, mx: bx - ax * d, mz: bz - az * d }
}

function createRohr(world) {
  const lage = rohrLage()
  if (!lage) return
  const { ux, uz, ax, az, bx, bz, bettY, mx, mz } = lage
  const R = 0.5
  const my = terrainHeight(mx, mz)
  const yc = my + R - 0.1
  const dreh = Math.atan2(ax, az)          // lokal +z zeigt aus dem Rohr heraus
  // q laengs der Klamm, l aus dem Rohr heraus.
  const welt = (q, h, l) => [mx + ux * q + ax * l, h, mz + uz * q + az * l]
  const teile = []
  const BLECH = 0x8e989f, BLECH_DUNKEL = 0x6d767c, INNEN = 0x1d2328

  // Das Rohr: offen, mit Wellen als Ringe, und innen dunkel.
  const L = 1.1
  const rohr = new THREE.CylinderGeometry(R, R, L, 18, 1, true)
  rohr.rotateX(Math.PI / 2)
  rohr.rotateY(dreh)
  teile.push({ geo: rohr, color: BLECH, position: welt(0, yc, 0.4 - L / 2) })
  for (let l = 0.4; l > 0.4 - L; l -= 0.18) {
    const ring = new THREE.TorusGeometry(R + 0.015, 0.025, 4, 18)
    ring.rotateY(dreh)
    teile.push({ geo: ring, color: BLECH_DUNKEL, position: welt(0, yc, l) })
  }
  const dunkel = new THREE.CircleGeometry(R - 0.02, 18)
  dunkel.rotateY(dreh)
  teile.push({ geo: dunkel, color: INNEN, position: welt(0, yc, -0.25) })

  // Die Stirnmauer: Bruchstein in Lagen, quer zum Bach, mit Schnee obenauf.
  const BREIT = 3.4, LAGE = 0.38
  let unten = Infinity
  for (let q = -BREIT / 2; q <= BREIT / 2 + 0.01; q += 0.4) { const p = welt(q, 0, -0.25); unten = Math.min(unten, terrainHeight(p[0], p[2])) }
  const oben = yc + R + 0.45
  let k = 0
  for (let y = unten - 0.2, lage = 0; y < oben - 0.05; y += LAGE, lage++) {
    let q = -BREIT / 2 - (lage % 2) * 0.3
    while (q < BREIT / 2) {
      const w = 0.6 + ((k * 37) % 5) * 0.1
      const q0 = Math.max(q, -BREIT / 2), q1 = Math.min(q + w, BREIT / 2)
      const h = Math.min(LAGE - 0.04, oben - y)
      k++
      q += w + 0.05
      if (q1 - q0 < 0.15) continue
      const qm = (q0 + q1) / 2
      // Nichts vor die Oeffnung.
      if (Math.abs(qm) < R + (q1 - q0) / 2 - 0.05 && y + h > yc - R && y < yc + R) {
        // Links und rechts der Oeffnung kurze Stuecke, darueber und darunter nichts.
        continue
      }
      const geo = new THREE.BoxGeometry(q1 - q0, h, 0.5)
      geo.rotateY(dreh)
      teile.push({ geo, color: (k + lage) % 3 ? STEIN : STEIN_HELL, position: welt(qm, y + h / 2, -0.25 - 0.02 * (k % 2)) })
    }
  }
  // Ueber dem Rohr ein Sturz aus einem Stein.
  const sturz = new THREE.BoxGeometry(R * 2 + 0.5, 0.3, 0.55)
  sturz.rotateY(dreh)
  teile.push({ geo: sturz, color: STEIN_HELL, position: welt(0, yc + R + 0.15, -0.25) })
  const kappe = new THREE.BoxGeometry(BREIT + 0.1, 0.12, 0.6)
  kappe.rotateY(dreh)
  teile.push({ geo: kappe, color: SCHNEE, position: welt(0, oben + 0.06, -0.25) })
  const rohrSchnee = new THREE.CylinderGeometry(R * 0.7, R * 0.7, 0.42, 10, 1, false, -Math.PI / 2, Math.PI)
  rohrSchnee.rotateX(Math.PI / 2)
  rohrSchnee.scale(1, 0.35, 1)
  rohrSchnee.rotateY(dreh)
  teile.push({ geo: rohrSchnee, color: SCHNEE, position: welt(0, yc + R, 0.2) })

  // Die gefrorene Zunge: aus dem Rohr ueber den Hang hinunter ins Bett.
  const a = welt(0, yc - R + 0.05, -0.1)
  const b = [bx + ax * 0.3, bettY + 0.12, bz + az * 0.3]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const zunge = new THREE.BoxGeometry(R * 1.5, 0.1, len)
  zunge.applyMatrix4(new THREE.Matrix4().makeRotationX(Math.atan2(a[1] - b[1], Math.hypot(b[0] - a[0], b[2] - a[2]))))
  zunge.rotateY(dreh)
  teile.push({ geo: zunge, color: 0x9fd8e4, position: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2] })
  // Eiszapfen am Rand der Oeffnung.
  for (let i = 0; i < 7; i++) {
    const w = -0.9 + i * 0.3
    const l = 0.12 + ((i * 5) % 3) * 0.07
    const zapfen = new THREE.ConeGeometry(0.03, l, 5)
    zapfen.rotateX(Math.PI)
    // Am oberen Bogen der Oeffnung, nach unten haengend.
    teile.push({ geo: zapfen, color: 0xdff3ff, position: welt(Math.sin(w) * R, yc + Math.cos(w) * R - l / 2, 0.42) })
  }

  const m = new THREE.Mesh(assemble(teile), vertexColorMaterial({ roughness: 0.75, side: THREE.DoubleSide }))
  m.castShadow = true
  m.receiveShadow = true
  m.name = 'bach-rohr'
  world.scene.add(m)
  // Die Mauer ist fest.
  for (const q of [-1.2, 0, 1.2]) {
    const p = welt(q, 0, -0.25)
    world.addCollider?.(p[0], p[2], 0.55)
  }
}
