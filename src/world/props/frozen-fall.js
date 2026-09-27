import * as THREE from 'three'
import { assemble, vertexColorMaterial, jitter } from '../../core/geometry.js'
import { makeRng } from '../../core/rng.js'
import { createBoulder } from './rocks.js'

// Die gefrorene Quelle am See. Das Wasser, das hier ueber den Fels lief,
// ist mitten im Fallen erstarrt – und im Eis steckt, was gerade auf
// broadcast.veerka.mp gesendet wird: ein Bild, ein Video oder ein Text,
// eingefroren wie ein Blatt im Bach.
//
// Aus der Ferne ist es nur ein bereifter Eisfall, durch den etwas Farbe
// schimmert. Faehrt man auf den See, taut der Reif von der Mitte her weg;
// auf der vorderen Haelfte des Sees ist das Bild ganz klar. Das ist das
// Versteck: man muss hin, um es zu sehen.
//
// Der Fall reicht vom Seeeis (Fuss 1,9 m vor dem Ufer) die Boeschung
// hinauf bis zu ihrer Kante, 5,2 m breit und 4,4 m hoch, gerahmt von
// Felsen mit Zapfen. Er lehnt 0,5 rad zurueck: senkrecht waere das Bild
// bei 36 Grad Kamerahoehe auf 59 % seiner Hoehe gestaucht (sin 36°), so
// sind es 86 %. Steiler geht nicht – bei 0,55 stuende die Boeschung
// durch das Eis.

export const FALL = { width: 5.2, height: 4.4, lean: 0.5 }

const ICE_DEEP = 0x397d94     // dieselben Toene wie der See davor
const ICE_SHALLOW = 0x83b8c8

