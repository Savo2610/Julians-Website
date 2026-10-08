import { createRocks } from './props/rocks.js'
import { makeRng } from '../core/rng.js'
import { aufLinie, zwischen } from './grenze.js'

// Eine Grenze aus dem, was ohnehin dasteht: Staemme und Felsen entlang einer
// Leitlinie werden der Reihe nach verbunden, und zwischen zwei Gliedern
// stehen unsichtbare Kreise so dicht, dass der Fahrer nicht hindurchpasst.
// Man stoesst also immer zwischen zwei Baeumen oder Felsen an, nie mitten im
// freien Schnee – dort, wo die Luecke groesser ist als LUECKE, setzt die
// Kette einen Felsen hinein.
//
// Warum nicht einfach eine Mauer aus Kreisen entlang der Linie: die Linie
// laeuft dann an Baeumen vorbei statt durch sie hindurch, und wer an ihr
// entlangschrammt, spuert eine Wand, wo er Luecken sieht.

// Wie weit ein Stamm oder Fels neben der Leitlinie stehen darf, um Glied zu
// werden. Bei 2,5 m zackt die Kette hoechstens fuenf Meter quer.
const BREITE = 2.5
// Groesste freie Strecke zwischen zwei Gliedern, bevor ein Fels hineinkommt.
const LUECKE = 2.6
// Die unsichtbaren Kreise: 0,65 m Radius alle 0,8 m. Der Fahrer (0,55) kommt
// der Mittellinie damit nicht naeher als 1,14 m, und mehr als 1,08 m legt er
// in einem Bild nicht zurueck (26 m/s, dt hoechstens 1/24) – er kann nicht
// hindurchschluepfen.
const KREIS = 0.65
const SCHRITT = 0.8

export function grenzeZiehen(world, linie, { seed = 1, ohne = () => false } = {}) {
  const rng = makeRng(seed)
  const glieder = world.colliders
    .filter((c) => !c.data && !c.off && c.r >= 0.45 && !ohne(c.x, c.z))
    .map((c) => ({ c, ...aufLinie(linie, c.x, c.z) }))
    .filter((g) => g.d < BREITE)
    .sort((a, b) => a.s - b.s)

  // Anfang und Ende der Linie sind feste Glieder ohne Radius: dort setzt
  // die Kette an den Nachbarn an (Lawinenverbauung, Netzpfosten, Rand).
  const kette = [
    { x: linie[0].x, z: linie[0].z, r: 0 },
    ...glieder.map(({ c }) => ({ x: c.x, z: c.z, r: c.r, c })),
    { x: linie.at(-1).x, z: linie.at(-1).z, r: 0 },
  ]

  const felsen = []
  for (let i = 0; i < kette.length - 1; i++) {
    const a = kette[i], b = kette[i + 1]
    const frei = Math.hypot(b.x - a.x, b.z - a.z) - a.r - b.r
    if (frei <= LUECKE) continue
    // Felsen in die Luecke, gleichmaessig verteilt, etwas versetzt – sonst
    // stuende eine Perlenschnur im Wald.
    for (const p of zwischen(a, b, LUECKE + 0.4)) {
      felsen.push({
        x: p.x + (rng() - 0.5) * 0.8,
        z: p.z + (rng() - 0.5) * 0.8,
        variant: Math.floor(rng() * 3),
        rotation: rng() * Math.PI * 2,
        scale: 0.75 + rng() * 0.45,
        stretch: 0.9 + rng() * 0.4,
        tilt: rng() - 0.5,
      })
    }
  }
  if (felsen.length) {
    const vorher = world.colliders.length
    createRocks(world, felsen, seed + 17)
    // Was in die Kette gehoert, ist nicht zu ueberspringen.
    for (const c of world.colliders.slice(vorher)) c.h = Infinity
  }
  for (const { c } of glieder) c.h = Infinity

  for (let i = 0; i < kette.length - 1; i++) {
    const a = kette[i], b = kette[i + 1]
    for (const p of [a, ...zwischen(a, b, SCHRITT)]) world.addCollider(p.x, p.z, KREIS)
  }
  world.addCollider(kette.at(-1).x, kette.at(-1).z, KREIS)

  return { glieder: kette, felsen }
}
