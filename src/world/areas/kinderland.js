import * as THREE from 'three'
import { KINDER_LANE, SHOOT_LANE, BREMS_LANE, TRAMPOLINE, terrainHeight } from '../heightfield.js'
import { CAMERA } from '../../config.js'
import { MagicCarpet } from '../attractions/magic-carpet.js'
import { SkiCarousel } from '../attractions/ski-carousel.js'
import { Trampolin } from '../attractions/trampolin.js'
import { ZerlegbarerSchneemann } from '../attractions/schneemann.js'
import { readableYaw } from '../props/slalom.js'
import { springMount } from '../props/signpost.js'
import { createLipLine } from '../props/funpark.js'
import { createMarker } from '../../stations/marker.js'
import { LINKS } from '../../stations/links.js'
import { createSnowCannon } from '../props/snow-cannon.js'
import { createTrampolin } from '../props/trampolin.js'
import { createSkischulhuette, HUETTE as HUETTE_MASS } from '../props/skischule.js'
import { Skischulgruppe } from './skischule.js'
import {
  createNoodleArch,
  createSnowman,
  createBuntingFence,
  createTierstange,
  createStoppschild,
  TIERE,
  KINDER_COLORS,
} from '../props/kinderland.js'

// Das Kinderland: Spielwiese oben auf der Osthoehe, Uebungshang darunter,
// Zauberteppich dazwischen, westlich daneben die Westabfahrt mit zwei
// Trampolinen und der Bremslinie, unten an der Einfahrt die Skischule.
//
// Der Aufbau folgt einem echten Kinderland, und daran haengt der ganze
// Zusammenhang: das Foerderband liegt am Westrand des praeparierten Bandes,
// die Uebungsstrecke daneben auf demselben Band. Man faehrt hinauf, spielt
// oben auf der Kuppe, faehrt durch den Tierslalom wieder hinunter, haelt am
// Bremsfeld und steht wieder am Teppich. Nichts steht irgendwo – alles liegt
// an dieser Schleife.
//
// Neu seit 09.10. (Ansage: die Leuchtstrecke ist zu langweilig, das
// Kinderland laedt noch nicht ein, ein Trampolin wie das Fangnetz, viele
// Spiel- und Uebemoeglichkeiten, irgendwo der Skilehrer-Ausweis):
// - die Leuchtstrecke ist weg, ihr Band ist die Westabfahrt mit dem
//   Trampolin auf halber Hoehe;
// - statt Huetchentoren ein Tierslalom: sechs Stangen mit Tierkoepfen, um
//   die man im Wechsel herumfaehrt – wer alle auf der richtigen Seite
//   nimmt, bekommt es gesagt;
// - ein Bremsfeld: so nah wie moeglich vor der roten Linie anhalten. Seit
//   10.10. am Fuss eines eigenen kleinen Hangs, der von der Kuppe nach
//   Westen hinunterfuehrt (BREMS_LANE);
// - Schneemaenner, die man umfahren kann: die Kugeln rollen den Hang
//   hinunter und werden groesser (attractions/schneemann.js);
// - an der Einfahrt der Treffpunkt der Skischule, von dem eine Gruppe aus
//   Skilehrer und vier Kindern ihre Runden faehrt. Nur der Skilehrer
//   fuehrt zum Ausweis (die Tafel am Treffpunkt ist seit 11.10. weg).
//
// Positionen auf dem Hang werden in Bandkoordinaten angegeben: s ist die
// Strecke von unten, off der seitliche Versatz (negativ = zum Teppich hin).
// Dadurch wandert die ganze Anlage mit, wenn das Band einmal anders liegt.

// Wo der Teppich auf dem Band liegt und wie weit er reicht.
const CARPET_OFFSET = -4.2
const CARPET_FROM = 3
const CARPET_TO = 23

// Die Spielwiese oben. Weltkoordinaten, weil die Kuppe kein Band hat – sie
// ist von selbst flach genug. In ihrer Mitte steht das Skikarussell: auf
// x 43–50, z −12…−5 liegt der Boden auf 0,6 m genau gleich hoch (8,2–8,7),
// das ist die einzige Stelle im Kinderland, auf die ein Kreis mit 3,25 m
// Fahrradius passt.
const CAP = { x: 46.6, z: -8.4 }

