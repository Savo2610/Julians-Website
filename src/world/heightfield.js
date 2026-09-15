import { WORLD } from '../config.js'
import { fbm } from '../core/noise.js'

// Die Hoehenfunktion existiert nur einmal und wird sowohl fuer das Mesh als
// auch fuer jede Bodenabfrage (Spieler, Objekte, Kollision) benutzt. Damit
// koennen Geometrie und Kollision nie auseinanderlaufen.

// --- Gezielte Landschaftselemente -------------------------------------------
// Handgesetzt statt zufaellig, damit das Tal eine Form hat, die man wiedererkennt.

const smooth = (t) => t * t * (3 - 2 * t)

function bump(x, z, cx, cz, radius, amp) {
  const dx = (x - cx) / radius
  const dz = (z - cz) / radius
  const d2 = dx * dx + dz * dz
  if (d2 >= 1) return 0
  const f = 1 - d2
  return amp * f * f
}

// Derselbe Buckel, aber entlang einer Linie statt um einen Punkt: der Abstand
// zaehlt zum naechsten Punkt der Polylinie. Damit laesst sich ein gekruemmter
// Ruecken in einem Stueck schreiben. Aus einer Kette einzelner Buckel wuerde
// dasselbe nur mit Diele dazwischen – an jeder Naht zwischen zwei Buckeln
// faellt der Kamm ein, und aus einem Grat wird eine Perlenschnur.
//
// Jeder Stuetzpunkt bringt seine eigene Hoehe mit: [x, z, amp]. Ein Ruecken,
// der ueberall gleich hoch ist, waere eine Mauer – dieser darf anschwellen und
// wieder auslaufen. Zwischen zwei Punkten wird die Hoehe linear entlang des
// Abschnitts gemischt, nicht ueber den Punktindex: sonst haengt das Ergebnis
// davon ab, wie eng man die Stuetzpunkte setzt.
function ridgeAlong(x, z, pts, radius) {
  let bestD2 = Infinity
  let bestAmp = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const ax = b[0] - a[0]
    const az = b[1] - a[1]
    const len2 = ax * ax + az * az
    let t = ((x - a[0]) * ax + (z - a[1]) * az) / len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const dx = x - (a[0] + ax * t)
    const dz = z - (a[1] + az * t)
    const d2 = dx * dx + dz * dz
    if (d2 < bestD2) {
      bestD2 = d2
      bestAmp = a[2] + (b[2] - a[2]) * t
    }
  }
  const d2 = bestD2 / (radius * radius)
  if (d2 >= 1) return 0
  const f = 1 - d2
  return bestAmp * f * f
}

// Weiche Senke mit flachem Boden – fuer den zugefrorenen See.
function basin(x, z, cx, cz, radius, depth, flat) {
  const dx = (x - cx) / radius
  const dz = (z - cz) / radius
  const d = Math.sqrt(dx * dx + dz * dz)
  if (d >= 1) return 0
  const edge = smooth(Math.min(1, Math.max(0, (1 - d) / (1 - flat))))
  return -depth * edge
}

export const LAKE = { x: -47, z: 41, radius: 17, level: -1.2 }

// Der Startplatz ist ein echtes Plateau: flach genug zum Abstecken, leicht
// erhoeht, damit man von dort in die drei Taeler blickt.
export const PLATEAU = { x: 0, z: 30, radius: 11, height: 2.4 }

// Der Gipfel des Bergarms. Von hier fuehrt die laengste Abfahrt zurueck ins
// Tal; hier endet spaeter auch der Lift.
export const SUMMIT = { x: -58, z: -64, height: 30 }

// Das Sportgelaende im Nordosten. Sein Scheitel liegt bewusst ausserhalb der
// Spielflaeche: im Spiel liegt damit nur die Flanke, und die faellt
// gleichmaessig zum Talkessel hin ab – ein Hang ohne Kuppe, auf dem sich
// Rennstrecke und Funpark unterbringen lassen.
// Der Scheitel liegt weit ausserhalb der Karte, der Radius ist gross: so
// beginnt die Flanke schon frueh im Tal und laeuft ueber eine lange Strecke
// aus, statt als Kegel am Kartenrand zu kleben.
export const SPORT_HILL = { x: 27, z: -87, radius: 68, height: 19 }