const vert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vViewT;
  varying float vBulge;
  void main() {
    vUv = uv;
    vec3 p = position;
    // Unten dicker als oben: dort hat sich das Eis gestaut. Quer laufen
    // Rinnen, wie sie ein gefrorener Wasserfall hat.
    float across = 1.0 - pow(abs(uv.x * 2.0 - 1.0), 2.2);
    float bulge = across * mix(0.22, 0.05, uv.y);
    bulge += sin(uv.x * 38.0 + sin(uv.y * 5.0) * 1.4) * 0.018 * across;
    // Unten laeuft das Eis nach vorn in das Becken aus, wie eine Schuerze.
    float apron = pow(1.0 - uv.y, 3.0) * 0.3;
    p.z += bulge + apron;
    p.y += apron * 0.25;
    vBulge = bulge;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    // Blickrichtung im Raum der Flaeche – fuer die Parallaxe, die das Bild
    // ein Stueck ins Eis hineinsetzt.
    vec3 V = cameraPosition - wp.xyz;
    vec3 T = normalize(modelMatrix[0].xyz);
    vec3 B = normalize(modelMatrix[1].xyz);
    vec3 N = normalize(modelMatrix[2].xyz);
    vViewT = vec3(dot(V, T), dot(V, B), dot(V, N));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vViewT;
  varying float vBulge;
  uniform sampler2D uMedia;
  uniform sampler2D uPrev;
  uniform float uMix;          // 0 = uPrev, 1 = uMedia (Ueberblendung)
  uniform float uMediaAspect;
  uniform float uPrevAspect;
  uniform float uHas;          // 0..1: steckt ueberhaupt etwas im Eis
  uniform float uClear;        // 0..1: wie weit der Reif weggetaut ist
  uniform float uLive;
  uniform float uFlash;
  uniform float uTime;
  uniform float uAspect;       // Breite/Hoehe der Flaeche
  uniform vec3 uDeep;
  uniform vec3 uShallow;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { s += noise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; }
    return s;
  }

  // Bild so in das innere Fenster legen, dass es es ganz fuellt (cover).
  vec2 cover(vec2 uv, float aspect) {
    vec2 inner = vec2(uAspect * 0.86, 0.82);
    float want = inner.x / inner.y;
    vec2 s = aspect > want ? vec2(want / aspect, 1.0) : vec2(1.0, aspect / want);
    return (uv - 0.5) * s + 0.5;
  }

  void main() {
    vec2 uv = vUv;

    // --- Umriss: oben eine gewellte Kante, wo das Wasser ueber den Fels
    // kam, seitlich nach unten breiter, wie sich ein Eisfall auffaechert.
    float halfW = mix(0.5, 0.39, smoothstep(0.0, 1.0, uv.y)) - 0.018 * sin(uv.y * 23.0 + 1.3) - 0.02 * noise(uv * vec2(3.0, 14.0));
    float side = halfW - abs(uv.x - 0.5);
    float top = 0.97 - 0.09 * pow(abs(uv.x - 0.5) * 2.0, 1.6) + 0.025 * sin(uv.x * 19.0) - 0.03 * noise(uv * 9.0);
    // Unten franst das Eis in Saeulen aus, die ins Becken reichen.
    float foot = uv.y - 0.035 * (1.0 - abs(sin(uv.x * 21.0 + 0.7))) * noise(uv * vec2(30.0, 3.0)) * 1.6;
    float edge = min(min(side * uAspect, top - uv.y), foot + 0.02);
    if (edge < 0.0) discard;
    float rim = 1.0 - smoothstep(0.0, 0.05, edge);

    // --- Das Eis selbst.
    float flute = sin(uv.x * 38.0 + sin(uv.y * 5.0) * 1.4);
    float grain = fbm(uv * vec2(4.0 * uAspect, 9.0));
    vec3 ice = mix(uShallow, uDeep, 0.35 + 0.45 * smoothstep(0.02, 0.2, vBulge) - 0.2 * grain);
    ice += vec3(0.1, 0.13, 0.14) * smoothstep(0.55, 1.0, flute) * 0.8;

    // --- Das Eingefrorene. Es sitzt ein Stueck hinter der Oberflaeche
    // (Parallaxe) und wird von den Rinnen leicht verzogen.
    vec2 windowUv = (uv - vec2(0.07, 0.07)) / vec2(0.86, 0.82);
    vec2 par = vViewT.xy / max(vViewT.z, 0.3) * 0.035;
    vec2 wob = vec2(cos(uv.x * 38.0 + sin(uv.y * 5.0) * 1.4) * 0.006, (grain - 0.5) * 0.012);
    vec2 muv = windowUv - par + wob * (1.3 - uClear);

    // --- Reif: dichter Filz aus Rauschen. Er taut von der Mitte her auf,
    // mit ausgefranster Grenze.
    vec2 c = (uv - vec2(0.5, 0.47)) * vec2(uAspect, 1.0);
    float frayed = (fbm(uv * 6.0 + 3.1) - 0.5) * 0.5;
    float reach = uClear * 1.25;
    float thawed = 1.0 - smoothstep(reach - 0.22, reach, length(c) + frayed);
    float frostTex = smoothstep(0.3, 0.8, fbm(uv * vec2(9.0 * uAspect, 9.0) + 7.0));
    float frost = mix(0.55 + 0.4 * frostTex, 0.06 * frostTex, thawed);
    frost = max(frost, rim * 0.8);

    float blur = frost * 4.5;
    vec4 now = texture2D(uMedia, cover(muv, uMediaAspect), blur);
    vec4 before = texture2D(uPrev, cover(muv, uPrevAspect), blur);
    vec4 m = mix(before, now, uMix);
    // Zum Rand des Fensters hin verliert sich das Bild im Eis.
    vec2 w = smoothstep(vec2(0.0), vec2(0.09), windowUv) * smoothstep(vec2(0.0), vec2(0.09), 1.0 - windowUv);
    float vis = uHas * m.a * w.x * w.y;
    // Im Eis ist alles etwas kuehler; aufgetaut kommt die echte Farbe durch.
    vec3 mcol = mix(m.rgb * vec3(0.72, 0.9, 1.0) + vec3(0.02, 0.06, 0.09), m.rgb, 0.35 + 0.6 * thawed);
    vec3 col = mix(ice, mcol, vis * (0.35 + 0.65 * (1.0 - frost)));

    // Die Rinnen des Eisfalls laufen auch ueber das Bild: senkrechte helle
    // Striche und ein paar Risse, damit es im Eis steckt und nicht darauf klebt.
    float streak = smoothstep(0.75, 1.0, flute) * (0.35 + 0.65 * noise(vec2(uv.x * 40.0, uv.y * 2.0)));
    col += vec3(0.75, 0.9, 1.0) * streak * 0.16;
    float veins = abs(fbm(uv * vec2(1.4 * uAspect, 1.6) + 4.0) - 0.5) * 2.0;
    col = mix(col, vec3(0.92, 0.98, 1.0), (1.0 - smoothstep(0.008, 0.03, veins)) * 0.3 * (1.0 - vis * 0.5));

    // Eingeschlossene Luftblasen, ein paar Dutzend feine Punkte.
    vec2 cell = uv * vec2(22.0 * uAspect, 22.0);
    vec2 id = floor(cell);
    float h = hash(id);
    float bubble = step(0.86, h) * (1.0 - smoothstep(0.06, 0.13, length(fract(cell) - 0.3 - 0.4 * vec2(hash(id + 1.7), hash(id + 3.1)))));
    col = mix(col, vec3(0.93, 0.98, 1.0), bubble * 0.55 * (1.0 - vis * 0.6));

    // Reif obendrauf.
    col = mix(col, vec3(0.84, 0.93, 0.97), frost * (0.45 + 0.35 * frostTex) * (1.0 - vis * 0.25));

    // Die rote Lampe des Funkturms, mit eingefroren. Sie atmet, solange
    // etwas gesendet wird – wie auf broadcast.veerka.mp – und leuchtet
    // auch durch den Reif, damit man sie aus der Ferne ahnt.
    vec2 lampPos = vec2(0.845, 0.66);
    float ld = length((uv - lampPos) * vec2(uAspect, 1.0));
    float pulse = 0.5 + 0.5 * sin(uTime * 2.4);
    col = mix(col, vec3(1.0, 0.33, 0.27), (1.0 - smoothstep(0.018, 0.028, ld)) * uLive * (0.55 + 0.45 * pulse));
    col += vec3(1.0, 0.32, 0.22) * exp(-ld * 18.0) * uLive * pulse * 0.6;

    // Glanzstreif, der langsam ueber das Eis wandert – aus der Ferne das
    // Einzige, was hier blinkt.
    float band = fract((uv.x * 0.8 + uv.y * 0.55) * 0.5 - uTime * 0.045);
    col += vec3(0.85, 0.95, 1.0) * smoothstep(0.0, 0.04, band) * (1.0 - smoothstep(0.04, 0.1, band)) * 0.22;

    // Weisse, dicke Kante, damit der Umriss auf Fels und Schnee steht.
    col = mix(col, vec3(0.94, 0.98, 1.0), rim * 0.75);
    col += vec3(0.55, 0.75, 0.85) * uFlash;

    float alpha = mix(0.93, 1.0, max(frost, vis)) * smoothstep(0.0, 0.012, edge);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

// Schein auf dem Schnee vor dem Eis, in der Farbe des Bildes.
const glowVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const glowFrag = /* glsl */ `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uStrength;
  void main() {
    float d = length((vUv - 0.5) * 2.0);
    float a = (1.0 - smoothstep(0.0, 1.0, d));
    gl_FragColor = vec4(uColor * a * a * uStrength, 1.0);
  }
`

function blank() {
  const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1)
  t.needsUpdate = true
  return t
}

