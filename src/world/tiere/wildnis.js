import * as THREE from 'three'
import { playAreaDistance, terrainHeight, terrainNormal, SUMMIT } from '../heightfield.js'
import { isSnowSurface } from '../surfaces.js'
import { Waldkarte, imBild } from './werkzeug.js'
import { Hase, Hasenfamilie } from './hase.js'
import { Schneehuehner } from './schneehuehner.js'
import { Fuchs } from './fuchs.js'
import { Eichhoernchen } from './eichhoernchen.js'
import { Dohle } from './dohle.js'
import { Steinbock } from './steinbock.js'

// Die Wildnis entscheidet, wann und wo sich ein Tier zeigt. Selten soll es
// sein: wer eine Viertelstunde durchs Tal faehrt, sieht vielleicht drei
// Hasen, mit Glueck einen Fuchs, und die Schneehuehner nur, wer oben am
// Gipfel herumfaehrt. Nie zwei Tiere auf einmal – ein Fund ist einer.
//
// Dazu seit 04.10. die Tiere mit festem Ort: das Eichhoernchen (so selten
// wie der Hase) nur auf dem First der Apres-Ski-Huette, die Dohle auf dem
// Gipfelkreuz oder dem First, der Steinbock (so selten wie der Fuchs) auf
// einem Felsen an Grat oder Klamm. Ihre Uhren laufen nur, wenn man in der
// Naehe ihres Ortes ist – sonst gaebe es dort nie einen Platz ausser Sicht.
// Jeder vierte Hase bringt zwei Junge mit (Hasenfamilie).
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
  eichhoernchen: { erst: [90, 180], dann: [210, 420] },
  dohle: { erst: [70, 150], dann: [240, 480] },
  steinbock: { erst: [360, 600], dann: [600, 900] },
}
const FAMILIE = 0.25        // Anteil der Hasen, die mit Jungen kommen
const NAH = 70              // m: so nah muss man einem festen Ort sein

