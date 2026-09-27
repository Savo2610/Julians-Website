import * as THREE from 'three'
import { WORLD, TRAIL } from '../config.js'

// Die Schneespur lebt in einer einzigen Textur, die das ganze Tal von oben
// abdeckt. Pro Frame werden nur die neu befahrenen Segmente hineingestempelt,
// akkumuliert per Max-Blending. Kanal R = Rille, Kanal G = aufgeworfener Wall.
// Das Terrain-Material liest die Textur im Vertex-Shader und verformt sich.

const MAX_STAMPS_PER_FRAME = 96

const stampVert = /* glsl */ `
  attribute vec2 aStart;
  attribute vec2 aEnd;
  attribute float aWidth;
  uniform float uWorldSize;
  varying vec2 vWorld;
  varying vec2 vSeg0;
  varying vec2 vSeg1;
  varying float vWidth;

  void main() {
    vec2 mid = (aStart + aEnd) * 0.5;
    vec2 delta = aEnd - aStart;
    float len = length(delta);
    vec2 dir = len > 0.0001 ? delta / len : vec2(1.0, 0.0);
    vec2 nrm = vec2(-dir.y, dir.x);

    // Quad grosszuegig aufziehen, damit auch der weiche Wall am Rand Platz hat.
    float halfLen = len * 0.5 + aWidth * 2.6;
    float halfWid = aWidth * 2.6;
    vec2 world = mid + dir * (position.x * halfLen) + nrm * (position.y * halfWid);

    vWorld = world;
    vSeg0 = aStart;
    vSeg1 = aEnd;
    vWidth = aWidth;

    // Direkt nach NDC – die Textur deckt exakt das Tal ab, keine Kamera noetig.
    gl_Position = vec4(world / (uWorldSize * 0.5), 0.0, 1.0);
  }
`

const stampFrag = /* glsl */ `
  precision highp float;
  varying vec2 vWorld;
  varying vec2 vSeg0;
  varying vec2 vSeg1;
  varying float vWidth;

  float segDist(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }

  void main() {
    float d = segDist(vWorld, vSeg0, vSeg1);
    float groove = 1.0 - smoothstep(vWidth * 0.5, vWidth * 1.25, d);
    float wall = 1.0 - smoothstep(vWidth * 1.0, vWidth * 2.4, d);
    gl_FragColor = vec4(groove, wall, 0.0, 1.0);
  }
`

// Ein Abziehbild, das dauerhaft in den Schnee gedrueckt wird – fuer Schrift
// und Symbole. Der Rot-Kanal der Textur wird zur Rille, der Gruen-Kanal zum
// aufgeworfenen Rand. So sieht Schrift aus, als waere sie in den Schnee
// getreten, statt aufgemalt.
const decalVert = /* glsl */ `
  uniform vec2 uCenter;
  uniform vec2 uSize;
  uniform float uRotation;
  uniform float uWorldSize;
  varying vec2 vUv;

  void main() {
    // Die Textur-Y-Achse zeigt in der Welt nach +Z, im Bild aber nach unten.
    // Gespiegelt wird deshalb die UV und nicht die Geometrie – sonst kehrt
    // sich die Winding-Order um und das Quad wird weggecullt.
    vUv = vec2(uv.x, 1.0 - uv.y);
    vec2 local = position.xy * uSize;
    float c = cos(uRotation);
    float s = sin(uRotation);
    vec2 world = uCenter + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
    gl_Position = vec4(world / (uWorldSize * 0.5), 0.0, 1.0);
  }
`

const decalFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform float uStrength;
  uniform float uRelief;
  varying vec2 vUv;

  void main() {
    vec4 t = texture2D(uMap, vUv);
    // Blau markiert bewusst gesetzte Zeichnung. Fahrspuren lassen den Kanal
    // leer – so kann das Terrain Schrift deutlich einfaerben, ohne dass jede
    // Spur zur Tintenspur wird.
    // uRelief nimmt Rille und Wall zurueck, ohne die Farbe anzutasten: bei
    // Schrift ist die Farbe das, was man liest, und das Relief das, was sie
    // im frischen Schnee verwischt.
    gl_FragColor = vec4(t.r * uStrength * uRelief, t.g * uStrength * uRelief, t.r * uStrength, 1.0);
  }