// Der Tierslalom: sechs Stangen knapp neben der Mittellinie, im Wechsel
// links und rechts, und jede wird aussen umfahren. Eine erste Fassung hatte
// sie 1,7 m weit draussen und verlangte die Innenseite – dann zaehlte auch,
// wer stur geradeaus durch die Mitte fuhr. Die Mittellinie liegt zwischen
// Teppich (−4,2) und Ostzaun (7,8). 2,8 m Abstand laengs: bei Reisetempo
// ein Schwung je Stange.
const SLALOM_MITTE = 1.6
const SLALOM = [18.5, 15.7, 12.9, 10.1, 7.3, 4.5].map((s, i) => ({ s, off: SLALOM_MITTE + (i % 2 ? -0.6 : 0.6) }))
const ZIEL_S = 2.2

// Das Bremsfeld liegt am Fuss des Bremshangs (BREMS_LANE in heightfield.js,
// s von oben), quer ueber die ganze Breite, wo der Hang in den Auslauf
// uebergeht: davor kommt man mit gut 20 Grad von der Kuppe herunter. Zuerst lag es im Auslauf des Uebungshangs, wo man
// nach dem Tierslalom schon langsam war, dann kurz unten an der
// Westabfahrt (Ansage 10.10.: ein eigener kleiner Hang von der Kuppe).
const BREMS_S = BREMS_LANE.segments[4].s0 + 0.5
const BREMS_VON = -3.5
const BREMS_BIS = 3.5
const SKISPITZE = 0.8   // m vor der Fahrermitte: dort zaehlt die Linie

// Der Treffpunkt der Skischule: am Fuss des Uebungshangs, im Bogen zwischen
// Zielbogen und Teppich. Dort kommt die Gruppe ohnehin vorbei – vorher stand
// er am Ostende des Bremsfelds, und sie fuhr hin, drehte um und lief an
// sich selbst vorbei zurueck (Meldung 10.10.: starke Kehrtwende). Jetzt
// ein weiter Bogen: vom Zielbogen nach Osten hinunter, am Treffpunkt
// warten und hinueber zum Teppich.
const TREFF = { s: -2.6, off: 4.2 }

// Die Huette der Skischule (Ansage 10.10.): suedoestlich vom Treffpunkt,
// zwischen dem Weg nach Osten und dem Wald, die Front zur Kamera. Aus der
// Kamera steht sie rechts unter dem Treffpunkt, 3,8 m daneben. Bei (39, 27)
// stand sie nur 1,7 m daneben und verdeckte Treffpunkt und Fahrer.
const HUETTE = { x: 42.0, z: 26.5 }

export class Kinderland {
  constructor(world, registry) {
    this.world = world
    this.registry = registry
    this.lane = KINDER_LANE
    this.reactors = []
    this.animated = []
    this.federn = []
    this.schneemaenner = []

    const from = this.at(CARPET_FROM, CARPET_OFFSET)
    const to = this.at(CARPET_TO, CARPET_OFFSET)
    this.carpet = new MagicCarpet(world, {
      base: { x: from.x, z: from.z },
      top: { x: to.x, z: to.z },
      speed: 5.4,
    })

    // Der Teppich meldet sich als Station an. Damit bekommt er denselben
    // Ring im Schnee und dieselbe Einblendung wie alles andere, das man mit E
    // benutzt – man muss nicht wissen, dass er faehrt, man sieht es.
    const marker = this.at(CARPET_FROM - 1.2, CARPET_OFFSET)
    if (registry) world.scene.add(createMarker(marker.x, marker.z, 5.5, '#2f6bd8'))
    registry?.add({
      id: 'zauberteppich',
      label: 'Zauberteppich',
      hint: 'Aufsteigen',
      color: '#2f6bd8',
      position: { x: marker.x, z: marker.z },
      radius: 5.5,
      labelHeight: terrainHeight(marker.x, marker.z) + 2.6,
      onUse: () => this.carpet.board(this._skier),
    })

    this._buildFence()
    this._buildCarousel()
    this._buildCap()
    this._buildSlope()
    this._buildBremsfeld()
    this._buildTrampolin()
    this._buildCannon()
    this._buildSkischule()
  }

  // --- Bandkoordinaten ----------------------------------------------------

