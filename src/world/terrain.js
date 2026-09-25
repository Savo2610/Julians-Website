import * as THREE from 'three'
import { isSnowSurface } from './surfaces.js'
import { pathPreparation } from './paths.js'
import { WORLD, TRAIL, COLORS } from '../config.js'
import { terrainHeight, terrainNormal } from './heightfield.js'

// Das Terrain-Mesh wird direkt in Weltkoordinaten gebaut (kein Rotieren eines
// Planes), damit object space == world space gilt. Das macht den Trail-Shader
// unten trivial: position.xz ist bereits die Weltposition.

function buildGeometry() {
  const { size, segments } = WORLD
  const half = size / 2
  const step = size / segments
  const side = segments + 1
  const count = side * side

  const positions = new Float32Array(count * 3)
  const normals = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const uvs = new Float32Array(count * 2)
  const preparation = new Float32Array(count)
  const snowSurface = new Float32Array(count)

  const snowLit = new THREE.Color(COLORS.snowLit)
  const snowShade = new THREE.Color(COLORS.snowShade)
  const rock = new THREE.Color(COLORS.rock)
  const prepared = new THREE.Color(0xc5dce5)
  const tmp = new THREE.Color()
  const n = new THREE.Vector3()

  let p = 0
  let c = 0
  let u = 0
  for (let iz = 0; iz < side; iz++) {
    const z = -half + iz * step
    for (let ix = 0; ix < side; ix++) {
      const x = -half + ix * step
      const y = terrainHeight(x, z)
      snowSurface[iz * side + ix] = isSnowSurface(x, z, 1) ? 1 : 0

      positions[p] = x
      positions[p + 1] = y
      positions[p + 2] = z

      terrainNormal(x, z, n)
      normals[p] = n.x
      normals[p + 1] = n.y
      normals[p + 2] = n.z

      // Steilheit: 0 = flach, 1 = senkrecht.
      const steep = 1 - n.y
      // Auf steilen Flanken blitzt Fels durch, in Senken wird der Schnee kuehler.
      const rockMix = THREE.MathUtils.smoothstep(steep, 0.28, 0.62)
      const shadeMix = THREE.MathUtils.smoothstep(steep, 0.02, 0.3) * 0.55
      tmp.copy(snowLit).lerp(snowShade, shadeMix).lerp(rock, rockMix * 0.85)
      // Ein gemeinsamer kuehler Schneeton verbindet die Stationen. Auf steilen
      // Flanken bleibt der Fels sichtbar, damit die Wege kein Relief kaschieren.
      const groomed = pathPreparation(x, z) * (1 - rockMix)
      preparation[iz * side + ix] = groomed
      tmp.lerp(prepared, groomed * 0.6)
      colors[c] = tmp.r
      colors[c + 1] = tmp.g
      colors[c + 2] = tmp.b

      uvs[u] = ix / segments
      uvs[u + 1] = iz / segments

      p += 3
      c += 3
      u += 2
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
  geo.setAttribute('snowSurface', new THREE.BufferAttribute(snowSurface, 1))
  geo.setAttribute('preparation', new THREE.BufferAttribute(preparation, 1))
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.computeBoundingSphere()
  return geo
}

function patchMaterial(material, trailTexture) {
  const uniforms = {
    uTrail: { value: trailTexture },
    uWorldSize: { value: WORLD.size },
    uDepth: { value: TRAIL.depth },
    uRim: { value: TRAIL.rimHeight },
  }
  material.userData.uniforms = uniforms

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        attribute float preparation;
        attribute float snowSurface;
        uniform sampler2D uTrail;
        uniform float uWorldSize;
        uniform float uDepth;
        uniform float uRim;
        varying vec2 vTerrainXZ;
        varying float vPreparation;

        // Rille eindruecken, am Rand den verdraengten Schnee aufwerfen.
        float trailDisplace(vec2 world) {
          vec2 uv = world / uWorldSize + 0.5;
          vec4 t = texture2D(uTrail, uv);
          return (-uDepth * t.r + uRim * max(0.0, t.g - t.r)) * snowSurface;
        }
      `,
      )
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        #include <beginnormal_vertex>
        {
          float e = uWorldSize / 900.0;
          float dx = trailDisplace(position.xz + vec2(e, 0.0)) - trailDisplace(position.xz - vec2(e, 0.0));
          float dz = trailDisplace(position.xz + vec2(0.0, e)) - trailDisplace(position.xz - vec2(0.0, e));
          objectNormal = normalize(objectNormal + vec3(-dx, 0.0, -dz) / (2.0 * e));
        }
      `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        transformed.y += trailDisplace(position.xz);
        vTerrainXZ = position.xz;
        vPreparation = preparation;
      `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform sampler2D uTrail;
        uniform float uWorldSize;
        uniform float uDepth;
        uniform float uRim;
        varying vec2 vTerrainXZ;
        varying float vPreparation;

        float snowHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float snowNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(snowHash(i), snowHash(i + vec2(1.0, 0.0)), f.x),
                     mix(snowHash(i + vec2(0.0, 1.0)), snowHash(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        float snowFbm(vec2 p) {
          float s = 0.0, a = 0.5;
          for (int i = 0; i < 3; i++) { s += snowNoise(p) * a; p *= 2.09; a *= 0.5; }
          return s;
        }
        // Hoehenfeld der Schneeoberflaeche: lange, vom Wind gezogene Rippen
        // plus feine Koernung. Wird nur fuer die Normale benutzt.
        float snowRelief(vec2 p) {
          float drift = snowFbm(vec2(p.x * 0.16 + p.y * 0.05, p.y * 0.42));
          float grain = snowFbm(p * 1.6 + 17.0);
          return drift * 0.34 + grain * 0.10;
        }
      `,
      )
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `
        #include <normal_fragment_begin>
        {
          vec2 wp = vTerrainXZ;
          float e = 0.42;
          float h0 = snowRelief(wp);
          float hx = snowRelief(wp + vec2(e, 0.0));
          float hz = snowRelief(wp + vec2(0.0, e));
          vec3 bump = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e));
          // Innerhalb der Spur ist der Schnee glattgedrueckt.
          // Schrift (Blau) gilt ebenfalls als glatt: das Wind-Relief liess
          // die Buchstaben im frischen Schnee ausfransen.
          vec4 tp = texture2D(uTrail, wp / uWorldSize + 0.5);
          float packed = max(tp.r, tp.b);
          vec3 rough = normalize(normal + (bump - vec3(0.0, 1.0, 0.0)) * 1.35);
          normal = normalize(mix(rough, normal, max(packed * 0.8, vPreparation * 0.94)));
        }
      `,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        {
          vec4 t = texture2D(uTrail, vTerrainXZ / uWorldSize + 0.5);
          // Frisch aufgeworfener Schnee am Spurrand ist heller als der Rest.
          float rim = max(0.0, t.g - t.r);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.74, 0.81, 0.98), t.r * 0.85);
          diffuseColor.rgb += rim * 0.06;
          // In den Schnee geschriebene Zeichen: deutlich dunkler, damit sie
          // auch aus der Distanz lesbar bleiben.
          // Kraeftiger als vorher (0.46/0.55/0.76): mit weniger Relief traegt
          // die Farbe die Lesbarkeit allein.
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.3, 0.42, 0.72), t.b * 0.95);
        }
      `,
      )
      .replace(
        '#include <dithering_fragment>',
        /* glsl */ `
        #include <dithering_fragment>
        {
          // Eiskristalle: einzelne Pixel, die nur unter bestimmten Winkeln
          // aufblitzen. Sehr subtil dosiert – es soll glitzern, nicht rauschen.
          vec2 cell = floor(vTerrainXZ * 46.0);
          float rnd = snowHash(cell);
          float facet = snowHash(cell + 7.3);
          vec3 V = normalize(vViewPosition);
          float align = pow(max(dot(normalize(normal), normalize(V + vec3(facet - 0.5, 1.0, rnd - 0.5))), 0.0), 220.0);
          float spark = step(0.986, rnd) * align;
          gl_FragColor.rgb += vec3(0.9, 0.95, 1.0) * spark * 2.2;
        }
      `,
      )
      // In der Rille ist der Schnee verdichtet und glaenzt etwas mehr.
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.42, texture2D(uTrail, vTerrainXZ / uWorldSize + 0.5).r);
      `,
      )
  }

  // Erzwingt einen eigenen Programm-Cache-Eintrag.
  material.customProgramCacheKey = () => 'snow-terrain-v5'
  return material
}

export function createTerrain(trailTexture) {
  const geometry = buildGeometry()
  const material = patchMaterial(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.6,
    }),
    trailTexture,
  )

  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  mesh.castShadow = false
  mesh.name = 'terrain'
  return mesh
}