export function createFrozenFall() {
  const rng = makeRng(270926)
  const { width: W, height: H, lean } = FALL
  const group = new THREE.Group()
  group.name = 'gefrorene-quelle'

  // Alles, was am Fels lehnt, sitzt in der gekippten Gruppe.
  const tilt = new THREE.Group()
  tilt.rotation.x = -lean
  group.add(tilt)

  const empty = blank()
  const uniforms = {
    uMedia: { value: empty },
    uPrev: { value: empty },
    uMix: { value: 1 },
    uMediaAspect: { value: 1 },
    uPrevAspect: { value: 1 },
    uHas: { value: 0 },
    uClear: { value: 0 },
    uLive: { value: 0 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
    uAspect: { value: W / H },
    uDeep: { value: new THREE.Color(ICE_DEEP) },
    uShallow: { value: new THREE.Color(ICE_SHALLOW) },
  }
  const geo = new THREE.PlaneGeometry(W, H, 40, 30)
  geo.translate(0, H / 2, 0)
  const sheet = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, uniforms, transparent: true,
  }))
  sheet.name = 'eisfall'
  tilt.add(sheet)

  // --- Der Rahmen aus Fels. Links und rechts je drei Steine die Boeschung
  // hinunter, oben ein Sturz aus vier Steinen, von dem die Quelle kam.
  // Ohne ihn stand die grosse Eisflaeche frei im Hang wie eine Leinwand im
  // Schnee; mit ihm ist sie ein Loch im Fels, aus dem das Wasser trat.
  // Die Steine sitzen in der gekippten Gruppe, damit sie der Flaeche folgen.
  const halfAt = (v) => 0.5 + (0.39 - 0.5) * (v * v * (3 - 2 * v))
  const stones = []
  const stone = (x, y, z, s, seed) => {
    const m = createBoulder(seed, s)
    m.position.set(x, y, z)
    m.rotation.set(rng() * 0.6, rng() * Math.PI * 2, rng() * 0.4)
    tilt.add(m)
    stones.push({ mesh: m, r: s * 1.15 })
    return m
  }
  for (const side of [-1, 1]) {
    ;[[0.08, 0.95], [0.42, 0.85], [0.74, 0.8]].forEach(([v, s], i) => {
      const x = side * (halfAt(v) * W + s * 0.95)
      stone(x, v * H, -0.1 - i * 0.1, s * (0.9 + rng() * 0.2), 7100 + i * 7 + (side > 0 ? 3 : 0))
    })
  }
  ;[-0.36, -0.12, 0.12, 0.36].forEach((u, i) => {
    const s = 0.78 + rng() * 0.22 + (Math.abs(u) < 0.2 ? 0.1 : 0)
    stone(u * W, H * 0.98 + s * 0.55, -0.4, s, 7200 + i * 5)
  })

  // --- Schnee auf den Steinen. Die Findlinge im Tal tragen ihn auf den
  // Oberseiten; hier sind die Steine mit der Flaeche gekippt, dadurch lag
  // er schief und fast nirgends. Also eigene Hauben, oben auf dem Sturz
  // dick, an den Seiten nur auf den oberen Steinen.
  const caps = []
  stones.forEach(({ mesh, r }, k) => {
    const oben = k >= 6
    if (!oben && k % 3 === 0) return
    const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed()
    jitter(g, 0.14, rng)
    caps.push({
      geo: g, color: 0xf6fbff,
      position: [mesh.position.x, mesh.position.y + r * (oben ? 0.62 : 0.55), mesh.position.z - r * 0.15],
      scale: [r * (oben ? 0.8 : 0.6), r * 0.22, r * 0.62],
      rotation: [lean, rng() * 3, 0],
    })
  })
  const capMesh = new THREE.Mesh(assemble(caps), vertexColorMaterial({ roughness: 0.9 }))
  capMesh.castShadow = true
  capMesh.receiveShadow = true
  tilt.add(capMesh)

  // --- Zapfen: an der Unterseite jedes Steins, zur Kamera hin, dazu die
  // Oberkante des Eises. Am Sturz lang, an den Seiten kurz. In der
  // gekippten Gruppe muessen sie um den Neigungswinkel zurueckgedreht
  // werden, sonst haengen sie schraeg.
  const icicles = []
  const zapfen = (x, y, z, long, r, dunkel) => {
    const g = new THREE.ConeGeometry(r, long, 5)
    // Basis oben, Spitze nach der Drehung nach unten.
    g.translate(0, long / 2, 0)
    icicles.push({
      geo: g,
      color: dunkel ? 0x8cc3d3 : 0xc4e8ef,
      position: [x, y, z],
      rotation: [Math.PI + lean, 0, (rng() - 0.5) * 0.18],
    })
  }
  stones.forEach(({ mesh, r }, k) => {
    const oben = k >= 6
    const n = oben ? 9 : 4
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * 1.5
      const x = mesh.position.x + Math.sin(a) * r * 0.75
      const y = mesh.position.y - r * (oben ? 0.28 : 0.1) - Math.abs(Math.sin(a)) * r * 0.12
      const z = mesh.position.z + Math.cos(a) * r * 0.7
      const long = oben ? 0.35 + rng() * 0.75 : 0.18 + rng() * 0.4
      zapfen(x, y, z, long, (oben ? 0.05 : 0.035) + rng() * 0.04, i % 3 === 0)
    }
  })
  for (let i = 0; i < 20; i++) {
    const u = (i + 0.5 + (rng() - 0.5) * 0.6) / 20
    const topV = 0.97 - 0.09 * Math.pow(Math.abs(u - 0.5) * 2, 1.6) + 0.025 * Math.sin(u * 19)
    zapfen((u - 0.5) * W * 0.78, topV * H - 0.06, 0.12 + rng() * 0.08, 0.25 + rng() * 0.5, 0.03 + rng() * 0.035, i % 3 === 0)
  }
  const icicleMesh = new THREE.Mesh(assemble(icicles), vertexColorMaterial({ roughness: 0.2, metalness: 0.05 }))
  icicleMesh.castShadow = true
  tilt.add(icicleMesh)

  // --- Unten auf dem Seeeis ein paar Brocken, die sich am Fuss gestaut
  // haben – an den Seiten, damit sie nicht vor dem Bild liegen.
  const lumps = []
  for (let i = 0; i < 12; i++) {
    const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed()
    jitter(g, 0.2, rng)
    const s = 0.08 + rng() * 0.12
    const side = i % 2 ? 1 : -1
    lumps.push({
      geo: g, color: i % 2 ? 0xb3dde7 : 0x9fcfdc,
      position: [side * (1.6 + rng() * 1.4), s * 0.4, 0.2 + rng() * 0.7],
      scale: [s * 1.3, s, s],
      rotation: [rng() * 3, rng() * 3, rng() * 3],
    })
  }
  const lumpMesh = new THREE.Mesh(assemble(lumps), vertexColorMaterial({ roughness: 0.25 }))
  lumpMesh.castShadow = true
  group.add(lumpMesh)

  // --- Schein auf dem Schnee, wenn etwas im Eis steckt.
  const glowUniforms = { uColor: { value: new THREE.Color(0x9fd6ff) }, uStrength: { value: 0 } }
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 6).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      vertexShader: glowVert, fragmentShader: glowFrag, uniforms: glowUniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  )
  glow.position.set(0, 0.03, 2.6)
  glow.renderOrder = 2
  group.add(glow)

  // --- Glitzer beim Oeffnen: feine Eiskristalle, die aufsteigen.
  const SPARKS = 36
  const sparkPos = new Float32Array(SPARKS * 3).fill(-999)
  const sparkVel = new Float32Array(SPARKS * 3)
  const sparkLife = new Float32Array(SPARKS)
  const sparkGeo = new THREE.BufferGeometry()
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3).setUsage(THREE.DynamicDrawUsage))
  sparkGeo.setAttribute('life', new THREE.BufferAttribute(sparkLife, 1).setUsage(THREE.DynamicDrawUsage))
  const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float life; varying float vLife;
      void main() { vLife = life; vec4 p = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(60.0 / -p.z, 1.0, 7.0) * (0.4 + life); gl_Position = projectionMatrix * p; }`,
    fragmentShader: `varying float vLife;
      void main() { vec2 q = gl_PointCoord - 0.5; float star = max(1.0 - abs(q.x) * 9.0 - abs(q.y) * 1.6, 1.0 - abs(q.y) * 9.0 - abs(q.x) * 1.6);
        float a = clamp(star, 0.0, 1.0) * clamp(vLife, 0.0, 1.0); if (a <= 0.0) discard; gl_FragColor = vec4(vec3(0.85, 0.95, 1.0) * a, 1.0); }`,
  }))
  sparks.frustumCulled = false
  tilt.add(sparks)

  // --- Zustand
  let sicht = 0           // 0..1 vom Aufrufer: wie klar es aus der Entfernung ist
  let focused = false
  let hasTarget = 0
  let liveTarget = 0
  let glowTarget = 0

  // Kollision in Weltkoordinaten, erst nach dem Aufstellen abzufragen: die
  // Steine des Rahmens und eine Reihe Kreise am Fuss des Eises, damit man
  // vom See aus nicht hineinfaehrt.
  group.userData.colliders = () => {
    group.updateMatrixWorld(true)
    const p = new THREE.Vector3()
    const out = stones.map(({ mesh, r }) => {
      mesh.getWorldPosition(p)
      return { x: p.x, z: p.z, r: r * 0.85 }
    })
    for (let x = -W * 0.42; x <= W * 0.42 + 1e-6; x += W * 0.14) {
      p.set(x, 0, 0.15)
      group.localToWorld(p)
      out.push({ x: p.x, z: p.z, r: 0.5 })
    }
    return out
  }

  group.userData.select = (index) => { focused = index !== null && index !== undefined }
  group.userData.press = () => {
    uniforms.uFlash.value = 0.55
    for (let i = 0; i < SPARKS; i++) {
      sparkPos[i * 3] = (rng() - 0.5) * W * 0.7
      sparkPos[i * 3 + 1] = 0.2 + rng() * H * 0.75
      sparkPos[i * 3 + 2] = 0.15 + rng() * 0.15
      sparkVel[i * 3] = (rng() - 0.5) * 0.5
      sparkVel[i * 3 + 1] = 0.4 + rng() * 0.9
      sparkVel[i * 3 + 2] = 0.3 + rng() * 0.6
      sparkLife[i] = 0.8 + rng() * 0.6
    }
  }
  group.userData.setSicht = (v) => { sicht = v }

  // Neues Bild ins Eis; das alte blendet ueber. Entsorgt werden Texturen
  // von dem, der sie gebaut hat (stations/broadcast.js).
  let current = null
  group.userData.setMedia = (texture, aspect = W / H) => {
    if (texture === current) return
    uniforms.uPrev.value = uniforms.uMedia.value
    uniforms.uPrevAspect.value = uniforms.uMediaAspect.value
    uniforms.uMedia.value = texture ?? empty
    uniforms.uMediaAspect.value = aspect
    uniforms.uMix.value = 0
    current = texture
    hasTarget = texture ? 1 : 0
  }
  group.userData.setAspect = (aspect) => { uniforms.uMediaAspect.value = aspect }
  group.userData.setLive = (v) => { liveTarget = v ? 1 : 0 }
  group.userData.setGlow = (color, strength = 1) => {
    if (color) glowUniforms.uColor.value.set(color)
    glowTarget = strength
  }

  group.userData.animate = (t, dt = 1 / 60) => {
    const ease = (v, to, rate) => v + (to - v) * (1 - Math.exp(-rate * dt))
    uniforms.uTime.value = t
    // Herangezoomt immer ganz aufgetaut, sonst so weit, wie der Aufrufer
    // es nach der Entfernung will.
    const clearTo = focused ? 1 : sicht
    uniforms.uClear.value = ease(uniforms.uClear.value, clearTo, focused ? 1.6 : 1.2)
    uniforms.uHas.value = ease(uniforms.uHas.value, hasTarget, 2.5)
    uniforms.uLive.value = ease(uniforms.uLive.value, liveTarget, 2)
    uniforms.uMix.value = Math.min(1, uniforms.uMix.value + dt / 1.4)
    uniforms.uFlash.value = Math.max(0, uniforms.uFlash.value - dt * 1.8)
    glowUniforms.uStrength.value = ease(glowUniforms.uStrength.value,
      glowTarget * hasTarget * (0.08 + 0.2 * uniforms.uClear.value), 2)

    for (let i = 0; i < SPARKS; i++) {
      if (sparkLife[i] <= 0) continue
      sparkLife[i] -= dt * 0.9
      sparkVel[i * 3 + 1] -= dt * 0.25
      for (let k = 0; k < 3; k++) sparkPos[i * 3 + k] += sparkVel[i * 3 + k] * dt
      if (sparkLife[i] <= 0) sparkPos[i * 3 + 1] = -999
    }
    sparkGeo.attributes.position.needsUpdate = true
    sparkGeo.attributes.life.needsUpdate = true
  }

  return group
}
