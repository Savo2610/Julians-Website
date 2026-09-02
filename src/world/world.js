import * as THREE from 'three'
import { WORLD } from '../config.js'
import { terrainHeight, terrainNormal } from './heightfield.js'
import { createTerrain } from './terrain.js'

// Haelt das Terrain und ein grobes Raster aller Hindernisse. Kollision ist
// bewusst 2D und kreisfoermig – das reicht fuer Baeume, Felsen, Pfosten und
// bleibt bei hunderten Objekten billig.

const CELL = 6

export class World {
  constructor(scene, trailTexture) {
    this.scene = scene
    this.terrain = createTerrain(trailTexture)
    scene.add(this.terrain)

    this.colliders = []
    this.grid = new Map()
  }

  addCollider(x, z, radius, data = null) {
    const c = { x, z, r: radius, data }
    this.colliders.push(c)
    const cx = Math.floor(x / CELL)
    const cz = Math.floor(z / CELL)
    const reach = Math.ceil(radius / CELL)
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const key = `${cx + i}:${cz + j}`
        let list = this.grid.get(key)
        if (!list) this.grid.set(key, (list = []))
        list.push(c)
      }
    }
    return c
  }

  nearby(x, z, out = []) {
    out.length = 0
    const key = `${Math.floor(x / CELL)}:${Math.floor(z / CELL)}`
    const list = this.grid.get(key)
    if (list) out.push(...list)
    return out
  }

  // Schiebt eine Position aus allen ueberlappenden Hindernissen heraus und
  // laesst sie an ihnen entlanggleiten, statt hart zu stoppen.
  resolve(x, z, radius, stepX, stepZ) {
    const candidates = this.nearby(x, z, this._scratch || (this._scratch = []))
    let hit = false
    let pushX = 0
    let pushZ = 0
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      const dx = x - c.x
      const dz = z - c.z
      const min = c.r + radius
      const d2 = dx * dx + dz * dz
      if (d2 >= min * min || d2 === 0) continue
      const d = Math.sqrt(d2)
      const push = (min - d) / d
      x += dx * push
      z += dz * push
      pushX += dx * push
      pushZ += dz * push
      hit = true
      if (c.data?.onHit) c.data.onHit()
    }
    // Die Ausweichrichtung wird mitgegeben: nur damit laesst sich ein
    // Streifschuss von einem frontalen Treffer unterscheiden.
    return { x, z, hit, pushX, pushZ }
  }

  heightAt(x, z) {
    return terrainHeight(x, z)
  }

  normalAt(x, z, out) {
    return terrainNormal(x, z, out)
  }

  // Legt ein Objekt auf den Boden und richtet es (optional) am Hang aus.
  place(object, x, z, { align = 0, yOffset = 0, rotation = null } = {}) {
    object.position.set(x, terrainHeight(x, z) + yOffset, z)
    if (rotation !== null) object.rotation.y = rotation
    if (align > 0) {
      const n = terrainNormal(x, z, new THREE.Vector3())
      const up = new THREE.Vector3(0, 1, 0)
      const q = new THREE.Quaternion().setFromUnitVectors(up, n)
      const target = new THREE.Quaternion().slerpQuaternions(new THREE.Quaternion(), q, align)
      const yaw = new THREE.Quaternion().setFromAxisAngle(up, object.rotation.y)
      object.quaternion.copy(target).multiply(yaw)
    }
    this.scene.add(object)
    return object
  }

  get bounds() {
    return WORLD
  }
}