// --- Die Rueckseite des Berges -----------------------------------------------
// Hinter dem Gipfel hoerte der Berg bisher einfach auf: das Gelaende fiel in
// dreissig Metern um vierzehn ab, und danach kam der Gebirgsrand. Jetzt zieht
// sich der Berg als breite Schulter nach Norden und dreht in einem grossen
// Bogen nach Osten ab, bis er ueber dem Funpark endet.
//
// Drei Teile, und jeder hat eine Aufgabe:
//
// SCHULTER traegt die Abfahrt. Sie liegt als Ruecken unter der Piste und faellt
// ueber ihre Laenge von neun auf fuenf Meter Aufbau – dadurch bekommt die Bahn
// ihr Gefaelle vom Gelaende und muss es nicht selbst schneiden.
//
// GRAT schliesst das Kar nach aussen. Er laeuft acht bis zwoelf Meter noerdlich
// der Piste und geht dort in den Gebirgsrand ueber. Ohne ihn liefe der Blick
// aus der Kurve heraus ins Leere: die Karte ist hier nur 34 Meter breit, und
// eine Piste am offenen Kartenrand sieht aus wie ein Brett im Nichts.
//
// KAR ist die Mulde *innerhalb* des Bogens. Sie ist der Grund, warum die
// Schulter als Schulter gelesen wird und nicht als Hochflaeche – ohne sie waere
// die ganze Rueckseite eine schiefe Ebene.
//
// Die Zahlen der Schulter sind nicht gegriffen, sondern die gemessene Luecke:
// der gewachsene Boden faellt hinter dem Gipfel von 26 auf 8 Meter und bleibt
// dann flach, der Funpark-Einstieg liegt aber bei 11,2. Eine Abfahrt, die
// unterwegs unter ihr eigenes Ziel faellt, gibt es nicht. Genau diese Differenz
// – hoechstens sechseinhalb Meter, an beiden Enden null – schuettet die
// Schulter auf. Mehr waere ein Damm quer durchs Kar gewesen; ein erster
// Entwurf mit vierzehn Metern war genau das.
const SCHULTER = [
  [-58, -72, 0.0], [-57, -81, 0.6], [-51, -87, 3.3], [-42, -88, 5.4],
  [-32, -85, 7.9], [-22, -80, 8.4], [-12, -76, 5.2], [-2, -71, 0.7], [6, -65, 0.0],
]
// Der Grat laeuft zwoelf bis sechzehn Meter ausserhalb der Piste und geht dort
// in den Gebirgsrand ueber. Er stand zuerst naeher und schmaler – dann schob er
// die ersten zwanzig Meter der Abfahrt um drei Meter hoch, und aus dem
// Einstieg wurde eine Ebene mit nicht einmal vier Grad.
const GRAT = [
  [-71, -76, 0.0], [-70, -88, 3.5], [-61, -98, 6.5], [-47, -101, 7.5],
  [-33, -99, 7.0], [-21, -93, 6.0], [-10, -87, 4.5], [0, -80, 2.0], [8, -73, 0.0],
]
const KAR = { x: -32, z: -70, radius: 19, depth: 4.2 }

// --- Pistenbaender ----------------------------------------------------------
// Ein Band zieht das Gelaende entlang einer Linie auf ein gleichmaessiges
// Gefaelle. In der Mitte wirkt es voll, zu den Seiten und an beiden Enden
// laeuft es weich aus – so entsteht eine fahrbare Bahn, ohne dass eine Kante
// in den Hang geschnitten wird.
//
// Die Hoehen der Stuetzpunkte sind feste Zahlen und keine Abfragen: die
// Hoehenfunktion darf sich nicht selbst aufrufen. Anfangs- und Endhoehe sind
// dem natuerlichen Gelaende abgemessen, dazwischen liegen sie auf einer
// Geraden. Dadurch trifft das Band an seinen Enden das Gelaende von selbst
// und muss dort nichts mehr ausgleichen.
function makeLane(points, { width, feather, endFade, bank = 0, flat = 0.55 }) {
  const segments = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    segments.push({ x: a.x, z: a.z, dx, dz, len2: dx * dx + dz * dz, h0: a.h, h1: b.h, s0: total, len })
    total += len
  }
  const reach = width * 0.5 + feather
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z)
  }
  return {
    points, segments, total, width, feather, endFade, reach, bank,
    flatHalf: width * 0.5 * flat,
    minX: minX - reach, maxX: maxX + reach, minZ: minZ - reach, maxZ: maxZ + reach,
  }
}

