import * as THREE from 'three'
import { WORLD, COLORS } from '../config.js'
import { terrainHeight, terrainNormal, lakeDistance, islandDistance, PLAZA } from './heightfield.js'
import { fbm } from '../core/noise.js'

// Das Gelaende als ein Mesh in Weltkoordinaten. Die Farbe steckt in den
// Ecken: Sand am Wasser, Wiese, dunklere Wiese in Senken, Fels an steilen
// Flanken. Unter Wasser geht der Sand in Schlick ueber, den man durch das
// flache Wasser am Ufer noch sieht.

const smooth = THREE.MathUtils.smoothstep

function buildGeometry() {
  const { size, segments } = WORLD
  const half = size / 2
  const step = size / segments
  const side = segments + 1
  const count = side * side

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)

  const grass = new THREE.Color(COLORS.grass)
  const grassDark = new THREE.Color(COLORS.grassDark)
  const meadow = new THREE.Color(COLORS.meadow)
  const sand = new THREE.Color(COLORS.sand)
  const sandWet = new THREE.Color(COLORS.sandWet)
  const rock = new THREE.Color(COLORS.rock)
  const path = new THREE.Color(COLORS.path)
  const silt = new THREE.Color(0x8f9a6e)
  const tmp = new THREE.Color()
  const n = new THREE.Vector3()

  let p = 0
  for (let iz = 0; iz < side; iz++) {
    const z = -half + iz * step
    for (let ix = 0; ix < side; ix++) {
      const x = -half + ix * step
      const y = terrainHeight(x, z)
      positions[p] = x
      positions[p + 1] = y
      positions[p + 2] = z
      terrainNormal(x, z, n)
      normals[p] = n.x
      normals[p + 1] = n.y
      normals[p + 2] = n.z

      const steep = 1 - n.y
      const nBig = fbm(x * 0.03 + 5, z * 0.03 - 2, 3)
      const nSmall = fbm(x * 0.21, z * 0.21, 2)

      // Wiese: zwei Gruentoene und helle, fast gelbe Flecken, damit es nicht
      // wie ein Golfplatz aussieht.
      tmp.copy(grass).lerp(grassDark, smooth(nBig, 0.45, 0.72) * 0.8)
      tmp.lerp(meadow, smooth(nSmall + nBig * 0.4, 0.62, 0.9) * 0.55)

      // Sandsaum: breiter, wo das Rauschen es will, und immer am Wasser.
      // Abstand zum naechsten Ufer: am Festland zum See, auf der Insel zu
      // ihrem eigenen Rand. (Auf der Insel ist lakeDistance positiv – die
      // Insel liegt ja im See – und hatte sie ganz zu Strand gemacht.)
      const ld = lakeDistance(x, z)
      const shore = ld < 0 ? -ld : islandDistance(x, z)
      const beachWidth = 2.5 + nBig * 7
      const beach = 1 - smooth(shore, beachWidth * 0.6, beachWidth)
      tmp.lerp(sand, beach * (y < 1.6 ? 1 : 0.3))

      // Platz vor der Station: festgetretener Kies.
      const pd = Math.hypot(x - PLAZA.x, z - PLAZA.z)
      tmp.lerp(path, (1 - smooth(pd, PLAZA.radius * 0.5, PLAZA.radius * 0.8)) * 0.85)

      tmp.lerp(rock, smooth(steep, 0.22, 0.5) * 0.9)

      // Unter Wasser: nasser Sand, in der Tiefe Schlick.
      if (y < 0.05) {
        tmp.copy(sandWet).lerp(silt, smooth(-y, 0.4, 2.2))
      }

      colors[p] = tmp.r
      colors[p + 1] = tmp.g
      colors[p + 2] = tmp.b
      p += 3
    }
  }

  const indices = new Uint32Array(segments * segments * 6)
  let i = 0
  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * side + ix
      const b = a + 1
      const d = a + side
      const e = d + 1
      indices[i++] = a
      indices[i++] = d
      indices[i++] = b
      indices[i++] = b
      indices[i++] = d
      indices[i++] = e
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeBoundingSphere()
  return geo
}

export function createTerrain(scene) {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0,
  })
  // Feines Korn in der Wiese: je Pixel ein Wertrauschen aus der Weltposition.
  // Aus 34 m Abstand liest es sich als Gras, ohne dass eine Textur geladen
  // werden muss.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTerrainPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `
        #include <common>
        varying vec3 vTerrainPos;
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x),
                     mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
      `)
      .replace('#include <color_fragment>', /* glsl */ `
        #include <color_fragment>
        {
          float g = tNoise(vTerrainPos.xz * 1.7) * 0.6 + tNoise(vTerrainPos.xz * 5.3) * 0.4;
          float land = smoothstep(0.0, 0.6, vTerrainPos.y);
          diffuseColor.rgb *= mix(1.0, 0.9 + g * 0.2, land);
        }
      `)
  }
  const mesh = new THREE.Mesh(buildGeometry(), material)
  mesh.receiveShadow = true
  mesh.name = 'terrain'
  scene.add(mesh)
  return mesh
}
