import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'

// Das gelbe Fangnetz an der Nordabfahrt – nur das Bild. Wie tief es wo
// eingedrueckt ist, rechnet attractions/fangnetz.js; hier wird daraus jedes
// Bild die Flaeche neu gelegt.
//
// Die Beule ist die eines Netzes, das an einem Punkt gezogen wird: zu den
// Pfosten hin laeuft sie flach aus (Kosinus, ohne Knick am Pfosten), nach
// unten bleibt der Saum fast stehen, das obere Seil geht etwas mit. Ohne
// Fahrer schwingt das Feld frei nach, die Nachbarfelder zucken leicht mit,
// und die Pfosten neigen sich mit dem Zug zur Beule hin.

const GELB = '#f2c21b'
const MASCHE = 0.32        // m, Maschenweite der Textur
const SAUM = 0.12          // Abstand des unteren Seils vom Schnee
const DURCHHANG = 0.012    // Durchhang des oberen Seils je Meter Feldlaenge
const SCHRITT = 0.3        // Gitter der Flaeche entlang des Feldes
const ZEILEN = 9
const STAHL = 0x4b545c
const ZUG = 0.3            // m je Meter Beule: so weit sinkt das obere Seil

function maschenTextur() {
  const n = 128
  const c = document.createElement('canvas')
  c.width = c.height = n
  const g = c.getContext('2d')
  // Ein Hauch Flaeche, damit das Netz aus 30 m noch als Netz zu sehen ist
  // und nicht nur als Flimmern einzelner Faeden.
  g.fillStyle = 'rgba(242,194,27,0.16)'
  g.fillRect(0, 0, n, n)
  g.strokeStyle = GELB
  g.lineWidth = 11
  g.lineCap = 'square'
  // Rautenmasche: zwei Diagonalen, ueber die Kachelgrenze gezogen.
  for (const o of [-n, 0, n]) {
    g.beginPath(); g.moveTo(o, 0); g.lineTo(o + n, n); g.stroke()
    g.beginPath(); g.moveTo(o + n, 0); g.lineTo(o, n); g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

// Glatter Buckel von 0 (Pfosten) bis 1 (Beule), mit der Spitze bei c.
function buckel(s, c, len) {
  const t = s < c ? s / c : (len - s) / Math.max(0.001, len - c)
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, t)))
}

