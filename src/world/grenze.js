// Die Grenzen des Tals an einer Stelle. Reine Daten und Geometrie, ohne
// three.js: die Tests messen damit nach, und populate.js baut daraus Zaun,
// Netz und Kette.
//
// Bis zum 08.10. war die Welt nur durch den weichen Rueckschub neun Meter
// hinter dem Rand der Spielflaeche begrenzt (skier.js). Der Wald davor sieht
// geschlossen aus, ist es aber nicht: Baeume stehen mindestens 3,4 m
// auseinander, ihre Kreise lassen gut zwei Meter frei, der Fahrer braucht
// 1,1. Gemessen mit einer Flutfuellung vom Startplatz (tests/grenze.test.js):
// rundum war der ganze Waldguertel befahrbar, und an der Nordseite fiel man
// hinter der Kante bis zu zwanzig Meter hinunter.

// --- Suedzaun ------------------------------------------------------------
// Der alte Weidezaun im Osten, verlaengert: vom Seeufer bis auf die Hoehe
// des Funparks. Er laeuft auf der Kontur fuenf Meter innerhalb des Randes der
// Spielflaeche (playAreaDistance = -5) – derselben Linie, auf der der alte
// Zaun schon stand, also im dichten Teil des Waldes, wo er von der Kamera
// aus zwischen den Kronen verschwindet. Zu Pisten und Wegen sind es
// mindestens elf Meter (am See, zur Verbindung bei (-21, 45)); nur der
// Stichweg zur abgestuerzten Drohne endet 7,8 m davor – dort stand schon der
// alte Zaun.
//
// Westlich beginnt er am mittleren Pfosten des Absperrzauns am See, oestlich
// knickt er an der Taille zwischen Talkessel und Sportgelaende nicht mit
// ein (dort springt die Kontur um vier Meter nach innen) und biegt am Ende
// hinaus in den Gebirgsrand. Weiter noerdlich steigt die Flanke des
// Sportbergs von selbst; dort braucht es keinen Zaun (Ansage 08.10.).
export const SUEDZAUN = [
  { x: -32, z: 56 }, { x: -26.2, z: 55.6 }, { x: -20.9, z: 57.3 },
  { x: -15.8, z: 58.9 }, { x: -10.6, z: 60.1 }, { x: -5.3, z: 60.8 },
  { x: 0, z: 61 }, { x: 5.3, z: 60.8 }, { x: 10.6, z: 60.1 },
  { x: 15.8, z: 58.9 }, { x: 20.9, z: 57.3 }, { x: 25.8, z: 55.3 },
  { x: 30.5, z: 52.8 }, { x: 35.7, z: 49.6 }, { x: 41.2, z: 45.2 },
  { x: 46.4, z: 39.6 }, { x: 52.0, z: 31.0 }, { x: 57.0, z: 22.8 },
  { x: 59.6, z: 15.0 }, { x: 60.6, z: 6.5 }, { x: 60.9, z: -2.0 },
  { x: 60.2, z: -10.6 }, { x: 58.6, z: -18.5 }, { x: 57.0, z: -26.0 },
  { x: 56.4, z: -34.0 }, { x: 57.0, z: -42.0 }, { x: 60.5, z: -48.5 },
  { x: 66.5, z: -53.0 }, { x: 71.0, z: -54.0 },
]

// Der Absperrzaun am See. Er bleibt, wo er war, wird aber dicht wie der
// Suedzaun: sein mittlerer Pfosten ist dessen Anfang.
export const SEEZAUN = [{ x: -26, z: 47 }, { x: -32, z: 56 }, { x: -42, z: 60 }]

// Der Zaun endet am Ufer. Ueber das Eis kaeme man sonst ans Suedufer und
// von dort in den Waldstreifen hinter dem Zaun; die elf Meter vom letzten
// Pfosten bis an den weichen Rand schliesst eine kurze Kette (unten).
export const KETTE_SEE = [SEEZAUN.at(-1), { x: -41.0, z: 65.5 }, { x: -39.2, z: 70.6 }]

// --- Fangnetz an der Nordabfahrt -----------------------------------------
// Rechts oben an der Bahn bricht der Hang hinter drei Tannen ab: auf sechs
// Metern geht es sechs Meter hinunter, dann weiter bis an den Kartenrand.
// Dort steht das gelbe Netz (Skizze Julian, 08.10.), knapp zwei Meter vor
// der Kante und vor den drei Tannen, zwischen denen es gezeichnet war. Es
// ist das einzige – sparsam, wie gewuenscht; die uebrige Kante haelt die
// Kette unten.
export const NETZ = {
  pfosten: [{ x: -61.2, z: -100.0 }, { x: -48.8, z: -99.3 }, { x: -40.5, z: -100.4 }],
  // Ein Punkt auf der Bahn: auf dieser Seite ist "innen".
  innen: { x: -48, z: -88 },
  hoehe: 1.9,
}

// --- Kette aus Baeumen und Felsen ----------------------------------------
// Wo kein Zaun hingehoert, sind es Baeume und Felsen, die nicht mehr
// durchlassen (Ansage 08.10.). grenzeZiehen() in populate.js verbindet die
// Staemme und Felsen entlang dieser Leitlinien zu einer Kette, fuellt
// groessere Luecken mit Felsen und macht die Felsen darin unueberspringbar.
//
// Nordwest: vom obersten Pfosten der Lawinenverbauung an der Kante des
// Gipfelrueckens entlang bis zum Netz. Links davon faellt die Gipfelflanke
// um vierzehn bis zwanzig Meter zum Kartenrand.
export const KETTE_NORDWEST = [
  { x: -71.0, z: -70.4 }, { x: -70.6, z: -77.5 }, { x: -69.0, z: -85.0 },
  { x: -66.0, z: -92.0 }, { x: -63.0, z: -97.6 }, NETZ.pfosten[0],
]

// Nordost: vom Netz an der Kante entlang ueber die Muendung der Klamm (dort
// laeuft der Bach in den Kessel hinaus) bis an den weichen Rand, wo der
// Sportberg zu steigen beginnt. Oberhalb der Huette braucht es nichts mehr.
export const KETTE_NORDOST = [
  NETZ.pfosten[2], { x: -33.0, z: -100.6 }, { x: -25.0, z: -100.2 },
  { x: -17.5, z: -100.6 }, { x: -10.5, z: -99.6 }, { x: -3.5, z: -97.8 },
  { x: 2.5, z: -97.2 }, { x: 7.0, z: -99.5 },
]

// Kuerzester Abstand eines Punktes zu einem Linienzug, dazu die Bogenlaenge
// des Fusspunktes. Damit sortiert die Kette ihre Glieder entlang der Linie.
export function aufLinie(linie, x, z) {
  let best = Infinity, bestS = 0, s0 = 0
  for (let i = 0; i < linie.length - 1; i++) {
    const a = linie[i], b = linie[i + 1]
    const dx = b.x - a.x, dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (len * len)))
    const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t)
    if (d < best) { best = d; bestS = s0 + t * len }
    s0 += len
  }
  return { d: best, s: bestS }
}

// Punkte in festem Abstand entlang einer Strecke, ohne die Enden.
export function zwischen(a, b, schritt) {
  const len = Math.hypot(b.x - a.x, b.z - a.z)
  const n = Math.max(1, Math.round(len / schritt))
  const out = []
  for (let k = 1; k < n; k++) out.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n })
  return out
}
