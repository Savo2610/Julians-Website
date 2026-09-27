import * as THREE from 'three'
import { assemble, vertexColorMaterial, snowDust } from '../../core/geometry.js'

// Kleiner Sendeturm hinter der gefrorenen Quelle: rot-weisses Gittermaennchen
// mit Huette, Schuessel und Warnlicht. Er erklaert, woher das Bild im Eis
// kommt, und bleibt dabei ein Spielzeug – 3,4 m hoch, kleiner als der
// Eisfall (4,4 m), damit er ihm nicht die Schau stiehlt.
// Die Vorderseite (+z) schaut zur Kamera, +x ist rechts im Bild.

const RED = 0xe0493c
const WHITE = 0xf3f1ec
const STEEL = 0x7d8691
const HUT = 0x8a5a3b
const HUT_DARK = 0x6b4430
const ROOF = 0x4d5a66
const SNOW = 0xf7fbff
const WINDOW = 0xffd27a

const HEIGHT = 3.4
const BANDS = 5
const up = new THREE.Vector3(0, 1, 0)

// Zylinder von a nach b – daraus ist das ganze Gitter.
function strut(a, b, r, color) {
  const d = new THREE.Vector3().subVectors(b, a)
  const geo = new THREE.CylinderGeometry(r, r, d.length(), 5, 1)
  const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize())
  const mid = a.clone().add(b).multiplyScalar(0.5)
  geo.applyQuaternion(q)
  geo.translate(mid.x, mid.y, mid.z)
  return { geo, color }
}

