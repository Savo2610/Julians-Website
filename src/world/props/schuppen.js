import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { SCHUPPEN, schuppenWelt } from '../heightfield.js'

// Der Schuppen der Pistenraupe: eine Holzhalle mit verschneitem Satteldach,
// an der langen Wand zur Kamera Schild und Fenster, hinten am Giebel ein
// Rolltor zum Auslauf der Nordabfahrt. Tagsueber ist das Tor zu; nachts faehrt es
// hoch, wenn die Raupe ausrueckt, und schliesst sich hinter ihr, wenn sie
// zurueckkommt (world/pistenraupe.js). Die Halle steht auf dem ebenen Platz
// aus dem Hoehenfeld (SCHUPPEN), innen 5,2 m breit und 7,2 m tief – die
// Raupe ist mit Schild 3,4 m breit und mit Fraese 5,1 m lang.

const HOLZ = 0x6e4a30
const HOLZ_HELL = 0x8a5e3b
const HOLZ_DUNKEL = 0x4b3222
const STEIN = 0x6e7178
const SCHNEE = 0xf7fbff
const SCHNEE_SCHATTEN = 0xdfe9f5
const TOR = 0x8f979e
const TOR_DUNKEL = 0x6d747b
const INNEN = 0x2a2420

export const TOR_B = 4.2
export const TOR_H = 3.1
const WAND = 3.5