// Wieviel das Band an dieser Stelle zieht (0 = gar nicht) und auf welche
// Hoehe. Getrennt zurueckgegeben, damit die Hoehenfunktion das feine
// Schneerauschen behalten kann – eine glattgezogene Piste soll trotzdem
// Textur haben.
function laneAt(x, z, lane) {
  if (x < lane.minX || x > lane.maxX || z < lane.minZ || z > lane.maxZ) return null
  // Nicht den naechsten Abschnitt gewinnen lassen, sondern alle gewichtet
  // mitteln. An einem Knick treffen zwei Abschnitte mit verschiedenen
  // Zielhoehen aufeinander; wer nur den naechsten nimmt, bekommt genau auf
  // der Winkelhalbierenden eine Stufe ins Gelaende geschnitten. Das Gewicht
  // faellt mit der vierten Potenz, damit entfernte Abschnitte nichts ziehen.
  let bestD = Infinity
  let sumW = 0
  let sumT = 0
  let sumS = 0
  for (const g of lane.segments) {
    let t = ((x - g.x) * g.dx + (z - g.z) * g.dz) / g.len2
    t = t < 0 ? 0 : t > 1 ? 1 : t
    const px = g.x + g.dx * t
    const pz = g.z + g.dz * t
    const d2 = (x - px) * (x - px) + (z - pz) * (z - pz)
    const d = Math.sqrt(d2)
    if (d < bestD) bestD = d
    const w = 1 / (d2 * d2 + 0.05)
    sumW += w
    sumT += w * (g.h0 + (g.h1 - g.h0) * t)
    sumS += w * (g.s0 + g.len * t)
  }
  const target = sumT / sumW
  const s = sumS / sumW
  if (bestD > lane.reach) return null
  const half = lane.width * 0.5
  // Bande: zur Mitte hin flach, nach aussen ansteigend. Sie macht aus der
  // Bahn eine Rinne, in der man die Kurve halten kann, statt oben hinaus zu
  // schiessen. Quadratisch, damit der Uebergang von Sohle zu Wand weich ist.
  // Wie hoch sie tatsaechlich wird, entscheidet erst die Hoehenfunktion:
  // aufgeschuettet wird nur, wo das Gelaende unter der Bahn liegt.
  let bank = 0
  if (lane.bank > 0 && bestD > lane.flatHalf) {
    const t = Math.min(1, (bestD - lane.flatHalf) / (half - lane.flatHalf))
    bank = lane.bank * t * t
  }
  const side = bestD <= half ? 1 : smooth((lane.reach - bestD) / lane.feather)
  const ends = smooth(Math.min(1, Math.min(s, lane.total - s) / lane.endFade))
  const weight = side * ends
  return weight <= 0.001 ? null : { weight, base: target, bank }
}

// Die Rodelbahn vom Gipfel nach Osten. Sie faengt dort an, wo der Lift den
// Fahrer absetzt – man steigt aus und ist im Start – holt dann nach Osten in
// den Wald aus und kommt in einer Schleife bis kurz vor den umgestuerzten
// Stamm im Tal. Zwischen ihr und der Lifttrasse bleibt die freie Abfahrt.
//
// Die Bahn ist bewusst kurvig gelegt und nicht die kuerzeste Linie: gerade
// nach unten ist die Falllinie, aber kein Vergnuegen. Ueber ihre Laenge
// dreht sie sich in Summe um gut 220 Grad.
//
// Sie endet dort, wo der Hang endet, und laeuft nicht mehr zwanzig Meter
// flach ins Tal aus. Das hat zwei Gruende: flaches Ausrollen ist keine
// Fahrt mehr, und die Querachse des Ziels zeigt hier ueber den Bildschirm
// statt in die Blickachse. Bei fester Kamera ist ein Bogen, dessen Achse in
// die Blickrichtung zeigt, nur ein senkrechter Strich.
//
// Die Hoehen sind nicht auf ein gleichmaessiges Gefaelle gerechnet, sondern
// ein geglaettetes, streng fallendes Abbild des natuerlichen Gelaendes: der
// Berg gibt sein Gefaelle nun einmal oben her und laeuft unten flach aus. So
// bleibt der groesste Auf- oder Abtrag unter anderthalb Metern – haette man
// eine Gerade erzwungen, waere unten ein fuenf Meter hoher Damm noetig
// gewesen. Oben 19 bis 31 Grad, unten Auslauf.
export const SLED_LANE = makeLane([
  { x: -53, z: -56, h: 27.50 },
  { x: -45, z: -61, h: 24.90 },
  { x: -36, z: -60, h: 20.23 },
  { x: -29, z: -54, h: 15.50 },
  { x: -26, z: -45, h: 10.79 },
  { x: -18, z: -41, h: 5.24 },
  { x: -11, z: -36, h: 2.34 },
  { x: -6, z: -30, h: 1.90 },
  { x: -2, z: -25, h: 1.55 },
], { width: 13, feather: 9, endFade: 8, bank: 1.35, flat: 0.5 })

