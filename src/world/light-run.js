import * as THREE from 'three'
import { assemble, vertexColorMaterial } from '../core/geometry.js'
import { terrainHeight } from './heightfield.js'

// Die Leuchtstrecke: eine gerade Schussfahrt aus dem Kinderland heraus,
// eingefasst von Lichtbogen, die mit dem Fahrer mitlaufen.
//
// Der Reiz ist die Welle. Steht niemand auf der Strecke, atmet sie langsam vor
// sich hin; kommt jemand, laeuft ein heller Kamm mit ihm mit und klingt hinter
// ihm aus. Man faehrt also nicht durch eine beleuchtete Roehre, sondern das
// Licht faehrt mit – das ist der Unterschied zwischen Dekoration und Reaktion.
//
// Die Begrenzung liegt laengs und nicht quer. Das ist keine Geschmacksfrage:
// die Kamera steht fest, und ein Bogen quer zur Fahrtrichtung zeigt hier mit
// seiner Achse fast genau in die Blickrichtung – aus jedem Bogen wird ein
// senkrechter Strich. Zwei durchgehende Leuchtlinien laengs der Strecke haben
// das Problem nicht: ihre Achse laeuft zu 98 Prozent ueber den Bildschirm.
//
// Beide Linien sind eine einzige InstancedMesh mit unbeleuchtetem Material.
// Unbeleuchtet heisst: die Farbe der Instanz ist das, was man sieht –
// Helligkeit ist dann schlicht eine Farbe pro Instanz, und die ganze Strecke
// kostet einen Zeichenaufruf. Ein zweiter, additiv gemischter Satz flacher
// Platten legt den Schein auf den Schnee, ohne Nachbearbeitungsschritt.

const PITCH = 1.75           // Abstand der Segmentmitten
const SEG = 1.5              // Laenge eines Leuchtsegments
const SPAN = 5.0             // lichte Weite zwischen den Linien
const POST = 0x2b3138

// Die Farben laufen die Strecke entlang von kalt nach warm, damit man am
// Farbton sieht, wie weit man ist.
const COOL = new THREE.Color(0x2f6bd8)
const WARM = new THREE.Color(0x37b87c)

export class LightRun {
  constructor(world, { from, to }) {
    this.world = world
    this.from = new THREE.Vector2(from.x, from.z)
    this.to = new THREE.Vector2(to.x, to.z)

    const delta = this.to.clone().sub(this.from)
    this.length = delta.length()
    this.dir = delta.clone().normalize()
    this.side = new THREE.Vector2(-this.dir.y, this.dir.x)
    this.heading = Math.atan2(this.dir.x, this.dir.y)

    this.stops = []
    this.phase = 0

    this._build()
  }

  pointAt(s, off = 0) {
    return {
      x: this.from.x + this.dir.x * s + this.side.x * off,
      z: this.from.y + this.dir.y * s + this.side.y * off,
    }
  }

  _build() {
    const group = new THREE.Group()
    this.group = group

    const cells = Math.floor(this.length / PITCH)
    this.count = cells * 2

    const bar = new THREE.BoxGeometry(0.2, 0.22, SEG)
    const glow = new THREE.InstancedMesh(
      bar,
      new THREE.MeshBasicMaterial({ toneMapped: false }),
      this.count,
    )

    // Der Schein auf dem Schnee: eine flache, breite Platte unter jedem
    // Segment. Additiv gemischt hellt sie nur auf – daraus wird ein weicher
    // Hof statt eines milchigen Streifens.
    const spill = new THREE.BoxGeometry(0.85, 0.02, SEG + 0.4)
    const halo = new THREE.InstancedMesh(
      spill,
      new THREE.MeshBasicMaterial({
        toneMapped: false,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.5,
      }),
      this.count,
    )

    const posts = []
    const dummy = new THREE.Object3D()
    let n = 0

    for (let i = 0; i < cells; i++) {
      const s = (i + 0.5) * PITCH
      const u = i / (cells - 1)
      const color = COOL.clone().lerp(WARM, u)

      for (const side of [-1, 1]) {
        const p = this.pointAt(s, (side * SPAN) / 2)
        const y = terrainHeight(p.x, p.z)

        dummy.position.set(p.x, y + 0.3, p.z)
        dummy.rotation.set(0, this.heading, 0)
        dummy.updateMatrix()
        glow.setMatrixAt(n, dummy.matrix)

        dummy.position.set(p.x, y + 0.05, p.z)
        dummy.updateMatrix()
        halo.setMatrixAt(n, dummy.matrix)

        // Ein dunkler Sockel unter der Leuchtleiste. Er nimmt ihr das
        // Schwebende, ohne selbst aufzufallen.
        posts.push({
          geo: new THREE.BoxGeometry(0.26, 0.3, SEG * 0.9),
          color: POST,
          position: [p.x, y + 0.13, p.z],
          rotation: [0, this.heading, 0],
        })

        this.stops.push({ s, color })
        n++
      }
    }

    glow.instanceMatrix.needsUpdate = true
    halo.instanceMatrix.needsUpdate = true
    glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.count * 3), 3)
    halo.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.count * 3), 3)

    group.add(glow, halo)
    group.add(new THREE.Mesh(assemble(posts), vertexColorMaterial({ roughness: 0.6 })))
    this.glow = glow
    this.halo = halo
    this.world.scene.add(group)

    this._tint = new THREE.Color()
  }

  // Wo auf der Strecke der Fahrer gerade ist – und wie weit er daneben liegt.
  project(x, z) {
    const dx = x - this.from.x
    const dz = z - this.from.y
    const s = dx * this.dir.x + dz * this.dir.y
    const off = dx * this.side.x + dz * this.side.y
    return { s, off }
  }

  update(dt, skier) {
    this.phase += dt
    const { s, off } = this.project(skier.position.x, skier.position.z)
    // Nur wer wirklich in der Gasse faehrt, loest die Welle aus. Sonst
    // flackert die Strecke, wenn jemand zwanzig Meter daneben vorbeizieht.
    const inside = Math.abs(off) < SPAN * 0.9 && s > -6 && s < this.length + 6

    const gc = this.glow.instanceColor.array
    const hc = this.halo.instanceColor.array

    for (let i = 0; i < this.count; i++) {
      const stop = this.stops[i]
      // Grundhelligkeit: eine langsame Welle, damit die Strecke auch leer
      // lebendig aussieht.
      let level = 0.16 + 0.06 * Math.sin(this.phase * 1.6 - i * 0.55)
      if (inside) {
        // Der Kamm sitzt knapp vor dem Fahrer und faellt nach hinten flacher
        // ab als nach vorn – so sieht es aus, als schoebe er das Licht vor
        // sich her und liesse eine Spur zurueck.
        const d = stop.s - (s + 2.5)
        const reach = d > 0 ? 7 : 13
        level += 1.5 * Math.exp(-(d * d) / (reach * reach))
      }
      const c = this._tint.copy(stop.color).multiplyScalar(level)
      gc[i * 3] = c.r; gc[i * 3 + 1] = c.g; gc[i * 3 + 2] = c.b
      const h = level * 0.55
      hc[i * 3] = stop.color.r * h; hc[i * 3 + 1] = stop.color.g * h; hc[i * 3 + 2] = stop.color.b * h
    }
    this.glow.instanceColor.needsUpdate = true
    this.halo.instanceColor.needsUpdate = true
  }
}
