import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { CAMERA } from '../config.js'
import { terrainHeight } from './heightfield.js'
import { snowPaint } from './props/snow-paint.js'

// Die Radarfalle auf der freien Abfahrt: eine Linie im Schnee, eine kleine
// Kamera am Rand und ein Display, das anzeigt, wie schnell man durch war.
//
// Sie misst nichts, was man nicht ohnehin haette – aber sie macht daraus eine
// Zahl, und eine Zahl will man verbessern. Das ist der ganze Zweck: der Hang
// war vorher der Weg ohne Uhr, jetzt hat er einen Grund.
//
// Die Markierung bleibt bewusst blass. Eine Rennstrecke daneben hat schon
// Bogen, Banden und Stangen; wenn die freie Abfahrt genauso laut wird, sind
// es zwei Rennstrecken und keine Wahl mehr.

const POST = 0x5d666f
const BODY = 0x3a424c
const LENS = 0x8fd3ff
const BOARD = 0x1b222b
const FRAME = 0xd8dee6

function displayTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return { canvas, tex }
}

export class SpeedCheck {
  constructor(world, { x, z, dx, dz, width = 10, label = 'SPEEDCHECK' }) {
    this.world = world
    this.x = x
    this.z = z
    this.dx = dx
    this.dz = dz
    // Quer zur Fahrtrichtung.
    this.nx = dz
    this.nz = -dx
    this.width = width
    this.label = label

    this.last = null
    this.best = 0
    this._prevSide = null
    this._hold = 0

    this._build()
    this._draw()
  }