// Die Nordabfahrt ueber die Rueckseite. Sie beginnt hinter dem Gipfel, faellt
// nach Norden ab und dreht dann in einem langen Rechtsbogen ueber das Kar nach
// Osten, bis sie oben am Funpark ankommt. Von dort faehrt man weiter in den
// Park und ins Tal – die Runde schliesst sich also: Lift, Rueckseite, Funpark.
//
// Achtzig Meter, knapp dreizehn Meter Fall, im Mittel 9,1 Grad. Das Profil ist
// bewusst ungleich: oben 13 bis 15 Grad als Einfahrt hinter dem Gipfel, danach
// sieben bis zehn Grad ueber den ganzen Bogen, zuletzt eine flache Schulter vor
// dem Funpark. Gleichmaessige neun Grad ueber achtzig Meter waeren eine Rampe
// und keine Abfahrt.
//
// Die Hoehen sind – wie bei der Rodelbahn – ein geglaettetes, streng fallendes
// Abbild des gewachsenen Bodens, nicht eine gerechnete Gerade. Weil die
// Schulter vorher schon fast genau unter der Bahn liegt, bleibt der groesste
// Auftrag bei 0,50 und der groesste Abtrag bei 1,15 Metern. Wer die Zahlen
// aendert, muss beides nachmessen: sobald daraus Meter werden, steht hier ein
// Damm im Kar.
export const NORTH_LANE = makeLane([
  { x: -58, z: -72, h: 25.17 },
  { x: -57, z: -81, h: 23.05 },
  { x: -51, z: -87, h: 20.78 },
  { x: -42, z: -88, h: 19.15 },
  { x: -32, z: -85, h: 17.71 },
  { x: -22, z: -80, h: 16.21 },
  { x: -12, z: -76, h: 14.48 },
  { x: -2, z: -71, h: 13.06 },
  { x: 6, z: -65, h: 12.32 },
], { width: 14, feather: 9, endFade: 7, bank: 1.2, flat: 0.5 })

// Der Funpark – 8 bis 12 Grad. Flach genug, dass man die Figuren trifft statt
// sie zu ueberfahren, steil genug, dass man ohne Nachdruecken durchkommt.
//
// Er liegt jetzt in der Luecke zwischen Rodelbahn und Kinderland und laeuft
// nach Norden ins Tal aus, statt quer im Suedosten zu haengen. Das ist eine
// Frage der Erreichbarkeit: vorher endete er dort, wo sonst nichts ist, jetzt
// laeuft er genau zwischen den beiden Anlagen hindurch, an denen man ohnehin
// vorbeikommt. Das Gefaelle liefert nach wie vor die Flanke des Sportbergs im
// Sueden – deshalb liegt der Einstieg oben im Sueden und nicht im Tal.
// Ganz oben liegt eine Terrasse: sechs Meter mit knapp sieben Grad, bevor es
// mit gut zwanzig Grad in den Park hineingeht. Sie liegt genau auf der Achse
// des Bandes, damit kein Knick entsteht, und ihre Hoehen folgen dem
// gewachsenen Boden auf einen halben Meter genau – ein Plateau, das man
// aufschuetten muesste, waere hier eine Rampe im Nichts.
//
// endFade ist von acht auf vier Meter herunter: bei acht waere die Terrasse
// zur Haelfte wieder ausgeblendet und damit keine.
//
// Unten haengt ein Auslauf dran, der nach Westen in die Talsohle dreht. Er
// traegt nichts mehr – er ist nur der Platz, den die zweite Schanze zum
// Landen braucht. Nach Osten ginge es nicht: dort steigt schon die Kuppe des
// Kinderlands an, und ein Landehang, der bergauf laeuft, ist eine Wand.
export const PARK_LANE = makeLane([
  { x: 10.0, z: -60.4, h: 11.20 },
  { x: 13.0, z: -55.2, h: 10.50 },
  { x: 16.0, z: -50.0, h: 8.13 },
  { x: 20, z: -43, h: 6.90 },
  { x: 24, z: -36, h: 5.20 },
  { x: 27, z: -29, h: 3.55 },
  { x: 29.5, z: -22, h: 2.10 },
  { x: 30.5, z: -18, h: 1.55 },
  { x: 28.8, z: -13.8, h: 1.20 },
], { width: 16, feather: 7, endFade: 4 })

// Der Uebungshang des Kinderlands: vom Muldenrand bei der Huette hinauf auf
// die Kuppe im Osten. Ein einziges Band traegt beides – den Zauberteppich an
// seinem Westrand und die Uebungsstrecke daneben. Genau so ist ein echtes
// Kinderland gebaut, und es spart die zweite Trasse.
//
// Das Gelaende darunter ist eine Kuppe, also in der Mitte steiler als an den
// Enden. Ein Band mit streng gleichem Gefaelle muesste unten anderthalb Meter
// auffuellen; diese Knoten folgen dem Berg ein Stueck weit und bleiben
// trotzdem zwischen 17 und 22 Grad – gleichmaessig genug fuer ein Foerderband.
export const KINDER_LANE = makeLane([
  { x: 31.0, z: 19.0, h: -1.20 },
  { x: 34.5, z: 13.5, h: 0.85 },
  { x: 38.0, z: 8.0, h: 3.25 },
  { x: 41.5, z: 2.5, h: 5.85 },
  { x: 45.0, z: -3.0, h: 8.14 },
], { width: 16, feather: 7, endFade: 6, flat: 0.6 })

