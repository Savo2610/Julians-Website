import * as THREE from 'three'
import { terrainHeight } from '../world/heightfield.js'

// Ein flacher Ring im Schnee markiert jede Station. Er liegt auf dem Terrain,
// pulsiert langsam und zieht an, sobald man naeher kommt – so sieht man aus
// der Ferne, dass es dort etwas gibt, ohne dass ein Symbol in der Luft haengt.

const vert = /* glsl */ `
  varying vec2 vUv;
  varying float vRadial;
  void main() {
    vUv = uv;
    vRadial = length(position.xz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying float vRadial;
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uProximity;
  uniform float uInner;
  uniform float uOuter;

  void main() {
    float t = (vRadial - uInner) / (uOuter - uInner);

    // Ein klar gezeichneter Ring aussen, ein zarter Nachlaeufer innen.
    float breath = 0.86 + 0.14 * sin(uTime * 1.5);
    float main = 1.0 - smoothstep(0.0, 0.09, abs(t - 0.9 * breath));
    float echo = 1.0 - smoothstep(0.0, 0.16, abs(t - 0.55 * breath));

    float alpha = (main * 0.85 + echo * 0.28) * (0.35 + uProximity * 0.65);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(uColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createMarker(x, z, radius, color) {
  const segments = 84
  const rings = 8
  const geo = new THREE.RingGeometry(radius * 0.42, radius, segments, rings)
  geo.rotateX(-Math.PI / 2)

  // Auf das Terrain legen, damit der Ring der Gelaendeform folgt.
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i)
    const pz = pos.getZ(i)
    pos.setY(i, terrainHeight(x + px, z + pz) - terrainHeight(x, z) + 0.05)
  }
  pos.needsUpdate = true

  // Markenfarben sind oft sehr dunkel. Auf weissem Schnee wuerde daraus ein
  // Schmutzfleck – deshalb wird die Farbe auf eine Mindesthelligkeit gehoben.
  const tint = new THREE.Color(color)
  const hsl = { h: 0, s: 0, l: 0 }
  tint.getHSL(hsl)
  tint.setHSL(hsl.h, Math.min(1, hsl.s * 1.15 + 0.15), Math.max(hsl.l, 0.56))

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: tint },
      uTime: { value: 0 },
      uProximity: { value: 0 },
      uInner: { value: radius * 0.42 },
      uOuter: { value: radius },
    },
  })

  const mesh = new THREE.Mesh(geo, material)
  mesh.position.set(x, terrainHeight(x, z), z)
  mesh.renderOrder = 2
  mesh.update = (dt, proximity) => {
    material.uniforms.uTime.value += dt
    material.uniforms.uProximity.value = proximity
  }
  return mesh
}
