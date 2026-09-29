import * as THREE from 'three'
import { COLORS } from '../../config.js'
import { skyColorGlsl } from '../sky.js'

// Ferne Bergkette. Sie steht weit ausserhalb der begehbaren Welt, hat keine
// Kollision und ist nur Kulisse fuer den Drohnen-Rundflug: die feste Kamera
// zeigt mit ihrem oberen Bildrand noch 17 Grad nach unten und sieht den
// Horizont nie, auch nicht vom Gipfel aus.
//
// Vorher standen hier 43 einzelne Kegel. Im Rundflug lasen sie sich als
// Reihe blasser Zipfelmuetzen: keine Grate dazwischen, und ihre Farbe war
// zum Nebel (kuehl, 0xd6e6f5) gemischt, waehrend der Himmel dahinter am
// Horizont warm ist – sie standen grau vor Pfirsich. Jetzt sind es zwei
// durchgehende Grate, und der Dunst ist nicht mehr gemalt, sondern die
// Himmelsfarbe genau hinter jedem Punkt. So loesen sie sich in den Himmel
// auf, gegen die Sonne warm, auf der anderen Seite kuehl.

// Zwei Staffeln hintereinander. Aus der Ferne liest man nur Umrisse, und
// zwei gestaffelte Grate geben mehr Tiefe als ein dicker Ring. Der hintere
// Grat liegt um 380 m: die Himmelskuppel (Radius 506) wandert mit der Kamera,
// und die Drohne kommt bis 114 m an den Rand – 380 + 114 bleibt innen. Was
// dahinter abfaellt, ist ohnehin ganz im Dunst.
const STAFFELN = [
  { mitte: 272, breite: 92, hoehe: 82, skala: 105, blass: 0, saat: 11 },
  { mitte: 372, breite: 120, hoehe: 128, skala: 140, blass: 0.4, saat: 29 },
]
const SEGMENTE = 256      // rund 9 m je Stueck am hinteren Grat – grob genug fuer Low-Poly
const REIHEN = 9
const FUSS = -16          // unter dem Gebirgsrand, damit nie ein Spalt zum Himmel bleibt

// Dunst ueber die Entfernung zur Kamera: bei 272 m ist gut ein Drittel
// Himmel, bei 372 m knapp die Haelfte. Mit 330 statt 600 blieb im Rundflug
// von beiden Graten nur ein Hauch.
const DUNST_WEITE = 600

// Hinter dem Bergarm im Nordwesten steht sie am hoechsten, so setzt sich der
// Gipfel des Tals in ihr fort. Ringsum halb so hoch: mit gleicher Hoehe
// ueberall fuellte sie aus der Drohne ueber dem Lift das obere Bilddrittel.
const NW = new THREE.Vector2(-Math.SQRT1_2, -Math.SQRT1_2)

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

// Wertrauschen auf einem Ganzzahlgitter. Reicht fuer Grate: gebraucht wird
// nur, dass es ueberall stetig und bei jedem Laden gleich ist.
function makeNoise(saat) {
  const hash = (ix, iz) => {
    let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(saat, 2246822519)
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296
  }
  return (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z)
    let fx = x - ix, fz = z - iz
    fx = fx * fx * (3 - 2 * fx)
    fz = fz * fz * (3 - 2 * fz)
    const a = hash(ix, iz), b = hash(ix + 1, iz)
    const c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1)
    return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fz
  }
}

// 1 − |n| macht aus weichen Huegeln scharfe Grate: der Knick liegt dort, wo
// das Rauschen seine Mitte kreuzt.
const ridged = (n) => 1 - Math.abs(n * 2 - 1)

