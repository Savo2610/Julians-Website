import * as THREE from 'three'

// Leichter Schneefall um die Kamera herum. Die Flocken leben in einem Wuerfel,
// der dem Fahrer folgt und sich an den Raendern wiederholt – so reichen wenige
// tausend Punkte fuer den Eindruck, dass es im ganzen Tal schneit.

const COUNT = 1400
const BOX = 46
const HEIGHT = 26

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  varying float vFade;

  void main() {
    vec3 p = position;
    // Sanftes Taumeln, damit die Flocken nicht wie Regen fallen.
    p.x += sin(uTime * 0.6 + aPhase * 6.28) * 1.1;
    p.z += cos(uTime * 0.45 + aPhase * 4.2) * 0.9;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * (140.0 / -mv.z);
    gl_Position = projectionMatrix * mv;

    // Nahe Flocken ausblenden, sonst kleben sie auf der Linse.
    vFade = smoothstep(4.0, 14.0, -mv.z);
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying float vFade;
  uniform vec3 uColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    gl_FragColor = vec4(uColor, smoothstep(0.25, 0.03, r) * 0.5 * vFade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createSnowfall() {
  const positions = new Float32Array(COUNT * 3)
  const sizes = new Float32Array(COUNT)
  const phases = new Float32Array(COUNT)
  const speeds = new Float32Array(COUNT)

  for (let i = 0; i < COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * BOX
    positions[i * 3 + 1] = Math.random() * HEIGHT
    positions[i * 3 + 2] = (Math.random() - 0.5) * BOX
    sizes[i] = 0.6 + Math.random() * 1.5
    phases[i] = Math.random()
    speeds[i] = 0.7 + Math.random() * 1.1
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), BOX)

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0xffffff) },
    },
  })

  const points = new THREE.Points(geo, material)
  points.frustumCulled = false
  points.renderOrder = 3

  const attr = geo.getAttribute('position')
  points.userData.update = (dt, elapsed, center) => {
    material.uniforms.uTime.value = elapsed
    // Der Wuerfel folgt dem Fahrer; Flocken, die herausfallen, kommen oben
    // wieder herein.
    points.position.set(center.x, 0, center.z)
    for (let i = 0; i < COUNT; i++) {
      const iy = i * 3 + 1
      attr.array[iy] -= speeds[i] * dt
      if (attr.array[iy] < 0) {
        attr.array[iy] = HEIGHT
        attr.array[i * 3] = (Math.random() - 0.5) * BOX
        attr.array[i * 3 + 2] = (Math.random() - 0.5) * BOX
      }
    }
    attr.needsUpdate = true
  }

  return points
}