// Die Schussstrecke westlich des Kinderlands. Sie hatte oben einen Knick:
// dort trifft sie auf den Auslauf des Funparks, und was zwei Baender an
// derselben Stelle verschieden hoch haben wollen, wird eine Stufe. Jetzt hat
// sie ihr eigenes Band mit gleichmaessigen 8,6 Grad – hauptsaechlich
// aufgeschuettet, stellenweise ein Vierteler abgetragen.
//
// Sie steht als letzte in der Reihe: die Baender werden nacheinander
// verrechnet, und wo zwei sich ueberlagern, gewinnt in der Mitte das spaetere.
// Genau das ist hier gewollt – die Strecke soll gerade sein, auch wo der
// Funpark daneben etwas anderes vorhat.
//
// Sie bleibt gerade und wird keine Halfpipe – das war einmal versucht und ist
// zweimal gescheitert. Fahrerisch: wer eine Wand anschneidet, bekommt Hoehe
// aus der Steigrate des Bodens, behaelt aber seine Fahrtrichtung. Die Wand
// gibt nicht zurueck, was sie nimmt, also wird man aus der Pipe geworfen
// statt in ihr gehalten. Baulich: die Bande reicht mit ihrem Federsaum ueber
// das Band hinaus, und dort drueben liegt der Zauberteppich.

// Die sichtbare Strecke – so weit reichen die Leuchtleisten.
export const SHOOT_RUN = { from: { x: 34.0, z: -9.9 }, to: { x: 20.0, z: 12.0 } }

// Das Band greift an beiden Enden zwei Meter darueber hinaus. Der endFade
// nimmt dem Band an seinen Enden die Wirkung, und faenge es genau an der
// Strecke an, laege der erste Meter wieder auf gewachsenem Grund.
export const SHOOT_LANE = makeLane([
  { x: 35.07, z: -11.59, h: 4.66 },
  { x: 18.93, z: 13.69, h: 0.10 },
], { width: 8, feather: 4, endFade: 1.5 })

// Die Reihenfolge entscheidet, wer sich an einer Ueberlagerung durchsetzt: das
// spaetere Band gewinnt auf seiner eigenen Mittellinie. NORTH_LANE steht vor
// PARK_LANE, weil beide sich oben am Funpark auf sieben Metern begegnen und
// dort der Funpark-Einstieg stimmen muss, nicht die Zufahrt.
const LANES = globalThis.__noLanes ? [] : [SLED_LANE, NORTH_LANE, PARK_LANE, KINDER_LANE, SHOOT_LANE]

// --- Figuren im Funpark ------------------------------------------------------
// Schanzen, Wellen und Kanten sind Gelaende und keine Aufbauten. Nur so faehrt
// man wirklich darueber: Boden, Kollision und Kamera lesen alle dieselbe
// Funktion. Ein Aufbau waere ein Objekt, durch das man hindurchfaehrt.
//
// Alle Figuren rechnen in einem lokalen System: u laeuft in Fahrtrichtung,
// v quer dazu.
function local(x, z, f) {
  const ax = x - f.x
  const az = z - f.z
  return { u: ax * f.dx + az * f.dz, v: -ax * f.dz + az * f.dx }
}

// Absprung mit Landehang.
//
// Frueher brach die Schanze hinter der Kante nach anderthalb Einheiten ab und
// ging gleich wieder in die Bahn ueber. Das hatte zwei Folgen: der Flug endete
// auf flachem Boden, und wer bergauf fuhr, traf hinten eine fast senkrechte
// Wand – bergauf gab es dadurch mehr Airtime als bergab, also genau
// verkehrt herum.
//
// Jetzt liegt hinter der Kante ein Landehang mit gleichmaessiger Neigung: von
// der Kante hinunter unter die Bahnsohle, dort ein gerundeter Knick, dann ein
// flacher Auslauf zurueck auf Bahnhoehe. Bergab verlaengert das den Flug und
// faengt ihn weich auf. Bergauf klettert man nur noch ueber gut dreissig Grad
// statt ueber eine Wand – und die Steigung vor der Kante entscheidet ueber
// den Absprung.
//
// Der Landehang ist bewusst gerade und nicht weich geschwungen. Eine weiche
// Kurve waere in der Mitte doppelt so steil wie im Mittel, und diese Mitte
// waere bergauf wieder eine Schanze.
function kicker(x, z, f) {
  const { u, v } = local(x, z, f)
  const hw = f.width * 0.5
  const av = Math.abs(v)
  const land = f.landing
  const dip = f.dip
  const knuckle = f.knuckle ?? 0.5   // wo im Landehang die Sohle liegt
  const flank = 3.0
  if (u > land || u < -f.length || av > hw + flank) return 0
  const side = av <= hw ? 1 : smooth((hw + flank - av) / flank)

  if (u <= 0) {
    // Kubisch statt quadratisch: der Fuss bleibt flach, die Steigung sammelt
    // sich an der Kante. Genau dort entscheidet sich der Absprung – bei einem
    // quadratischen Profil verteilt sie sich zu gleichmaessig und der Fahrer
    // rollt ueber die Kante, statt abzuheben.
    const a = Math.min(1, (u + f.length) / f.length)
    return f.height * a * a * a * side
  }

  const t = u / land
  // Beide Geraden ueber ihren Abschnitt hinaus verlaengert und dann ineinander
  // geblendet – das rundet den Knick an der Sohle, ohne die Neigung der
  // Flanken zu veraendern.
  const slope = f.height + (-dip - f.height) * (t / knuckle)
  const runout = -dip * (1 - (t - knuckle) / (1 - knuckle))
  const w = smooth(Math.min(1, Math.max(0, (t - knuckle) / 0.18 + 0.5)))
  return (slope * (1 - w) + runout * w) * side
}

