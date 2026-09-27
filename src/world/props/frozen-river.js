import * as THREE from 'three'
import { terrainHeight, BACH } from '../heightfield.js'
import { makeRng } from '../../core/rng.js'
import { createRocks } from './rocks.js'

// Der Bach, der vom Gebirgsrand herunterkommt und oben in die gefrorene
// Quelle stuerzt (props/frozen-fall.js). Auch er ist zugefroren – wie See und
// Fall –, und er erzaehlt, woher das Wasser im Eisfall kam.
//
// Ein Band aus Eis liegt in dem Bett, das heightfield.js in den Hang
// schneidet (BACH). Wo es steil ist, liegt mehr Schnee darauf. Die letzten Meter liegen nicht mehr auf
// dem Hang, sondern spannen sich als Eislippe von der Boeschungskante zur
// Oberkante des Falls; dort wird er schmal und laeuft durch die Kerbe im
// Steinsturz.

// Der Bach traegt dasselbe Material wie das Gelaende (MeshStandardMaterial),
// damit Sonne, Hangneigung und die Schatten der Tannen auf ihm liegen wie
// auf dem Schnee daneben. Ein erster Entwurf war unbeleuchtet, mit eigenem
// Tuerkis und harter Kante – er sah aus wie aufgemalt. Die Farbe kommt jetzt
// aus demselben Rezept wie der See (props/lake.js): dieselben Toene, Risse
// aus gefaltetem Rauschen, Verwehungen in Weltkoordinaten. Zum Ufer hin
// franst das Eis aus und wird durchsichtig, der Schnee laeuft darueber.
const ICE_CHUNK = /* glsl */ `
  float a = abs(vAcross);
  vec2 wp = vRiverXZ;
  // Zur Mitte hin dunkler, weil das Eis dort dicker wirkt – wie im See.
  vec3 col = mix(uShallow, uDeep, smoothstep(0.1, 0.9, 1.0 - a) * 0.85);
  float veins = abs(riverFbm(wp * 0.35) - 0.5) * 2.0;
  col = mix(col, uCrack, (1.0 - smoothstep(0.02, 0.1, veins)) * 0.3);
  // Verwehter Schnee auf dem Eis; wo es steil ist, mehr davon.
  float drift = smoothstep(0.52, 0.78, riverFbm(wp * 0.26 + 21.0));
  drift = max(drift, smoothstep(0.2, 0.8, vSteep) * 0.55 * smoothstep(0.35, 0.7, riverFbm(wp * 0.5 + 3.0)));
  // Ausgefranstes Ufer: der Rand ist keine Linie, sondern Rauschen.
  float edge = a + (riverFbm(wp * 0.7 + 5.0) - 0.5) * 0.5;
  drift = max(drift, smoothstep(0.55, 0.9, edge));
  col = mix(col, vec3(0.96, 0.98, 1.0), drift * 0.7);
  float alpha = 1.0 - smoothstep(0.78, 1.0, edge);
  // Oben am Rand kommt er unter dem Schnee hervor.
  alpha *= smoothstep(1.0, 6.0, vAlong);
  diffuseColor = vec4(col, alpha);
  riverGlow = col * (1.0 - drift) * 0.32;
`

function patch(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aAcross;
        attribute float aAlong;
        attribute float aSteep;
        varying float vAcross;
        varying float vAlong;
        varying float vSteep;
        varying vec2 vRiverXZ;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vAcross = aAcross;
        vAlong = aAlong;
        vSteep = aSteep;
        vRiverXZ = (modelMatrix * vec4(position, 1.0)).xz;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vAcross;
        varying float vAlong;
        varying float vSteep;
        varying vec2 vRiverXZ;
        uniform vec3 uDeep;
        uniform vec3 uShallow;
        uniform vec3 uCrack;
        float riverHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float riverNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(riverHash(i), riverHash(i + vec2(1.0, 0.0)), f.x),
                     mix(riverHash(i + vec2(0.0, 1.0)), riverHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float riverFbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { s += riverNoise(p) * a; p *= 2.07; a *= 0.5; }
          return s;
        }`)
      .replace('#include <color_fragment>', `vec3 riverGlow;\n${ICE_CHUNK}`)
      // Ein Teil der Farbe leuchtet selbst: der See ist unbeleuchtet, und
      // ganz ohne Eigenlicht wurde das Eis im Schatten grau statt blau.
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += riverGlow;')
  }
  material.customProgramCacheKey = () => 'frozen-river-v2'
  return material
}

// lip: Weltpunkt der Oberkante des Falls, dort endet der Bach.
export function createFrozenRiver(world, { lip }) {
  // Bis zur Boeschungskante liegt der Bach auf dem Hang; ab da spannt er
  // sich zur Lippe. Die Kante ist der hoechste Punkt nahe dem Ende.
  const pts = BACH.punkte.slice(0, -1).map(([x, z]) => new THREE.Vector3(x, 0, z))
  const kante = pts[pts.length - 1]
  const curve = new THREE.CatmullRomCurve3([...pts, new THREE.Vector3(lip.x, 0, lip.z)], false, 'centripetal')
  const length = curve.getLength()
  const n = Math.ceil(length / 0.35)
  const ACROSS = 13

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
    const mid = u <= kanteU ? terrainHeight(p.x, p.z) : kanteY + (lip.y - kanteY) * bruecke
    const s = prevY === null ? 0 : Math.min(1, Math.max(0, (prevY - mid) / (length / n) - 0.35))
    prevY = mid
    // Nicht ueberall gleich breit: ein Bach, der mit dem Lineal gezogen ist,
    // liest sich als Strich. In den Kaskaden enger, auf dem Schwemmkegel
    // weiter, zur Lippe hin schmal wie ein Ausguss.
    const welle = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(u * length * 0.23 + 1.3) * Math.cos(u * length * 0.071))
    const w = (BACH.halb + 0.6) * welle * (1 - 0.25 * s) * (1 - 0.6 * bruecke)
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

  // Dieselben Toene wie der See (props/lake.js).
  const material = patch(new THREE.MeshStandardMaterial({
    roughness: 0.28,
    metalness: 0.0,
    envMapIntensity: 0.6,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }), {
    uDeep: { value: new THREE.Color(0x397d94) },
    uShallow: { value: new THREE.Color(0x83b8c8) },
    uCrack: { value: new THREE.Color(0xe6f3fa) },
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
    const off = BACH.halb + 1.2 + rng() * 1.0
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