  // Unterhalb des Bandes (s < 0) geht es in der Richtung des ersten
  // Abschnitts weiter – dort liegen Bremsfeld und Treffpunkt.
  at(s, off = 0, lane = this.lane) {
    const segs = lane.segments
    let g = s < 0 ? segs[0] : segs[segs.length - 1]
    let t = s < 0 ? s / g.len : 1
    for (const seg of segs) {
      if (s >= seg.s0 && s <= seg.s0 + seg.len) {
        g = seg
        t = (s - seg.s0) / seg.len
        break
      }
    }
    const ux = g.dx / g.len
    const uz = g.dz / g.len
    return {
      x: g.x + g.dx * t - uz * off,
      z: g.z + g.dz * t + ux * off,
      // Bergauf, also entgegen der Fahrtrichtung beim Abfahren.
      heading: Math.atan2(ux, uz),
    }
  }

  // Umkehrung von at(): am Uebungshang fuer den untersten Abschnitt – das
  // Band ist ohnehin eine Gerade (alle Abschnitte 3,5 / −5,5). Am gebogenen
  // Bremshang der naechste Abschnitt (`alle`).
  lage(x, z, lane = this.lane, alle = false) {
    if (alle) {
      let best = null
      for (const g of lane.segments) {
        const ux = g.dx / g.len, uz = g.dz / g.len
        const dx = x - g.x, dz = z - g.z
        const t = Math.max(0, Math.min(g.len, dx * ux + dz * uz))
        const off = -dx * uz + dz * ux
        const d = Math.hypot(dx - ux * t, dz - uz * t)
        if (!best || d < best.d) best = { d, s: g.s0 + dx * ux + dz * uz, off, ux, uz }
      }
      return best
    }
    const g = lane.segments[0]
    const ux = g.dx / g.len
    const uz = g.dz / g.len
    const dx = x - g.x
    const dz = z - g.z
    return { s: dx * ux + dz * uz, off: -dx * uz + dz * ux }
  }

  // --- Aufbau -------------------------------------------------------------

  // Ein Objekt hinstellen und, wenn es reagieren kann, anmelden.
  add(object, x, z, { rotation = 0, collider = 0, trigger = 0, kind = null } = {}) {
    this.world.place(object, x, z, { rotation })
    if (collider > 0) this.world.addCollider(x, z, collider)
    if (object.userData.animate) this.animated.push(object.userData.animate)
    if (trigger > 0 && object.userData.react) {
      this.reactors.push({ x, z, r: trigger, obj: object, kind, cool: 0 })
    }
    return object
  }

  // Die Einfassung. Sie umschliesst Teppich, Uebungshang, Spielwiese und
  // Westabfahrt – erst dadurch sind die Dinge darin ein Ort und nicht eine
  // Ansammlung. Luecken: unten die Einfahrt, im Westen der Weg vom
  // Sportgelaende (er kreuzt die Abfahrt zwischen den Trampolinen) und oben
  // die Westabfahrt selbst.
  _buildFence() {
    const zug = (punkte) => this.world.scene.add(createBuntingFence(punkte, {
      sample: (x, z) => terrainHeight(x, z),
      spacing: 3.4,
    }))
    const p = (s, off) => {
      const q = this.at(s, off)
      return [q.x, q.z]
    }
    // Westlich der Trampoline, zwischen Abfahrt und Weg, mit einer Luecke
    // fuer den Weg, der zwischen den Tuechern quert.
    const w = (s, off) => {
      const q = this.at(s, off, SHOOT_LANE)
      return [q.x, q.z]
    }
    zug([w(8, 5.2), w(12, 5.6), w(15.5, 5.6)])
    zug([w(21, 5.4), w(25, 5.0)])
    // Um die Kuppe herum und den Ostrand hinunter.
    // Von der Kuppe nach Westen faehrt man den Bremshang hinunter; der
    // Zaun fasst ihn nach Norden ein, zum Funpark hin. Das kurze Stueck
    // zwischen Teppich und Kuppe ist weg (zweite Skizze 10.10.): es stand
    // mitten im Hang.
    const cap = [
      [33.4, -17.4], [37.4, -16.6], [41.4, -16.2], [45.0, -14.6], [49.5, -13.6],
      [52.4, -10.0], [52.6, -5.4], [50.0, -2.2],
    ]
    const east = [24.5, 19, 13, 7, 1.5].map((s) => p(s, 7.8))
    zug([...cap, ...east])
  }