// Wellenbahn: eine Reihe weicher Buckel, die an beiden Enden ausklingt.
function rollers(x, z, f) {
  const { u, v } = local(x, z, f)
  const half = (f.spacing * f.count) * 0.5
  const av = Math.abs(v)
  const hw = f.width * 0.5
  if (Math.abs(u) > half || av > hw + 2) return 0
  const side = av <= hw ? 1 : smooth((hw + 2 - av) / 2)
  const wave = Math.cos((u / f.spacing) * Math.PI * 2) * 0.5 + 0.5
  const fade = smooth(Math.min(1, (half - Math.abs(u)) / (f.spacing * 0.6)))
  return f.height * wave * side * fade
}

// Schneekante zum Aufsteigen: flaches Dach, an den Enden angerampt.
function ledge(x, z, f) {
  const { u, v } = local(x, z, f)
  const half = f.length * 0.5
  const hw = f.width * 0.5
  const av = Math.abs(v)
  if (Math.abs(u) > half || av > hw + 1.2) return 0
  const ends = smooth(Math.min(1, (half - Math.abs(u)) / f.ramp))
  const side = av <= hw ? 1 : smooth((hw + 1.2 - av) / 1.2)
  return f.height * ends * side
}

// Die Figuren liegen der Reihe nach im Band. Richtung ist jeweils die
// Fahrtrichtung des Bandes an der Stelle.
//
// Die Hoehe einer Schanze ist nicht ihr Absprungwinkel: das Band faellt
// darunter mit knapp 10 Grad weiter, das frisst einen Teil der Rampe. Was
// zaehlt, ist die Steigung an der Kante, und die ist beim kubischen Profil
// 3*Hoehe/Laenge minus dem Gefaelle des Bandes. Bei Tempo 13 sind das hier
// gut eine Sekunde Flugzeit und knapp drei Meter Scheitelhoehe.
//
// Der Platz ist knapp gerechnet. Jede Schanze braucht Rampe *und* Landehang –
// zusammen sechzehn bis achtzehn Einheiten – und der Landehang muss auch
// wirklich frei sein, sonst landet man auf der naechsten Figur. Deshalb liegt
// die zweite Schanze ganz unten und das Band hat einen Auslauf bekommen.
//
// Quer dazu ist der Park in drei Spuren geteilt: in der Mitte die
// Sprunglinie, links die beiden Boxen, rechts das lange Rail. Der seitliche
// Versatz von siebeneinhalb Einheiten ist kein Geschmack, sondern Rechnung:
// die Flanke einer Schanze reicht mit halber Breite plus drei Einheiten
// Auslauf bis 6,5 – wer naeher liegt, haengt schief in der Boeschung. Nach
// aussen begrenzt die flache Breite des Bandes.
export const PARK_FEATURES = [
  { kind: 'rollers', x: 18.97, z: -44.80, dx: 0.496, dz: 0.868, count: 3, spacing: 4.2, height: 0.7, width: 9 },
  { kind: 'kicker', x: 24.74, z: -34.28, dx: 0.394, dz: 0.919, length: 5.0, width: 7.0, height: 1.95, landing: 12.5, dip: 1.1 },
  { kind: 'box', x: 17.85, z: -31.33, dx: 0.394, dz: 0.919, length: 6.6, width: 1.5, height: 0.42, ramp: 1.2 },
  { kind: 'box', x: 20.36, z: -25.30, dx: 0.336, dz: 0.942, length: 8.2, width: 2.0, height: 0.60, ramp: 1.5 },
  { kind: 'ledge', x: 34.49, z: -30.34, dx: 0.336, dz: 0.942, length: 12, width: 2.6, height: 0.85, ramp: 2.2 },
  { kind: 'kicker', x: 29.70, z: -21.20, dx: 0.243, dz: 0.970, length: 5.5, width: 7.5, height: 2.85, landing: 12.5, dip: 1.3 },
]

