import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'

// Die Bauteile des Kinderlands.
//
// Alles hier hat dieselbe Handschrift, damit es als ein Ort liest und nicht
// als ausgekippte Spielzeugkiste: dicke runde Formen, dieselben vier Farben,
// und jedes Ding steht auf einem weissen Teller im Schnee. Der Teller ist der
// Trick – er sagt "das wurde hier hingestellt" und bindet Nudelbogen,
// Huetchen, Fahne und Schneemann optisch zusammen.
//
// Was reagiert, reagiert nach demselben Muster: `userData.react(staerke)`
// stoesst an, `userData.animate(t, dt)` laesst ausschwingen. Kein Objekt
// kennt den Fahrer – das Kinderland selbst entscheidet, was wann ausgeloest
// wird.

// Die Farben des Kinderlands. Vier Toene, immer dieselben, immer in dieser
// Reihenfolge – daran erkennt man von oben, dass die Dinge zusammengehoeren.
export const KINDER_COLORS = [0xe8663a, 0x2f6bd8, 0xf2c53d, 0x37b87c]

const SNOW = 0xf7fbff
const POST = 0xd8dee6
const RUBBER = 0x39414a

// Der weisse Teller, auf dem alles steht.
function pad(parts, radius = 0.42) {
  parts.push({
    geo: new THREE.CylinderGeometry(radius, radius * 1.16, 0.08, 12),
    color: SNOW,
    position: [0, 0.04, 0],
  })
}

// Ein federndes Teil bekommt eine Auslenkung und schwingt aus. Rueckgabe ist
// eine Funktion, die den aktuellen Ausschlag liefert.
function springy({ frequency = 7, decay = 3.4 } = {}) {
  let energy = 0
  let phase = 0
  return {
    hit(strength = 1) {
      energy = Math.min(1.2, energy + strength)
      phase = 0
    },
    step(dt) {
      if (energy < 0.001) return 0
      phase += dt * frequency
      energy *= Math.exp(-decay * dt)
      return Math.sin(phase) * energy
    },
    get level() {
      return energy
    },
  }
}

// --- Nudelbogen --------------------------------------------------------------
// Zwei Stangen, dazwischen eine Schaumstoffnudel im Bogen. Man faehrt
// hindurch, die Nudel wackelt. Der Bogen ist aus Segmenten gebaut, damit er
// sich als Ganzes biegen laesst.

export function createNoodleArch({ span = 5.2, height = 2.5, color = 0xe8663a } = {}) {
  const group = new THREE.Group()
  const parts = []
  const half = span / 2

  for (const sx of [-1, 1]) {
    parts.push({
      geo: new THREE.CylinderGeometry(0.075, 0.095, 1.0, 8),
      color: POST,
      position: [sx * half, 0.5, 0],
    })
    pad(parts)
    parts[parts.length - 1].position = [sx * half, 0.04, 0]
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.7 }))
  mesh.castShadow = true
  group.add(mesh)

  // Die Nudel selbst: ein Halbkreis aus dicken Segmenten, abwechselnd hell
  // und dunkel wie eine echte Schwimmnudel.
  const noodle = new THREE.Group()
  noodle.position.y = 1.0
  const segments = 11
  const tone = new THREE.Color(color)
  const pale = tone.clone().lerp(new THREE.Color(0xffffff), 0.42)
  const rise = height - 1.0
  const noodleParts = []
  for (let i = 0; i < segments; i++) {
    const a0 = (i / segments) * Math.PI
    const a1 = ((i + 1) / segments) * Math.PI
    const p0 = new THREE.Vector3(-Math.cos(a0) * half, Math.sin(a0) * rise, 0)
    const p1 = new THREE.Vector3(-Math.cos(a1) * half, Math.sin(a1) * rise, 0)
    const mid = p0.clone().add(p1).multiplyScalar(0.5)
    const dir = p1.clone().sub(p0)
    noodleParts.push({
      geo: new THREE.CylinderGeometry(0.13, 0.13, dir.length() * 1.12, 7),
      color: i % 2 ? pale.getHex() : tone.getHex(),
      position: [mid.x, mid.y, mid.z],
      rotation: [0, 0, Math.atan2(-dir.x, dir.y)],
    })
  }
  const noodleMesh = new THREE.Mesh(assemble(noodleParts), vertexColorMaterial({ roughness: 0.65 }))
  noodleMesh.castShadow = true
  noodle.add(noodleMesh)
  group.add(noodle)

  const spring = springy({ frequency: 9, decay: 3.0 })
  group.userData.react = (s) => spring.hit(s)
  group.userData.animate = (t, dt) => {
    const swing = spring.step(dt)
    // Der Bogen kippt in Fahrtrichtung und wird dabei flacher – so als haette
    // ihn jemand im Vorbeifahren gestreift.
    noodle.rotation.x = swing * 0.34
    noodle.scale.y = 1 - Math.abs(swing) * 0.12
    // Auch ohne Beruehrung atmet er leicht im Wind.
    noodle.rotation.z = Math.sin(t * 1.3 + span) * 0.015
  }
  return group
}