// Weicher runder Lichthof; ohne Textur zeichnet ein Sprite ein Quadrat.
function haloTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export function createRadioTower() {
  const parts = []

  // Drei Beine, oben eng: bei 0,5 m Spreizung unten und 0,12 m oben wirkt
  // er gedrungen und freundlich statt wie ein echter Funkmast.
  const legAt = (y, k) => {
    const s = THREE.MathUtils.lerp(0.5, 0.12, y / HEIGHT)
    const a = k * Math.PI * 2 / 3 + Math.PI / 6
    return new THREE.Vector3(Math.cos(a) * s, y, Math.sin(a) * s)
  }
  for (let i = 0; i < BANDS; i++) {
    const y0 = (i / BANDS) * HEIGHT
    const y1 = ((i + 1) / BANDS) * HEIGHT
    const color = i % 2 ? WHITE : RED
    for (let k = 0; k < 3; k++) {
      const a0 = legAt(y0, k), a1 = legAt(y1, k)
      const b0 = legAt(y0, (k + 1) % 3), b1 = legAt(y1, (k + 1) % 3)
      parts.push(strut(a0, a1, 0.045, color))
      parts.push(strut(a1, b1, 0.03, color))
      parts.push(strut(a0, b1, 0.022, color))
    }
  }

  // Plattform, Antennenstab und Lampensockel.
  parts.push({ geo: new THREE.CylinderGeometry(0.24, 0.2, 0.08, 10), color: WHITE, position: [0, HEIGHT + 0.04, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.26, 0.26, 0.05, 10), color: SNOW, position: [0, HEIGHT + 0.1, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.025, 0.035, 0.7, 6), color: STEEL, position: [0, HEIGHT + 0.45, 0] })
  parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.05, 8), color: STEEL, position: [0, HEIGHT + 0.82, 0] })

  // Zwei Stummelantennen seitlich, damit die Silhouette nach Sender aussieht.
  for (const side of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(0.06, 0.34, 0.06), color: WHITE, position: [side * 0.2, HEIGHT - 0.35, 0.06] })
  }

  // Schuessel auf zwei Dritteln Hoehe, halb zur Quelle rechts, halb zur
  // Kamera gedreht, damit man ihre Schale sieht.
  const dish = new THREE.SphereGeometry(0.28, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.32)
  dish.rotateX(Math.PI / 2)
  dish.rotateY(0.9)
  dish.translate(0.26, HEIGHT * 0.62, 0.12)
  parts.push({ geo: dish, color: WHITE })
  parts.push(strut(new THREE.Vector3(0.1, HEIGHT * 0.62, 0.02), new THREE.Vector3(0.26, HEIGHT * 0.62, 0.12), 0.03, STEEL))
  parts.push(strut(new THREE.Vector3(0.26, HEIGHT * 0.62, 0.12), new THREE.Vector3(0.5, HEIGHT * 0.62 + 0.03, 0.29), 0.012, STEEL))

  // Huette am Fuss, links vom Mast, mit Satteldach und warmem Fenster.
  const hx = -0.85, hz = 0.2
  parts.push({ geo: new THREE.BoxGeometry(0.9, 0.7, 0.72), color: HUT, position: [hx, 0.35, hz] })
  for (let i = 0; i < 4; i++) {
    parts.push({ geo: new THREE.BoxGeometry(0.92, 0.03, 0.74), color: HUT_DARK, position: [hx, 0.12 + i * 0.16, hz] })
  }
  for (const side of [-1, 1]) {
    parts.push({ geo: new THREE.BoxGeometry(1.06, 0.07, 0.5), color: ROOF, position: [hx, 0.86, hz + side * 0.2], rotation: [side * 0.62, 0, 0] })
    parts.push({ geo: new THREE.BoxGeometry(1.08, 0.06, 0.5), color: SNOW, position: [hx, 0.91, hz + side * 0.2], rotation: [side * 0.62, 0, 0] })
  }
  const gable = new THREE.CylinderGeometry(0.43, 0.43, 0.88, 3, 1)
  gable.rotateZ(Math.PI / 2)
  gable.rotateX(Math.PI / 2)
  gable.scale(1, 0.55, 0.84)
  gable.translate(hx, 0.7 + 0.1, hz)
  parts.push({ geo: gable, color: HUT })
  parts.push({ geo: new THREE.BoxGeometry(0.26, 0.44, 0.03), color: HUT_DARK, position: [hx - 0.22, 0.22, hz + 0.37] })
  parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), color: STEEL, position: [hx + 0.3, 1.0, hz - 0.15] })

  // Kabel von der Huette zum Mast.
  parts.push(strut(new THREE.Vector3(hx + 0.45, 0.55, hz), new THREE.Vector3(-0.2, 0.9, 0.1), 0.018, 0x2b2f35))

  const group = new THREE.Group()
  const body = new THREE.Mesh(snowDust(assemble(parts), 0.8, 0.55), vertexColorMaterial({ roughness: 0.6 }))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  // Fenster und Warnlicht leuchten selbst.
  const windowMat = new THREE.MeshBasicMaterial({ color: WINDOW })
  const win = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.2), windowMat)
  win.position.set(hx + 0.16, 0.42, hz + 0.37)
  group.add(win)
  const lampMat = new THREE.MeshStandardMaterial({ color: RED, emissive: new THREE.Color(RED), emissiveIntensity: 1, roughness: 0.3 })
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), lampMat)
  lamp.position.set(0, HEIGHT + 0.9, 0)
  group.add(lamp)
  const haloMat = new THREE.SpriteMaterial({ map: haloTexture(), color: 0xff5a48, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  const halo = new THREE.Sprite(haloMat)
  halo.scale.setScalar(0.55)
  halo.position.copy(lamp.position)
  group.add(halo)

  // Funkwellen: drei Bogenpaare wie im Symbol, die nur waehrend einer
  // Sendung von der Spitze wegwandern. In der Bildebene, weil sich die
  // Kamera nie dreht.
  const waveMat = () => new THREE.MeshBasicMaterial({
    // Rot statt additiv: vor Himmel und Schnee wuerde Licht nur weiss.
    color: 0xff6b5a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  })
  const arc = new THREE.RingGeometry(0.9, 1, 20, 1, -Math.PI / 4.5, Math.PI / 2.25)
  const waves = []
  for (let i = 0; i < 3; i++) {
    const w = new THREE.Group()
    const mat = waveMat()
    w.add(new THREE.Mesh(arc, mat))
    const left = new THREE.Mesh(arc, mat)
    left.rotation.z = Math.PI
    w.add(left)
    w.position.copy(lamp.position)
    w.renderOrder = 2
    group.add(w)
    waves.push({ w, mat, phase: i / 3 })
  }

  // Schneewehe um den Fuss.
  const drift = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.5)
  drift.scale(1.5, 0.22, 1.1)
  drift.translate(-0.35, -0.04, 0.1)
  const driftMesh = new THREE.Mesh(drift, new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.95 }))
  driftMesh.receiveShadow = true
  group.add(driftMesh)

  let live = 0
  let liveTarget = 0
  group.userData.setLive = (v) => { liveTarget = v ? 1 : 0 }
  // Mast und Huette als zwei Kreise; die Welt rechnet sie in ihre
  // Koordinaten um.
  group.userData.colliders = () => {
    group.updateMatrixWorld(true)
    return [[0, 0, 0.6], [hx, hz, 0.6]].map(([x, z, r]) => {
      const p = group.localToWorld(new THREE.Vector3(x, 0, z))
      return { x: p.x, z: p.z, r }
    })
  }
  group.userData.animate = (t, dt = 1 / 60) => {
    live += (liveTarget - live) * Math.min(1, dt * 2)
    // Warnlicht: ein kurzes Aufblitzen je 1,6 s, auf Sendung doppelt so oft.
    const period = live > 0.5 ? 0.8 : 1.6
    const f = (t % period) / period
    const blink = Math.exp(-f * 9)
    lampMat.emissiveIntensity = 0.35 + blink * 2.2
    haloMat.opacity = blink * 0.55
    // Fenster flackert leicht, als laeuft drinnen ein Bildschirm.
    windowMat.color.setHex(WINDOW).multiplyScalar(0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 2.1))
    for (const wave of waves) {
      const p = (t * 0.45 + wave.phase) % 1
      wave.w.scale.setScalar(0.25 + p * 0.85)
      wave.mat.opacity = live * Math.sin(p * Math.PI) * 0.7
      wave.w.visible = live > 0.01
    }
  }
  group.userData.animate(0)
  return group
}
