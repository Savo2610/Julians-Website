// Zentrale Stellschrauben der Welt. Klein und dicht halten – die Welt soll sich
// wie ein Spielzeugtal anfuehlen, nicht wie ein echtes Skigebiet.

export const WORLD = {
  size: 230,          // Kantenlaenge der Karte in Einheiten (1 Einheit ~ 1 Meter)
  segments: 448,      // Aufloesung des Terrain-Meshes
  // Die Spielflaeche ist keine Scheibe, sondern die Vereinigung mehrerer
  // Kreise. So waechst die Welt, ohne dass in der Mitte Leere entsteht: jeder
  // neue Kreis ueberlappt den vorigen so weit, dass eine Taille entsteht
  // statt einer Naht.
  basins: [
    { x: 0, z: 0, radius: 66 },        // Talkessel mit Plateau und den drei Wegen
    { x: -58, z: -64, radius: 41 },    // Bergarm im Nordwesten: lange Abfahrt und Lift
    { x: 29, z: -45, radius: 32 },     // Sportgelaende im Nordosten: der Funpark
    // Die Rueckseite des Berges. Sie schliesst die Luecke zwischen Bergarm und
    // Sportgelaende, durch die bisher der Gebirgsrand lief – dort liegt jetzt
    // das Nordkar mit der neuen Abfahrt. Der Kreis ist bewusst nur 34 gross:
    // sein Rand laeuft acht bis zwoelf Meter nordwestlich der Piste vorbei, und
    // genau dort steigt der Gebirgsrand als Wand auf. Ein groesserer Kreis
    // haette das Kar nach oben geoeffnet und die Karte nach Norden ausfransen
    // lassen – die Karte waechst nicht mit, ihre Kantenlaenge bleibt bei 230.
    { x: -26, z: -68, radius: 34 },
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
  airDrag: 0.16,      // Tempoverlust je Sekunde in der Luft
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

// Tricks liegen alle auf einer Taste – Leertaste, dieselbe, mit der man
// abspringt. Das ist Absicht: was die Taste tut, haengt davon ab, wo man
// gerade ist. Am Boden stellt sie die Ski quer, in der Luft dreht sie den
// Fahrer. Zwei Tasten fuer zwei Zustaende waeren eine Regel mehr zu merken,
// ohne dass man je beides gleichzeitig brauchte.
export const TRICK = {
  spinAccel: 30,      // rad/s^2, wie schnell die Drehung anlaeuft
  spinMax: 9.5,       // rad/s – reicht bei knapp einer Sekunde Flugzeit fuer 360
  spinDecay: 2.5,     // wie schnell die Drehung ohne Taste ausklingt
  slideAngle: 1.35,   // rad, wie weit die Ski beim Sliden querstehen
  slideLerp: 7,
  slideMinSpeed: 3.5,
  slideDrag: 1.6,     // zusaetzlicher Widerstand quer zur Fahrt
  // Ab dieser Drehung zaehlt ein Sprung als Trick. Etwas unter einer halben
  // Umdrehung, damit auch ein knapper 180er anerkannt wird.
  landedRotation: 2.7,
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

// Der Verfolgermodus – er gilt ausschliesslich auf der Nordabfahrt.
//
// Die feste Kamera ist sonst eine der Grundregeln dieser Welt, und das bleibt
// sie auch: sie ist der Grund, warum WASD ueberall dieselben Himmelsrichtungen
// bedeutet und warum jedes Schild der Kamera zugewandt steht. Die Rueckseite
// des Berges ist die eine Ausnahme, und sie funktioniert nur, weil die
// Steuerung sie nicht bemerkt – A und D drehen den Fahrer seit jeher aus
// *seiner* Sicht und nicht aus der des Bildschirms. Die Kamera darf sich also
// hinter ihn stellen, ohne dass eine einzige Taste etwas anderes bedeutet.
//
// Flacher, naeher und weitwinkliger als die feste Kamera: aus 17 Grad statt 36
// sieht man den Hang auf sich zukommen, und 46 Grad Bildwinkel geben bei 14
// Metern Abstand das Tempo zurueck, das der kleine Ausschnitt sonst schluckt.
export const CHASE = {
  elevation: 0.30,    // rad ueber dem Horizont, ~17 Grad
  distance: 14,
  fov: 46,
  lookHeight: 1.5,    // Blickpunkt auf Brusthoehe, nicht auf die Ski
  lead: 3.0,          // die Kamera zeigt ohnehin nach vorn – weniger Vorlauf noetig
  // Wieviel vom Schwung des Fahrers die Kamera mitnimmt. Ganz ohne wirkt sie
  // wie auf einer Schiene, ganz mit pendelt das Bild im Takt der Schwuenge und
  // macht seekrank – der Fahrer schlaegt um bis zu 0,55 rad aus.
  swingAnteil: 0.3,
  blende: 2.6,        // wie schnell zwischen den beiden Kameras ueberblendet wird
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
