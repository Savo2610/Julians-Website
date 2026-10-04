import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { CAMERA } from '../../config.js'
import { terrainHeight, SCHANZE } from '../heightfield.js'
import { ohneSpur } from '../surfaces.js'

// Was man von der Klammschanze sieht. Befahren wird sie im Hoehenfeld
// (SCHANZE in heightfield.js) – hier steht nur, was sie als gebaute Schanze
// lesbar macht: Seitenbretter an der Rampe, ein Schanzentisch aus Holz vorn
// an der Kante und die Weitenmarken im Landehuegel.
//
// Ohne die Bretter war die Rampe aus 33 Metern ein Buckel im Schnee wie jeder
// andere; erst die zwei dunklen Linien sagen "hier wird gesprungen", und zwar
// schon von oben am Startbogen.

const HOLZ = 0x5f3f28
const HOLZ_HELL = 0x8a6340
const SCHNEE = 0xf7fbff
const ROT = 0xd8462f
const BLAU = 0x2f6bd8
const SNOW_WEISS = 0xf2f2ee

// Weltpunkt aus Schanzenkoordinaten (u laengs ab der Kante, v quer).
function punkt(u, v) {
  return {
    x: SCHANZE.x + SCHANZE.dx * u - SCHANZE.dz * v,
    z: SCHANZE.z + SCHANZE.dz * u + SCHANZE.dx * v,
  }
}

// Ein Brett von a nach b (Weltpunkte mit y), hochkant.
function brett(parts, a, b, hoch, dick, color) {
  const d = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z)
  const len = d.length()
  const geo = new THREE.BoxGeometry(len, hoch, dick)
  // Erst um die Hochachse in die Richtung, dann um die eigene Querachse
  // geneigt – so bleibt das Brett senkrecht stehen und kippt nicht zur Seite.
  const yaw = Math.atan2(-d.z, d.x)
  const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z))
  geo.applyMatrix4(new THREE.Matrix4().makeRotationZ(pitch))
  geo.applyMatrix4(new THREE.Matrix4().makeRotationY(yaw))
  parts.push({ geo, color, position: [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2] })
}

// Kleine Tafel mit einer Zahl, zur Kamera gedreht wie jede Schrift im Tal.
function zahlTafel(text, farbe) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f4efe6'
  ctx.fillRect(0, 0, 128, 64)
  ctx.fillStyle = farbe
  ctx.fillRect(0, 0, 128, 8)
  ctx.font = '800 40px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#1b2430'
  ctx.fillText(text, 64, 38)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: tex }))
  return plate
}

export const WEITEN = [15, 20, 25]

export function createKlammSchanze(world) {
  const S = SCHANZE
  const parts = []
  const auf = (p, dy = 0) => ({ x: p.x, y: terrainHeight(p.x, p.z) + dy, z: p.z })

  // --- Seitenbretter an der Rampe -----------------------------------------
  // Sie stehen auf der flachen Breite der Rampe, nicht an ihrem Fuss: dort
  // waeren sie unter der Flanke begraben.
  for (const sv of [-1, 1]) {
    const v = sv * (S.halb + 0.1)
    let prev = null
    for (let u = -S.laenge + 0.6; u <= 0.01; u += 0.5) {
      const p = auf(punkt(u, v), 0.12)
      if (prev) brett(parts, prev, p, 0.5, 0.09, HOLZ)
      prev = p
    }
    // Ein Pfosten am Ende jedes Bretts, mit Schneekappe.
    const ende = auf(punkt(0, v))
    parts.push({ geo: new THREE.BoxGeometry(0.2, 0.9, 0.2), color: HOLZ, position: [ende.x, ende.y + 0.2, ende.z] })
    parts.push({ geo: new THREE.BoxGeometry(0.26, 0.07, 0.26), color: SCHNEE, position: [ende.x, ende.y + 0.68, ende.z] })
  }

  // --- Schanzentisch ------------------------------------------------------
  // Die Stirn der Kante ist eine Wand aus Bohlen. Die Rampe bricht im
  // Hoehenfeld auf einem halben Meter ab (sonst rollte man in die Klamm statt
  // abzuheben); ohne Holz davor sah die Kante aus wie abgebrochener Schnee.
  const kante = auf(punkt(0, 0))
  const yaw = Math.atan2(-S.dz, S.dx)
  for (let i = 0; i < 6; i++) {
    const y = kante.y - 0.22 - i * 0.42
    const p = punkt(0.22, 0)
    parts.push({
      geo: new THREE.BoxGeometry(0.12, 0.38, S.halb * 2 + 0.3),
      color: i % 2 ? HOLZ : HOLZ_HELL,
      position: [p.x, y, p.z],
      rotation: [0, yaw, 0],
    })
  }
  ohneSpur([[punkt(0.05, -S.halb).x, punkt(0.05, -S.halb).z], [punkt(0.05, S.halb).x, punkt(0.05, S.halb).z]], 0.08)
  // Die Kante selbst rot-weiss, wie man sie an jeder Schanze anzeichnet.
  for (let i = 0; i < 7; i++) {
    const v = (i / 6 - 0.5) * S.halb * 2
    const p = punkt(0.05, v)
    parts.push({
      geo: new THREE.BoxGeometry(0.16, 0.08, (S.halb * 2) / 7 + 0.02),
      color: i % 2 ? SNOW_WEISS : ROT,
      position: [p.x, kante.y - 0.03, p.z],
      rotation: [0, yaw, 0],
    })
  }

  // --- Weitenmarken im Landehuegel ------------------------------------------
  // Quer ueber die Landung gespruehte Linien wie an jeder Sprungschanze: blau
  // je fuenf Meter, die zwanzig rot. Sie folgen dem Gelaende in kurzen
  // Stuecken und liegen drei Zentimeter darauf, sonst sticht der Schnee durch.
  const tafeln = []
  for (const w of WEITEN) {
    let prev = null
    const spur = []
    for (let v = -S.halb - 0.6; v <= S.halb + 0.61; v += 0.55) {
      const p = auf(punkt(w, v), 0.03)
      if (prev) brett(parts, prev, p, 0.04, 0.2, w === 20 ? ROT : BLAU)
      prev = p
      spur.push([p.x, p.z])
    }
    // Keine Spur ueber der Linie, sonst ist sie nach drei Landungen weg.
    ohneSpur(spur, 0.1)
    // Die Zahl steht auf der Kameraseite neben der Landung.
    const t = punkt(w, S.halb + 1.4)
    const y = terrainHeight(t.x, t.z)
    parts.push({ geo: new THREE.BoxGeometry(0.08, 1.2, 0.08), color: HOLZ, position: [t.x, y + 0.6, t.z] })
    const tafel = zahlTafel(`${w} m`, w === 20 ? '#d8462f' : '#2f6bd8')
    tafel.position.set(t.x, y + 1.25, t.z)
    tafel.rotation.set(-0.35, CAMERA.azimuth, 0, 'YXZ')
    world.scene.add(tafel)
    tafeln.push(tafel)
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.85 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  world.scene.add(mesh)

  // Die Pfosten am Ende der Seitenbretter sind feste Hindernisse.
  for (const sv of [-1, 1]) {
    const e = punkt(0, sv * (S.halb + 0.1))
    world.addCollider(e.x, e.z, 0.2)
  }

  mesh.userData.animate = () => {}
  return mesh
}
