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
// Gesucht wird ein Platz am Waldrand, der gerade im Bild liegt, und ein
// Einstieg dazu im Wald, der es nicht tut. So kommt das Tier von draussen
// herein und geht auch wieder dorthin – entstehen und verschwinden sieht
// man nie.

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
    if (art === 'hase') platz = this._waldrand(skier, { nah: 11, fern: 19, frei: 3, einstieg: 16 })
    else if (art === 'fuchs') platz = this._waldrand(skier, { nah: 12, fern: 20, frei: 4, einstieg: 18, quer: true })
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

  // Einen Weg vom Platz in den Wald hinein, bis er aus dem Bild ist.
  _einstieg(x, z, r, max) {
    const { camera, wald } = this.ctx
    for (let d = 2; d <= max; d += 1) {
      const ex = x + r.x * d
      const ez = z + r.z * d
      if (playAreaDistance(ex, ez) > 12) return null
      if (!imBild(camera, ex, terrainHeight(ex, ez) + 0.4, ez, 1.12)) {
        // Noch ein Stueck weiter, damit auch die Ohren draussen sind.
        return { x: ex + r.x * 1.5, z: ez + r.z * 1.5 }
      }
      if (wald.naechster(ex, ez, 0.8) < 0.8) continue
    }
    return null
  }

  _waldrand(skier, { nah, fern, frei, einstieg, quer = false }) {
    const { camera, wald } = this.ctx
    const p = skier.position
    let best = null
    for (let i = 0; i < 140; i++) {
      // Bevorzugt dort, wo der Fahrer hinfaehrt: dann kommt er von selbst
      // auf das Tier zu, statt es im Ruecken zu haben.
      const a = skier.speed > 3 && i < 90 ? skier.heading + zufall(-1.2, 1.2) : Math.random() * Math.PI * 2
      const dist = zufall(nah, fern)
      const x = p.x + Math.sin(a) * dist
      const z = p.z + Math.cos(a) * dist
      if (!this._frei(x, z, { frei })) continue
      if (!imBild(camera, x, terrainHeight(x, z) + 0.3, z, 0.78)) continue
      if (wald.anzahl(x, z, 16) < 4) continue
      const r = wald.richtung(x, z, 16)
      if (!r) continue
      const von = this._einstieg(x, z, r, einstieg)
      if (!von) continue
      let ausgang = von
      if (quer) {
        // Der Fuchs quert das Bild: er geht auf der anderen Seite wieder.
        const q = { x: -r.x, z: -r.z }
        const seite = { x: r.z, z: -r.x }
        const zurueck = this._einstieg(x, z, { x: q.x * 0.5 + seite.x * 0.85, z: q.z * 0.5 + seite.z * 0.85 }, 22) ||
          this._einstieg(x, z, { x: q.x * 0.5 - seite.x * 0.85, z: q.z * 0.5 - seite.z * 0.85 }, 22)
        if (!zurueck) continue
        ausgang = zurueck
      }
      const wertung = Math.random() + (skier.speed > 3 ? Math.cos(a - skier.heading) : 0)
      if (!best || wertung > best.wertung) best = { von, ziel: { x, z }, ausgang, wertung }
      if (i > 40 && best) break
    }
    return best
  }

  // Schneehuehner sitzen oberhalb der Baumgrenze im Offenen.
  _hoehe(skier) {
    const p = skier.position
    if (Math.hypot(p.x - SUMMIT.x, p.z - SUMMIT.z) > 48) return null
    const { camera, wald } = this.ctx
    for (let i = 0; i < 120; i++) {
      const a = i < 70 && skier.speed > 3 ? skier.heading + zufall(-1, 1) : Math.random() * Math.PI * 2
      const dist = zufall(14, 22)
      const x = p.x + Math.sin(a) * dist
      const z = p.z + Math.cos(a) * dist
      if (terrainHeight(x, z) < 15) continue
      if (!this._frei(x, z, { frei: 5, kante: -2 })) continue
      if (wald.anzahl(x, z, 7) > 0) continue
      // Gleich ausserhalb des Bildes, aber nicht weit: man faehrt hinein.
      const lage = imBild(camera, x, terrainHeight(x, z), z, 1.0)
      if (lage && !skier.tow) continue
      return { x, z }
    }
    return null
  }
}
