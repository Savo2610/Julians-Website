import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { assemble, vertexColorMaterial, transformed } from '../../core/geometry.js'
import { terrainHeight } from '../heightfield.js'

// Lawinenverbauung an der Westflanke unter dem Gipfel: eine Reihe
// Schneebruecken, wie sie an jedem Steilhang ueber einem Ort stehen.
//
// Dort faellt der Hang auf zwoelf Metern um sechs ab und endet im Wald; wer
// vom Gipfel nach links wegfuhr, landete zwischen Tannen, aus denen man nur
// kriechend wieder herauskam. Ein Zaun waere dort ein Fremdkoerper, eine
// Verbauung dagegen gehoert genau an diese Stelle – sie ist die Grenze, die
// der Berg selbst hat.
//
// Jede Bruecke ist ein Rechen aus waagerechten Bohlen, leicht talwaerts
// geneigt, mit einer Strebe dahinter und Schnee, der sich bergseitig
// davor staut. Die Schauseite zeigt bergauf – also zur Kamera, die von
// Osten schaut.

const STEEL = 0x56616c
const WOOD = 0x6b4a35
const SNOW = 0xf7fbff

const WIDTH = 3.4
const HEIGHT = 1.9
const LEAN = 0.32      // Neigung talwaerts
const GAP = 0.5        // Luft zwischen zwei Bruecken

function unitGeometry() {
  const parts = []
  const back = (y) => -y * Math.tan(LEAN)
  // Pfosten reichen 0,6 m in den Boden – die Reihe laeuft am Hang entlang,
  // und ein Ende laege sonst in der Luft.
  for (const sx of [-1, 1]) {
    const len = HEIGHT + 0.6
    parts.push({
      geo: new THREE.BoxGeometry(0.12, len, 0.12), color: STEEL,
      position: [sx * (WIDTH / 2 - 0.25), len / 2 - 0.6, back(len / 2 - 0.6)],
      rotation: [-LEAN, 0, 0],
    })
    // Strebe vom Pfostenkopf schraeg talwaerts in den Boden.
    const top = [HEIGHT - 0.1, back(HEIGHT - 0.1)]
    const foot = [-0.3, -1.5]
    const dy = top[0] - foot[0], dz = top[1] - foot[1]
    parts.push({
      geo: new THREE.BoxGeometry(0.09, Math.hypot(dy, dz), 0.09), color: STEEL,
      position: [sx * (WIDTH / 2 - 0.25), (top[0] + foot[0]) / 2, (top[1] + foot[1]) / 2],
      rotation: [Math.atan2(dz, dy), 0, 0],
    })
  }
  // Die Bohlen des Rechens, mit Luft dazwischen.
  for (let i = 0; i < 5; i++) {
    const y = 0.25 + i * ((HEIGHT - 0.35) / 4)
    parts.push({
      geo: new THREE.BoxGeometry(WIDTH, 0.16, 0.08), color: WOOD,
      position: [0, y, back(y) + 0.09], rotation: [-LEAN, 0, 0],
    })
  }
  // Schneehaube auf der obersten Bohle und der gestaute Schnee bergseitig.
  parts.push({
    geo: new THREE.BoxGeometry(WIDTH + 0.1, 0.1, 0.2), color: SNOW,
    position: [0, HEIGHT - 0.02, back(HEIGHT) + 0.12], rotation: [-LEAN, 0, 0],
  })
  parts.push({
    geo: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), color: SNOW,
    position: [0, -0.15, 0.35], scale: [WIDTH * 0.52, 0.95, 0.9],
  })
  return assemble(parts)
}

export function createAvalancheBarrier(world, points) {
  const unit = unitGeometry()
  const pieces = []

  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i]
    const [bx, bz] = points[i + 1]
    const len = Math.hypot(bx - ax, bz - az)
    const tx = (bx - ax) / len, tz = (bz - az) / len
    const count = Math.max(1, Math.floor(len / (WIDTH + GAP)))
    const step = len / count
    for (let k = 0; k < count; k++) {
      const x = ax + tx * (k + 0.5) * step
      const z = az + tz * (k + 0.5) * step
      // Lokales x laeuft die Reihe entlang, lokales z muss bergauf zeigen.
      let yaw = Math.atan2(-tz, tx)
      const e = 0.8
      const upX = terrainHeight(x + e, z) - terrainHeight(x - e, z)
      const upZ = terrainHeight(x, z + e) - terrainHeight(x, z - e)
      if (Math.sin(yaw) * upX + Math.cos(yaw) * upZ < 0) yaw += Math.PI
      pieces.push(transformed(unit, { rotation: [0, yaw, 0], position: [x, terrainHeight(x, z), z] }))
    }
    // Kollision durchgehend, auch in den Luecken: sie sind 0,5 m schmal und
    // sollen die Reihe nicht durchlaessig machen. Unendlich hoch – ueber
    // eine Grenze springt man nicht.
    for (let d = 0; d <= len; d += 0.9) world.addCollider(ax + tx * d, az + tz * d, 0.55)
  }

  const mesh = new THREE.Mesh(mergeGeometries(pieces, false), vertexColorMaterial({ roughness: 0.85 }))
  pieces.forEach((g) => g.dispose())
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.name = 'lawinenverbauung'
  world.scene.add(mesh)
  return mesh
}