export function createFangnetz(world, netz) {
  const group = new THREE.Group()
  const H = netz.hoehe

  // --- Flaeche und Seile -------------------------------------------------
  const felder = netz.felder.map((f) => {
    const spalten = Math.max(8, Math.ceil(f.len / SCHRITT))
    const boden = []
    for (let i = 0; i <= spalten; i++) {
      const u = f.len * i / spalten
      boden.push(terrainHeight(f.a.x + f.tx * u, f.a.z + f.tz * u))
    }
    return { f, spalten, boden }
  })

  const ecken = felder.reduce((n, d) => n + (d.spalten + 1) * (ZEILEN + 1), 0)
  const pos = new Float32Array(ecken * 3)
  const uv = new Float32Array(ecken * 2)
  const index = []
  let basis = 0
  for (const d of felder) {
    d.basis = basis
    for (let j = 0; j <= ZEILEN; j++) {
      for (let i = 0; i <= d.spalten; i++) {
        const k = basis + j * (d.spalten + 1) + i
        uv[k * 2] = (d.f.len * i / d.spalten) / MASCHE
        uv[k * 2 + 1] = (H * j / ZEILEN) / MASCHE
        if (i < d.spalten && j < ZEILEN) {
          const a = k, b = k + 1, c = k + d.spalten + 1, e = c + 1
          index.push(a, b, c, b, e, c)
        }
      }
    }
    basis += (d.spalten + 1) * (ZEILEN + 1)
  }
  const flaeche = new THREE.BufferGeometry()
  flaeche.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
  flaeche.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  flaeche.setIndex(index)
  const netzMesh = new THREE.Mesh(flaeche, new THREE.MeshStandardMaterial({
    map: maschenTextur(),
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // Durchsichtig und beidseitig: ohne forceSinglePass zeichnet three.js
    // es zweimal (siehe Sendeturm, HANDOVER 4a⁵).
    forceSinglePass: true,
    roughness: 0.85,
    emissive: new THREE.Color(GELB),
    emissiveIntensity: 0.18,
  }))
  netzMesh.frustumCulled = false
  netzMesh.renderOrder = 2
  group.add(netzMesh)

  // Oberes und unteres Seil als schmale Baender, die mit der Flaeche gehen.
  const seilEcken = felder.reduce((n, d) => n + (d.spalten + 1) * 4, 0)
  const seilPos = new Float32Array(seilEcken * 3)
  const seilIndex = []
  let s0 = 0
  for (const d of felder) {
    d.seil = s0
    for (const reihe of [0, 1]) {
      for (let i = 0; i < d.spalten; i++) {
        const a = s0 + (reihe * (d.spalten + 1) + i) * 2
        seilIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    s0 += (d.spalten + 1) * 4
  }
  const seil = new THREE.BufferGeometry()
  seil.setAttribute('position', new THREE.BufferAttribute(seilPos, 3).setUsage(THREE.DynamicDrawUsage))
  seil.setIndex(seilIndex)
  const seilMesh = new THREE.Mesh(seil, new THREE.MeshStandardMaterial({
    color: 0xc9950c, roughness: 0.7, side: THREE.DoubleSide,
  }))
  seilMesh.frustumCulled = false
  seilMesh.castShadow = true
  group.add(seilMesh)

  // --- Pfosten -------------------------------------------------------------
  // Stahlrohr mit gelber Kappe und Schneehaube, am Fuss ein Schneekegel.
  const pfostenGeo = assemble([
    { geo: new THREE.CylinderGeometry(0.06, 0.075, H + 0.45, 8), color: STAHL, position: [0, (H + 0.45) / 2 - 0.2, 0] },
    { geo: new THREE.CylinderGeometry(0.085, 0.085, 0.14, 8), color: 0xe0b014, position: [0, H + 0.2, 0] },
    { geo: new THREE.SphereGeometry(0.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), color: 0xf7fbff, position: [0, H + 0.26, 0], scale: [1, 0.6, 1] },
    { geo: new THREE.ConeGeometry(0.32, 0.3, 9), color: 0xf2f6fb, position: [0, 0.02, 0] },
  ])
  const orte = [netz.felder[0].a, ...netz.felder.map((f) => f.b)]
  const pfosten = new THREE.InstancedMesh(pfostenGeo, vertexColorMaterial({ roughness: 0.6 }), orte.length)
  pfosten.castShadow = true
  group.add(pfosten)
  const stueck = new THREE.Object3D()

  world.scene.add(group)

  // Oberkante des Netzes ueber dem Boden, mit leichtem Durchhang.
  const oben = (d, u) => H - DURCHHANG * d.f.len * Math.sin(Math.PI * u / d.f.len)

  // Mitte des Netzes: wer weiter weg ist, sieht es nicht schwingen.
  const mitte = orte.reduce((m, p) => ({ x: m.x + p.x / orte.length, z: m.z + p.z / orte.length }), { x: 0, z: 0 })
  let zeit = 0
  function update(dt, skier) {
    zeit += dt
    const fern = skier && Math.hypot(skier.position.x - mitte.x, skier.position.z - mitte.z) > 80
    if (fern && netz.felder.every((f) => Math.abs(f.tiefe) < 0.002 && Math.abs(f.tempo) < 0.002)) return
    for (const [fi, d] of felder.entries()) {
      const { f, spalten, boden } = d
      const b = netz.beule(fi)
      // Die Nachbarn zucken mit, ein Fuenftel so stark: das Netz ist ein Stueck.
      const links = fi > 0 ? netz.beule(fi - 1).tiefe : 0
      const rechts = fi < felder.length - 1 ? netz.beule(fi + 1).tiefe : 0
      const vc = Math.max(0.25, Math.min(0.75, b.y / H))
      for (let i = 0; i <= spalten; i++) {
        const u = f.len * i / spalten
        const fu = buckel(u, b.u, f.len)
        // Nachbarbeule: zieht nur am naeheren Ende ein wenig.
        const nach = 0.2 * (links * Math.max(0, 1 - u / 3) + rechts * Math.max(0, 1 - (f.len - u) / 3))
        // Kaum Wind: ein Netz, das ganz still steht, sieht gemalt aus.
        const wind = 0.025 * Math.sin(zeit * 1.3 + u * 0.55 + fi * 1.7) * Math.sin(Math.PI * u / f.len)
        const x0 = f.a.x + f.tx * u, z0 = f.a.z + f.tz * u
        const top = oben(d, u)
        for (let j = 0; j <= ZEILEN; j++) {
          const v = j / ZEILEN
          // Unten bleibt der Saum fast stehen, das obere Seil geht halb mit.
          const fv = v < vc ? 0.2 + 0.8 * buckel(v, vc, 2 * vc) : 0.45 + 0.55 * buckel(v, vc, 1)
          const aus = (b.tiefe * fu + nach) * fv + wind * fv
          // Wer in Hueftehoehe hineinfaellt, zieht das obere Seil mit hinunter:
          // aus der Spielkamera (36° von oben) liest sich die Beule erst daran,
          // dass die Oberkante zur Mitte hin einknickt.
          const zug = ZUG * Math.max(0, b.tiefe) * fu * v * v
          const k = d.basis + j * (spalten + 1) + i
          pos[k * 3] = x0 - f.nx * aus
          pos[k * 3 + 1] = boden[i] + SAUM + (top - SAUM) * v - zug
          pos[k * 3 + 2] = z0 - f.nz * aus
        }
        // Seile: oben und unten je zwei Ecken, 6 cm hoch.
        for (const [reihe, j] of [[0, 0], [1, ZEILEN]]) {
          const k = d.basis + j * (spalten + 1) + i
          const s = d.seil + (reihe * (spalten + 1) + i) * 2
          for (const [q, dy] of [[0, -0.035], [1, 0.035]]) {
            seilPos[(s + q) * 3] = pos[k * 3]
            seilPos[(s + q) * 3 + 1] = pos[k * 3 + 1] + dy
            seilPos[(s + q) * 3 + 2] = pos[k * 3 + 2]
          }
        }
      }
    }
    flaeche.attributes.position.needsUpdate = true
    flaeche.computeVertexNormals()
    seil.attributes.position.needsUpdate = true

    // Pfosten neigen sich zur Beule hin: oben zieht das Seil nach aussen
    // und zur Feldmitte.
    orte.forEach((p, i) => {
      let ax = 0, az = 0
      for (const [fi, seite] of [[i - 1, 1], [i, -1]]) {
        const f = netz.felder[fi]
        if (!f) continue
        const t = netz.beule(fi).tiefe
        ax += (-f.nx * 0.05 - f.tx * seite * 0.03) * t
        az += (-f.nz * 0.05 - f.tz * seite * 0.03) * t
      }
      stueck.position.set(p.x, terrainHeight(p.x, p.z) - 0.05, p.z)
      stueck.rotation.set(az, 0, -ax)
      stueck.updateMatrix()
      pfosten.setMatrixAt(i, stueck.matrix)
    })
    pfosten.instanceMatrix.needsUpdate = true
  }
  update(0)

  return { group, update }
}
