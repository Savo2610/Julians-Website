import * as THREE from 'three'
import { COLORS } from '../config.js'
import { terrainHeight } from './heightfield.js'
import { WAKE_BOX } from './wake.js'

// Der See. Eine flache Scheibe auf y = 0 mit eigenem Shader: Farbe aus der
// Wassertiefe (flach tuerkis, tief petrol), gekraeuselte Oberflaeche aus zwei
// ziehenden Rauschlagen, Himmel im Streiflicht, Sonnenglitzer, Schaum am Ufer
// und das Kielwasser aus wake.js. Das Wasser ist am Ufer durchsichtig, damit
// der Sand durchscheint.

const DEPTH_RES = 256
const DEPTH_MAX = 4

function depthTexture() {
  const data = new Uint8Array(DEPTH_RES * DEPTH_RES)
  for (let iz = 0; iz < DEPTH_RES; iz++) {
    for (let ix = 0; ix < DEPTH_RES; ix++) {
      const x = WAKE_BOX.x0 + ((ix + 0.5) / DEPTH_RES) * WAKE_BOX.size
      const z = WAKE_BOX.z0 + ((iz + 0.5) / DEPTH_RES) * WAKE_BOX.size
      const d = Math.max(0, Math.min(DEPTH_MAX, -terrainHeight(x, z)))
      data[iz * DEPTH_RES + ix] = Math.round((d / DEPTH_MAX) * 255)
    }
  }
  const t = new THREE.DataTexture(data, DEPTH_RES, DEPTH_RES, THREE.RedFormat, THREE.UnsignedByteType)
  t.magFilter = t.minFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vWorld;
  uniform sampler2D uDepth;
  uniform sampler2D uWake;
  uniform vec4 uBox;
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSun;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec4 uShadow;     // x, z, Radius, Staerke

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // Kraeuselung: zwei Lagen, die gegeneinander ziehen.
  float ripple(vec2 p) {
    return noise(p * 0.42 + uTime * vec2(0.16, 0.11)) * 0.6
         + noise(p * 1.1 + uTime * vec2(-0.21, 0.27)) * 0.3
         + noise(p * 2.7 - uTime * vec2(0.35, -0.1)) * 0.1;
  }

  void main() {
    vec2 uv = (vWorld.xz - uBox.xy) / uBox.z;
    float depth = texture2D(uDepth, uv).r * ${DEPTH_MAX.toFixed(1)};

    vec2 p = vWorld.xz;
    float e = 0.12;
    float h0 = ripple(p);
    float hx = ripple(p + vec2(e, 0.0)) - h0;
    float hz = ripple(p + vec2(0.0, e)) - h0;
    vec4 wake = texture2D(uWake, uv);
    // Das Kielwasser wirft die Oberflaeche zusaetzlich auf.
    float wx = texture2D(uWake, uv + vec2(0.002, 0.0)).g - wake.g;
    float wz = texture2D(uWake, uv + vec2(0.0, 0.002)).g - wake.g;
    vec3 N = normalize(vec3(-hx / e * 0.22 - wx * 3.0, 1.0, -hz / e * 0.22 - wz * 3.0));

    vec3 V = normalize(cameraPosition - vWorld);
    float shallowK = exp(-depth * 1.1);
    vec3 col = mix(uDeep, uShallow, shallowK);
    // Dunklere, weiche Flecken im Tiefen, damit der See nicht einfarbig ist.
    col *= 0.92 + 0.12 * noise(p * 0.05 + 3.0);

    vec3 R = reflect(-V, N);
    vec3 sky = mix(uSkyHorizon, uSkyTop, pow(clamp(R.y, 0.0, 1.0), 0.55));
    float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    col = mix(col, sky, clamp(fres * 1.6, 0.0, 0.55));

    // Sonnenglitzer: harte Funken statt eines weichen Flecks.
    float spec = pow(max(dot(R, normalize(uSunDir)), 0.0), 220.0);
    col += uSun * smoothstep(0.25, 0.6, spec) * 0.9;
    col += uSun * pow(max(dot(R, normalize(uSunDir)), 0.0), 18.0) * 0.08;

    // Schatten des Fahrers als weicher Fleck – er sagt, wie hoch man fliegt.
    float sd = length(p - uShadow.xy);
    col *= 1.0 - uShadow.w * (1.0 - smoothstep(uShadow.z * 0.35, uShadow.z, sd));

    // Uferschaum: eine duenne Linie, die mit der Tiefe atmet, und ein
    // zweiter, blasserer Saum dahinter. Breiter und heller sah es aus wie
    // Schnee am Strand.
    float n = noise(p * 0.8 + uTime * 0.2);
    float wave = sin(depth * 18.0 - uTime * 1.3 + n * 3.0) * 0.5 + 0.5;
    float line1 = smoothstep(0.12, 0.03, abs(depth - 0.06 - 0.05 * wave));
    float line2 = smoothstep(0.05, 0.0, abs(depth - 0.26 - 0.08 * wave)) * 0.45;
    float foam = (line1 * 0.75 + line2) * smoothstep(0.35, 0.75, noise(p * 0.35 + uTime * 0.05) + 0.3);

    // Kielwasser.
    float breakup = noise(p * 2.2 + uTime * 0.7);
    foam = max(foam, wake.r * (0.55 + 0.6 * breakup));
    foam = max(foam, wake.g * 0.55 * smoothstep(0.35, 0.75, breakup + wake.g * 0.4));
    col = mix(col, uFoam, clamp(foam, 0.0, 1.0));

    float d = length(cameraPosition - vWorld);
    float fogAmount = 1.0 - exp(-uFogDensity * uFogDensity * d * d);
    col = mix(col, uFogColor, clamp(fogAmount, 0.0, 1.0));

    // Am Ufer durchsichtig: der Sand darunter soll durchscheinen.
    float alpha = mix(0.45, 0.94, smoothstep(0.0, 1.6, depth));
    alpha = max(alpha, clamp(foam, 0.0, 1.0));
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createWater(scene, { wake, sky }) {
  const geo = new THREE.PlaneGeometry(WAKE_BOX.size, WAKE_BOX.size, 1, 1)
  geo.rotateX(-Math.PI / 2)
  geo.translate(WAKE_BOX.x0 + WAKE_BOX.size / 2, 0, WAKE_BOX.z0 + WAKE_BOX.size / 2)

  const skyU = sky.dome.material.uniforms
  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uDepth: { value: depthTexture() },
      uWake: { value: wake.texture },
      uBox: { value: new THREE.Vector4(WAKE_BOX.x0, WAKE_BOX.z0, WAKE_BOX.size, 0) },
      uTime: { value: 0 },
      uSunDir: { value: sky.sunDir },
      uDeep: { value: new THREE.Color(COLORS.waterDeep) },
      uShallow: { value: new THREE.Color(COLORS.waterShallow) },
      uFoam: { value: new THREE.Color(COLORS.foam) },
      uSkyTop: skyU.uTop,
      uSkyHorizon: skyU.uHorizon,
      uSun: skyU.uSun,
      uFogColor: { value: new THREE.Color(COLORS.fog) },
      uFogDensity: { value: scene.fog ? scene.fog.density : 0 },
      uShadow: { value: new THREE.Vector4(0, 0, 1, 0) },
    },
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.name = 'water'
  // Nach dem Gelaende, aber vor Spritzwasser und Schaumkronen.
  mesh.renderOrder = 1
  scene.add(mesh)

  return {
    mesh,
    update(elapsed, rider) {
      material.uniforms.uTime.value = elapsed
      const sh = material.uniforms.uShadow.value
      const height = Math.max(0, rider.y)
      sh.set(rider.x, rider.z, 1.0 + height * 0.25, rider.mode === 'crash' ? 0 : 0.32 / (1 + height * 0.25))
    },
  }
}
