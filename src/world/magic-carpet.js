import * as THREE from 'three'
import { assemble, vertexColorMaterial, labelTexture } from '../core/geometry.js'
import { CAMERA } from '../config.js'
import { terrainHeight } from './heightfield.js'
import { KINDER_COLORS } from './props/kinderland.js'

// Der fliegende Teppich: ein Foerderband im Schnee, das den Fahrer den Hang
// hinauftraegt. Anders als am Schlepplift haelt man sich an nichts fest – man
// steht einfach drauf. Deshalb setzt er `grab: false`, und der Fahrer laesst
// den Arm unten.
//
// Das Band ist ein Streifen entlang der Trasse mit einer Streifentextur. Die
// Bewegung entsteht dadurch, dass die Textur wandert – hundert einzelne
// Rippen waeren hundertmal so teuer und saehen genauso aus.
//
// Der Teppich liegt auf dem Kinderland-Band, das den Hang auf gleichmaessige
// 18 Grad zieht. Ohne dieses Band gaebe es keine Trasse, auf der ein
// Foerderband ueberhaupt liegen koennte: gewachsen ist der Hang in der Mitte
// 34 Grad steil und an den Enden fast eben.

const BELT_WIDTH = 1.5
const RAIL_HEIGHT = 0.5

// Die Streifen des Bandes. Dunkles Gummi mit hellen Querrippen – von oben
// erkennt man daran sofort die Laufrichtung.
function beltTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#39414a'
  ctx.fillRect(0, 0, 16, 64)
  ctx.fillStyle = '#525c67'
  for (let i = 0; i < 4; i++) ctx.fillRect(0, i * 16, 16, 6)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class MagicCarpet {
  constructor(world, { base, top, speed = 5.0, label = 'ZAUBERTEPPICH' }) {
    this.world = world
    this.speed = speed
    this.base = new THREE.Vector2(base.x, base.z)
    this.top = new THREE.Vector2(top.x, top.z)

    const delta = this.top.clone().sub(this.base)
    this.length = delta.length()
    this.dir = delta.clone().normalize()
    this.side = new THREE.Vector2(-this.dir.y, this.dir.x)
    this.heading = Math.atan2(this.dir.x, this.dir.y)

    this.baseY = terrainHeight(this.base.x, this.base.y)
    this.topY = terrainHeight(this.top.x, this.top.y)
    this.pitch = Math.atan2(this.topY - this.baseY, this.length)

    this.group = new THREE.Group()
    world.scene.add(this.group)

    this._buildBelt()
    this._buildStations(label)

    this.rider = null
    this.boardRadius = 4.0
  }

  // Punkt auf der Bandmitte bei t in [0,1], optional seitlich versetzt.
  pointAt(t, offset = 0) {
    return {
      x: this.base.x + this.dir.x * this.length * t + this.side.x * offset,
      z: this.base.y + this.dir.y * this.length * t + this.side.y * offset,
      y: this.baseY + (this.topY - this.baseY) * t,
    }
  }

  // Hoehe des Bandes an der Stelle t. Der Teppich liegt auf dem Pistenband,
  // aber das ist nicht mathematisch eben – es folgt dem Berg ein Stueck weit.
  // Deshalb wird die Trasse abgetastet statt interpoliert; sonst taucht das
  // Band in der Mitte in den Schnee ein und haengt an den Enden darueber.
  groundAt(t, offset = 0) {
    const p = this.pointAt(t, offset)
    return terrainHeight(p.x, p.z)
  }

  _buildBelt() {
    const steps = Math.max(8, Math.round(this.length / 1.4))
    const half = BELT_WIDTH / 2

    // Das laufende Band als Streifen entlang der Trasse.
    const pos = []
    const uv = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const v = (t * this.length) / 1.6
      for (const s of [-1, 1]) {
        const p = this.pointAt(t, s * half)
        pos.push(p.x, this.groundAt(t, s * half) + 0.14, p.z)
        uv.push(s < 0 ? 0 : 1, v)
      }
    }
    const index = []
    for (let i = 0; i < steps; i++) {
      const a = i * 2
      // Umlaufsinn: bergauf mal seitwaerts zeigt nach unten, also andersherum.
      index.push(a, a + 3, a + 2, a, a + 1, a + 3)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geo.setIndex(index)
    geo.computeVertexNormals()

    this.beltMap = beltTexture()
    const belt = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: this.beltMap, roughness: 0.78,
    }))
    belt.receiveShadow = true
    this.group.add(belt)
    this.belt = belt

    // Seitenwangen: niedrige Bretter links und rechts, damit das Band nicht
    // wie ein aufgeklebter Streifen wirkt. Sie folgen dem Boden mit.
    const parts = []
    const rails = Math.max(2, Math.round(this.length / 2.0))
    for (const s of [-1, 1]) {
      for (let i = 0; i < rails; i++) {
        const t0 = i / rails
        const t1 = (i + 1) / rails
        const off = s * (half + 0.22)
        const a = this.pointAt(t0, off)
        const b = this.pointAt(t1, off)
        const ay = this.groundAt(t0, off)
        const by = this.groundAt(t1, off)
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        parts.push({
          geo: new THREE.BoxGeometry(0.22, RAIL_HEIGHT, len * 1.03),
          color: i % 2 ? KINDER_COLORS[1] : KINDER_COLORS[2],
          position: [(a.x + b.x) / 2, (ay + by) / 2 + RAIL_HEIGHT * 0.5, (a.z + b.z) / 2],
          rotation: [-Math.atan2(by - ay, len), this.heading, 0],
        })
      }
    }
    const railMesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.62 }))
    railMesh.castShadow = true
    this.group.add(railMesh)
  }

  _buildStations(label) {
    // Unten eine flache Auffahrtsschanze, oben eine Abfahrtsnase – beide so
    // niedrig, dass man im Vorbeifahren nicht dagegenstoesst.
    for (const [t, sign] of [[0, -1], [1, 1]]) {
      const p = this.pointAt(t)
      const parts = []
      parts.push({
        geo: new THREE.CylinderGeometry(BELT_WIDTH / 2 + 0.34, BELT_WIDTH / 2 + 0.34, 0.3, 14),
        color: 0x39414a,
        position: [0, 0.15, 0],
      })
      parts.push({
        geo: new THREE.BoxGeometry(BELT_WIDTH + 0.7, 0.1, 1.5),
        color: 0xf7fbff,
        position: [0, 0.05, sign * 1.0],
        rotation: [sign * 0.16, 0, 0],
      })
      const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.7 }))
      mesh.castShadow = true
      mesh.position.set(p.x, this.groundAt(t), p.z)
      mesh.rotation.y = this.heading
      this.group.add(mesh)
    }

    // Ein Schild an der Talstation, wie an jeder anderen Station im Tal auch.
    const post = new THREE.Group()
    const parts = []
    parts.push({
      geo: new THREE.CylinderGeometry(0.09, 0.12, 2.4, 8),
      color: 0xd8dee6,
      position: [0, 1.2, 0],
    })
    parts.push({
      geo: new THREE.BoxGeometry(3.0, 0.72, 0.09),
      color: KINDER_COLORS[1],
      position: [0, 2.1, 0.12],
      rotation: [-0.52, 0, 0],
    })
    const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.7 }))
    mesh.castShadow = true
    post.add(mesh)

    const tex = labelTexture(label, {
      width: 512, height: 128, background: null, color: '#ffffff',
      font: '700 74px ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    })
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 0.66),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    plate.position.set(0, 2.1, 0.155)
    plate.rotation.x = -0.52
    post.add(plate)

    const p = this.pointAt(0, -2.4)
    post.position.set(p.x, terrainHeight(p.x, p.z), p.z)
    // Schilder zeigen in dieser Welt immer zur Kamera, nicht in Fahrtrichtung –
    // sonst liest man sie von hinten.
    post.rotation.y = CAMERA.azimuth
    this.group.add(post)
    this.world.addCollider(p.x, p.z, 0.4)
  }

  canBoard(skier) {
    if (this.rider || skier.tow) return false
    const dx = skier.position.x - this.base.x
    const dz = skier.position.z - this.base.y
    return dx * dx + dz * dz < this.boardRadius * this.boardRadius
  }

  board(skier) {
    if (!this.canBoard(skier)) return false
    // Dort einsteigen, wo man steht: der Fahrer wird auf die naechste Stelle
    // des Bandes gezogen statt an den Anfang zurueckgesetzt.
    const rel = new THREE.Vector2(skier.position.x, skier.position.z).sub(this.base)
    const t = THREE.MathUtils.clamp(rel.dot(this.dir) / this.length, 0, 0.2)
    this.rider = { progress: t }
    skier.tow = this
    skier.speed = this.speed
    return true
  }

  release(skier, atTop = false) {
    if (!this.rider) return
    this.rider = null
    if (!skier) return
    skier.tow = null
    skier.towTarget = null
    skier.speed = atTop ? this.speed * 0.7 : 0
    if (atTop) {
      skier.heading = this.heading
      skier.facing = this.heading
      skier._prevFacing = this.heading
    }
  }

  update(dt, skier, input) {
    // Das Band laeuft immer, auch ohne Fahrgast – daran sieht man, dass es
    // benutzbar ist.
    this.beltMap.offset.y -= (this.speed / 1.6) * dt * 0.1

    if (!this.rider) {
      if (skier && input && input.justPressed('use') && this.canBoard(skier)) this.board(skier)
      return
    }

    const r = this.rider
    r.progress += (this.speed / this.length) * dt
    const p = this.pointAt(Math.min(r.progress, 1))
    skier.towTarget = { x: p.x, z: p.z, heading: this.heading, progress: r.progress }

    if (input.braking || input.justPressed('use') || r.progress >= 0.985) {
      this.release(skier, r.progress >= 0.985)
    }
  }
}

// Der Teppich traegt, er zieht nicht – der Fahrer steht aufrecht darauf.
MagicCarpet.prototype.grab = false