// Ist der Punkt im Funpark? Gemessen wird am Band selbst, nicht an einem
// zusaetzlichen Rechteck – der Park ist genau das, was das Band abdeckt.
// Gebraucht wird das fuer die Tricks: sie sollen dort gehen, wo Figuren
// stehen, und nicht auf der Piste.
export function inFunpark(x, z) {
  return laneAt(x, z, PARK_LANE) !== null
}

// Steht der Fahrer gerade auf einer Box oder der Schneekante? Gebraucht wird
// das nur fuer die Rueckmeldung – ein Slide auf der Box heisst anders als
// einer im Schnee. Geprueft wird das Rechteck der Figur, nicht die Hoehe:
// wer knapp danebensteht, ist eben nicht drauf.
export function onParkRail(x, z) {
  for (const f of PARK_FEATURES) {
    if (f.kind !== 'box' && f.kind !== 'ledge') continue
    const { u, v } = local(x, z, f)
    if (Math.abs(u) < f.length * 0.5 - f.ramp * 0.5 && Math.abs(v) < f.width * 0.5 + 0.35) return true
  }
  return false
}

function parkFeatures(x, z) {
  let add = 0
  for (const f of PARK_FEATURES) {
    if (f.kind === 'kicker') add += kicker(x, z, f)
    else if (f.kind === 'rollers') add += rollers(x, z, f)
    // Kante und Box haben dieselbe Form – ein flaches Dach mit angerampten
    // Enden. Der Unterschied liegt allein darauf: auf der Kante liegt ein
    // Rohr, auf der Box eine Holzplatte.
    else add += ledge(x, z, f)
  }
  return add
}


// Signierter Abstand zum Rand der Spielflaeche: negativ innerhalb, positiv
// ausserhalb. Weil die Flaeche aus mehreren Kreisen besteht, gewinnt der
// naechstgelegene – so entsteht eine weiche Acht statt harter Kanten.
export function playAreaDistance(x, z) {
  let best = Infinity
  for (const b of WORLD.basins) {
    const d = Math.hypot(x - b.x, z - b.z) - b.radius
    if (d < best) best = d
  }
  return best
}

