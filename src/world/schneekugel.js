// Eine Schneekugel, die den Hang hinunterrollt und dabei Schnee aufnimmt –
// ohne three.js, damit sie sich ohne Szene pruefen laesst
// (tests/schneekugel.test.js). Entstanden fuer die Schneemaenner im
// Kinderland (Ansage 10.10.: wer dagegenfaehrt, zerlegt sie, und die Kugeln
// rollen den Berg hinunter und werden groesser). Sie kennt nur eine
// Hoehenfunktion und, wenn es eine gibt, die Welt fuer Hindernisse – so
// laesst sie sich auch am grossen Berg wiederverwenden.
//
// Gerollt wird wie eine Kugel: vom Hangabtrieb kommen 5/7 an (der Rest geht
// in die Drehung). Schnee bremst viel: ein fester Widerstand und einer, der
// mit dem Tempo waechst. Gemessen auf dem Uebungshang (17 bis 22 Grad):
// Endtempo um 3 m/s, also so, dass man ihr zuschauen und nachfahren kann.
// Unter gut 5 Grad bleibt sie liegen.

const G = 9.8
const ROLLEN = 5 / 7
const HAFTEN = 0.9        // m/s²: so viel Hangabtrieb braucht es zum Anrollen (5,2 Grad)
const ZAEH = 0.45         // 1/s: Widerstand, der mit dem Tempo waechst
const WACHSEN = 0.022     // m Halbmesser je gerolltem Meter, am Anfang
const PRALL = 0.35        // so viel kommt von einem Hindernis zurueck
const E = 0.4             // m: Abstand fuer das Gefaelle

export class Schneekugel {
  // hoehe(x, z): Boden. rMax: groesser wird sie nicht (sonst rollt am Ende
  // ein Felsbrocken durchs Tal).
  constructor({ x, z, r, hoehe, rMax = Math.max(r * 2.2, 0.9) }) {
    this.x = x
    this.z = z
    this.r = r
    this.r0 = r
    this.rMax = rMax
    this.hoehe = hoehe
    this.y = hoehe(x, z) + r
    this.vx = 0
    this.vz = 0
    this.vy = 0
    this.luft = false
    this.ruht = true
    this.gerollt = 0
  }

  get tempo() {
    return Math.hypot(this.vx, this.vz)
  }

  // Ein Stoss: in die Waagerechte (vx, vz), mit vy nach oben.
  stossen(vx, vz, vy = 0) {
    this.vx += vx
    this.vz += vz
    if (vy > 0) {
      this.vy = vy
      this.luft = true
    }
    this.ruht = false
  }

  // welt: { resolve(x, z, r) } wie world.js, oder null.
  update(dt, welt = null) {
    if (this.ruht) return
    const h = this.hoehe
    if (this.luft) {
      this.vy -= G * dt
      this.x += this.vx * dt
      this.z += this.vz * dt
      this.y += this.vy * dt
      const boden = h(this.x, this.z) + this.r
      if (this.y > boden) return
      // Im Schnee aufgekommen: kaum Rueckprall, ein Teil des Tempos bleibt
      // im Schnee stecken.
      this.y = boden
      this.vy = 0
      this.luft = false
      this.vx *= 0.7
      this.vz *= 0.7
    }

    // Gefaelle unter der Kugel.
    const gx = (h(this.x + E, this.z) - h(this.x - E, this.z)) / (2 * E)
    const gz = (h(this.x, this.z + E) - h(this.x, this.z - E)) / (2 * E)
    // Hangabtrieb in der Waagerechten: g·sin·cos des Neigungswinkels, das
    // ist g·grad/(1 + grad²).
    const k = G * ROLLEN / (1 + gx * gx + gz * gz)
    const ax = -gx * k
    const az = -gz * k
    const v = this.tempo
    const zug = Math.hypot(ax, az)

    if (v < 0.08 && zug < HAFTEN) {
      this.vx = 0
      this.vz = 0
      this.ruht = true
      return
    }
    this.vx += ax * dt
    this.vz += az * dt
    // Bremsen: fest und mit dem Tempo, nie ueber den Stillstand hinaus.
    const neu = this.tempo
    if (neu > 0) {
      const bremse = Math.min(neu, (HAFTEN + ZAEH * neu) * dt)
      this.vx -= this.vx / neu * bremse
      this.vz -= this.vz / neu * bremse
    }

    const dx = this.vx * dt
    const dz = this.vz * dt
    this.x += dx
    this.z += dz
    const weg = Math.hypot(dx, dz)
    this.gerollt += weg
    // Sie nimmt Schnee auf, je groesser, desto weniger dazu.
    this.r = Math.min(this.rMax, this.r + WACHSEN * weg * (1 - (this.r - this.r0) / (this.rMax - this.r0 + 1e-6)))

    // Baeume, Zaeune, Felsen: abprallen statt hindurchrollen.
    if (welt) {
      const hit = welt.resolve(this.x, this.z, this.r * 0.8, 0, 0)
      if (hit.hit) {
        const d = Math.hypot(hit.pushX, hit.pushZ)
        this.x = hit.x
        this.z = hit.z
        if (d > 0) {
          const nx = hit.pushX / d
          const nz = hit.pushZ / d
          const vn = this.vx * nx + this.vz * nz
          if (vn < 0) {
            this.vx -= (1 + PRALL) * vn * nx
            this.vz -= (1 + PRALL) * vn * nz
          }
        }
      }
    }
    this.y = h(this.x, this.z) + this.r
  }
}
