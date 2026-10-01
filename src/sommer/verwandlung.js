import * as THREE from 'three'

// Der Uebergang zwischen Winter und Sommer. Beide Welten zeichnen in eine
// eigene Flaeche, ein Bild ueber den ganzen Schirm mischt sie. Im Spiel sonst
// nie: nur waehrend der gut anderthalb Sekunden, in denen beide zu sehen sind.
//
// Gezeichnet wird linear und ohne Tonwertabbildung (three.js macht beides
// nur beim Zeichnen ins Bild); ACES und sRGB kommen hier am Ende dazu. So
// sehen beide Welten im Uebergang genau so aus wie davor und danach.
//
// Abtauchen: die Kamera stuerzt aufs Eis zu, ein heller Ring, und aus dem
// Wasser taucht der Sommer auf. Rueckwaerts (Sommer -> Winter) laeuft
// derselbe Weg von 1 nach 0. Eine Tauwelle (Ring vom Fahrer aus, aussen
// Winter, innen Sommer) stand zur Wahl; Julian nahm das Abtauchen (01.10.).
// Sie steckt in 39a4402, falls sie noch einmal gebraucht wird.

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D tWinter;
  uniform sampler2D tSommer;
  uniform vec2 uMitte;       // Fahrer im Bild, 0..1
  uniform float uAspect;     // Breite / Hoehe
  uniform float uP;          // 0 = Winter, 1 = Sommer
  uniform float uZeit;

  vec3 tauchen(vec2 uv) {
    // Erste Haelfte: Winter zoomt zum Fahrer hin. Zweite: Sommer zoomt aus
    // der Naehe zurueck. Dazwischen ein heller Ring auf dem Wasser.
    float h = smoothstep(0.0, 0.5, uP);
    float z = mix(1.0, 3.2, h * h);
    float t = smoothstep(0.5, 1.0, uP);
    float zs = mix(2.6, 1.0, 1.0 - (1.0 - t) * (1.0 - t));
    vec2 d = (uv - uMitte) * vec2(uAspect, 1.0);
    float r = length(d);
    float wellen = sin(r * 70.0 - uZeit * 14.0) * 0.006 * (1.0 - abs(uP - 0.5) * 2.0);
    vec2 n = r > 0.0001 ? d / r / vec2(uAspect, 1.0) : vec2(0.0);
    vec3 w = texture2D(tWinter, uMitte + (uv - uMitte) / z + n * wellen).rgb;
    vec3 s = texture2D(tSommer, uMitte + (uv - uMitte) / zs + n * wellen).rgb;
    float m = smoothstep(0.42, 0.58, uP);
    vec3 col = mix(w, s, m);
    float blitz = exp(-pow((uP - 0.5) / 0.09, 2.0));
    float ring = exp(-pow(r - (uP - 0.4) * 2.2, 2.0) / 0.003) * step(0.4, uP) * (1.0 - t);
    col = mix(col, vec3(0.92, 0.97, 1.0) * 1.6, blitz * 0.85);
    col += vec3(0.8, 0.95, 1.1) * ring * 0.8;
    return col;
  }

  void main() {
    vec3 col = tauchen(vUv);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export class Verwandlung {
  constructor(renderer) {
    this.renderer = renderer
    const flaeche = () => new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      // Kantenglaettung wie im Bild; ohne sie flimmerten Tannen und Seil
      // genau in den anderthalb Sekunden, in denen man hinsieht.
      samples: 4,
    })
    this.winter = flaeche()
    this.sommer = flaeche()
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tWinter: { value: this.winter.texture },
        tSommer: { value: this.sommer.texture },
        uMitte: { value: new THREE.Vector2(0.5, 0.5) },
        uAspect: { value: 1 },
        uP: { value: 0 },
        uZeit: { value: 0 },
      },
    })
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material)
    this.quad.frustumCulled = false
    this.szene = new THREE.Scene()
    this.szene.add(this.quad)
    this.kamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this._v = new THREE.Vector3()
  }

  _groesse() {
    const r = this.renderer
    const v = r.getDrawingBufferSize(new THREE.Vector2())
    if (this.winter.width !== v.x || this.winter.height !== v.y) {
      this.winter.setSize(v.x, v.y)
      this.sommer.setSize(v.x, v.y)
    }
    return v
  }

  // Wo `punkt` mit `kamera` im Bild liegt, 0..1 von links unten.
  mitteAus(punkt, kamera) {
    this._v.copy(punkt).project(kamera)
    this.material.uniforms.uMitte.value.set(this._v.x * 0.5 + 0.5, this._v.y * 0.5 + 0.5)
  }

  // p: 0 Winter .. 1 Sommer. zeichneWinter/zeichneSommer bekommen das Ziel.
  zeichnen(p, zeit, zeichneWinter, zeichneSommer) {
    const v = this._groesse()
    const u = this.material.uniforms
    u.uP.value = p
    u.uZeit.value = zeit
    u.uAspect.value = v.x / v.y
    zeichneWinter(this.winter)
    zeichneSommer(this.sommer)
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.szene, this.kamera)
  }

  dispose() {
    this.winter.dispose()
    this.sommer.dispose()
    this.material.dispose()
  }
}
