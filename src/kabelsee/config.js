// Zentrale Stellschrauben. Wie im Skital: klein und dicht, ein Spielzeugsee
// und kein echtes Revier. 1 Einheit ~ 1 Meter, Wasserspiegel auf y = 0.

export const WORLD = {
  size: 380,          // Kantenlaenge des Gelaende-Meshes
  segments: 380,      // ein Meter je Masche reicht: Ufer und Insel sind weich
}

// Der See ist eine Superellipse: fast ein abgerundetes Rechteck, damit die
// Kabelbahn ueberall gleich weit vom Ufer laeuft. Bei einer echten Ellipse
// kamen die Ecken der Bahn dem Ufer auf 9 m nahe; mit n = 3.8 und den
// Buchten bleiben ueberall mindestens 16 m (der Test prueft es).
export const LAKE = {
  x: 0,
  z: 0,
  rx: 102,
  rz: 84,
  power: 3.8,
  depth: 2.6,         // Tiefe in der Mitte des Beckens
}

// Die Insel liegt mittig. Ihr Ufer bleibt mindestens 24 m von der Bahn weg:
// so weit, wie der Fahrer am 17-m-Seil innen abkuerzen kann, plus Luft.
export const ISLAND = {
  x: 4,
  z: -2,
  rx: 32,
  rz: 20,
  power: 2.4,
  height: 6.5,
}

// Die Kabelbahn: ein abgerundetes Rechteck um die Insel. Die Masten stehen
// aussen an den Ecken, der Umlaufsinn ist gegen den Uhrzeiger (von oben,
// Norden oben), wie an den meisten Anlagen.
export const CABLE = {
  halfX: 66,
  halfZ: 50,
  cornerRadius: 15,
  height: 9,          // Hoehe des Seils ueber dem Wasser
  // m/s, 54 km/h (vorher 45). Ausgeschwungen kommt man damit auf gut 85
  // km/h. Die Abstaende der Kicker reichen weiter zum Aufladen: 0,45 s
  // sind bei diesem Tempo keine 7 m.
  speed: 15,
  carriers: 5,        // Mitnehmer auf dem Seil, einer davon zieht den Fahrer
  ropeLength: 17,     // waagerechte Seillaenge vom Mitnehmer bis zur Hantel
}

export const RIDER = {
  // Seilzug als steife Feder mit Daempfung. Mit k = 38 steht das Seil nach
  // einem Ruck in einer Viertelsekunde wieder; weicher (k = 12) fuehlte sich
  // an wie ein Gummiband und der Fahrer pendelte zwei Sekunden nach.
  ropeStiffness: 38,
  ropeDamping: 7,
  ropeSlackLimit: 1.4, // weiter darf das Seil nie gedehnt sein
  // Kanten: wie weit die Ski gegen die Seilrichtung angestellt werden.
  edgeMax: 1.05,      // rad, gut 60 Grad
  steerLerp: 5.5,
  turnRate: 3.4,      // rad/s, schneller wechselt niemand die Kante
  // Quer zu den Ski bremst das Wasser hart, laengs kaum. Das ist der ganze
  // Trick hinter dem Ausschwingen: der Seilzug kommt schraeg, das Wasser
  // laesst nur die Laengsrichtung durch, und der Fahrer wird schneller als
  // der Mitnehmer.
  lateralGrip: 7.5,
  carveKeep: 0.55,     // Anteil des Querschwungs, der beim Kanten erhalten bleibt
  dragLinear: 0.12,
  dragQuad: 0.013,
  slackDrag: 0.5,     // zusaetzlich am schlaffen Seil
  brakeDrag: 1.8,     // S: zuruecklehnen
  pullAccel: 3.2,     // W: an der Hantel ziehen
  maxSpeed: 24,
  // Weniger als echt und weniger als vorher (21): aufgeladen fliegt man vom
  // Kicker jetzt gut 1,8 s statt 1,1 s und behaelt bei Cork und Doppelsalto
  // den Ueberblick. Damit die Spruenge dabei nicht in den Himmel gehen, ist
  // der Absprung etwas schwaecher; der hoechste Punkt liegt bei gut 6 m.
  gravity: 13,
  popBase: 2.6,       // Absprung auf dem Wasser
  popCharge: 3,       // dazu, wenn voll aufgeladen
  chargeTime: 0.45,   // s bis zur vollen Ladung
  stepUpCrash: 0.35,  // hoeher darf eine Kante nicht sein, die man seitlich trifft
  // Schraeg gegen eine Rampe: bis zu diesem Winkel gegen ihre Laengsrichtung
  // gleitet man an der Seite ab, statt zu stuerzen. Auf Box und Rail springt
  // man bis zu diesem Winkel von der Seite auf.
  glanceAngle: 0.7,   // rad, 40 Grad
  mountAngle: 0.87,   // rad, 50 Grad
  // Rueckwaerts (nach einem 180) geht alles etwas zaeher: weniger Kante,
  // langsamer lenken, kein Ziehen an der Hantel.
  fakieEdge: 0.7,
  fakieSteer: 0.7,
  // Auf Box und Rail: die Kante haelt den Fahrer in der Spur, mit A/D dreht
  // er sich darauf (langsamer als in der Luft). Ohne Taste rastet er in der
  // naechsten Viertelstellung ein: laengs, quer oder rueckwaerts.
  slideCenter: 5,
  slideDrag: 0.08,
  slideSpinAccel: 26,
  slideSpinMax: 8,    // rad/s: ein 360 braucht knapp 1 s, die Box ist 0,8 s lang
}