  // Das Skikarussell: Enter haengt einen an den naechsten Griff, nach einer
  // Runde laesst es los, wenn die Tangente auf den Einstieg des Slaloms
  // zeigt. Damit schliesst es die Schleife oben: Teppich hinauf, eine Runde
  // im Kreis, hinaus in die Tierstangen.
  _buildCarousel() {
    const exit = this.at(21.5, 1.0)
    this.carousel = new SkiCarousel(this.world, { center: CAP, exit: { x: exit.x, z: exit.z } })

    if (this.registry) this.world.scene.add(createMarker(CAP.x, CAP.z, 4.1, '#e8663a'))
    this.registry?.add({
      id: 'skikarussell',
      label: 'Skikarussell',
      hint: 'Einsteigen',
      color: '#e8663a',
      position: { x: CAP.x, z: CAP.z },
      radius: 5.4,
      labelHeight: terrainHeight(CAP.x, CAP.z) + 4.0,
      onUse: () => this.carousel.board(this._skier),
    })
    // Die Einladung bleibt stehen, solange man im Kreis faehrt – dann sagt
    // sie, was Enter dort tut. registry.add kopiert die Station, deshalb
    // wird die gespeicherte Fassung geaendert, nicht das Literal oben.
    this._carouselStation = this.registry?.stations.find((s) => s.id === 'skikarussell')
  }

  _buildCap() {
    // Ein Nudelbogen dort, wo das Karussell einen loslaesst – man wird
    // hindurchgeschleudert, hinunter zum Slalom.
    this.add(createNoodleArch({ color: KINDER_COLORS[3], span: 4.6 }), 47.4, -2.6, {
      rotation: readableYaw(Math.atan2(0.62, -0.78)),
      trigger: 3.0,
      kind: 'arch',
    })

    // Drei Schneemaenner, aufgestellt wie Zuschauer am Rand: verschieden
    // gross, verschiedene Huete, alle mit Blick auf die Wiese.
    const snowmen = [
      { x: 43.2, z: -4.6, scale: 1.15, hat: KINDER_COLORS[0] },
      { x: 50.0, z: -5.2, scale: 0.9, hat: KINDER_COLORS[1] },
      // Neben dem Kopf des Bremshangs, nicht auf ihm.
      { x: 47.2, z: -13.0, scale: 1.3, hat: KINDER_COLORS[3] },
    ]
    snowmen.forEach((s, i) => this._schneemann(s.x, s.z, s.scale, s.hat, i * 2.1, Math.atan2(CAP.x - s.x, CAP.z - s.z), 7))
  }

  // Jeder Schneemann laesst sich umfahren; die Kollision haengt an ihm
  // (attractions/schneemann.js) und faellt mit ihm weg.
  _schneemann(x, z, scale, hat, seed, rotation, trigger = 6.5) {
    const man = createSnowman({ scale, hat, seed })
    this.add(man, x, z, { rotation, trigger, kind: 'snowman' })
    const zerlegbar = new ZerlegbarerSchneemann(this.world, man, x, z, { scale, hat })
    this.schneemaenner.push(zerlegbar)
    this.reactors.at(-1).schneemann = zerlegbar
  }

  // Die Schneekanone steht am oberen Drittel des Uebungshangs, hinter der
  // Absperrung, und blaest ueber den Zaun hinweg quer auf die Strecke. Quer
  // ist hier zweimal richtig: man faehrt zwangslaeufig hindurch, und die
  // Fahne laeuft bei fester Kamera fast vollstaendig ueber den Bildschirm,
  // statt als Fleck in die Blickachse zu zeigen. Hinter dem Zaun ist sie,
  // weil ein Geraet mit einem Geblaese nicht dort steht, wo Kinder fahren.
  _buildCannon() {
    const p = this.at(13, 10.5)
    const cannon = createSnowCannon({ heading: p.heading + Math.PI / 2 })
    this.world.place(cannon, p.x, p.z, {})
    this.world.addCollider(p.x, p.z, 1.0)
    this.animated.push(cannon.userData.animate)
    this.cannon = cannon
  }

