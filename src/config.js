// Zentrale Stellschrauben der Welt. Klein und dicht halten – die Welt soll sich
// wie ein Spielzeugtal anfuehlen, nicht wie ein echtes Skigebiet.

export const WORLD = {
  size: 230,          // Kantenlaenge der Karte in Einheiten (1 Einheit ~ 1 Meter)
  segments: 448,      // Aufloesung des Terrain-Meshes
  // Die Spielflaeche ist keine Scheibe, sondern die Vereinigung zweier Kreise:
  // der urspruengliche Talkessel und ein Bergarm im Nordwesten. So waechst die
  // Welt, ohne dass in der Mitte Leere entsteht.
  basins: [
    { x: 0, z: 0, radius: 66 },        // Talkessel mit Plateau und den drei Wegen
    { x: -58, z: -64, radius: 41 },    // Bergarm: lange Abfahrt, spaeter der Lift
  ],
  rimWidth: 17,       // wie breit der Gebirgsrand ansteigt
}

export const SKIER = {
  cruiseSpeed: 13,    // Grundtempo, konstant – keine Simulation
  boostSpeed: 18,     // bergab erreichbar
  carveSpeed: 6.5,    // mit Shift (kanten / bremsen)
  turnRate: 3.1,      // rad/s, wie schnell sich die Fahrtrichtung dreht
  turnRateSlow: 6.5,  // bei niedrigem Tempo darf fast auf der Stelle gedreht werden
  accel: 3.4,         // wie schnell man auf Tempo kommt
  steerLerp: 9,       // wie direkt die Lenkung anspricht
  brakeDrag: 4.5,     // wie hart S bremst
  coastDrag: 1.15,    // wie schnell man ohne Eingabe ausrollt
  slopeInfluence: 9,  // wie stark Gefaelle das Tempo moduliert
  minClimbSpeed: 2.4, // Kriechtempo bergauf, damit man nie festsitzt
  bodyRadius: 0.55,
  leanMax: 0.66,      // maximale Kurvenneigung in rad
  leanLerp: 6.5,
  pitchMax: 0.22,
  // Schwuenge: der Fahrer pendelt um seine Zielrichtung, statt stur geradeaus
  // zu fahren. Das macht aus der Spur eine Schlangenlinie und aus dem Fahren
  // ein Skigefuehl, ohne dass man dauernd lenken muss.
  swingAmplitude: 0.55,   // rad, Ausschlag zu jeder Seite
  swingWavelength: 18,    // Einheiten pro voller Schwungperiode
  swingMinSpeed: 3.5,
}

export const CAMERA = {
  // Fester Blickwinkel von schraeg oben. Die Kamera dreht sich nie mit dem
  // Fahrer – sie folgt ihm nur. Dadurch bleibt WASD dauerhaft auf dieselben
  // Himmelsrichtungen gemappt.
  azimuth: Math.PI * 0.25,
  elevation: 0.63,     // rad ueber dem Horizont, ~36 Grad
  distance: 33,        // weit heraus – aus dieser Hoehe liest sich das Tal am besten
  fov: 38,
  lookHeight: 0.6,
  lead: 5.5,           // wie weit die Kamera in Fahrtrichtung vorlaeuft
  zoomMin: 0.62,
  zoomMax: 1.32,
  posLerp: 4.0,
  aimLerp: 5.0,
}

export const TRAIL = {
  resolution: 2560,   // Spur-Textur ueber die ganze Karte
  depth: 0.34,        // wie tief die Rille ins Terrain gedrueckt wird
  rimHeight: 0.17,    // aufgeworfener Schneewall am Rand
  width: 0.62,        // halbe Spurbreite in Einheiten
  fade: 0.0,          // 0 = Spuren bleiben liegen
}

export const COLORS = {
  snowLit:    0xfdfcff,
  snowShade:  0x9fb4d8,
  snowDeep:   0x6f8ec4,
  sky:        0x86b9e8,
  skyHorizon: 0xf6e6d4,
  sun:        0xfff0da,
  ambient:    0x8fb0dc,
  fog:        0xd6e6f5,
  pine:       0x2c4a44,
  pineDark:   0x1d332f,
  rock:       0x5d6673,
  wood:       0x6b4a35,
}
