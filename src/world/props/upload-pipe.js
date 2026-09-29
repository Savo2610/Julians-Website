import * as THREE from 'three'
import { assemble, tint, vertexColorMaterial } from '../../core/geometry.js'

// Die Uploadseite steckt als Rohrpost im Boden: ein Stahlrohr, das aus dem
// Schnee ragt, mit Trichter, Klappe und einem Pfeil nach unten. Aus dem Schacht
// steigt warme Luft – das erklaert den ausgeschmolzenen Ring ringsum.
//
// Die Sendung spielt, wenn das Fenster zugeht, nicht wenn es aufgeht: vorher
// schoss beim Oeffnen eine Kapsel heraus, bevor ueberhaupt etwas geschickt
// war. Jetzt faellt je Sendung eine Kapsel in den Trichter, das Rohr
// schluckt, und von unten laeuft die Spur zum Funkmast (rohrpost-netz.js).

const STEEL = 0x7b858f
const STEEL_DARK = 0x505a64
const RUST = 0x9a6746
const ACCENT = 0x37b87c

const TILT = 0.11            // das Rohr steht leicht schief
const MAX_KAPSELN = 5
const ABSTAND = 0.32         // s zwischen zwei Kapseln – plopp, plopp, plopp
const FALL = 0.42            // s vom Auftauchen bis in den Schlund
const SCHLUCK = 0.38         // s, bis eine Beule unten am Kragen ist