  // Der Uebungshang: oben der orange Bogen, durch den das Karussell einen
  // wirft, dann sechs Tierstangen, unten ein gelber Bogen als Ziel.
  _buildSlope() {
    for (const [s, off, i] of [[21.0, 0.8, 0], [ZIEL_S, SLALOM_MITTE, 2]]) {
      const p = this.at(s, off)
      // Alles auf dem Hang schaut bergauf – also dem entgegen, der herunter
      // kommt.
      this.add(createNoodleArch({ color: KINDER_COLORS[i], span: 4.8, height: 2.3 }), p.x, p.z, {
        rotation: readableYaw(p.heading + Math.PI), trigger: 2.9, kind: 'arch',
      })
    }

    // Die Tierstangen. Der Kopf zeigt zur Kamera, nicht bergauf: von oben
    // liest man das Tier, und wer herunterkommt, sieht es ohnehin.
    this.slalom = SLALOM.map((g, i) => {
      const p = this.at(g.s, g.off)
      const stange = createTierstange({ tier: TIERE[i % TIERE.length], farbe: KINDER_COLORS[i % 4] })
      // Etwas groesser als Kinderstangen in echt: aus 33 m Kameraabstand
      // waren die Gesichter bei 0,3 m Halbmesser kaum mehr als Knoepfe.
      stange.scale.setScalar(1.3)
      this.world.place(stange, p.x, p.z, { rotation: CAMERA.azimuth })
      this.world.place(stange.userData.teller, p.x, p.z, {})
      this.federn.push(springMount(this.world, stange, p.x, p.z, CAMERA.azimuth))
      return { ...g, x: p.x, z: p.z }
    })
    this._slalomLauf = null

    // Zwei kleine Schneemaenner am Ostrand des Uebungshangs, damit die
    // Strecke auch dort als Ort gefasst ist und nicht im Hang ausfranst. Der
    // eine stand frueher westlich am Teppich; dort steht jetzt das Trampolin
    // mit eigenen Zuschauern.
    for (const [s, off, scale] of [[17.5, 6.2, 0.85], [8.5, 6.4, 0.95]]) {
      const p = this.at(s, off)
      this._schneemann(p.x, p.z, scale, KINDER_COLORS[2], s, p.heading + Math.PI)
    }
  }

  // Das Bremsfeld: eine rote Linie quer im Auslauf des Bremshangs, am
  // Suedende ein HALT. Wer vom Hang kommt und davor zum Stehen kommt,
  // bekommt gesagt, wie nah die Skispitzen an der Linie sind.
  _buildBremsfeld() {
    const punkte = []
    for (let off = BREMS_VON; off <= BREMS_BIS + 0.01; off += 0.5) {
      const p = this.at(BREMS_S, off, BREMS_LANE)
      punkte.push([p.x, terrainHeight(p.x, p.z) + 0.03, p.z])
    }
    this.world.scene.add(createLipLine(punkte, 0xd6332a))
    // Am Suedende, zur Kamera hin, etwas hinter der Linie.
    const schild = this.at(BREMS_S + 0.4, BREMS_VON - 0.9, BREMS_LANE)
    this.world.place(createStoppschild(), schild.x, schild.z, { rotation: CAMERA.azimuth })
    this.world.addCollider(schild.x, schild.z, 0.25)
    this._bremsen = null
  }

  // Die zwei Trampoline auf der Westabfahrt, jedes kennt das andere (mit W
  // springt man hinueber), und zwei Zuschauer am Rand.
  _buildTrampolin() {
    this.trampoline = TRAMPOLINE.map((t) => {
      const tr = new Trampolin(t)
      const bild = createTrampolin(t)
      this.world.place(bild, t.x, t.z, { yOffset: t.h - terrainHeight(t.x, t.z) })
      this.animated.push(() => bild.userData.update(tr.delle()))
      return tr
    })
    for (const tr of this.trampoline) tr.nachbarn = this.trampoline.filter((n) => n !== tr)
    // Westlich hinter den Tuechern, von der Kamera aus gesehen: davor
    // verdeckten sie die Delle, und auf der Abfahrt stuenden sie im Weg.
    const mitte = this.at(18, 0, SHOOT_LANE)
    for (const [s, off, scale, hat, seed] of [[12.5, 4.4, 0.9, KINDER_COLORS[1], 3.3], [24, 4.0, 1.05, KINDER_COLORS[0], 5.1]]) {
      const { x, z } = this.at(s, off, SHOOT_LANE)
      this._schneemann(x, z, scale, hat, seed, Math.atan2(mitte.x - x, mitte.z - z))
    }
  }

