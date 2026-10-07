import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../../core/geometry.js'
import { CAMERA } from '../../config.js'
import { terrainHeight } from '../heightfield.js'

// Die Anzeigetafel an Speedcheck, Klammsprung und Slalom: zwei Pfosten,
// ein schraeg gestelltes Feld mit Leinwand. Gezeichnet wird von aussen
// (512 x 256), die Tafel liefert nur Leinwand und Textur.
//
// Sie zeigt immer zur Kamera – sonst liest man sie von hinten.

const POST = 0x5d666f
const BOARD = 0x1b222b
const FRAME = 0xd8dee6

export const TAFEL_SCHRIFT = 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif'

export function createAnzeigetafel(world, x, z) {
  const parts = []
  for (const sx of [-1, 1]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.08, 0.1, 1.9, 8), color: POST, position: [sx * 1.05, 0.95, 0] })
  }
  parts.push({ geo: new THREE.BoxGeometry(2.6, 1.32, 0.14), color: FRAME, position: [0, 2.0, 0], rotation: [-0.42, 0, 0] })
  parts.push({ geo: new THREE.BoxGeometry(2.38, 1.12, 0.06), color: BOARD, position: [0, 2.02, 0.09], rotation: [-0.42, 0, 0] })
  const mesh = new THREE.Mesh(assemble(parts), vertexColorMaterial({ roughness: 0.6 }))
  mesh.castShadow = true

  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(2.3, 1.06),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  )
  plate.position.set(0, 2.03, 0.125)
  plate.rotation.x = -0.42

  const group = new THREE.Group()
  group.add(mesh, plate)
  group.position.set(x, terrainHeight(x, z), z)
  group.rotation.y = CAMERA.azimuth
  world.scene.add(group)
  world.addCollider(x, z, 0.6)
  return { canvas, tex, group }
}