export class Wildnis {
  constructor({ scene, trail, spray, camera, world, baeume, stationen, huette = null, kreuz = null, felsen = [] }) {
    this.ctx = { scene, trail, spray, camera, world, wald: new Waldkarte(baeume), huette }
    this.sitze = this._sitze(huette, kreuz)
    // Nur Felsen, die gross genug sind, dass ein Bock darauf thront, und die
    // wirklich aus dem Schnee ragen.
    this.felsen = felsen.filter((f) => f.scale >= 1.5 && f.top - terrainHeight(f.x, f.z) > 0.45)
    this.stationen = stationen
    this.tier = null
    this.art = null
    this.uhr = Object.fromEntries(Object.entries(TAKT).map(([k, t]) => [k, zufall(...t.erst)]))
    // Zaehler fuer Neugierige und den Pistenpass, falls er sie einmal will.
    this.gesichtet = Object.fromEntries(Object.keys(TAKT).map((k) => [k, 0]))
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
      if (skier.tow && art !== 'huehner' && art !== 'dohle') continue
      if (!this._inDerNaehe(art, skier)) continue
      this.uhr[art] -= dt
      if (this.uhr[art] > 0) continue
      if (this.rufen(art, skier)) return
      // Kein Platz gefunden: bald noch einmal schauen, nicht gleich wieder.
      this.uhr[art] = zufall(4, 9)
    }
  }

  // Ruft ein Tier sofort herbei, wenn es einen Platz findet. Aus der
  // Konsole: __ski.tiere.rufen('hase' | 'hasenfamilie' | 'huehner' |
  // 'fuchs' | 'eichhoernchen' | 'dohle' | 'steinbock'). Die mit festem Ort
  // kommen nur, wenn man hoechstens 70 m davon ist und der Ort nicht im
  // Bild liegt.
  rufen(art, skier = window.__ski?.skier) {
    if (!skier) return false
    if (this.tier) this.tier.entfernen()
    this.tier = null
    let familie = art === 'hasenfamilie'
    if (familie) art = 'hase'
    else if (art === 'hase') familie = Math.random() < FAMILIE
    let platz = null
    if (art === 'hase') platz = this._waldrand(skier, { frei: 3 })
    else if (art === 'fuchs') platz = this._waldrand(skier, { frei: 4 })
    else if (art === 'huehner') platz = this._hoehe(skier)
    else if (art === 'eichhoernchen') platz = this._dach(skier)
    else if (art === 'dohle') platz = this._sitz(skier)
    else if (art === 'steinbock') platz = this._fels(skier)
    if (!platz) return false
    const Art = {
      hase: familie ? Hasenfamilie : Hase, fuchs: Fuchs, huehner: Schneehuehner,
      eichhoernchen: Eichhoernchen, dohle: Dohle, steinbock: Steinbock,
    }[art]
    this.tier = new Art(this.ctx, platz)
    this.art = art
    this._gezaehlt = false
    return true
  }

  // Die Uhr eines Tiers mit festem Ort laeuft nur in dessen Naehe.
  _inDerNaehe(art, skier) {
    const p = skier.position
    const nah = (o) => Math.hypot(o.x - p.x, o.z - p.z) < NAH
    if (art === 'eichhoernchen') return !!this.ctx.huette && nah(this.ctx.huette.position)
    if (art === 'dohle') return this.sitze.some(nah)
    if (art === 'steinbock') return this.felsen.some(nah)
    return true
  }

  // Die Plaetze der Dohle in Weltkoordinaten: drei auf dem First der
  // Huette (laengs beweglich), zwei auf dem Kreuz – die Enden des
  // Querbalkens –, und einer oben auf dem Stamm.
  _sitze(huette, kreuz) {
    const sitze = []
    const v = new THREE.Vector3()
    if (huette) {
      huette.updateMatrixWorld(true)
      const dach = huette.userData.dach
      for (const f of [-0.55, 0, 0.55]) {
        v.set(0, dach.first, f * dach.halb)
        huette.localToWorld(v)
        sitze.push({ x: v.x, y: v.y, z: v.z, gier: huette.rotation.y, art: 'huette', laengs: dach.halb * 0.35 })
      }
    }
    if (kreuz) {
      kreuz.updateMatrixWorld(true)
      for (const [x, y] of [[0.62, 2.85], [-0.62, 2.85], [0, 3.88]]) {
        v.set(x, y, 0)
        kreuz.localToWorld(v)
        sitze.push({ x: v.x, y: v.y, z: v.z, gier: kreuz.rotation.y + Math.PI / 2, art: 'kreuz' })
      }
    }
    return sitze
  }

  // Ein Punkt, der weder im Bild noch vorn liegt, mit etwas mehr Rand:
  // ein Tier auf einem Dach ragt hoeher auf als eines im Schnee.
  _versteckt(skier, x, y, z) {
    if (imBild(this.ctx.camera, x, y + 0.3, z, 1.2)) return false
    return !this._verboten(skier, x, z)
  }

  _dach(skier) {
    const h = this.ctx.huette
    if (!h) return null
    const d = Math.hypot(h.position.x - skier.position.x, h.position.z - skier.position.z)
    if (d < 20 || d > NAH) return null
    h.updateMatrixWorld(true)
    const dach = h.userData.dach
    const v = new THREE.Vector3()
    for (const f of [-1, 0, 1]) {
      v.set(0, dach.first, f * dach.halb)
      h.localToWorld(v)
      if (!this._versteckt(skier, v.x, v.y, v.z)) return null
    }
    return {}
  }

  _sitz(skier) {
    const p = skier.position
    const frei = this.sitze.filter((s) => {
      const d = Math.hypot(s.x - p.x, s.z - p.z)
      return d > 20 && d < NAH && this._versteckt(skier, s.x, s.y, s.z)
    })
    if (!frei.length) return null
    return { sitze: this.sitze, start: frei[Math.floor(Math.random() * frei.length)] }
  }

  _fels(skier) {
    const p = skier.position
    const frei = this.felsen.filter((f) => {
      const d = Math.hypot(f.x - p.x, f.z - p.z)
      return d > 24 && d < NAH && this._versteckt(skier, f.x, f.top + 0.8, f.z)
    })
    if (!frei.length) return null
    const fels = frei[Math.floor(Math.random() * frei.length)]
    // Quer zur Kamera, mit dem Kopf zur einen oder anderen Seite.
    const blick = new THREE.Vector3()
    this.ctx.camera.getWorldDirection(blick)
    const gier = Math.atan2(blick.x, blick.z) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2
    return { fels, gier }
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
