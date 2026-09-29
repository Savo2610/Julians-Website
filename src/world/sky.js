import * as THREE from 'three'
import { COLORS, WORLD } from '../config.js'

// Himmelskuppel als weicher Verlauf plus die zwei Lichter, die den ganzen
// Look tragen: warme tiefstehende Sonne, kaltes Himmelslicht aus der Gegen-
// richtung. Der Kontrast warm/kalt macht den Schnee gemuetlich statt grau.

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// Die Farbe des Himmels in einer Richtung, als eigene Funktion: die ferne
// Bergkette (props/backdrop.js) mischt sich mit genau diesem Wert in den
// Dunst. Nur wenn beide dieselbe Rechnung benutzen, verschwinden ihre Gipfel
// im Himmel, statt als blasse Flaeche davor zu stehen.
export const skyColorGlsl = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform float uTime;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += noise(p) * a; p *= 2.11; a *= 0.5; }
    return s;
  }

  vec3 skyColor(vec3 dir) {
    float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 col = mix(uHorizon, uTop, pow(h, 0.75));
    // Diffuser Sonnenschein am Horizont, kein harter Ball.
    float sun = pow(max(dot(normalize(dir), normalize(uSunDir)), 0.0), 8.0);
    col += uSun * sun * 0.4;
    col += uSun * pow(max(dot(normalize(dir), normalize(uSunDir)), 0.0), 64.0) * 0.7;

    // Sanfte Wolkenbaender – nur eine Andeutung, damit der Himmel nicht leer wirkt.
    vec2 cp = dir.xz / max(abs(dir.y) + 0.22, 0.05);
    float band = fbm(cp * 0.9 + vec2(uTime * 0.006, 0.0));
    float clouds = smoothstep(0.52, 0.86, band) * smoothstep(0.02, 0.4, dir.y);
    return mix(col, vec3(1.02, 1.0, 0.99), clouds * 0.4);
  }
`

const skyFrag = /* glsl */ `
  precision highp float;
  varying vec3 vDir;
  ${skyColorGlsl}

  void main() {
    vec3 col = skyColor(vDir);

    // Dithering gegen sichtbare Streifen im Verlauf.
    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    col += dither;

    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createSky(scene, renderer) {
  // Etwas hoeher: die Waldschatten sollen die kleinen Talwellen nicht
  // vollstaendig verschlucken, waehrend der warme Gegenlichtcharakter bleibt.
  const sunDir = new THREE.Vector3(-0.55, 0.42, 0.76).normalize()

  const geo = new THREE.SphereGeometry(WORLD.size * 2.2, 32, 20)
  const mat = new THREE.ShaderMaterial({
    vertexShader: skyVert,
    fragmentShader: skyFrag,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(COLORS.sky) },
      uHorizon: { value: new THREE.Color(COLORS.skyHorizon) },
      uSun: { value: new THREE.Color(COLORS.sun) },
      uSunDir: { value: sunDir },
      uTime: { value: 0 },
    },
  })
  const dome = new THREE.Mesh(geo, mat)
  dome.name = 'sky'
  scene.add(dome)

  scene.fog = new THREE.FogExp2(COLORS.fog, 0.0052)

  const sun = new THREE.DirectionalLight(COLORS.sun, 2.7)
  sun.position.copy(sunDir).multiplyScalar(90)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.near = 20
  sun.shadow.camera.far = 220
  const s = 62
  sun.shadow.camera.left = -s
  sun.shadow.camera.right = s
  sun.shadow.camera.top = s
  sun.shadow.camera.bottom = -s
  sun.shadow.bias = -0.0008
  sun.shadow.normalBias = 0.05
  scene.add(sun)
  scene.add(sun.target)

  const hemi = new THREE.HemisphereLight(COLORS.sky, COLORS.ambient, 1.1)
  scene.add(hemi)

  // Kaltes Fuell-Licht aus der Gegenrichtung, damit Schattenseiten blau
  // statt schwarz werden.
  const fill = new THREE.DirectionalLight(COLORS.ambient, 0.6)
  fill.position.set(sunDir.x * -70, 40, sunDir.z * -70)
  scene.add(fill)

  // Umgebungsreflexion direkt aus der Himmelskuppel.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envScene = new THREE.Scene()
  envScene.add(new THREE.Mesh(geo.clone(), mat.clone()))
  const env = pmrem.fromScene(envScene, 0, 1, WORLD.size * 3)
  scene.environment = env.texture
  scene.environmentIntensity = 0.45
  pmrem.dispose()

  return {
    dome, sun, hemi, fill, sunDir,
    update(elapsed) {
      mat.uniforms.uTime.value = elapsed
    },
  }
}