function staffel({ mitte, breite, hoehe, skala, saat }) {
  const noise = makeNoise(saat)
  const innen = mitte - breite * 0.5
  const aussen = mitte + breite * 0.5
  const pos = []
  const s = SEGMENTE + 1

  for (let ir = 0; ir <= REIHEN; ir++) {
    // Reihen zur Vorderkante hin dichter: dort entsteht die Silhouette.
    const r = innen + (aussen - innen) * (ir / REIHEN) ** 1.3
    for (let ia = 0; ia <= SEGMENTE; ia++) {
      const a = (ia / SEGMENTE) * Math.PI * 2
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      let y = FUSS
      if (ir > 0) {
        const huelle = smooth(innen, innen + breite * 0.42, r) * (1 - smooth(mitte + breite * 0.1, aussen, r))
        const grob = ridged(noise(x / skala, z / skala)) ** 1.8
        const fein = ridged(noise(x / (skala * 0.45) + 50, z / (skala * 0.45))) ** 2.5
        const richtung = 0.5 + 0.5 * smooth(-0.6, 1, Math.cos(a) * NW.x + Math.sin(a) * NW.y)
        y = FUSS + huelle * hoehe * richtung * (0.18 + 0.82 * (grob * 0.7 + fein * 0.3))
      }
      pos.push(x, y, z)
    }
  }

  const idx = []
  for (let ir = 0; ir < REIHEN; ir++) {
    for (let ia = 0; ia < SEGMENTE; ia++) {
      const p = ir * s + ia
      idx.push(p, p + 1, p + s, p + 1, p + s + 1, p + s)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  // Flaechen statt weicher Normalen: dieselbe Low-Poly-Sprache wie Tannen
  // und Felsen im Tal, und aus der Ferne ohne Details, die scharf wirken.
  const flach = geo.toNonIndexed()
  flach.computeVertexNormals()
  return flach
}

// Licht und Schnee einmal beim Bauen in die Farben schreiben. Die Kette ist
// unbeleuchtet: ein echtes Licht wuerde sie in den Schatten der Sonne legen
// und kostet jedes Bild. Der Kontrast ist mit Absicht klein – Sonnenseite
// eine Spur waermer, Schattenseite eine Spur blauer, wie im Tal.
function faerben(geo, sunDir, blass) {
  const pos = geo.attributes.position
  const nor = geo.attributes.normal
  const col = new Float32Array(pos.count * 3)
  const fels = new THREE.Color(0x7d90b0)
  const schnee = new THREE.Color(COLORS.snowLit)
  const schatten = new THREE.Color(COLORS.snowShade)
  const sonne = new THREE.Color(COLORS.sun)
  // Luftperspektive zwischen den Staffeln: die hintere ist heller und
  // blauer, sonst stehen beide gleich weit weg.
  const ferne = new THREE.Color(0xdce7f4)
  const c = new THREE.Color()
  const n = new THREE.Vector3()

  // Je Dreieck eine Farbe, sonst verwischen die Facetten wieder.
  for (let i = 0; i < pos.count; i += 3) {
    const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
    n.set(nor.getX(i), nor.getY(i), nor.getZ(i))
    // Schnee bleibt auf flachen Flaechen liegen, an steilen Flanken sieht
    // man Fels. Die Schneegrenze wandert mit der Hoehe.
    const liegt = smooth(0.42, 0.7, n.y) * smooth(4, 28, y)
    c.copy(fels).lerp(schnee, liegt)
    const licht = Math.max(0, n.dot(sunDir))
    c.lerp(schatten, (1 - licht) * 0.5)
    c.lerp(sonne, licht * 0.14)
    c.lerp(ferne, blass)
    for (let k = 0; k < 3; k++) col.set([c.r, c.g, c.b], (i + k) * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
}

const vert = /* glsl */ `
  varying vec3 vColor;
  varying vec3 vWorld;
  void main() {
    vColor = color;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`

const frag = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying vec3 vWorld;
  uniform vec3 uKuppel;
  uniform float uKuppelRadius;
  uniform float uDunstWeite;
  ${skyColorGlsl}

  void main() {
    // Welcher Punkt der Himmelskuppel liegt hinter diesem Stueck Berg? Die
    // Kuppel sitzt nicht auf der Kamera, sondern auf ihrer Grundflaeche –
    // also den Blickstrahl mit der Kugel schneiden, statt nur die Richtung
    // zu nehmen. Sonst stimmt die Farbe am Grat um einige Prozent nicht.
    vec3 o = cameraPosition - uKuppel;
    vec3 d = normalize(vWorld - cameraPosition);
    float b = dot(o, d);
    float c = dot(o, o) - uKuppelRadius * uKuppelRadius;
    float t = -b + sqrt(max(b * b - c, 0.0));
    vec3 himmel = skyColor(normalize(o + d * t));

    float weite = length(vWorld.xz - cameraPosition.xz);
    float dunst = 1.0 - exp(-weite / uDunstWeite);
    // Unten geht der Berg ganz im Dunst auf – eine harte Unterkante wuerde
    // verraten, dass hier eine Kulisse steht.
    dunst = mix(dunst, 1.0, 1.0 - smoothstep(-16.0, 18.0, vWorld.y));

    gl_FragColor = vec4(mix(vColor, himmel, dunst), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export function createBackdrop(scene, sky) {
  const uniforms = sky.dome.material.uniforms
  const teile = STAFFELN.map((s) => {
    const geo = staffel(s)
    faerben(geo, sky.sunDir, s.blass)
    return geo
  })

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    vertexColors: true,
    fog: false,
    // Dieselben Objekte wie in der Kuppel, nicht Kopien: die Wolken ziehen
    // mit uTime, und die Kuppel wandert mit der Kamera.
    uniforms: {
      uTop: uniforms.uTop,
      uHorizon: uniforms.uHorizon,
      uSun: uniforms.uSun,
      uSunDir: uniforms.uSunDir,
      uTime: uniforms.uTime,
      uKuppel: { value: sky.dome.position },
      uKuppelRadius: { value: sky.dome.geometry.parameters.radius },
      uDunstWeite: { value: DUNST_WEITE },
    },
  })

  const group = new THREE.Group()
  group.name = 'backdrop'
  for (const geo of teile) {
    const mesh = new THREE.Mesh(geo, material)
    mesh.renderOrder = -1
    group.add(mesh)
  }
  scene.add(group)
  return group
}
