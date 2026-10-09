import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { KINDER_COLORS } from './kinderland.js'

// Das Trampolin im Kinderland – nur das Bild. Wie tief das Tuch wo
// nachgibt, rechnet attractions/trampolin.js; hier wird daraus jedes Bild
// die Flaeche neu gelegt.
//
// Ein Bodentrampolin: das Tuch liegt buendig im Schnee, ringsum ein Polster
// in den Farben des Teppichs (blau und gelb im Wechsel), damit man von oben
// sieht, dass Tuch und Teppich zu derselben Anlage gehoeren. Die Delle ist
// die eines gespannten Tuchs: unter den Fuessen am tiefsten, zum Rahmen hin
// flach auslaufend, nie ueber den Rand hinaus.

const TUCH = 0x1f2a44
const RINGE = 12
const SPEICHEN = 44
const POLSTER = 0.46      // m breit
const STUECKE = 16

export function createTrampolin(t) {
  const group = new THREE.Group()
  const R = t.r

  // --- Polster ----------------------------------------------------------
  const parts = []
  for (let i = 0; i < STUECKE; i++) {
    const a = (i + 0.5) / STUECKE * Math.PI * 2
    const bogen = (2 * Math.PI * (R + POLSTER / 2)) / STUECKE
    parts.push({
      geo: new THREE.BoxGeometry(bogen - 0.04, 0.1, POLSTER),
      color: KINDER_COLORS[i % 2 ? 2 : 1],
      position: [Math.sin(a) * (R + POLSTER / 2), 0.04, Math.cos(a) * (R + POLSTER / 2)],
      rotation: [0, a, 0],
    })
  }
  const polster = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.55 }))
  polster.receiveShadow = true
  polster.castShadow = true
  group.add(polster)

  // --- Tuch -------------------------------------------------------------
  const ecken = 1 + RINGE * SPEICHEN
  const pos = new Float32Array(ecken * 3)
  const flach = new Float32Array(ecken * 2)
  const index = []
  flach[0] = 0
  flach[1] = 0
  for (let j = 1; j <= RINGE; j++) {
    const r = R * j / RINGE
    for (let i = 0; i < SPEICHEN; i++) {
      const k = 1 + (j - 1) * SPEICHEN + i
      const a = i / SPEICHEN * Math.PI * 2
      flach[k * 2] = Math.sin(a) * r
      flach[k * 2 + 1] = Math.cos(a) * r
    }
  }
  for (let i = 0; i < SPEICHEN; i++) index.push(0, 1 + i, 1 + (i + 1) % SPEICHEN)
  for (let j = 1; j < RINGE; j++) {
    for (let i = 0; i < SPEICHEN; i++) {
      const a = 1 + (j - 1) * SPEICHEN + i
      const b = 1 + (j - 1) * SPEICHEN + (i + 1) % SPEICHEN
      const c = 1 + j * SPEICHEN + i
      const d = 1 + j * SPEICHEN + (i + 1) % SPEICHEN
      index.push(a, c, d, a, d, b)
    }
  }
  for (let k = 0; k < ecken; k++) {
    pos[k * 3] = flach[k * 2]
    pos[k * 3 + 1] = 0.02
    pos[k * 3 + 2] = flach[k * 2 + 1]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  // Ein heller Ring kurz vor dem Rand, wie der Saum auf echten Tuechern:
  // ohne ihn liest sich das dunkle Tuch von oben als Loch im Schnee.
  const farben = new Float32Array(ecken * 3)
  const dunkel = new THREE.Color(TUCH)
  const saum = new THREE.Color(0xe8edf4)
  for (let k = 0; k < ecken; k++) {
    const r = Math.hypot(flach[k * 2], flach[k * 2 + 1]) / R
    const c = r > 0.8 && r < 0.9 ? saum : dunkel
    farben.set([c.r, c.g, c.b], k * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(farben, 3))
  const tuch = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.85, side: THREE.DoubleSide,
  }))
  tuch.receiveShadow = true
  group.add(tuch)

  let ruhig = false
  // Delle: tiefe an (dx, dz) relativ zur Mitte. Unter den Fuessen am
  // tiefsten, zum Rahmen hin auf null; geteilt durch den Randfaktor am
  // Fusspunkt, damit der Fahrer genau auf dem Tuch steht.
  const rand = (r) => Math.max(0, 1 - (r / R) ** 6)
  group.userData.update = (delle) => {
    const tiefe = delle.tiefe
    if (Math.abs(tiefe) < 0.002 && Math.abs(delle.tempo) < 0.01) {
      if (ruhig) return
      ruhig = true
    } else ruhig = false
    const cx = delle.x - group.position.x
    const cz = delle.z - group.position.z
    const kc = Math.max(0.2, rand(Math.hypot(cx, cz)))
    const breite = R * 1.15
    for (let k = 0; k < ecken; k++) {
      const x = flach[k * 2], z = flach[k * 2 + 1]
      const q = Math.hypot(x - cx, z - cz) / breite
      const w = q < 1 ? (1 - q * q) ** 2 : 0
      pos[k * 3 + 1] = 0.02 - tiefe * w * rand(Math.hypot(x, z)) / kc
    }
    geo.attributes.position.needsUpdate = true
    geo.computeVertexNormals()
  }
  return group
}
