import * as THREE from 'three'

// Der Uebergang zwischen Winter und Sommer. Beide Welten zeichnen in eine
// eigene Flaeche, ein Bild ueber den ganzen Schirm mischt sie. Im Spiel sonst
// nie: nur waehrend der gut anderthalb Sekunden, in denen beide zu sehen sind.
//
// Gezeichnet wird linear und ohne Tonwertabbildung (three.js macht beides
// nur beim Zeichnen ins Bild); ACES und sRGB kommen hier am Ende dazu. So
// sehen beide Welten im Uebergang genau so aus wie davor und danach.
//
// Zwei Arten, zum Vergleichen (?verwandlung=tauchen):
// - welle:   vom Fahrer aus laeuft ein Tauring ueber das Bild. Aussen Winter,
//            innen Sommer, am Rand bricht das Licht wie an nassem Eis.
// - tauchen: die Kamera stuerzt aufs Eis zu, ein heller Ring, und aus dem
//            Wasser taucht der Sommer auf.
// Rueckwaerts (Sommer -> Winter) laeuft derselbe Weg von 1 nach 0.

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
  uniform float uArt;        // 0 = welle, 1 = tauchen
  uniform float uWeit;       // Radius, der die fernste Bildecke erreicht

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  vec3 welle(vec2 uv) {
    vec2 d = (uv - uMitte) * vec2(uAspect, 1.0);
    float r = length(d);
    float a = atan(d.y, d.x);
    // Ausgefranster Rand: zwei Lagen Rauschen ueber den Winkel, die mitlaufen.
    float rand = (noise(vec2(a * 3.0, uZeit * 0.8)) - 0.5) * 0.09
               + (noise(vec2(a * 11.0, uZeit * 2.0 + 7.0)) - 0.5) * 0.035;
    float p = uP * uP * (3.0 - 2.0 * uP);
    float R = p * (uWeit + 0.16) - 0.04 + rand * smoothstep(0.0, 0.08, p);
    float k = r - R;                       // < 0: schon Sommer
    float rim = exp(-k * k / 0.0016);      // 4 cm breiter Saum

    // Brechung am Rand: radial nach aussen versetzt, im Winter staerker.
    vec2 n = r > 0.0001 ? d / r : vec2(0.0);
    vec2 off = n / vec2(uAspect, 1.0) * rim * 0.035;
    vec3 w = texture2D(tWinter, uv + off).rgb;
    vec3 s = texture2D(tSommer, uv - off * 0.6).rgb;
    float m = smoothstep(0.012, -0.012, k);
    vec3 col = mix(w, s, m);
    // Tau: ein heller, kuehler Schein auf dem Rand, darin Glitzer.
    float glitzer = step(0.985, hash(floor(uv * vec2(uAspect, 1.0) * 220.0) + floor(uZeit * 12.0)));
    col += vec3(0.85, 0.95, 1.1) * rim * (0.55 + glitzer * 2.5) * (1.0 - smoothstep(0.85, 1.0, uP));
    return col;
  }

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
    vec3 col = uArt < 0.5 ? welle(vUv) : tauchen(vUv);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export class Verwandlung {
  constructor(renderer, { art = 'welle' } = {}) {
    this.renderer = renderer
    this.art = art
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
        uArt: { value: art === 'tauchen' ? 1 : 0 },
        uWeit: { value: 1 },
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
    // Bis zur fernsten Ecke, in Bildhoehen gemessen.
    const m = u.uMitte.value
    const ax = Math.max(m.x, 1 - m.x) * u.uAspect.value
    const ay = Math.max(m.y, 1 - m.y)
    u.uWeit.value = Math.hypot(ax, ay)
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
