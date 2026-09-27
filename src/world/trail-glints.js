import * as THREE from 'three'
import { terrainHeight } from './heightfield.js'

// Leuchtschleier: ab und zu huscht auf jedem der vier Wege ein Lichtfaden vom
// Startplatz aus den Weg entlang, wie eine Sternschnuppe knapp ueber dem
// Schnee, und laesst ein paar Funken zurueck. Er sagt dasselbe wie vorher die
// Winkel im Schnee – hier entlang geht es –, aber erst, wenn man hinschaut,
// und ohne dass der Schnee dauerhaft bemalt ist.
//
// Farbig und normal gemischt, nicht additiv: auf Schnee, der fast weiss ist,
// bringt additives Licht nichts mehr hinzu und der Faden verschwaende.

const TAIL = 56             // Punkte je Schweif – dicht, sonst liest er als Perlenschnur
const TAIL_STEP = 0.14      // m zwischen zwei Schweifpunkten
const HOVER = 0.35          // m ueber dem Schnee
const SPARKS = 160

const vert = /* glsl */ `
  attribute float aAlpha;
  attribute float aSize;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / -mv.z;
    vAlpha = aAlpha;
    vColor = aColor;
  }
`

const frag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;
    float glow = pow(1.0 - d, 1.6);
    // Heller Kern, farbiger Hof.
    vec3 c = mix(vColor, vColor * 1.25 + 0.15, smoothstep(0.55, 0.95, 1.0 - d));
    gl_FragColor = vec4(c, glow * vAlpha);
  }
`

function resample(path, step = 0.5) {
  const pts = []
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i]
    const [bx, bz] = path[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const n = Math.max(1, Math.ceil(len / step))
    for (let k = 0; k < n; k++) pts.push([ax + (bx - ax) * (k / n), az + (bz - az) * (k / n)])
  }
  pts.push(path[path.length - 1])
  // Weich gezogen: die Wege sind Polygonzuege, eine Sternschnuppe fliegt
  // keine Ecken.
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < pts.length - 1; i++) {
      pts[i] = [(pts[i - 1][0] + pts[i][0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + pts[i][1] * 2 + pts[i + 1][1]) / 4]
    }
  }
  const out = pts.map(([x, z]) => ({ x, z, y: terrainHeight(x, z) + HOVER, s: 0 }))
  for (let i = 1; i < out.length; i++) out[i].s = out[i - 1].s + Math.hypot(out[i].x - out[i - 1].x, out[i].z - out[i - 1].z)
  return out
}

function at(line, s, target) {
  // Binaersuche waere schneller; bei ein paar hundert Stuetzpunkten und acht
  // Schnuppen ist die lineare Suche vom letzten Treffer aus genug.
  let i = 1
  while (i < line.length - 1 && line[i].s < s) i++
  const a = line[i - 1], b = line[i]
  const t = Math.min(1, Math.max(0, (s - a.s) / Math.max(1e-4, b.s - a.s)))
  target.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
  return target
}

export function createTrailGlints(trails) {
  const lanes = trails.map((t) => ({
    line: resample(t.path),
    // Die Wegfarben sind gedeckt; als Licht auf Weiss lasen sie sich wie
    // Rauch. Gleicher Farbton, aber gesaettigt und hell.
    color: (() => { const c = new THREE.Color(t.color); const hsl = {}; c.getHSL(hsl); return c.setHSL(hsl.h, 0.95, 0.58) })(),
    next: 0.6 + Math.random() * 2.5,
    comets: [],
  }))

  const maxComets = lanes.length
  const count = maxComets * TAIL + SPARKS
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(count * 3)
  const alpha = new Float32Array(count)
  const size = new Float32Array(count)
  const color = new Float32Array(count * 3)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3))

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: { uScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = 2
  points.name = 'leuchtschleier'

  const sparks = Array.from({ length: SPARKS }, () => ({ life: 0, max: 1, p: new THREE.Vector3(), v: new THREE.Vector3(), c: null }))
  let sparkIndex = 0
  const _p = new THREE.Vector3()

  // Neue Schleier nur, solange der Fahrer in der Naehe des Startplatzes ist:
  // dort sind sie Wegweiser. Draussen im Tal waeren sie nur Unruhe am Rand.
  function update(dt, t, camera, renderer, near = true) {
    // Punktgroesse in Pixeln pro Meter bei Abstand 1 – haengt an Bildhoehe
    // und Brennweite, sonst waeren die Faeden am Handy nur Staub.
    const h = renderer.domElement.height
    material.uniforms.uScale.value = h / (2 * Math.tan((camera.fov * Math.PI) / 360))

    for (const lane of lanes) {
      lane.next -= dt
      if (lane.next <= 0 && lane.comets.length < 1 && near) {
        // Nicht im Takt und je Weg hoechstens eine, alle 9–18 s: mit zwei pro
        // Weg und 5–11 s war es aufdringlich.
        lane.next = 9 + Math.random() * 9
        lane.comets.push({ s: 0, speed: 7.5 + Math.random() * 3, seed: Math.random() * 10 })
      }
      const end = lane.line[lane.line.length - 1].s
      for (const c of lane.comets) {
        c.s += c.speed * dt
        if (Math.random() < dt * 22) {
          const sp = sparks[sparkIndex = (sparkIndex + 1) % SPARKS]
          at(lane.line, c.s, sp.p)
          sp.v.set((Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.4, (Math.random() - 0.5) * 0.6)
          sp.max = sp.life = 0.5 + Math.random() * 0.7
          sp.c = lane.color
        }
      }
      lane.comets = lane.comets.filter((c) => c.s - TAIL * TAIL_STEP < end)
    }

    let n = 0
    for (const lane of lanes) {
      const end = lane.line[lane.line.length - 1].s
      for (const c of lane.comets) {
        for (let k = 0; k < TAIL; k++) {
          const s = c.s - k * TAIL_STEP
          const f = 1 - k / TAIL
          // Ein- und Ausblenden an den Wegenden, damit nichts aus dem Nichts
          // auftaucht oder an einer Kante abreisst.
          const fade = Math.min(1, s / 3, (end - s) / 5)
          at(lane.line, Math.max(0, Math.min(end, s)), _p)
          _p.y += Math.sin(t * 3 + c.seed + s * 0.6) * 0.08
          pos.set([_p.x, _p.y, _p.z], n * 3)
          alpha[n] = s < 0 || s > end ? 0 : Math.max(0, fade) * Math.pow(f, 1.4) * 0.4
          size[n] = 0.22 + 0.38 * f
          color.set([lane.color.r, lane.color.g, lane.color.b], n * 3)
          n++
        }
      }
    }
    for (const sp of sparks) {
      if (sp.life > 0) {
        sp.life -= dt
        sp.p.addScaledVector(sp.v, dt)
        const f = Math.max(0, sp.life / sp.max)
        pos.set([sp.p.x, sp.p.y, sp.p.z], n * 3)
        // Funkeln statt gleichmaessig verloeschen.
        alpha[n] = f * (0.5 + 0.5 * Math.sin(t * 40 + sp.max * 50)) * 0.85
        size[n] = 0.22
        color.set([sp.c.r, sp.c.g, sp.c.b], n * 3)
        n++
      }
    }
    for (let i = n; i < count; i++) alpha[i] = 0
    geo.setDrawRange(0, n)
    geo.attributes.position.needsUpdate = true
    geo.attributes.aAlpha.needsUpdate = true
    geo.attributes.aSize.needsUpdate = true
    geo.attributes.aColor.needsUpdate = true
  }

  return { points, update }
}