  // Fuer Pistenpass und Sprungtaste: springt man gerade auf einem der Tuecher?
  get trampolinImSpiel() {
    return this.trampoline.some((t) => t.imSpiel)
  }

  get aufTrampolin() {
    return this.trampoline.some((t) => t.fang)
  }

  // Die Skischule: die Gruppe, die vom Treffpunkt aus ihre Runde faehrt.
  // Der Skilehrer-Ausweis haengt nur am Skilehrer selbst – wer neben ihm
  // steht, kann ihn ansprechen. Die Tafel am Treffpunkt, die ihn ausserdem
  // zeigte, ist weg (Ansage 11.10.).
  _buildSkischule() {
    const ausweis = {
      label: 'Skilehrer-Ausweis', sub: 'geprüft · snowsports.at', glyph: 'ski',
      url: LINKS.skilehrer, color: '#1f4fa8',
    }

    // Die Runde der Gruppe, Abschnitt fuer Abschnitt.
    const p = (s, off) => {
      const q = this.at(s, off)
      return [q.x, q.z]
    }
    // Ein Bogen vom Zielbogen hinunter und hinueber zum Teppich: am
    // Treffpunkt wird gewartet, ohne Umkehr.
    const start = p(TREFF.s, TREFF.off)
    const vorTeppich = p(CARPET_FROM - 1.4, CARPET_OFFSET)
    const slalom = SLALOM.map((g) => p(g.s, g.off + (g.off > SLALOM_MITTE ? 0.85 : -0.85)))
    const halt = p(0.4, 1.3)
    // Die Huette: die Tuer liegt links in der Front, zur Kamera. Hinaus geht
    // es zur Kamera hin und in einem Bogen links um die Huette zum
    // Treffpunkt; hinein auf demselben Weg zurueck.
    const huette = createSkischulhuette()
    // Der Boden steigt zur Front um 0,37 m an: so viel hoeher, dass die Tuer
    // nicht im Schnee steckt; hinten traegt der tiefe Sockel.
    this.world.place(huette.group, HUETTE.x, HUETTE.z, { rotation: CAMERA.azimuth, yOffset: 0.25 })
    const ca = Math.cos(CAMERA.azimuth), sa = Math.sin(CAMERA.azimuth)
    const lokal = (lx, lz) => [HUETTE.x + lx * ca + lz * sa, HUETTE.z - lx * sa + lz * ca]
    const tx = HUETTE_MASS.tuerX
    for (const [lx, lz, r] of [[-1.0, 0, 1.2], [0.6, 0, 1.2], [0.8, 0.9, 0.45]]) this.world.addCollider(...lokal(lx, lz), r)
    this.huette = huette
    const hutweg = [lokal(tx, 0), lokal(tx, HUETTE_MASS.tief / 2), lokal(tx - 0.2, HUETTE_MASS.tief / 2 + 1.1),
      lokal(-2.2, HUETTE_MASS.tief / 2 + 1.0), lokal(-3.3, 0.2), p(TREFF.s + 0.2, TREFF.off + 2.6), start]

    this.gruppe = new Skischulgruppe(this.world, {
      teppich: this.carpet,
      huette: { bild: huette, weg: hutweg },
      erzwungen: new URLSearchParams(globalThis.location?.search ?? '').has('skischule'),
      abschnitte: [
        { art: 'gehen', tempo: 1.3, halt: 'treffpunkt', rund: true, punkte: [start, p(-3.4, 3.6), p(-3.8, 2.4), p(-3.6, 0.2), p(-2.4, -1.9), p(-0.9, -3.4), vorTeppich, p(CARPET_FROM, CARPET_OFFSET)] },
        { art: 'teppich', tempo: this.carpet.speed, punkte: [p(CARPET_FROM, CARPET_OFFSET), p(CARPET_TO, CARPET_OFFSET)] },
        // Oben ein Bogen ueber die Kuppe: lang genug, dass die ganze
        // Schlange vor dem Slalom Platz hat. Bei 6,8 m stand das dritte Kind
        // noch am Ausstieg, und das vierte kam auf dem Band in es hinein.
        { art: 'gehen', tempo: 1.2, punkte: [p(CARPET_TO, CARPET_OFFSET), p(CARPET_TO + 1.6, -3.8), p(CARPET_TO + 2.8, -1.8), p(CARPET_TO + 2.4, 0.8), p(23.2, 1.6)] },
        // Im Pflug hinunter, langsamer als der Fahrer im Reisetempo.
        { art: 'fahren', tempo: 2.6, halt: 'oben', punkte: [p(23.2, 1.6), p(21, 1.6), ...slalom, p(ZIEL_S, SLALOM_MITTE), halt] },
        { art: 'gehen', tempo: 1.1, halt: 'bremsen', rund: true, punkte: [halt, p(-0.9, 3.4), p(-2.0, 4.3), start] },
      ],
    })

    if (this.registry) {
      const lehrer = this.gruppe.lehrer.model
      lehrer.userData.select = () => {}
      this.registry.add({
        id: 'skilehrer',
        label: 'Skilehrer',
        hint: 'Ausweis zeigen',
        color: '#1f4fa8',
        position: { x: lehrer.position.x, z: lehrer.position.z },
        radius: 2.6,
        groundY: lehrer.position.y,
        labelHeight: lehrer.position.y + 2.4,
        object: lehrer,
        focus: { abstand: 6, hoehe: 1.0, vor: 0.6 },
        choices: [ausweis],
      })
      this._lehrerStation = this.registry.stations.find((s) => s.id === 'skilehrer')
    }
  }

