import * as THREE from 'three'

// Kielwasser als Canvas-Textur ueber dem ganzen See. Der Shader des Wassers
// liest daraus Schaum (rot) und Wellenkamm (gruen).
//
// Statt Spuren einzustempeln und langsam zu verblassen, wird das Bild jedes
// Mal neu gemalt, aus einer Liste von Wegpunkten. Das kostet bei 90 Punkten
// nichts und erlaubt, was ein Stempel nicht kann: die beiden Wellen des
// Kielwassers laufen mit dem Alter auseinander, so wie hinter jedem Boot.

const RES = 512
export const WAKE_BOX = { x0: -130, z0: -115, size: 250 }
const LIFE = 3.2
const SPREAD = 1.6       // m/s, mit der die Wellen seitlich auseinanderlaufen

export class Wake {
  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.canvas.height = RES
    // Auf der CPU malen: 90 Striche sind dort schneller als der Umweg ueber
    // die Grafikkarte, und beim Vorspulen stauen sich keine Auftraege.
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.NoColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
    // Zeile 0 des Canvas ist z0, wie in der Tiefenkarte des Wassers.
    this.texture.flipY = false
    this.points = []
    this.rings = []
    this._acc = 0
  }

  toPx(x, z) {
    return [((x - WAKE_BOX.x0) / WAKE_BOX.size) * RES, ((z - WAKE_BOX.z0) / WAKE_BOX.size) * RES]
  }

  // Jedes Bild mit der Lage des Fahrers aufrufen. strength 0..1.
  add(dt, x, z, dirX, dirZ, strength) {
    this._acc += dt
    if (this._acc < 0.045) return
    this._acc = 0
    if (strength <= 0.02) return
    this.points.push({ x, z, dx: dirX, dz: dirZ, age: 0, s: strength })
  }

  // Aufschlag nach einem Sprung oder Sturz: ein Ring, der auseinanderlaeuft.
  splash(x, z, size = 1) {
    this.rings.push({ x, z, age: 0, size })
  }

  update(dt) {
    for (const p of this.points) p.age += dt
    for (const r of this.rings) r.age += dt
    while (this.points.length && this.points[0].age > LIFE) this.points.shift()
    this.rings = this.rings.filter((r) => r.age < 2.2)
    this.dirty = true
  }

  // Erst vor dem Zeichnen malen, einmal je Bild.
  paint() {
    if (!this.dirty) return
    this.dirty = false
    const ctx = this.ctx
    const k = RES / WAKE_BOX.size
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, RES, RES)
    ctx.globalCompositeOperation = 'lighter'
    ctx.lineCap = 'round'

    // Schaumspur direkt hinter den Ski, dick und hell, schnell vergehend.
    for (let i = 1; i < this.points.length; i++) {
      const a = this.points[i - 1]
      const b = this.points[i]
      if (Math.hypot(a.x - b.x, a.z - b.z) > 4) continue
      const life = 1 - b.age / LIFE
      const [ax, az] = this.toPx(a.x, a.z)
      const [bx, bz] = this.toPx(b.x, b.z)
      ctx.strokeStyle = `rgba(255,0,0,${(life * life * 0.9 * b.s).toFixed(3)})`
      ctx.lineWidth = (1.1 + b.age * 0.9) * k
      ctx.beginPath()
      ctx.moveTo(ax, az)
      ctx.lineTo(bx, bz)
      ctx.stroke()

      // Die beiden Wellen: seitlich versetzt, je aelter desto weiter.
      const off = 0.5 + b.age * SPREAD
      const offA = 0.5 + a.age * SPREAD
      for (const side of [-1, 1]) {
        const [cx, cz] = this.toPx(a.x - a.dz * offA * side, a.z + a.dx * offA * side)
        const [dx, dz] = this.toPx(b.x - b.dz * off * side, b.z + b.dx * off * side)
        ctx.strokeStyle = `rgba(80,255,0,${(life * 0.55 * b.s).toFixed(3)})`
        ctx.lineWidth = 0.7 * k
        ctx.beginPath()
        ctx.moveTo(cx, cz)
        ctx.lineTo(dx, dz)
        ctx.stroke()
      }
    }

    // Aufschlag: ein duenner Ring, der auslaeuft, und kurz ein Schaumfleck
    // in der Mitte. Doppelt so gross sah es aus wie ein Teich aus Schaum.
    for (const r of this.rings) {
      const [x, z] = this.toPx(r.x, r.z)
      const life = 1 - r.age / 2.2
      ctx.strokeStyle = `rgba(160,255,0,${(life * 0.65).toFixed(3)})`
      ctx.lineWidth = (0.35 + r.age * 0.25) * k
      ctx.beginPath()
      ctx.arc(x, z, (0.6 + r.age * 2.2) * r.size * k, 0, Math.PI * 2)
      ctx.stroke()
      if (r.age < 0.45) {
        ctx.fillStyle = `rgba(255,0,0,${((1 - r.age / 0.45) * 0.55).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(x, z, (0.7 + r.age * 1.4) * r.size * k, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    this.texture.needsUpdate = true
  }
}