  _build() {
    const { x, z, dx, dz, nx, nz } = this
    const half = this.width / 2

    // --- Linie im Schnee ---------------------------------------------------
    const paint = snowPaint()
    paint.bar(x - nx * half, z - nz * half, x + nx * half, z + nz * half, 0.5, 0xa9c2dc)
    // Zwei kurze Striche daneben markieren die Breite, ohne die Linie zu
    // verstaerken – von oben sieht man daran, dass die Linie gemeint ist.
    for (const side of [-1, 1]) {
      const mx = x + nx * side * (half + 0.9)
      const mz = z + nz * side * (half + 0.9)
      paint.bar(mx - dx * 1.1, mz - dz * 1.1, mx + dx * 1.1, mz + dz * 1.1, 0.45, 0xa9c2dc)
    }
    this.world.scene.add(paint.build({ name: 'speedcheck-linie' }))

    // --- Kamera am Rand ----------------------------------------------------
    const camX = x - nx * (half + 1.6)
    const camZ = z - nz * (half + 1.6)
    const parts = []
    parts.push({ geo: new THREE.CylinderGeometry(0.07, 0.09, 2.4, 8), color: POST, position: [0, 1.2, 0] })
    parts.push({ geo: new THREE.BoxGeometry(0.34, 0.3, 0.5), color: BODY, position: [0, 2.42, 0.16] })
    // Objektiv, zur Bahn hin geneigt.
    parts.push({
      geo: new THREE.CylinderGeometry(0.11, 0.13, 0.26, 10),
      color: BODY,
      position: [0, 2.3, 0.44],
      rotation: [1.16, 0, 0],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.095, 0.095, 0.04, 10),
      color: LENS,
      position: [0, 2.24, 0.51],
      rotation: [1.16, 0, 0],
    })
    // Sonnenblende obendrauf
    parts.push({ geo: new THREE.BoxGeometry(0.4, 0.05, 0.34), color: POST, position: [0, 2.6, 0.28], rotation: [0.2, 0, 0] })
    const cam = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.55 }))
    cam.castShadow = true
    // Die Kamera schaut quer auf die Bahn, also entlang der Normalen.
    cam.position.set(camX, terrainHeight(camX, camZ), camZ)
    cam.rotation.y = Math.atan2(nx, nz)
    this.world.scene.add(cam)
    this.world.addCollider(camX, camZ, 0.35)
    this.camPost = { x: camX, z: camZ }

    // Ein kleines Blitzlicht, das beim Durchfahren angeht.
    const flash = new THREE.PointLight(0xbfe6ff, 0, 9, 2)
    flash.position.set(camX, terrainHeight(camX, camZ) + 2.4, camZ)
    this.world.scene.add(flash)
    this.flash = flash
  }

  // Das Display steht ein Stueck unterhalb der Linie am Rand: man faehrt
  // durch, schaut nach unten und sieht die Zahl schon stehen.
  buildDisplay(dx, dz) {
    const px = dx
    const pz = dz
    const parts = []
    for (const sx of [-1, 1]) {
      parts.push({
        geo: new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8),
        color: POST,
        position: [sx * 1.05, 0.95, 0],
      })
    }
    parts.push({ geo: new THREE.BoxGeometry(2.6, 1.32, 0.14), color: FRAME, position: [0, 2.0, 0], rotation: [-0.42, 0, 0] })
    parts.push({ geo: new THREE.BoxGeometry(2.38, 1.12, 0.06), color: BOARD, position: [0, 2.02, 0.09], rotation: [-0.42, 0, 0] })
    const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.6 }))
    mesh.castShadow = true

    const { canvas, tex } = displayTexture()
    this.canvas = canvas
    this.tex = tex
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 1.06),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    plate.position.set(0, 2.03, 0.125)
    plate.rotation.x = -0.42

    const group = new THREE.Group()
    group.add(mesh, plate)
    group.position.set(px, terrainHeight(px, pz), pz)
    // Displays zeigen in dieser Welt immer zur Kamera – sonst liest man sie
    // von hinten.
    group.rotation.y = CAMERA.azimuth
    this.world.scene.add(group)
    this.world.addCollider(px, pz, 0.6)
    return group
  }

  _draw() {
    if (!this.canvas) return
    const ctx = this.canvas.getContext('2d')
    ctx.clearRect(0, 0, 512, 256)
    ctx.textAlign = 'center'

    ctx.fillStyle = '#5c6b7d'
    ctx.font = '700 34px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    ctx.fillText(this.label, 256, 46)

    const value = this.last === null ? '--' : String(Math.round(this.last))
    ctx.fillStyle = this.last !== null && this.last >= this.best ? '#8ef0b4' : '#f2f7ff'
    ctx.font = '800 128px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    ctx.fillText(value, 214, 168)

    ctx.fillStyle = '#7f8fa2'
    ctx.font = '700 40px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
    ctx.fillText('km/h', 388, 168)

    if (this.best > 0) {
      ctx.fillStyle = '#6d7c8e'
      ctx.font = '600 30px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'
      ctx.fillText(`BESTE ${Math.round(this.best)}`, 256, 220)
    }
    this.tex.needsUpdate = true
  }

  update(dt, skier) {
    if (this.flash.intensity > 0) {
      this.flash.intensity = Math.max(0, this.flash.intensity - dt * 24)
    }

    // Auf welcher Seite der Linie steht der Fahrer? Das Vorzeichen entlang der
    // Fahrtrichtung genuegt – eine Triggerbox braucht es dafuer nicht.
    const rx = skier.position.x - this.x
    const rz = skier.position.z - this.z
    const along = rx * this.dx + rz * this.dz
    const across = Math.abs(rx * this.nx + rz * this.nz)
    const side = along >= 0 ? 1 : -1

    if (this._prevSide !== null && side !== this._prevSide && side > 0 && across < this.width / 2 + 1) {
      // Einheiten sind Meter, also ist Tempo mal 3,6 Kilometer je Stunde.
      const kmh = skier.speed * 3.6
      this.last = kmh
      if (kmh > this.best) this.best = kmh
      this._draw()
      this.flash.intensity = 7
    }
    this._prevSide = side
  }
}
