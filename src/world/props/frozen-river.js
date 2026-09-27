import * as THREE from 'three'
import { terrainHeight, BACH } from '../heightfield.js'
import { makeRng } from '../../core/rng.js'
import { createRocks } from './rocks.js'

// Der Bach, der vom Gebirgsrand herunterkommt und oben in die gefrorene
// Quelle stuerzt (props/frozen-fall.js). Auch er ist zugefroren – wie See und
// Fall –, und er erzaehlt, woher das Wasser im Eisfall kam.
//
// Ein Band aus Eis liegt in dem Bett, das heightfield.js in den Hang
// schneidet (BACH). Oben am Rand ist er steil und weiss: gefrorene Kaskaden,
// in denen Luft steckt. Unten auf dem Schwemmkegel wird er ruhig und klar,
// mit dunklem Wasser unter dem Eis. Die letzten Meter liegen nicht mehr auf
// dem Hang, sondern spannen sich als Eislippe von der Boeschungskante zur
// Oberkante des Falls; dort wird er schmal und laeuft durch die Kerbe im
// Steinsturz.

const vert = /* glsl */ `
  attribute float aAcross;
  attribute float aAlong;
  attribute float aSteep;
  varying float vAcross;
  varying float vAlong;
  varying float vSteep;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vAcross = aAcross;
    vAlong = aAlong;
    vSteep = aSteep;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying float vAcross;
  varying float vAlong;
  varying float vSteep;
  varying vec3 vWorld;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSunDir;
  #include <fog_pars_fragment>

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += noise(p) * a; p = p * 2.03 + 7.1; a *= 0.5; }
    return s;
  }

  void main() {
    float a = abs(vAcross);
    // In der Mitte tiefer und dunkler, zum Ufer hin flach und hell.
    vec3 col = mix(uDeep, uShallow, smoothstep(0.0, 0.85, a));
    // Das Wasser zieht unter dem Eis: lange, laengs gestreckte Schlieren.
    float flow = noise(vec2(vAcross * 4.0, vAlong * 0.35));
    col = mix(col, uDeep * 0.8, smoothstep(0.55, 0.85, flow) * (1.0 - a) * 0.5);
    col += vec3(0.08, 0.1, 0.1) * smoothstep(0.6, 0.9, noise(vec2(vAcross * 9.0 + 3.0, vAlong * 0.6)));

    // Wo es steil ist, ist das Eis weiss und gerippt: gefrorene Kaskaden.
    float ribs = smoothstep(0.3, 0.95, sin(vAlong * 6.0 + noise(vec2(vAcross * 3.0, vAlong)) * 3.0) * 0.5 + 0.5);
    // Eisblau mit weissen Rippen – ganz weiss las es sich wie eine Piste.
    vec3 cascade = mix(mix(uShallow, uDeep, 0.25 * (1.0 - a)), vec3(0.93, 0.98, 1.0), ribs * 0.75);
    col = mix(col, cascade, smoothstep(0.25, 0.7, vSteep));

    // Eingeschlossene Blasen.
    vec2 cell = vec2(vAcross * 6.0, vAlong * 3.0);
    vec2 id = floor(cell);
    float bubble = step(0.88, hash(id)) * (1.0 - smoothstep(0.08, 0.16, length(fract(cell) - 0.5)));
    col = mix(col, vec3(0.92, 0.98, 1.0), bubble * 0.5 * (1.0 - vSteep));

    // Schnee: am Rand eine ausgefranste Wehe, in der Mitte vereinzelte
    // Verwehungen – der Bach ist nicht frisch gefegt.
    float drift = smoothstep(0.6, 0.95, a + (fbm(vec2(vAcross * 2.0, vAlong * 0.5)) - 0.5) * 0.5);
    drift = max(drift, smoothstep(0.64, 0.8, fbm(vec2(vAcross * 1.3 + 9.0, vAlong * 0.22))) * 0.85 * (1.0 - vSteep));
    // Oben am Rand kommt er unter dem Schnee hervor.
    drift = max(drift, 1.0 - smoothstep(1.0, 5.0, vAlong));
    col = mix(col, vec3(0.95, 0.975, 1.0), drift);

    // Ein schmaler Glanz, wie auf dem See.
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 H = normalize(V + normalize(uSunDir));
    col += vec3(1.0, 0.97, 0.9) * pow(max(H.y, 0.0), 80.0) * 0.2 * (1.0 - drift);

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

// lip: Weltpunkt der Oberkante des Falls, dort endet der Bach.
export function createFrozenRiver(world, { lip, sunDir }) {
  // Bis zur Boeschungskante liegt der Bach auf dem Hang; ab da spannt er
  // sich zur Lippe. Die Kante ist der hoechste Punkt nahe dem Ende.
  const pts = BACH.punkte.slice(0, -1).map(([x, z]) => new THREE.Vector3(x, 0, z))
  const kante = pts[pts.length - 1]
  const curve = new THREE.CatmullRomCurve3([...pts, new THREE.Vector3(lip.x, 0, lip.z)], false, 'centripetal')
  const length = curve.getLength()
  const n = Math.ceil(length / 0.35)
  const ACROSS = 9

  // Wo auf der Kurve die Kante liegt.
  let kanteU = 1
  for (let i = 0; i <= 400; i++) {
    const p = curve.getPointAt(i / 400)
    if (Math.hypot(p.x - kante.x, p.z - kante.z) < 0.25) { kanteU = i / 400; break }
  }
  const kanteY = terrainHeight(kante.x, kante.z) + 0.04

  const pos = [], across = [], along = [], steep = [], index = []
  const p = new THREE.Vector3(), t = new THREE.Vector3()
  let prevY = null
  for (let i = 0; i <= n; i++) {
    const u = i / n
    curve.getPointAt(u, p)
    curve.getTangentAt(u, t)
    const nx = -t.z, nz = t.x
    const nl = Math.hypot(nx, nz) || 1
    // Auf der Bruecke zur Lippe wird der Bach schmal wie ein Ausguss.
    const bruecke = u > kanteU ? (u - kanteU) / (1 - kanteU) : 0
    const w = (BACH.halb + 0.3) * (1 - 0.45 * bruecke)
    const mid = u <= kanteU ? terrainHeight(p.x, p.z) : kanteY + (lip.y - kanteY) * bruecke
    const s = prevY === null ? 0 : Math.min(1, Math.max(0, (prevY - mid) / (length / n) - 0.35))
    prevY = mid
    for (let k = 0; k < ACROSS; k++) {
      const q = k / (ACROSS - 1) * 2 - 1
      const x = p.x + (nx / nl) * q * w
      const z = p.z + (nz / nl) * q * w
      const ground = terrainHeight(x, z) + 0.04
      const y = u <= kanteU ? ground : Math.max(ground, mid + 0.02)
      pos.push(x, y, z)
      across.push(q)
      along.push(u * length)
      steep.push(s)
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < ACROSS - 1; k++) {
      const a = i * ACROSS + k, b = a + 1, c = a + ACROSS, d = c + 1
      index.push(a, b, c, b, d, c)
    }
  }
  // Die Steilheit weich ziehen, sonst flackern die Kaskaden von Probe zu Probe.
  const smoothSteep = steep.slice()
  for (let i = 0; i <= n; i++) {
    let sum = 0, cnt = 0
    for (let j = Math.max(0, i - 4); j <= Math.min(n, i + 4); j++) { sum += steep[j * ACROSS]; cnt++ }
    for (let k = 0; k < ACROSS; k++) smoothSteep[i * ACROSS + k] = sum / cnt
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1))
  geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1))
  geo.setAttribute('aSteep', new THREE.Float32BufferAttribute(smoothSteep, 1))
  geo.setIndex(index)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uDeep: { value: new THREE.Color(0x2f6f86) },
        uShallow: { value: new THREE.Color(0x8cc3d2) },
        uSunDir: { value: sunDir.clone() },
      },
    ]),
  })
  // Verschneite Steine am Ufer, dichter wo es steil ist – dort bricht
  // Fels durch. Klein genug, dass man sie ueberspringt.
  const rng = makeRng(270927)
  const steine = []
  for (let u = 0.04; u < kanteU; u += 0.035 + rng() * 0.04) {
    curve.getPointAt(u, p)
    curve.getTangentAt(u, t)
    const i = Math.round(u * n)
    if (smoothSteep[i * ACROSS] < 0.2 && rng() < 0.6) continue
    const side = rng() < 0.5 ? -1 : 1
    const off = BACH.halb + 0.6 + rng() * 0.9
    const nl = Math.hypot(t.z, t.x) || 1
    steine.push({
      x: p.x - (t.z / nl) * side * off, z: p.z + (t.x / nl) * side * off,
      variant: Math.floor(rng() * 3), scale: 0.35 + rng() * 0.45,
      stretch: 0.8 + rng() * 0.5, rotation: rng() * 6, tilt: rng() * 0.3,
    })
  }
  createRocks(world, steine, 270928)

  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'gefrorener-bach'
  mesh.receiveShadow = true
  world.scene.add(mesh)
  return mesh
}