export const TRICK = {
  spinAccel: 28,
  spinMax: 8.6,       // rad/s: ein 360 braucht so gut 0,85 s Luft
  spinDecay: 9,       // ohne Taste steht die Drehung nach gut 0,1 s
  flipAccel: 22,
  flipMax: 7,
  flipDecay: 8,
  // Landefenster in rad Abweichung. Beim Drehen zaehlt die naechste halbe
  // Umdrehung (ein 180 landet rueckwaerts), beim Salto die naechste ganze.
  // Gestuerzt wird erst jenseits von knapp 70 Grad: wirklich quer oder
  // wirklich schraeg.
  spinLand: { perfect: 0.3, clean: 0.6, sketchy: 1.2 },
  flipLand: { perfect: 0.3, clean: 0.65, sketchy: 1.2 },
  // Ohne Taste dreht das Spiel den Fahrer in der Luft auf die naechste
  // Landestellung zurueck: sacht im Steigen, entschieden kurz vor dem Wasser.
  assistRise: 3.5,
  assistLand: 9,
  comboWindow: 3.5,   // s nach der Landung, in denen der naechste Trick zaehlt
}

// Die Kamera des Skitals: fest von schraeg oben, dreht sich nie. Nur Abstand
// und Bildwinkel atmen ein wenig mit dem Tempo, damit man die 54 km/h spuert.
export const CAMERA = {
  azimuth: Math.PI * 0.25,
  elevation: 0.63,
  distance: 34,
  fov: 38,
  fovSpeed: 7,        // zusaetzliche Grad bei Hoechsttempo
  distSpeed: 4,       // zusaetzlicher Abstand bei Hoechsttempo
  lookHeight: 0.8,
  lead: 7,
  zoomMin: 0.62,
  zoomMax: 1.4,
  aimLerp: 5.5,
}

export const COLORS = {
  sky: 0x86b9e8,
  skyHorizon: 0xf6e6d4,
  sun: 0xffe4bd,
  ambient: 0x8fb0dc,
  fog: 0xd9e8f2,
  grass: 0x93bb68,
  grassDark: 0x6f9a52,
  meadow: 0xb7c97c,
  sand: 0xead7a9,
  sandWet: 0xc9b58a,
  path: 0xd3bd92,
  rock: 0x8d8f93,
  pine: 0x2c4a44,
  pineDark: 0x1d332f,
  leaf: 0x7ea356,
  leafDark: 0x5f8a45,
  leafGold: 0xd9a441,
  wood: 0x6b4a35,
  woodLight: 0xa9794f,
  waterDeep: 0x1f6f86,
  waterShallow: 0x5fc0c0,
  foam: 0xf4fbff,
}

// Die Murmeltierkolonie am Nordwestufer (world/murmeltiere.js): Richtung
// vom Seemittelpunkt und Meter landeinwaerts. Dort kommt die Kabelbahn dem
// Ufer am naechsten (36 m bis zur Seilmitte, gemessen alle 0,1 rad); am
// Suedwestufer (2,35) waren es 48, da haette sie kaum je einer verscheucht.
// Mit 5 m Inland sassen sie noch im Ufersand.
export const MURMEL = { winkel: -2.35, inland: 9 }
