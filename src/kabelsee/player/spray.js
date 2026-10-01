import * as THREE from 'three'
import { pointScale } from '../../core/point-scale.js'

// Schneestaub hinter den Ski. CPU-simuliert, weil es nie viele Partikel sind
// und die Kontrolle ueber Lebensdauer und Auftrieb hier mehr wert ist als
// GPU-Eleganz.


const vert = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  uniform float uPointScale;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z) * (0.35 + aLife * 0.8) * uPointScale;
    gl_Position = projectionMatrix * mv;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying float vLife;
  uniform vec3 uColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = dot(p, p);
    if (d > 0.25) discard;
    float soft = smoothstep(0.25, 0.02, d);
    gl_FragColor = vec4(uColor, soft * vLife * 0.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// Dieselbe Anlage traegt auch den Goldstaub der goldenen Ski: weniger
// Partikel, eigene Farbe.
export class Spray {
  constructor({ max = 900, color = 0xf4f9ff } = {}) {
    const MAX = this.max = max
    this.positions = new Float32Array(MAX * 3)
    this.velocities = new Float32Array(MAX * 3)
    this.life = new Float32Array(MAX)
    this.sizes = new Float32Array(MAX)
    this.cursor = 0

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3))
    geo.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1))
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1))
    geo.setDrawRange(0, MAX)
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4)

    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uPointScale: pointScale },
    })

    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
    this.geometry = geo
  }

  emit(x, y, z, vx, vy, vz, size, life = 1) {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.max
    this.positions[i * 3] = x
    this.positions[i * 3 + 1] = y
    this.positions[i * 3 + 2] = z
    this.velocities[i * 3] = vx
    this.velocities[i * 3 + 1] = vy
    this.velocities[i * 3 + 2] = vz
    this.life[i] = life
    this.sizes[i] = size
  }

  update(dt) {
    const p = this.positions
    const v = this.velocities
    const l = this.life
    for (let i = 0; i < this.max; i++) {
      if (l[i] <= 0) continue
      l[i] -= dt * 0.85
      if (l[i] <= 0) {
        l[i] = 0
        this.sizes[i] = 0
        continue
      }
      const i3 = i * 3
      // Auftrieb, dann sinken: Schneestaub haengt kurz in der Luft.
      v[i3 + 1] += (1.4 * l[i] - 2.4) * dt
      v[i3] *= 1 - 1.6 * dt
      v[i3 + 2] *= 1 - 1.6 * dt
      p[i3] += v[i3] * dt
      p[i3 + 1] += v[i3 + 1] * dt
      p[i3 + 2] += v[i3 + 2] * dt
    }
    this.geometry.getAttribute('position').needsUpdate = true
    this.geometry.getAttribute('aLife').needsUpdate = true
    this.geometry.getAttribute('aSize').needsUpdate = true
  }
}
