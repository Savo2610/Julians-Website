import * as THREE from 'three'
import { terrainHeight } from '../heightfield.js'

// Farbe im Schnee.
//
// Ein Bogen aus Stangen wird von der festen Kamera nur dann als Bogen
// gelesen, wenn seine Querachse ueber den Bildschirm laeuft – steht sie in
// der Blickachse, bleibt ein Strich uebrig. Eine Flaeche am Boden hat dieses
// Problem nicht: von schraeg oben sieht man sie immer. Deshalb liegt hier
// alles, was eindeutig sein muss, im Schnee und nicht in der Luft.
//
// Jede Flaeche wird in Zellen zerlegt und auf das Gelaende gesetzt, damit sie
// sich ueber Wellen und Banden legt statt sie zu durchstossen. Alles landet
// in einer einzigen Geometrie – Bodenfarbe darf nichts kosten.

const LIFT = 0.045          // Abstand ueber dem Schnee
const CELL = 0.9            // Kantenlaenge der Unterteilung

class Paint {
  constructor() {
    this.pos = []
    this.col = []
  }

  // Ein Rechteck, gegeben durch Mitte, Richtung, Laenge und Breite.
  // dx/dz muss normiert sein. `from`/`to` erlauben ein Rechteck, das nur
  // einen Ausschnitt der Breite fuellt – so entstehen Streifenmuster.
  rect(x, z, dx, dz, length, width, color, { from = -0.5, to = 0.5 } = {}) {
    const nx = -dz
    const nz = dx
    const w0 = width * from
    const w1 = width * to
    const nu = Math.max(1, Math.round(length / CELL))
    const nv = Math.max(1, Math.round((w1 - w0) / CELL))
    const c = new THREE.Color(color)

    const point = (u, v) => {
      const a = (u - 0.5) * length
      const b = w0 + (w1 - w0) * v
      const px = x + dx * a + nx * b
      const pz = z + dz * a + nz * b
      return [px, terrainHeight(px, pz) + LIFT, pz]
    }

    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) {
        const a = point(i / nu, j / nv)
        const b = point((i + 1) / nu, j / nv)
        const d = point(i / nu, (j + 1) / nv)
        const e = point((i + 1) / nu, (j + 1) / nv)
        // Umlaufsinn: u-Richtung mal v-Richtung zeigt nach unten, also
        // muessen die Dreiecke andersherum laufen, damit sie nach oben sehen.
        this.pos.push(...a, ...e, ...b, ...a, ...d, ...e)
        for (let k = 0; k < 6; k++) this.col.push(c.r, c.g, c.b)
      }
    }
    return this
  }

  // Balken von einem Punkt zum anderen – fuer Torlinien und Wegstriche.
  bar(x0, z0, x1, z1, width, color) {
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz)
    if (len < 0.01) return this
    return this.rect((x0 + x1) / 2, (z0 + z1) / 2, dx / len, dz / len, len, width, color)
  }

  // Ein Winkel, der in Fahrtrichtung zeigt. Zwei schraege Balken, die sich
  // an der Spitze treffen – von oben ein klares Pfeilzeichen.
  chevron(x, z, dx, dz, size, color) {
    const nx = -dz
    const nz = dx
    const tipX = x + dx * size * 0.5
    const tipZ = z + dz * size * 0.5
    const backX = x - dx * size * 0.5
    const backZ = z - dz * size * 0.5
    const arm = size * 0.55
    for (const side of [-1, 1]) {
      this.bar(
        backX + nx * arm * side, backZ + nz * arm * side,
        tipX, tipZ,
        size * 0.22, color,
      )
    }
    return this
  }

  // Karobalken quer zur Bahn: das internationale Zeichen fuer Start und Ziel
  // und aus jeder Richtung lesbar.
  checker(x, z, dx, dz, length, width, { cells = 8, dark = 0x1d232b, light = 0xf2f6fb } = {}) {
    const rows = 2
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cells; i++) {
        const color = (i + r) % 2 === 0 ? dark : light
        const from = -0.5 + i / cells
        const to = -0.5 + (i + 1) / cells
        const off = (r + 0.5) / rows - 0.5
        this.rect(
          x + dx * off * length, z + dz * off * length,
          dx, dz, length / rows, width, color, { from, to },
        )
      }
    }
    return this
  }

  build({ name = 'snow-paint' } = {}) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    geo.computeVertexNormals()
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      // Die Farbe liegt knapp ueber dem Schnee. Der Tiefenversatz haelt sie
      // auch dort sauber, wo das Gelaende zwischen den Stuetzstellen woelbt.
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    }))
    mesh.name = name
    mesh.receiveShadow = true
    return mesh
  }
}

export function snowPaint() {
  return new Paint()
}