// --- Huetchen ----------------------------------------------------------------
// Kleine Pylonen. Wer eines streift, kippt es um; es richtet sich von selbst
// wieder auf, damit die Bahn nie kaputt bleibt.

export function createCone({ color = 0xe8663a, height = 0.66 } = {}) {
  const group = new THREE.Group()
  const parts = []
  parts.push({
    geo: new THREE.BoxGeometry(0.52, 0.06, 0.52),
    color: RUBBER,
    position: [0, 0.03, 0],
  })
  parts.push({
    geo: new THREE.ConeGeometry(0.19, height, 10),
    color,
    position: [0, height / 2 + 0.05, 0],
  })
  // Reflexring, damit das Huetchen von oben nicht nur ein Farbfleck ist.
  parts.push({
    geo: new THREE.CylinderGeometry(0.145, 0.163, 0.1, 10),
    color: SNOW,
    position: [0, height * 0.55, 0],
  })
  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.6 }))
  mesh.castShadow = true

  const pivot = new THREE.Group()
  pivot.add(mesh)
  group.add(pivot)

  let fall = 0            // 0 = steht, 1 = liegt
  let target = 0
  let axis = 0
  group.userData.react = (s, heading = 0) => {
    if (fall > 0.25) return
    target = Math.min(1, 0.55 + s * 0.7)
    axis = heading
  }
  group.userData.animate = (t, dt) => {
    // Umfallen geht schnell, Aufstehen langsam – sonst wirkt es wie ein
    // Gummiball statt wie ein Huetchen.
    const rate = target > fall ? 11 : 1.5
    fall += (target - fall) * (1 - Math.exp(-rate * dt))
    if (fall > 0.985) target = 0
    pivot.rotation.set(0, axis, 0)
    pivot.rotateX(fall * Math.PI * 0.47)
  }
  return group
}

// Hier stand eine freistehende Wimpelkette zwischen zwei Masten. Sie ist
// entfallen: sie hing im Hang, ohne etwas zu begrenzen, und stand damit neben
// dem Wimpelzaun, der genau das tut. Zwei Sorten Wimpel in einer Anlage sind
// eine zu viel.

// --- Tunnel ------------------------------------------------------------------
// Ein Bogen aus Ringen, durch den man faehrt. Beim Durchfahren laufen die
// Ringe der Reihe nach an – von aussen sieht man, dass drinnen etwas passiert.

export function createSnowTunnel({ length = 5.2, width = 4.4, height = 2.6 } = {}) {
  const group = new THREE.Group()
  const rings = []
  const count = 7
  const shell = []

  for (let i = 0; i < count; i++) {
    const z = (i / (count - 1) - 0.5) * length
    // Der Ring: ein halber Torus, an den Enden etwas dicker.
    const geo = new THREE.TorusGeometry(width / 2, 0.2, 7, 16, Math.PI)
    const ring = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: KINDER_COLORS[i % KINDER_COLORS.length],
      roughness: 0.6,
      emissive: new THREE.Color(KINDER_COLORS[i % KINDER_COLORS.length]),
      emissiveIntensity: 0,
      flatShading: true,
    }))
    ring.position.set(0, 0, z)
    ring.scale.y = height / (width / 2)
    ring.castShadow = true
    group.add(ring)
    rings.push(ring)
  }

  // Die Roehre zwischen den Ringen: ein offener Halbzylinder statt einzelner
  // Platten. Das ist nicht nur weniger Geometrie – die Kamera steht fest, und
  // ein Tunnel, dessen Achse in die Blickrichtung zeigt, zeigt von seinen
  // Ringen nur die Kanten. Erst die geschlossene Schale macht daraus wieder
  // einen Koerper, den man als Roehre liest.
  // Der offene Halbzylinder hat seine Achse auf Y und die Schale auf +X.
  // rotateZ legt die Achse auf X und die Schale nach oben; danach ist Y die
  // Hoehe und Z die Breite. Erst dann skalieren, sonst vertauscht man beide.
  const tube = new THREE.CylinderGeometry(1, 1, length, 20, 1, true, 0, Math.PI)
  tube.rotateZ(Math.PI / 2)
  tube.scale(1, height, width / 2)
  // Die letzte Vierteldrehung stellt die Achse auf Z, wo auch die Ringe liegen.
  shell.push({ geo: tube, color: SNOW, position: [0, 0, 0], rotation: [0, Math.PI / 2, 0] })

  const shellMesh = new THREE.Mesh(assemble(shell), vertexColorMaterial({ roughness: 0.85 }))
  shellMesh.castShadow = true
  shellMesh.receiveShadow = true
  group.add(shellMesh)

  let wave = -1
  group.userData.react = () => { wave = 0 }
  group.userData.animate = (t, dt) => {
    if (wave >= 0) {
      wave += dt * 3.4
      if (wave > count + 1.5) wave = -1
    }
    rings.forEach((ring, i) => {
      // Eine Lichtwelle laeuft von vorn nach hinten durch die Ringe.
      const d = wave < 0 ? 9 : Math.abs(wave - i)
      const lit = Math.max(0, 1 - d * 0.9)
      // Immer ein leichtes Glimmen, damit die Roehre auch im Ruhezustand
      // nach Innenraum aussieht.
      ring.material.emissiveIntensity = 0.12 + lit * 0.9
    })
  }
  return group
}