export function createUploadPipe() {
  const group = new THREE.Group()
  const parts = []

  // Betonkragen, aus dem das Rohr kommt
  parts.push({ geo: new THREE.CylinderGeometry(0.72, 0.85, 0.34, 12), color: 0x93999f, position: [0, 0.12, 0] })

  // Hauptrohr, leicht schief – als waere es schon lange da
  const tilt = TILT
  parts.push({
    geo: new THREE.CylinderGeometry(0.42, 0.44, 1.5, 14),
    color: STEEL,
    position: [0.08, 0.95, 0],
    rotation: [0, 0, -tilt],
  })
  // Verstaerkungsringe
  for (const y of [0.5, 1.15]) {
    parts.push({
      geo: new THREE.TorusGeometry(0.45, 0.05, 6, 16),
      color: STEEL_DARK,
      position: [0.08 + (y - 0.95) * tilt, y, 0],
      rotation: [Math.PI / 2, 0, -tilt],
    })
  }
  // Rostspur unten
  parts.push({
    geo: new THREE.CylinderGeometry(0.455, 0.46, 0.22, 14, 1, true),
    color: RUST,
    position: [0.13, 0.42, 0],
    rotation: [0, 0, -tilt],
  })

  // Trichter oben
  parts.push({
    geo: new THREE.CylinderGeometry(0.62, 0.42, 0.36, 14, 1, true),
    color: STEEL_DARK,
    position: [0.02, 1.82, 0],
    rotation: [0, 0, -tilt],
  })
  parts.push({
    geo: new THREE.TorusGeometry(0.62, 0.045, 6, 18),
    color: STEEL,
    position: [0.0, 1.99, 0],
    rotation: [Math.PI / 2, 0, -tilt],
  })

  // Scharnier der Klappe; die Klappe selbst bewegt sich und steht unten.
  parts.push({
    geo: new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6),
    color: STEEL_DARK,
    position: [-0.5, 1.98, 0],
    rotation: [Math.PI / 2, 0, 0],
  })

  // Pfeil nach unten am Rohr: hier kommt etwas rein.
  parts.push({ geo: new THREE.BoxGeometry(0.1, 0.34, 0.03), color: ACCENT, position: [0.1, 1.15, 0.44] })
  parts.push({
    geo: new THREE.ConeGeometry(0.13, 0.18, 4),
    color: ACCENT,
    position: [0.1, 0.92, 0.44],
    rotation: [0, Math.PI / 4, Math.PI],
  })

  const body = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.5, metalness: 0.45 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // --- Klappe ----------------------------------------------------------------
  // Am Scharnier links am Trichterrand. 0 ist zu, dann liegt sie auf dem
  // Trichter; in Ruhe steht sie nach links hinten offen, und waehrend das
  // Fenster offen ist, klappt sie ganz auf: hier kommt gleich etwas rein.
  const ZU = 0
  const RUHE = 1.95
  const WEIT = 2.45
  const scharnier = new THREE.Group()
  scharnier.position.set(-0.62, 2.02, 0)
  const klappe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.05, 14),
    vertexColorMaterial({ roughness: 0.5, metalness: 0.45 }),
  )
  tint(klappe.geometry, ACCENT)
  klappe.position.set(0.6, 0.03, 0)
  klappe.castShadow = true
  scharnier.add(klappe)
  group.add(scharnier)
  let klappeZiel = RUHE
  let klappeWinkel = RUHE
  let klappeTempo = 0
  // Feder: zuschlagen soll klappern, nicht gleiten.
  const klappen = (dt) => {
    const kraft = (klappeZiel - klappeWinkel) * 170 - klappeTempo * 13
    klappeTempo += kraft * dt
    klappeWinkel += klappeTempo * dt
    if (klappeWinkel < ZU) { klappeWinkel = ZU; klappeTempo *= -0.35 }
    scharnier.rotation.z = -TILT + klappeWinkel
  }

  // --- Kapseln --------------------------------------------------------------
  // Eine je Sendung, hoechstens fuenf. Sie fallen von oben in den Trichter
  // und verschwinden im Schlund; eine gescheiterte wird wieder ausgespuckt.
  const kapselGeo = assemble([
    { geo: new THREE.CapsuleGeometry(0.19, 0.34, 4, 10), color: ACCENT },
    { geo: new THREE.ConeGeometry(0.19, 0.24, 10), color: 0x2b9668, position: [0, 0.36, 0] },
    { geo: new THREE.TorusGeometry(0.2, 0.03, 5, 12), color: 0xf2f7f4, position: [0, 0.04, 0], rotation: [Math.PI / 2, 0, 0] },
    // Drei Finnen unten
    ...[0, 1, 2].map((i) => ({
      geo: new THREE.BoxGeometry(0.05, 0.2, 0.16),
      color: 0x2b9668,
      position: [Math.sin((i / 3) * Math.PI * 2) * 0.18, -0.26, Math.cos((i / 3) * Math.PI * 2) * 0.18],
      rotation: [0, -(i / 3) * Math.PI * 2, 0],
    })),
  ])
  const kapselMat = vertexColorMaterial({ roughness: 0.42, metalness: 0.2 })
  const kapseln = []
  for (let i = 0; i < MAX_KAPSELN; i++) {
    const k = new THREE.Mesh(kapselGeo, kapselMat)
    k.castShadow = true
    k.visible = false
    group.add(k)
    kapseln.push(k)
  }

  // Die Beule, die durchs Rohr nach unten wandert: ein Ring, etwas dicker
  // als das Rohr, der kurz aufquillt – das Rohr schluckt.
  const beule = new THREE.Mesh(
    new THREE.CylinderGeometry(0.5, 0.5, 0.26, 14),
    vertexColorMaterial({ roughness: 0.5, metalness: 0.45 }),
  )
  tint(beule.geometry, STEEL)
  beule.visible = false
  group.add(beule)

  // Woelkchen: Schnee am Kragen, Dampf und Rauch aus dem Schlund.
  const puffs = []
  const puffGeo = new THREE.IcosahedronGeometry(0.16, 1)
  for (let i = 0; i < 12; i++) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdfe8ee, transparent: true, opacity: 0, roughness: 1, flatShading: true, depthWrite: false,
    })
    const mesh = new THREE.Mesh(puffGeo, mat)
    mesh.visible = false
    group.add(mesh)
    puffs.push({ mesh, mat, alter: -1, dauer: 1, v: new THREE.Vector3() })
  }
  const woelkchen = (x, y, z, { anzahl = 4, farbe = 0xdfe8ee, streuung = 1, hoch = 0.8, dauer = 0.9 } = {}) => {
    let n = 0
    for (const p of puffs) {
      if (p.alter >= 0 || n >= anzahl) continue
      const w = (n / anzahl) * Math.PI * 2 + Math.random() * 0.6
      p.mesh.position.set(x, y, z)
      p.v.set(Math.cos(w) * streuung, hoch + Math.random() * 0.4, Math.sin(w) * streuung)
      p.mat.color.setHex(farbe)
      p.alter = 0
      p.dauer = dauer
      p.mesh.visible = true
      n++
    }
  }

  // Ablauf als Liste von Zeitpunkten, abgespielt in animate().
  let uhr = 0
  let ablauf = []
  const fallend = []     // { k, t0 }
  const schlucke = []    // Startzeiten der Beulen
  let spuck = null       // { k, t0, ziel }
  const LAUNCH_Y = 1.97

  // Weltpunkt vor dem Rohr, wo eine ausgespuckte Kapsel landet: zur Kamera
  // hin und etwas rechts, damit sie nicht hinter dem Kragen liegt.
  const landepunkt = () => {
    const lokal = new THREE.Vector3(0.9, 0, 2.3)
    const welt = group.localToWorld(lokal.clone())
    lokal.y = boden(welt.x, welt.z) - group.position.y + 0.19
    return lokal
  }
  let boden = () => group.position.y

  group.userData.setBoden = (f) => { boden = f }

  // Das Fenster geht auf: Klappe weit auf, es wird gleich etwas eingeworfen.
  group.userData.oeffnen = () => { klappeZiel = WEIT }

  // Das Fenster ging zu, ohne dass etwas geschickt wurde: die Klappe faellt
  // zu, ein Hauch Dampf, und nach einer Weile steht sie wieder offen. Hmpf.
  group.userData.hmpf = () => {
    uhr = 0
    ablauf = [
      { t: 0, tun: () => { klappeZiel = ZU } },
      { t: 0.22, tun: () => woelkchen(0, 2.1, 0, { anzahl: 2, streuung: 0.25, hoch: 0.5, dauer: 0.8 }) },
      { t: 1.4, tun: () => { klappeZiel = RUHE } },
    ]
  }

  // n Kapseln hinein, danach bei Bedarf eine wieder heraus. Gibt zurueck,
  // wann die letzte unten ankommt – ab da darf die Spur loslaufen.
  group.userData.versenden = ({ n = 0, fehler = false } = {}) => {
    n = Math.min(n, MAX_KAPSELN - (fehler ? 1 : 0))
    uhr = 0
    ablauf = []
    const alle = n + (fehler ? 1 : 0)
    klappeZiel = WEIT
    for (let i = 0; i < alle; i++) {
      const t0 = 0.25 + i * ABSTAND
      ablauf.push({ t: t0, tun: () => fallend.push({ k: kapseln[i], t0 }) })
      ablauf.push({ t: t0 + FALL, tun: () => schlucke.push(t0 + FALL) })
    }
    const zu = 0.25 + (alle - 1) * ABSTAND + FALL + 0.05
    ablauf.push({ t: zu, tun: () => { klappeZiel = ZU } })
    const unten = zu + SCHLUCK
    ablauf.push({ t: unten, tun: () => woelkchen(0, 0.3, 0, { anzahl: 5, streuung: 0.9, hoch: 0.6 }) })
    if (fehler) {
      // Das Rohr hustet: die letzte Kapsel kommt zurueck, mit Rauch.
      const t = unten + 0.35
      ablauf.push({ t, tun: () => { klappeZiel = WEIT + 0.2; klappeTempo = 14 } })
      ablauf.push({
        t: t + 0.05,
        tun: () => {
          spuck = { k: kapseln[alle - 1], t0: t + 0.05, ziel: landepunkt() }
          woelkchen(0, 2.1, 0, { anzahl: 5, farbe: 0x6d737a, streuung: 0.45, hoch: 1.2, dauer: 1.3 })
        },
      })
      ablauf.push({ t: t + 1.6, tun: () => { klappeZiel = RUHE } })
    } else {
      ablauf.push({ t: unten + 0.6, tun: () => { klappeZiel = RUHE } })
    }
    // Beim Husten wartet die Spur, bis die Kapsel im Schnee liegt – sonst
    // faehrt die Kamera dem Maulwurf nach, bevor man sie fliegen sieht.
    return { unten: n > 0 ? unten + (fehler ? 1.9 : 0.1) : null }
  }

  group.userData.animate = (t, dt = 1 / 60) => {
    uhr += dt
    while (ablauf.length && ablauf[0].t <= uhr) ablauf.shift().tun()
    klappen(Math.min(dt, 1 / 30))

    // Fallende Kapseln: von 1,4 m ueber dem Trichter in den Schlund, mit
    // etwas Drall; im Schlund werden sie kleiner und sind weg.
    for (let i = fallend.length - 1; i >= 0; i--) {
      const { k, t0 } = fallend[i]
      const u = (uhr - t0) / FALL
      if (u >= 1) { k.visible = false; fallend.splice(i, 1); continue }
      k.visible = true
      k.position.set(0.02, LAUNCH_Y + 1.4 * (1 - u * u) - 0.2 * u, 0)
      k.rotation.set(Math.PI + 0.3 * (1 - u), u * 2, 0.25 * (1 - u))
      k.scale.setScalar(u > 0.8 ? 1 - (u - 0.8) * 4 : 1)
    }

    // Beulen: je Kapsel eine, von oben nach unten durchs schiefe Rohr.
    let beuleDa = false
    for (let i = schlucke.length - 1; i >= 0; i--) {
      const u = (uhr - schlucke[i]) / SCHLUCK
      if (u >= 1) { schlucke.splice(i, 1); continue }
      const y = 1.7 - u * 1.35
      beule.position.set(0.08 + (y - 0.95) * TILT, y, 0)
      beule.rotation.z = -TILT
      const q = Math.sin(u * Math.PI)
      beule.scale.set(0.92 + q * 0.14, 1, 0.92 + q * 0.14)
      beuleDa = true
    }
    beule.visible = beuleDa

    // Ausgespuckt: Bogen aus dem Schlund bis vors Rohr, dann ein paar
    // Handbreit rollen, liegen bleiben und langsam einsinken.
    if (spuck) {
      const { k, t0, ziel } = spuck
      const a = uhr - t0
      k.visible = true
      k.scale.setScalar(1)
      if (a < 0.7) {
        const u = a / 0.7
        k.position.set(0.02 + (ziel.x - 0.02) * u, LAUNCH_Y + (ziel.y - LAUNCH_Y) * u + 2.2 * Math.sin(u * Math.PI), ziel.z * u)
        k.rotation.set(u * 5, u * 2, u * 3)
      } else {
        const r = Math.min(1, (a - 0.7) / 0.6)
        const roll = 1 - (1 - r) * (1 - r)
        k.position.set(ziel.x + roll * 0.35, ziel.y, ziel.z + roll * 0.25)
        k.rotation.set(Math.PI / 2, 0.6, 3.5 + roll * 2.4)
        if (a > 6) k.position.y = ziel.y - Math.min(1, (a - 6) / 1.5) * 0.45
        if (a > 7.5) { k.visible = false; spuck = null }
      }
    }

    for (const p of puffs) {
      if (p.alter < 0) continue
      p.alter += dt
      const u = p.alter / p.dauer
      if (u >= 1) { p.alter = -1; p.mesh.visible = false; continue }
      p.mesh.position.addScaledVector(p.v, dt)
      p.v.multiplyScalar(1 - dt * 2.2)
      p.mesh.scale.setScalar(0.6 + u * 1.6)
      p.mat.opacity = 0.55 * (1 - u)
    }
  }

  // Dunkler Schlund – verschluckt das Licht, damit das Rohr tief wirkt.
  const throat = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 14),
    new THREE.MeshBasicMaterial({ color: 0x0b1016 }),
  )
  throat.rotation.x = -Math.PI / 2
  throat.position.set(0.0, 1.97, 0)
  group.add(throat)

  return group
}
