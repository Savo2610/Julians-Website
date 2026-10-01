import * as THREE from 'three'

// Ein Seil als duenner Schlauch mit fester Topologie. Jedes Bild werden nur
// die Ecken neu gesetzt: eine TubeGeometry je Bild neu zu bauen haette sechs
// Seile lang je Bild 36 kB Muell erzeugt.

const _a = new THREE.Vector3()
const _t = new THREE.Vector3()
const _n = new THREE.Vector3()
const _b = new THREE.Vector3()
const UP = new THREE.Vector3(0, 1, 0)

export class Rope {
  constructor({ radius = 0.035, segments = 18, sides = 4, color = 0x2b3240 } = {}) {
    this.segments = segments
    this.sides = sides
    this.radius = radius
    const ring = sides
    const count = (segments + 1) * ring
    this.positions = new Float32Array(count * 3)
    this.normals = new Float32Array(count * 3)
    const idx = []
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < ring; j++) {
        const a = i * ring + j
        const b = i * ring + ((j + 1) % ring)
        const c = a + ring
        const d = b + ring
        idx.push(a, c, b, b, c, d)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('normal', new THREE.BufferAttribute(this.normals, 3))
    geo.setIndex(idx)
    this.geometry = geo
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }))
    this.mesh.frustumCulled = false
    this.mesh.castShadow = true
    this.points = Array.from({ length: segments + 1 }, () => new THREE.Vector3())
  }

  // Von a nach b mit Durchhang sag (Meter nach unten in der Mitte). floorY:
  // tiefer als das haengt das Seil nicht (es liegt dann auf dem Wasser).
  set(a, b, sag = 0, floorY = -Infinity) {
    const n = this.segments
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const p = this.points[i]
      p.lerpVectors(a, b, t)
      p.y -= sag * 4 * t * (1 - t)
      if (p.y < floorY) p.y = floorY
    }
    this._build()
  }

  _build() {
    const n = this.segments
    const pos = this.positions
    const nor = this.normals
    for (let i = 0; i <= n; i++) {
      const p = this.points[i]
      const q = this.points[Math.min(n, i + 1)]
      const o = this.points[Math.max(0, i - 1)]
      _t.subVectors(q, o).normalize()
      _n.crossVectors(_t, UP)
      if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0)
      _n.normalize()
      _b.crossVectors(_n, _t).normalize()
      for (let j = 0; j < this.sides; j++) {
        const a = (j / this.sides) * Math.PI * 2
        _a.copy(_n).multiplyScalar(Math.cos(a)).addScaledVector(_b, Math.sin(a))
        const k = (i * this.sides + j) * 3
        pos[k] = p.x + _a.x * this.radius
        pos[k + 1] = p.y + _a.y * this.radius
        pos[k + 2] = p.z + _a.z * this.radius
        nor[k] = _a.x
        nor[k + 1] = _a.y
        nor[k + 2] = _a.z
      }
    }
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.attributes.normal.needsUpdate = true
  }
}