  // --- Ablauf -------------------------------------------------------------

  update(dt, skier, input) {
    this._skier = skier
    this.carpet.update(dt, skier, input)
    this.carousel.update(dt, skier, input)
    for (const tr of this.trampoline) tr.update(dt, skier, input)
    for (const m of this.schneemaenner) m.update(dt, skier)
    // Liegen alle Schneemaenner zugleich, kommt die Skischule – auch
    // ausserhalb ihrer Zeit, von da an fuer den ganzen Besuch (Ansage
    // 10.10.). Eine Belohnung fuer alle, die das Kinderland abraeumen.
    const alleUm = this.schneemaenner.every((m) => m.kaputt)
    if (alleUm && !this._alleUm) this.gruppe.herbeirufen()
    this._alleUm = alleUm
    if (this._carouselStation) {
      this._carouselStation.hint = this.carousel.rider ? 'Loslassen' : 'Einsteigen'
    }
    for (const feder of this.federn) feder(dt, skier)

    // Die Gruppe haelt an, solange man mit dem Skilehrer spricht, und die
    // Station laeuft mit ihm mit.
    const ls = this._lehrerStation
    this.gruppe.halten = !!ls && this.registry.active === ls
    this.gruppe.update(dt, skier)
    if (ls) {
      const m = this.gruppe.lehrer.model.position
      ls.position.x = m.x
      ls.position.z = m.z
      ls.groundY = m.y
      ls.labelHeight = m.y + 2.4
      // In der Huette spricht keiner.
      ls.radius = !this.gruppe.sichtbar || !this.gruppe.lehrer.model.visible ? 0 : 2.6
    }

    const sx = skier.position.x
    const sz = skier.position.z
    const moving = skier.speed > 1.2 && !skier.tow

    // Die Kanone nimmt den Fahrer ins Visier, sobald er in ihr Feld faehrt,
    // und geht sonst aus. Wer in der Fahne steht, wird eingeschneit; der Wert
    // steigt, solange man drin bleibt, und taut danach von selbst wieder ab.
    // Am Seil des Zauberteppichs bleibt sie stumm, und sie springt auch nicht
    // bei jeder Vorbeifahrt an – siehe snow-cannon.js.
    this.cannon.userData.aimAt(sx, sz, !skier.tow)
    const hit = this.cannon.userData.inPlume(sx, sz)
    if (hit > 0) skier.dustWithSnow(Math.min(1, skier.snowed + hit * dt * 2.2))

    for (const r of this.reactors) {
      r.cool = Math.max(0, r.cool - dt)
      const dx = sx - r.x
      const dz = sz - r.z
      const d2 = dx * dx + dz * dz
      if (d2 > r.r * r.r) continue

      if (r.kind === 'snowman') {
        if (r.schneemann.kaputt) continue
        // Der Schneemann schaut immer her, sobald jemand in der Naehe ist –
        // dafuer braucht es keine Ausloesesperre, nur einen Peilwinkel.
        let bearing = Math.atan2(dx, dz) - r.obj.rotation.y
        bearing = Math.atan2(Math.sin(bearing), Math.cos(bearing))
        const near = 1 - Math.sqrt(d2) / r.r
        r.obj.userData.react(near, bearing)
        continue
      }

      if (r.cool > 0 || !moving) continue
      r.cool = 1.2
      const strength = THREE.MathUtils.clamp(skier.speed / 12, 0.3, 1.2)
      r.obj.userData.react(strength, skier.heading)
    }
  }