// --- Schneemann --------------------------------------------------------------
// Drei Kugeln, Moehre, Kohleaugen, Astarme, Topfhut. Wer vorbeifaehrt, wird
// angeschaut und bekommt gewinkt.

export function createSnowman({ scale = 1, hat = 0xe8663a, seed = 0 } = {}) {
  const group = new THREE.Group()
  const body = []
  const r0 = 0.62 * scale
  const r1 = 0.44 * scale
  const r2 = 0.31 * scale
  const y0 = r0 * 0.86
  const y1 = y0 + r0 * 0.62 + r1 * 0.36
  const y2 = y1 + r1 * 0.58 + r2 * 0.34

  body.push({ geo: new THREE.SphereGeometry(r0, 12, 9), color: SNOW, position: [0, y0, 0] })
  body.push({ geo: new THREE.SphereGeometry(r1, 12, 9), color: SNOW, position: [0, y1, 0] })
  // Drei Kohleknoepfe auf dem Bauch.
  for (let i = 0; i < 3; i++) {
    body.push({
      geo: new THREE.SphereGeometry(0.045 * scale, 6, 5),
      color: 0x2a2f36,
      position: [0, y1 - r1 * 0.1 + i * 0.16 * scale, r1 * 0.94],
    })
  }
  const bodyMesh = new THREE.Mesh(assemble(body), vertexColorMaterial({ roughness: 0.9 }))
  bodyMesh.castShadow = true
  bodyMesh.receiveShadow = true
  group.add(bodyMesh)

  // Der Kopf sitzt in einer eigenen Gruppe, damit er sich drehen kann.
  const head = new THREE.Group()
  head.position.y = y2
  const headParts = []
  headParts.push({ geo: new THREE.SphereGeometry(r2, 12, 9), color: SNOW, position: [0, 0, 0] })
  for (const sx of [-1, 1]) {
    headParts.push({
      geo: new THREE.SphereGeometry(0.04 * scale, 6, 5),
      color: 0x2a2f36,
      position: [sx * r2 * 0.36, r2 * 0.26, r2 * 0.86],
    })
  }
  headParts.push({
    geo: new THREE.ConeGeometry(0.062 * scale, 0.34 * scale, 7),
    color: 0xe07a2c,
    position: [0, 0, r2 * 0.95 + 0.14 * scale],
    rotation: [Math.PI / 2, 0, 0],
  })
  // Topfhut mit Krempe.
  headParts.push({
    geo: new THREE.CylinderGeometry(r2 * 1.24, r2 * 1.24, 0.05 * scale, 12),
    color: hat,
    position: [0, r2 * 0.88, 0],
  })
  headParts.push({
    geo: new THREE.CylinderGeometry(r2 * 0.78, r2 * 0.84, 0.34 * scale, 12),
    color: hat,
    position: [0, r2 * 1.05 + 0.15 * scale, 0],
  })
  const headMesh = new THREE.Mesh(assemble(headParts), vertexColorMaterial({ roughness: 0.85 }))
  headMesh.castShadow = true
  head.add(headMesh)
  group.add(head)

  // Zwei Astarme, der rechte winkt.
  const arms = []
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group()
    arm.position.set(sx * r1 * 0.9, y1 + r1 * 0.12, 0)
    const stick = []
    stick.push({
      geo: new THREE.CylinderGeometry(0.035 * scale, 0.045 * scale, 0.78 * scale, 6),
      color: 0x6b4f31,
      position: [sx * 0.36 * scale, 0.1 * scale, 0],
      rotation: [0, 0, sx * -1.15],
    })
    stick.push({
      geo: new THREE.CylinderGeometry(0.025 * scale, 0.03 * scale, 0.3 * scale, 5),
      color: 0x6b4f31,
      position: [sx * 0.66 * scale, 0.36 * scale, 0],
      rotation: [0, 0, sx * -0.5],
    })
    const mesh = new THREE.Mesh(assemble(stick), vertexColorMaterial({ roughness: 0.9 }))
    mesh.castShadow = true
    arm.add(mesh)
    group.add(arm)
    arms.push(arm)
  }

  let wave = 0
  let look = 0
  let lookTarget = 0
  group.userData.react = (s, bearing = 0) => {
    wave = Math.min(1.4, wave + 0.9 + s * 0.5)
    lookTarget = THREE.MathUtils.clamp(bearing, -1.1, 1.1)
  }
  group.userData.animate = (t, dt) => {
    wave *= Math.exp(-1.9 * dt)
    if (wave < 0.02) lookTarget *= Math.exp(-0.8 * dt)
    look += (lookTarget - look) * (1 - Math.exp(-4 * dt))
    head.rotation.y = look
    // Leichtes Nicken im Leerlauf, kraeftiges Winken nach dem Anstossen.
    head.rotation.z = Math.sin(t * 0.9 + seed) * 0.03
    arms[1].rotation.z = -wave * 1.15 + Math.sin(t * 9 + seed) * wave * 0.5
    arms[0].rotation.z = Math.sin(t * 0.7 + seed) * 0.04
  }
  return group
}

