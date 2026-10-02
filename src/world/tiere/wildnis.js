import * as THREE from 'three'
import { playAreaDistance, terrainHeight, terrainNormal, SUMMIT } from '../heightfield.js'
import { isSnowSurface } from '../surfaces.js'
import { Waldkarte, imBild } from './werkzeug.js'
import { Hase } from './hase.js'
import { Schneehuehner } from './schneehuehner.js'
import { Fuchs } from './fuchs.js'

// Die Wildnis entscheidet, wann und wo sich ein Tier zeigt. Selten soll es
// sein: wer eine Viertelstunde durchs Tal faehrt, sieht vielleicht drei
// Hasen, mit Glueck einen Fuchs, und die Schneehuehner nur, wer oben am
// Gipfel herumfaehrt. Nie zwei Tiere auf einmal – ein Fund ist einer.
//
// Die Uhren laufen nur, solange man im Winter frei faehrt: nicht im
// Rundflug, nicht im Sommer, nicht in einer Auswahl. Und sie laufen erst
// weiter, wenn das vorige Tier wieder fort ist.
//
// Gesucht wird ein Platz am Waldrand, 24–55 m entfernt und ausserhalb des
// Bildes, aber nie dort, wohin man gerade faehrt. Dort wartet das Tier zwei,
// drei Minuten – wer vorbeikommt, entdeckt es durch Zufall. In der ersten
// Fassung sass es 11–20 m vor dem Fahrer im Bild und hoppelte ihm entgegen:
// das war kein Fund, sondern ein Auftritt. Entstehen und verschwinden sieht
// man weiterhin nie.

const zufall = (a, b) => a + Math.random() * (b - a)

// Sekunden freien Fahrens bis zum ersten Auftritt, danach Pause nach dem
// Abgang. Der Hase ist das Haupttier, der Fuchs das seltene.
const TAKT = {
  hase: { erst: [90, 180], dann: [210, 420] },
  huehner: { erst: [60, 120], dann: [300, 480] },
  fuchs: { erst: [360, 600], dann: [600, 900] },
}

export class Wildnis {
  constructor({ scene, trail, spray, camera, world, baeume, stationen }) {
    this.ctx = { scene, trail, spray, camera, world, wald: new Waldkarte(baeume) }
    this.stationen = stationen
    this.tier = null
    this.art = null
    this.uhr = Object.fromEntries(Object.entries(TAKT).map(([k, t]) => [k, zufall(...t.erst)]))
    // Zaehler fuer Neugierige und den Pistenpass, falls er sie einmal will.
    this.gesichtet = { hase: 0, huehner: 0, fuchs: 0 }
    this._gezaehlt = false
  }

  update(dt, skier, darf) {
    if (this.tier) {
      const lebt = this.tier.update(dt, skier)
      if (this.tier.gesehen && !this._gezaehlt) {
        this._gezaehlt = true
        this.gesichtet[this.art]++
      }
      if (!lebt) {
        this.uhr[this.art] = zufall(...TAKT[this.art].dann)
        this.tier = null
        this.art = null
      }
      return
    }
    if (!darf) return

    for (const art of Object.keys(TAKT)) {
      // Am Lift haengt man fest – da soll kein Hase vorbeihoppeln, den man
      // nicht erreichen kann. Die Huehner duerfen: man schwebt an ihnen vorbei.
      if (skier.tow && art !== 'huehner') continue
      this.uhr[art] -= dt
      if (this.uhr[art] > 0) continue
      if (this.rufen(art, skier)) return
      // Kein Platz gefunden: bald noch einmal schauen, nicht gleich wieder.
      this.uhr[art] = zufall(4, 9)
    }
  }

