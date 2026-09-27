import * as THREE from 'three'
import { LAKE, lakeRadius } from '../heightfield.js'

// Zugefrorener See: eine leicht unregelmaessige Scheibe aus Eis, darauf
// Schneeverwehungen und ein paar Risse. Man kann darueber fahren – das Eis
// liegt auf derselben Hoehe wie der befahrbare Boden.

const iceVert = /* glsl */ `
  varying vec2 vXZ;
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vXZ = position.xz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const iceFrag = /* glsl */ `
  precision highp float;
  varying vec2 vXZ;
  varying vec3 vWorld;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uCrack;
  uniform float uRadius;
  uniform vec3 uSunDir;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uCameraPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += noise(p) * a; p *= 2.07; a *= 0.5; }
    return s;
  }

  void main() {
    float r = length(vXZ) / uRadius;

    // Grundfarbe: zur Mitte hin dunkler, weil das Eis dort dicker wirkt.
    vec3 col = mix(uShallow, uDeep, smoothstep(0.15, 0.95, 1.0 - r));

    // Risse: scharfe Adern aus gefaltetem Rauschen.
    float veins = abs(fbm(vXZ * 0.22) - 0.5) * 2.0;
    float crack = 1.0 - smoothstep(0.02, 0.10, veins);
    col = mix(col, uCrack, crack * 0.3);

    // Verwehter Schnee auf dem Eis.
    float drift = smoothstep(0.52, 0.78, fbm(vXZ * 0.13 + 21.0));
    drift = max(drift, smoothstep(0.72, 1.0, r));
    col = mix(col, vec3(0.96, 0.98, 1.0), drift * 0.65);

    // Glanz: sehr flacher, breiter Highlight-Streifen.
    vec3 V = normalize(uCameraPos - vWorld);
    vec3 H = normalize(V + normalize(uSunDir));
    float spec = pow(max(H.y, 0.0), 90.0) * (1.0 - drift * 0.85);
    col += vec3(1.0, 0.97, 0.9) * spec * 0.24;

    float fres = pow(1.0 - max(V.y, 0.0), 3.0) * (1.0 - drift);
    col = mix(col, vec3(0.86, 0.93, 1.0), fres * 0.22);

    float d = length(uCameraPos - vWorld);
    float fogAmount = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
    col = mix(col, uFogColor, clamp(fogAmount, 0.0, 1.0));

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createLake(world, { fogColor, fogDensity, sunDir }) {
  const segments = 96
  const geo = new THREE.CircleGeometry(1, segments)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 1; i < pos.count; i++) {
    const angle = Math.atan2(pos.getZ(i), pos.getX(i))
    const radius = lakeRadius(angle)
    pos.setXYZ(i, Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
  }
  geo.computeBoundingSphere()

  const material = new THREE.ShaderMaterial({
    vertexShader: iceVert,
    fragmentShader: iceFrag,
    uniforms: {
      uDeep: { value: new THREE.Color(0x397d94) },
      uShallow: { value: new THREE.Color(0x83b8c8) },
      uCrack: { value: new THREE.Color(0xe6f3fa) },
      uRadius: { value: LAKE.radius },
      uSunDir: { value: sunDir.clone() },
      uFogColor: { value: new THREE.Color(fogColor) },
      uFogDensity: { value: fogDensity },
      uCameraPos: { value: new THREE.Vector3() },
    },
  })

  const mesh = new THREE.Mesh(geo, material)
  // Eishoehe: knapp ueber dem Beckenboden, damit der Uferrand sauber ansetzt.
  const level = LAKE.level + 0.012
  mesh.position.set(LAKE.x, level, LAKE.z)
  mesh.receiveShadow = true
  mesh.name = 'lake'
  world.scene.add(mesh)

  return {
    mesh,
    level,
    update(camera) {
      material.uniforms.uCameraPos.value.copy(camera.position)
    },
    contains(x, z) {
      const dx = x - LAKE.x
      const dz = z - LAKE.z
      return Math.hypot(dx, dz) < lakeRadius(Math.atan2(dz, dx))
    },
  }
}