// --- Wimpelzaun --------------------------------------------------------------
// Die Einfassung des Kinderlands: niedrige Pfosten mit einer Wimpelschnur
// dazwischen, die dem Gelaende folgt.
//
// Das ist das wichtigste Stueck der ganzen Anlage. Ohne Einfassung sind
// Tunnel, Huetchen und Schneemaenner ein paar Dinge, die zufaellig
// nebeneinander im Schnee stehen. Mit ihr sind sie das, was drin ist.

export function createBuntingFence(points, { height = 1.15, spacing = 3.6, sample } = {}) {
  const parts = []
  const at = sample || ((x, z) => 0)

  // Erst die Pfostenplaetze gleichmaessig auf der Polylinie verteilen, damit
  // die Abstaende ueber Ecken hinweg stimmen.
  const posts = []
  let carry = 0
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, z1] = points[i]
    const [x2, z2] = points[i + 1]
    const len = Math.hypot(x2 - x1, z2 - z1)
    if (len < 0.01) continue
    const dx = (x2 - x1) / len
    const dz = (z2 - z1) / len
    for (let d = carry; d < len; d += spacing) {
      const x = x1 + dx * d
      const z = z1 + dz * d
      posts.push({ x, z, y: at(x, z) })
    }
    carry = spacing - ((len - carry) % spacing)
  }
  const last = points[points.length - 1]
  posts.push({ x: last[0], z: last[1], y: at(last[0], last[1]) })

  for (let i = 0; i < posts.length; i++) {
    const a = posts[i]
    parts.push({
      geo: new THREE.CylinderGeometry(0.055, 0.07, height, 6),
      color: POST,
      position: [a.x, a.y + height / 2, a.z],
    })
    parts.push({
      geo: new THREE.CylinderGeometry(0.062, 0.062, 0.09, 6),
      color: KINDER_COLORS[i % KINDER_COLORS.length],
      position: [a.x, a.y + height, a.z],
    })

    const b = posts[i + 1]
    if (!b) continue
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    if (len > spacing * 2.2) continue   // Luecke: hier ist ein Eingang

    // Die Schnur haengt durch, die Wimpel haengen daran.
    const flags = Math.max(2, Math.round(len / 0.9))
    for (let k = 0; k < flags; k++) {
      const u = (k + 0.5) / flags
      const sag = 0.16 * (1 - Math.pow((u - 0.5) * 2, 2))
      const x = a.x + (b.x - a.x) * u
      const z = a.z + (b.z - a.z) * u
      const y = a.y + (b.y - a.y) * u + height - 0.06 - sag
      parts.push({
        geo: new THREE.ConeGeometry(0.11, 0.28, 3),
        color: KINDER_COLORS[(i + k) % KINDER_COLORS.length],
        position: [x, y - 0.14, z],
        rotation: [Math.PI, 0, 0],
      })
    }
    // Die Schnur selbst, damit die Wimpel nicht in der Luft haengen.
    parts.push({
      geo: new THREE.BoxGeometry(0.03, 0.03, len),
      color: 0xb9c3cd,
      position: [(a.x + b.x) / 2, (a.y + b.y) / 2 + height - 0.13, (a.z + b.z) / 2],
      rotation: [-Math.atan2(b.y - a.y, len), Math.atan2(b.x - a.x, b.z - a.z), 0],
    })
  }

  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.72 }))
  mesh.castShadow = true
  return mesh
}