export function createSchuppen(world) {
  const S = SCHUPPEN
  const B = S.halbB - 0.15   // Aussenkante der Waende
  const T = S.halbT
  const group = new THREE.Group()
  const teile = []
  const p = (geo, color, position, rotation) => teile.push({ geo, color, position, rotation })

  // Steinsockel ringsum, dann Bohlenwaende. Vorn zwei Wandstuecke neben dem
  // Tor und der Sturz darueber.
  p(new THREE.BoxGeometry(2 * B + 0.2, 0.35, 0.3), STEIN, [0, 0.17, T])
  for (const sx of [-1, 1]) p(new THREE.BoxGeometry(0.3, 0.35, 2 * T), STEIN, [sx * B, 0.17, 0])
  for (let i = 0; i < 9; i++) {
    const y = 0.5 + i * 0.36
    const farbe = i % 2 ? HOLZ : HOLZ_HELL
    p(new THREE.BoxGeometry(2 * B, 0.34, 0.2), farbe, [0, y, T])
    for (const sx of [-1, 1]) p(new THREE.BoxGeometry(0.2, 0.34, 2 * T), i % 2 ? HOLZ_HELL : HOLZ, [sx * B, y, 0])
    // Hinten nur neben und ueber dem Tor.
    const neben = B - TOR_B / 2
    for (const sx of [-1, 1]) p(new THREE.BoxGeometry(neben, 0.34, 0.2), farbe, [sx * (TOR_B / 2 + neben / 2), y, -T])
    if (y > TOR_H) p(new THREE.BoxGeometry(TOR_B, 0.34, 0.2), farbe, [0, y, -T])
  }
  // Ecksaeulen und ein dunkler Torrahmen.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p(new THREE.BoxGeometry(0.28, WAND, 0.28), HOLZ_DUNKEL, [sx * B, WAND / 2, sz * T])
  for (const sx of [-1, 1]) p(new THREE.BoxGeometry(0.18, TOR_H, 0.3), HOLZ_DUNKEL, [sx * (TOR_B / 2 + 0.09), TOR_H / 2, -T - 0.02])
  p(new THREE.BoxGeometry(TOR_B + 0.4, 0.24, 0.32), HOLZ_DUNKEL, [0, TOR_H + 0.1, -T - 0.02])
  // Innen dunkel, damit man durchs offene Tor nicht in den Schnee schaut.
  p(new THREE.BoxGeometry(2 * B - 0.3, 0.04, 2 * T - 0.3), INNEN, [0, 0.03, 0])
  p(new THREE.BoxGeometry(2 * B - 0.3, WAND - 0.2, 0.05), INNEN, [0, WAND / 2, T - 0.15])

  // Giebel und Satteldach, laengs zur Tiefe. Der Giebel zeigt zur Kamera.
  const first = 1.35
  const giebel = new THREE.Shape()
  giebel.moveTo(-B - 0.1, 0)
  giebel.lineTo(B + 0.1, 0)
  giebel.lineTo(0, first)
  giebel.closePath()
  for (const sz of [-1, 1]) p(new THREE.ExtrudeGeometry(giebel, { depth: 0.18, bevelEnabled: false }), HOLZ_DUNKEL, [0, WAND, sz * T - 0.09])
  const neigung = Math.atan2(first, B + 0.1)
  const lauf = (B + 0.55) / Math.cos(neigung)
  for (const sx of [-1, 1]) {
    const cx = sx * (B + 0.55) / 2
    const cy = WAND + first - ((B + 0.55) / 2) * Math.tan(neigung)
    const nx = sx * Math.sin(neigung)
    const ny = Math.cos(neigung)
    p(new THREE.BoxGeometry(lauf, 0.14, 2 * T + 0.8), HOLZ_DUNKEL, [cx, cy, 0], [0, 0, -sx * neigung])
    p(new THREE.BoxGeometry(lauf - 0.05, 0.3, 2 * T + 0.75), sx > 0 ? SCHNEE : SCHNEE_SCHATTEN, [cx + nx * 0.22, cy + ny * 0.22, 0], [0, 0, -sx * neigung])
  }
  p(new THREE.CylinderGeometry(0.16, 0.16, 2 * T + 0.75, 8), SCHNEE, [0, WAND + first + 0.3, 0], [Math.PI / 2, 0, 0])
  // Eine Laterne ueber dem Tor und eine am Giebel.
  p(new THREE.BoxGeometry(0.22, 0.26, 0.2), 0x18191c, [TOR_B / 2 - 0.3, TOR_H + 0.45, -T - 0.2])
  p(new THREE.BoxGeometry(0.22, 0.26, 0.2), 0x18191c, [1.5, 2.4, T + 0.2])

  const mesh = new THREE.Mesh(assemble(teile), vertexColorMaterial({ roughness: 0.82 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)

  for (const [x, y, z] of [[TOR_B / 2 - 0.3, TOR_H + 0.45, -T - 0.21], [1.5, 2.4, T + 0.21]]) {
    const licht = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.21), new THREE.MeshBasicMaterial({ color: 0xffcf7a, toneMapped: false }))
    licht.position.set(x, y, z)
    group.add(licht)
  }
  // Zur Kamera zeigt vor allem die lange Wand bei +x (gemessen: 89 % des
  // Blicks gegen 45 % fuer den Giebel). Dort sitzen Fenster und Schild, sonst
  // sah man einen Bretterverschlag und das Schild schraeg am Giebel.
  for (const z of [-1.6, 1.6]) {
    const fenster = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, 1.0), new THREE.MeshBasicMaterial({ color: 0xffc46e, toneMapped: false }))
    fenster.position.set(B + 0.11, 1.75, z)
    group.add(fenster)
  }

  // Das Rolltor: waagerechte Lamellen. Hochgefahren schiebt es sich unter
  // den Sturz; dafuer wird es von unten her kuerzer (scale.y am oberen Rand).
  const lamellen = []
  for (let i = 0; i < 10; i++) {
    lamellen.push({ geo: new THREE.BoxGeometry(TOR_B, TOR_H / 10 - 0.02, 0.08), color: i % 2 ? TOR : TOR_DUNKEL, position: [0, -(i + 0.5) * (TOR_H / 10), 0] })
  }
  const tor = new THREE.Mesh(assemble(lamellen), vertexColorMaterial({ roughness: 0.45, metalness: 0.3 }))
  tor.castShadow = true
  tor.position.set(0, TOR_H, -T - 0.05)
  group.add(tor)

  // Schild am Giebel.
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#3d2614'
  g.fillRect(0, 0, 512, 128)
  g.strokeStyle = '#d9c39a'
  g.lineWidth = 6
  g.strokeRect(8, 8, 496, 112)
  g.fillStyle = '#f4e4c2'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '900 64px Rockwell, "Roboto Slab", "Courier New", Georgia, serif'
  g.fillText('PISTENDIENST', 256, 68, 470)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const schild = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }))
  schild.position.set(B + 0.13, WAND - 0.55, 0)
  schild.rotation.y = Math.PI / 2
  group.add(schild)

  const mitte = schuppenWelt(0, 0)
  world.place(group, mitte.x, mitte.z, { rotation: S.gier })
  group.position.y = S.h

  // Kollision fuer Waende und Rueckseite: Kreise im Abstand von gut einem
  // Meter. Hinten nur die Wandstuecke neben dem Tor – durchs Tor kommt die Raupe.
  const kreis = (lx, lz) => {
    const w = schuppenWelt(lx, lz)
    world.addCollider(w.x, w.z, 0.55)
  }
  for (let lx = -B; lx <= B + 0.01; lx += (2 * B) / 5) kreis(lx, T)
  for (const sx of [-1, 1]) for (let lz = -T + 1.2; lz <= T; lz += 1.2) kreis(sx * B, lz)
  for (const sx of [-1, 1]) kreis(sx * (B - 0.25), -T)

  let offen = 0
  return {
    group,
    // 0 zu, 1 ganz offen.
    get offen() { return offen },
    setzeTor(wert) {
      offen = Math.max(0, Math.min(1, wert))
      tor.scale.y = Math.max(0.04, 1 - offen)
    },
  }
}