export function terrainHeight(x, z) {
  let h = 0

  // Grosse, traege Wellen – das Grundrelief des Tals.
  h += (fbm(x * 0.0125 + 40, z * 0.0125 + 40, 4) - 0.5) * 11.0
  // Feinere Buckel, damit die Fahrt nie ganz glatt wird.
  h += (fbm(x * 0.055 + 8, z * 0.055 + 8, 3) - 0.5) * 1.9
  // Sehr feines Rauschen fuer Schneeverwehungen.
  const grain = (fbm(x * 0.19, z * 0.19, 2) - 0.5) * 0.34
  h += grain

  // Der Bergarm im Nordwesten: ein breiter Kegel, der zum Gipfel ansteigt.
  // Er traegt die laengste Abfahrt der Karte.
  h += bump(x, z, SUMMIT.x, SUMMIT.z, 52, SUMMIT.height)
  // Zwei vorgelagerte Schultern, damit der Berg nicht wie ein Kegelhut wirkt.
  h += bump(x, z, -34, -44, 26, 7.5)
  h += bump(x, z, -74, -40, 24, 6.0)
  // Eine Mulde als natuerliche Leitlinie der Abfahrt.
  h += bump(x, z, -44, -34, 17, -3.2)

  // Die Rueckseite: Schulter, Grat und Kar. Sie stehen vor den Baendern, damit
  // die neue Abfahrt ihr Gefaelle vom Gelaende bekommt und das Band nur noch
  // glaettet.
  h += ridgeAlong(x, z, SCHULTER, 24)
  h += ridgeAlong(x, z, GRAT, 15)
  h += bump(x, z, KAR.x, KAR.z, KAR.radius, -KAR.depth)

  // Kuppe im Osten – dort steht das Fernrohr.
  h += bump(x, z, 48, -8, 27, 7.2)

  // Sportgelaende im Nordosten: die Flanke eines weit ausserhalb liegenden
  // Schildes. Dazu eine flache Mulde an der Taille zum Talkessel, damit der
  // Uebergang als Senke gelesen wird und nicht als Kante.
  h += bump(x, z, SPORT_HILL.x, SPORT_HILL.z, SPORT_HILL.radius, SPORT_HILL.height)
  h += bump(x, z, 26, -34, 20, -1.4)
  // Sanfter Ruecken, der den mittleren Weg gliedert.
  h += bump(x, z, 4, -10, 28, 3.2)
  // Mulde, in der die Huette steht.
  h += bump(x, z, 33, 17, 19, -2.6)

  // Zugefrorener See. Bewusst flach: man soll hineinfahren koennen, ohne in
  // ein Loch zu fallen.
  h += basin(x, z, LAKE.x, LAKE.z, LAKE.radius, 2.4, 0.5)

  // Renn- und Funparkband: ziehen ihren Streifen auf gleichmaessiges Gefaelle.
  // Das feine Rauschen kommt danach wieder drauf, damit die Bahn nicht wie
  // gebuegelt aussieht.
  for (const lane of LANES) {
    const hit = laneAt(x, z, lane)
    if (!hit) continue
    let target = hit.base
    if (hit.bank > 0) {
      // Auf der Bergseite ist der Anschnitt selbst schon die Wand. Eine Bande
      // davor ergaebe eine zweite Kante und dazwischen einen Graben – deshalb
      // waechst sie nur dort, wo das Gelaende unter der Bahnsohle liegt.
      const fill = Math.min(1, Math.max(0, (hit.base + hit.bank - h) / hit.bank))
      target += hit.bank * fill
    }
    h = h * (1 - hit.weight) + (target + grain) * hit.weight
  }

  // Die Figuren im Funpark sitzen auf dem geglaetteten Band – deshalb erst
  // hier, nach der Bandformung.
  h += parkFeatures(x, z)

  // Startplateau: eine flache Terrasse, die sich weich ins Gelaende einfuegt.
  {
    const dx = x - PLATEAU.x
    const dz = z - PLATEAU.z
    const d = Math.sqrt(dx * dx + dz * dz) / (PLATEAU.radius * 1.55)
    if (d < 1) {
      const blend = smooth(Math.min(1, Math.max(0, (1 - d) / 0.42)))
      // Auf das Zielniveau ueberblenden statt addieren – so wird es wirklich flach.
      h = h * (1 - blend) + PLATEAU.height * blend
    }
  }

  // Gebirgsrand: steigt an, sobald man die Spielflaeche verlaesst. Bewusst
  // niedrig – er soll die Karte schliessen, aber nicht den Himmel wegnehmen.
  const edge = playAreaDistance(x, z)
  if (edge > 0) {
    const t = Math.min(1, edge / WORLD.rimWidth)
    const ridge = 0.6 + 0.85 * fbm(x * 0.06, z * 0.06, 3)
    h += t * t * 17 * ridge
  }

  return h
}

export function terrainNormal(x, z, out) {
  const e = 0.45
  const hL = terrainHeight(x - e, z)
  const hR = terrainHeight(x + e, z)
  const hD = terrainHeight(x, z - e)
  const hU = terrainHeight(x, z + e)
  const nx = hL - hR
  const nz = hD - hU
  const ny = 2 * e
  const len = Math.hypot(nx, ny, nz)
  if (out) return out.set(nx / len, ny / len, nz / len)
  return { x: nx / len, y: ny / len, z: nz / len }
}

// Gefaelle in eine bestimmte Fahrtrichtung: positiv = es geht bergab.
export function slopeAlong(x, z, dirX, dirZ) {
  const step = 1.2
  const here = terrainHeight(x, z)
  const ahead = terrainHeight(x + dirX * step, z + dirZ * step)
  return (here - ahead) / step
}

// Sucht in der Umgebung die flachste Stelle. Gebaeude und Automaten sollen
// nicht am Hang kleben – statt Koordinaten von Hand zu justieren, laesst man
// jede Station selbst den besten Standplatz in ihrer Naehe finden.
export function findFlatSpot(x, z, search = 9, footprint = 2) {
  const relief = (px, pz) => {
    let min = Infinity
    let max = -Infinity
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2
      for (const r of [footprint * 0.5, footprint]) {
        const h = terrainHeight(px + Math.cos(angle) * r, pz + Math.sin(angle) * r)
        if (h < min) min = h
        if (h > max) max = h
      }
    }
    return max - min
  }

  let best = { x, z, relief: relief(x, z) }
  // Goldener-Winkel-Spirale: gleichmaessige Abdeckung ohne Raster-Artefakte.
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 1; i <= 160; i++) {
    const r = search * Math.sqrt(i / 160)
    const a = i * golden
    const px = x + Math.cos(a) * r
    const pz = z + Math.sin(a) * r
    const value = relief(px, pz)
    // Naeher am Wunschort ist besser – kleine Strafe fuer weite Wege.
    const penalty = (r / search) * 0.22
    if (value + penalty < best.relief) best = { x: px, z: pz, relief: value + penalty }
  }
  return best
}
