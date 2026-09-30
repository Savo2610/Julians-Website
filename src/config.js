// Zentrale Stellschrauben. Wie im Skital: klein und dicht, ein Spielzeugsee
// und kein echtes Revier. 1 Einheit ~ 1 Meter, Wasserspiegel auf y = 0.

export const WORLD = {
  size: 380,          // Kantenlaenge des Gelaende-Meshes
  segments: 380,      // ein Meter je Masche reicht: Ufer und Insel sind weich
}

// Der See ist eine Superellipse: fast ein abgerundetes Rechteck, damit die
// Kabelbahn ueberall gleich weit vom Ufer laeuft. Bei einer echten Ellipse
// kamen die Ecken der Bahn dem Ufer auf 9 m nahe, mit n = 3.2 sind es 22.
export const LAKE = {
  x: 0,
  z: 0,
  rx: 102,
  rz: 84,
  power: 3.8,
  depth: 2.6,         // Tiefe in der Mitte des Beckens
}

// Die Insel liegt mittig. Ihr Ufer bleibt mindestens 26 m von der Bahn weg:
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
// aussen an den Ecken, der Umlaufsinn ist gegen den Uhrzeiger (von oben),
// wie an den meisten Anlagen.
export const CABLE = {
  halfX: 66,
  halfZ: 50,
  cornerRadius: 15,
  height: 9,          // Hoehe des Seils ueber dem Wasser
  speed: 12.5,        // m/s, rund 45 km/h
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
  maxSpeed: 21,
  gravity: 21,        // etwas mehr als echt: Spruenge sollen knackig sein
  popBase: 3.2,       // Absprung auf dem Wasser
  popCharge: 3.6,     // dazu, wenn voll aufgeladen
  chargeTime: 0.45,   // s bis zur vollen Ladung
  stepUpCrash: 0.35,  // hoeher darf eine Kante nicht sein, die man seitlich trifft
}

export const TRICK = {
  spinAccel: 34,
  spinMax: 10.5,      // rad/s: ein 360 braucht so gut 0,7 s Luft
  spinDecay: 9,      // ohne Taste steht die Drehung nach gut 0,1 s
  flipAccel: 26,
  flipMax: 8.2,
  flipDecay: 8,
  // Landefenster (rad Abweichung von einer vollen Drehung).
  perfect: 0.22,
  clean: 0.5,
  sketchy: 0.95,
  // Innerhalb dieses Fensters hilft das Spiel beim Aufsetzen nach. Ohne
  // Hilfe landete man einen 360 nur bei jedem dritten Versuch sauber.
  assist: 0.7,
  comboWindow: 3.5,   // s nach der Landung, in denen der naechste Trick zaehlt
}

// Die Kamera des Skitals: fest von schraeg oben, dreht sich nie. Nur Abstand
// und Bildwinkel atmen ein wenig mit dem Tempo, damit man die 45 km/h spuert.
export const CAMERA = {
  azimuth: Math.PI * 0.25,
  elevation: 0.63,
  distance: 34,
  fov: 38,
  fovSpeed: 5,        // zusaetzliche Grad bei Hoechsttempo
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
