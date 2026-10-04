import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'

// Was man vom Schneebrett sieht: die Anrisskante, die Schollen, in die das
// Brett zerbricht, und die Brocken, die am Ende auf der Piste liegen. Alles
// Aufbau – befahren wird weiter das Hoehenfeld, die Brocken haben keine
// Kollision. Wer hineinfaehrt, wird nicht gebremst, sondern verschuettet,
// solange sie noch rutschen (attractions/schneebrett.js).

const SCHNEE = 0xf4f8fd
const SCHATTEN = 0xd9e3ef
// Die frische Bruchkante liegt im eigenen Schatten. 0x8fa5c2 ging im
// Hangschatten unter; dunkler und dicker liest man sie aus 33 Metern.
const KANTE = 0x6a819f

// Eine Scholle: eine flache Platte, oben hell, an den Seiten im Schatten.
// Die Kanten sind gebrochen, nicht gesaegt – deshalb ein leicht verzogener
// Quader statt eines sauberen.
export function scholle(breit, lang, dick, zufall) {
  const geo = new THREE.BoxGeometry(breit, dick, lang, 2, 1, 2)
  const pos = geo.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) * (0.85 + zufall() * 0.3))
    pos.setZ(i, pos.getZ(i) * (0.85 + zufall() * 0.3))
    if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + (zufall() - 0.5) * dick * 0.5)
  }
  const mesh = new THREE.Mesh(
    assemble([
      { geo, color: SCHNEE, position: [0, 0, 0] },
      // Die Unterseite und die Bruchflaechen dunkler.
      { geo: new THREE.BoxGeometry(breit * 0.92, dick * 0.4, lang * 0.92), color: SCHATTEN, position: [0, -dick * 0.35, 0] },
    ]),
    material(),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// Ein Brocken: was von der Scholle uebrig bleibt, wenn sie zerbricht.
export function brocken(r) {
  const mesh = new THREE.Mesh(
    assemble([{ geo: new THREE.IcosahedronGeometry(r, 0), color: SCHNEE, position: [0, 0, 0] }]),
    material(),
  )
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// Die Anrisskante: ein schmales dunkles Band, das dem Gelaende folgt, und
// talseitig davon die niedrige Bruchstufe, an der das Brett abgerissen ist.
// `punkte` sind [x, y, z] entlang der Kante, `tal` die waagerechte Richtung
// hangab. Vorher waren es 0,45 m hohe Balken mit fester Hoehe: am Hang
// ergaben sie eine blaue Treppe, die 45 Sekunden lang dort stand.
export function anriss(punkte, tal) {
  const pos = []
  const index = []
  const BAND = 0.32
  const STUFE = 0.22
  for (const [x, y, z] of punkte) {
    const ox = x + tal.x * BAND
    const oz = z + tal.z * BAND
    // oben am Band, unten am Band (auf dem Gelaende), Fuss der Stufe
    pos.push(x, terrainHeight(x, z) + 0.05, z)
    pos.push(ox, terrainHeight(ox, oz) + 0.05, oz)
    pos.push(ox + tal.x * 0.05, terrainHeight(ox, oz) - STUFE, oz + tal.z * 0.05)
  }
  for (let i = 0; i < punkte.length - 1; i++) {
    const a = i * 3
    const b = a + 3
    index.push(a, b, a + 1, a + 1, b, b + 1)          // Band
    index.push(a + 1, b + 1, a + 2, a + 2, b + 1, b + 2) // Stufe
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: KANTE, roughness: 0.92, side: THREE.DoubleSide }))
  mesh.receiveShadow = true
  return mesh
}

// Etwas Eigenlicht: im Hangschatten wurden die Schollen sonst graublau und
// lasen sich als Felsbrocken, die den Hang herunterpoltern. Schnee streut
// Licht auch in seinen Schatten – der Hang daneben ist ja auch nicht grau.
let _material = null
function material() {
  return (_material ||= vertexColorMaterial({ roughness: 0.92, emissive: 0x4a5566, emissiveIntensity: 0.55 }))
}


// Die Lawinenbahn in der Spurkarte: aufgewuehlter Schnee, Buckel und Mulden
// durcheinander. Dieselbe Kanalsprache wie die Tierspuren (tiere/werkzeug.js):
// Gruen ist der zur Seite gedrueckte Schnee, Gelb die Vertiefung.
let _bahn = null
export function bahnTextur() {
  if (_bahn) return _bahn
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, 128, 128)
  let seed = 7
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (const [farbe, wachs] of [['#00ff00', 4], ['#ffff00', 0]]) {
    ctx.fillStyle = farbe
    for (let i = 0; i < 9; i++) {
      const x = 24 + r() * 80
      const y = 24 + r() * 80
      ctx.beginPath()
      ctx.ellipse(x, y, 8 + r() * 12 + wachs, 6 + r() * 9 + wachs, r() * 3, 0, Math.PI * 2)
      ctx.fill()
    }
    seed = 7
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  return (_bahn = tex)
}