  // Nach skier.update(): das Trampolin faengt im selben Bild, in dem man
  // das Tuch erreicht, und Slalom und Bremsfeld lesen die neue Lage.
  pruefen(skier) {
    for (const tr of this.trampoline) if (tr.pruefen(skier)) break
    this._slalomPruefen(skier)
    this._bremsfeldPruefen(skier)
  }

  // Wer die Tierstangen von oben nach unten nimmt, wird gezaehlt: richtig
  // ist eine Stange, wenn man aussen an ihr vorbeikommt, auf der Seite weg
  // von der Mittellinie. Gemeldet wird an der letzten, wie eine Figur im
  // Park.
  _slalomPruefen(skier) {
    const { s, off } = this.lage(skier.position.x, skier.position.z)
    const vorher = this._slalomVorher
    this._slalomVorher = { s, off }
    if (skier.tow || !vorher) { this._slalomLauf = null; return }
    if (off < -3.5 || off > 7) { this._slalomLauf = null; return }
    const lauf = this._slalomLauf
    const i = lauf ? lauf.naechste : 0
    const g = this.slalom[i]
    if (!(vorher.s > g.s && s <= g.s)) {
      // Wer wieder hinauffaehrt oder unten vorbei ist, faengt neu an.
      if (lauf && s > this.slalom[0].s + 1) this._slalomLauf = null
      return
    }
    if (!lauf) this._slalomLauf = { naechste: 0, richtig: 0 }
    const l = this._slalomLauf
    if ((off - g.off) * Math.sign(g.off - SLALOM_MITTE) > 0) l.richtig++
    l.naechste++
    if (l.naechste < this.slalom.length) return
    const n = this.slalom.length
    skier.trick = l.richtig === n
      ? { text: `ALLE ${n} TIERE`, tone: 'good' }
      : { text: `${l.richtig} VON ${n} TIEREN`, tone: l.richtig >= n - 2 ? 'meh' : 'bad' }
    this._slalomLauf = null
  }

  // Das Bremsfeld schaut nur zu, wer den Bremshang herunterkommt: scharf
  // im unteren Teil mit Tempo und bergab gerichtet (aus dem Funpark quert
  // man den Auslauf), gemessen, sobald man steht. s waechst bergab.
  _bremsfeldPruefen(skier) {
    const { s, off, ux, uz } = this.lage(skier.position.x, skier.position.z, BREMS_LANE, true)
    const quer = off > BREMS_VON - 2 && off < BREMS_BIS + 2
    if (skier.tow || !quer || s < 4 || s > BREMS_S + 6) { this._bremsen = null; return }
    if (!this._bremsen) {
      const bergab = skier._fahrt.x * ux + skier._fahrt.z * uz > 0.6
      if (s > 6 && s < BREMS_S - 1 && skier.speed > 3 && !skier.airborne && bergab) this._bremsen = { scharf: true }
      return
    }
    if (skier.speed > 0.2 || skier.airborne) return
    this._bremsen = null
    const vor = BREMS_S - (s + SKISPITZE)
    const cm = Math.round(Math.abs(vor) * 100)
    if (Math.abs(vor) < 0.12) skier.trick = { text: 'PUNKTLANDUNG', tone: 'good' }
    else if (vor > 0) skier.trick = { text: `${cm} CM VOR DER LINIE`, tone: vor < 1 ? 'good' : 'meh' }
    else skier.trick = { text: `${cm} CM DRÜBER`, tone: 'bad' }
  }

  animate(t, dt) {
    for (const fn of this.animated) fn(t, dt)
  }
}
