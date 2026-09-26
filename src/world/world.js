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

  // height: wie hoch das Hindernis ueber dem Boden aufragt. Was niedrig ist
  // (Steine, liegende Staemme), kann man ueberspringen; ohne Angabe ist es
  // unendlich hoch – Baeume, Haeuser und Zaeune bleiben Grenzen.
  addCollider(x, z, radius, data = null, height = Infinity) {
    const c = { x, z, r: radius, data, h: height }
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
  //
  // lift ist die Hoehe des Fahrers ueber dem Boden. Ein Stein ist kein
  // Zylinder, sondern eine Kuppe: sein Rand liegt tiefer als seine Mitte.
  // Deshalb wird die Flughoehe gegen ein Halbkugelprofil geprueft – wer im
  // Sprung nur den Rand streift, bleibt nicht an der vollen Hoehe haengen.
  resolve(x, z, radius, stepX, stepZ, lift = 0) {
    const candidates = this.nearby(x, z, this._scratch || (this._scratch = []))
    let hit = false
    let pushX = 0
    let pushZ = 0
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      // Ausgeschaltet: die zerlegte Seebank, siehe props/lake-bench.js.
      if (c.off) continue
      const dx = x - c.x
      const dz = z - c.z
      const min = c.r + radius
      const d2 = dx * dx + dz * dz
      if (d2 >= min * min || d2 === 0) continue
      if (lift > 0 && c.h < Infinity && lift > c.h * Math.sqrt(Math.max(0, 1 - d2 / (min * min)))) {
        // Fuer den Pistenpass: nur wer wirklich ueber der Kuppe ist, nicht
        // wer im Absprung den Rand streift.
        if (d2 < c.r * c.r && c.h >= 0.2) this.uebersprungen = (this.uebersprungen ?? 0) + 1
        continue
      }
      // Gibt onHit true zurueck, ist das Hindernis in diesem Moment zu Bruch
      // gegangen (Funparkzaun): dann faehrt man hindurch, statt noch ein
      // letztes Mal abzuprallen und Tempo zu verlieren.
      if (c.data?.onHit?.() === true) continue
      const d = Math.sqrt(d2)
      const push = (min - d) / d
      x += dx * push
      z += dz * push
      pushX += dx * push
      pushZ += dz * push
      hit = true
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