  // Ruft ein Tier sofort herbei, wenn es einen Platz findet. Aus der
  // Konsole: __ski.tiere.rufen('hase' | 'huehner' | 'fuchs').
  rufen(art, skier = window.__ski?.skier) {
    if (!skier) return false
    if (this.tier) this.tier.entfernen()
    this.tier = null
    let platz = null
    if (art === 'hase') platz = this._waldrand(skier, { frei: 3 })
    else if (art === 'fuchs') platz = this._waldrand(skier, { frei: 4 })
    else if (art === 'huehner') platz = this._hoehe(skier)
    if (!platz) return false
    const Art = { hase: Hase, fuchs: Fuchs, huehner: Schneehuehner }[art]
    this.tier = new Art(this.ctx, platz)
    this.art = art
    this._gezaehlt = false
    return true
  }

  _frei(x, z, { frei = 3, kante = -3 } = {}) {
    if (playAreaDistance(x, z) > kante) return false
    if (!isSnowSurface(x, z, 1.5)) return false
    if (terrainNormal(x, z, (this._n ||= new THREE.Vector3())).y < 0.86) return false
    if (this.ctx.wald.naechster(x, z, frei) < frei) return false
    for (const c of this.ctx.world.nearby(x, z)) if (Math.hypot(c.x - x, c.z - z) < c.r + 1.5) return false
    for (const s of this.stationen.stations) if (Math.hypot(s.position.x - x, s.position.z - z) < 8) return false
    return true
  }

  // Liegt der Punkt im Bild oder dort, wohin der Fahrer gerade faehrt?
  // Vorn heisst: bis 55 m und hoechstens 50° neben der Fahrtrichtung –
  // dorthin ist man in drei, vier Sekunden, und dann waere es wieder ein
  // Tier, das direkt vor einem auftaucht.
  _verboten(skier, x, z, rand = 1.15) {
    // Auch im Stand: wer steht, faehrt meist gleich dorthin los, wohin er schaut.
    if (imBild(this.ctx.camera, x, terrainHeight(x, z) + 0.4, z, rand)) return true
    const dx = x - skier.position.x
    const dz = z - skier.position.z
    const vor = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - skier.heading), Math.cos(Math.atan2(dx, dz) - skier.heading)))
    return vor < 0.87 && Math.hypot(dx, dz) < 55
  }

  _waldrand(skier, { frei }) {
    const { wald } = this.ctx
    const p = skier.position
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * Math.PI * 2
      const dist = zufall(24, 55)
      const x = p.x + Math.sin(a) * dist
      const z = p.z + Math.cos(a) * dist
      if (!this._frei(x, z, { frei })) continue
      if (this._verboten(skier, x, z)) continue
      if (wald.anzahl(x, z, 16) < 4) continue
      const r = wald.richtung(x, z, 16)
      if (!r) continue
      // Ein paar Meter im Bestand kommt es her und geht es wieder hin.
      const d = zufall(3, 6)
      const von = { x: x + r.x * d, z: z + r.z * d }
      if (playAreaDistance(von.x, von.z) > 12 || this._verboten(skier, von.x, von.z)) continue
      return { von, ziel: { x, z }, ausgang: von }
    }
    return null
  }

  // Schneehuehner sitzen oberhalb der Baumgrenze im Offenen, irgendwo rund
  // um den Gipfel – wer oben herumfaehrt, stoesst irgendwann auf sie.
  _hoehe(skier) {
    const p = skier.position
    if (Math.hypot(p.x - SUMMIT.x, p.z - SUMMIT.z) > 90) return null
    const { wald } = this.ctx
    for (let i = 0; i < 200; i++) {
      const a = Math.random() * Math.PI * 2
      const r = Math.sqrt(Math.random()) * 45
      const x = SUMMIT.x + Math.sin(a) * r
      const z = SUMMIT.z + Math.cos(a) * r
      if (Math.hypot(x - p.x, z - p.z) < 24) continue
      if (terrainHeight(x, z) < 15) continue
      if (!this._frei(x, z, { frei: 5, kante: -2 })) continue
      if (wald.anzahl(x, z, 7) > 0) continue
      if (this._verboten(skier, x, z)) continue
      return { x, z }
    }
    return null
  }
}