`

export class SnowTrail {
  constructor(renderer) {
    this.renderer = renderer

    this.target = new THREE.WebGLRenderTarget(TRAIL.resolution, TRAIL.resolution, {
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    })
    this.target.texture.wrapS = THREE.ClampToEdgeWrapping
    this.target.texture.wrapT = THREE.ClampToEdgeWrapping

    const base = new THREE.PlaneGeometry(2, 2)
    const geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index
    geo.setAttribute('position', base.getAttribute('position'))
    geo.setAttribute('aStart', new THREE.InstancedBufferAttribute(new Float32Array(MAX_STAMPS_PER_FRAME * 2), 2))
    geo.setAttribute('aEnd', new THREE.InstancedBufferAttribute(new Float32Array(MAX_STAMPS_PER_FRAME * 2), 2))
    geo.setAttribute('aWidth', new THREE.InstancedBufferAttribute(new Float32Array(MAX_STAMPS_PER_FRAME), 1))
    geo.instanceCount = 0
    base.dispose()

    const mat = new THREE.ShaderMaterial({
      vertexShader: stampVert,
      fragmentShader: stampFrag,
      depthTest: false,
      depthWrite: false,
      // Max-Blending: mehrfach ueberfahrene Stellen werden nicht heller als 1.
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.MaxEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: { uWorldSize: { value: WORLD.size } },
    })

    this.mesh = new THREE.Mesh(geo, mat)
    this.mesh.frustumCulled = false
    this.scene = new THREE.Scene()
    this.scene.add(this.mesh)
    this.camera = new THREE.Camera()

    this.pending = 0

    // Zweites, einzeln gerendertes Mesh fuer Abziehbilder.
    this.decalMaterial = new THREE.ShaderMaterial({
      vertexShader: decalVert,
      fragmentShader: decalFrag,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.MaxEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.MaxEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
      uniforms: {
        uMap: { value: null },
        uCenter: { value: new THREE.Vector2() },
        uSize: { value: new THREE.Vector2(1, 1) },
        uRotation: { value: 0 },
        uWorldSize: { value: WORLD.size },
        uStrength: { value: 1 },
        uRelief: { value: 1 },
      },
    })
    this.decalMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.decalMaterial)
    this.decalMesh.frustumCulled = false
    this.decalScene = new THREE.Scene()
    this.decalScene.add(this.decalMesh)

    this.clearTarget()
  }

  // Zeichnet eine Textur einmalig in den Schnee. width/height in Welteinheiten.
  stampDecal(texture, x, z, width, height, rotation = 0, strength = 1, relief = 1) {
    const u = this.decalMaterial.uniforms
    u.uRelief.value = relief
    u.uMap.value = texture
    u.uCenter.value.set(x, z)
    u.uSize.value.set(width / 2, height / 2)
    u.uRotation.value = rotation
    u.uStrength.value = strength

    const prevTarget = this.renderer.getRenderTarget()
    const prevAutoClear = this.renderer.autoClear
    this.renderer.autoClear = false
    this.renderer.setRenderTarget(this.target)
    this.renderer.render(this.decalScene, this.camera)
    this.renderer.setRenderTarget(prevTarget)
    this.renderer.autoClear = prevAutoClear
  }

  clearTarget() {
    const prev = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(this.target)
    this.renderer.setClearColor(0x000000, 1)
    this.renderer.clear(true, false, false)
    this.renderer.setRenderTarget(prev)
  }

  // Ein befahrenes Segment vormerken. Wird erst in flush() gezeichnet.
  stamp(x0, z0, x1, z1, width = TRAIL.width) {
    if (this.pending >= MAX_STAMPS_PER_FRAME) return
    const i = this.pending
    const g = this.mesh.geometry
    const s = g.getAttribute('aStart')
    const e = g.getAttribute('aEnd')
    const w = g.getAttribute('aWidth')
    s.array[i * 2] = x0
    s.array[i * 2 + 1] = z0
    e.array[i * 2] = x1
    e.array[i * 2 + 1] = z1
    w.array[i] = width
    this.pending++
  }

  flush() {
    if (this.pending === 0) return
    const g = this.mesh.geometry
    g.getAttribute('aStart').needsUpdate = true
    g.getAttribute('aEnd').needsUpdate = true
    g.getAttribute('aWidth').needsUpdate = true
    g.instanceCount = this.pending

    const prevTarget = this.renderer.getRenderTarget()
    const prevAutoClear = this.renderer.autoClear
    this.renderer.autoClear = false
    this.renderer.setRenderTarget(this.target)
    this.renderer.render(this.scene, this.camera)
    this.renderer.setRenderTarget(prevTarget)
    this.renderer.autoClear = prevAutoClear

    this.pending = 0
  }

  get texture() {
    return this.target.texture
  }
}
