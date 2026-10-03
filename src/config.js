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
    // Die Seebucht gehoert zur Spielflaeche. Bisher hob der Gebirgsrand
    // das aeussere Eis um bis zu 7,86 m an und drueckte Fahrer zurueck.
    { x: -47, z: 41, radius: 20 },
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
  // Abfahrtshocke: erst oberhalb des Grundtempos, sonst hockte der Fahrer
  // auf jeder flachen Strecke, denn mit W faehrt man dort genau 13. Vom
  // Gipfel herunter liegt jedes fuenfte Bild ueber 14, jedes zwanzigste
  // ueber 18 – dort soll die Hocke voll sein.
  tuckFrom: 13.3,
  tuckFull: 17,
  // Hangschraege quer zur Fahrt: ab welchem Quergefaelle die volle
  // Hangstellung erreicht ist. Vom Gipfel herunter liegt der Median bei 0.33 –
  // wer dort schraeg faehrt, soll sie ganz zeigen.
  traverseFull: 0.35,
  // rad je Ski. Ab 0.22 stossen die Schaufeln aneinander, bei 0.26
  // kreuzten sie sich.
  ploughYaw: 0.21,
}

// Springen: Leertaste druecken springt sofort. Bis 03.10. war die Taste an
// der Schanze gleichgueltig – der Kicker warf jeden gleich weit. Jetzt
// zaehlt der Moment wie am Kabelsee: wer an der Kante drueckt, springt
// hoeher. Den Pop gibt es nur im Funpark; ueberall sonst bleibt der Hopser
// so hoch wie vorher, damit kein Weg, kein Zaun und keine Slalomlinie
// anders zu fahren ist. Halten zum Laden wie am See war probiert und nicht
// eingaengig genug (Ansage 03.10.).
export const SPRUNG = {
  hopser: 6.4,        // m/s auf flachem Schnee: 1,14 m Scheitel, genug fuer jeden Stein
  // m/s mehr, wer auf der Schanze drueckt (nur im Park). Kleiner Kicker:
  // 1,03 s Flug ohne Taste, 1,33 s mit Druck an der Kante.
  pop: 2.4,
  nachsicht: 0.12,    // s: so spaet nach der Kante zaehlt ein Druck noch
  // Im Funpark fliegt man leichter, wie am Kabelsee (dort auch 13). Mit 18
  // war ein Flug am grossen Kicker 1,45 s lang – fuer einen 720 braucht es
  // gut 1,75 s. Jetzt 1,7–1,9 s ohne Taste und 2,0–2,1 s mit Pop.
  schwerkraft: 13,
  parkHopser: 5.4,    // m/s: bei 13 so hoch wie 6,4 bei 18
  // Von der Box: ohne Taste rutscht man am Ende fast nur herunter (wie am
  // See), mit der Leertaste springt man ab – zusammen 6 m/s, so viel wie
  // ein Hopser, genug fuer einen 360 vom Ende der langen Box.
  boxAbwurf: 1.5,
  boxPop: 4.5,
}

// Tricks gibt es nur im Funpark, gesteuert wie am Kabelsee: in der Luft
// drehen A und D um die Hochachse, W und S schlagen einen Salto. Ohne Taste
// dreht der Fahrer von selbst auf die naechste Landestellung zurueck. Die
// Werte sind die vom See; dort sind sie erprobt.
//
// Am Boden stellt die Leertaste auf Box und Kante die Ski quer (Slide), im
// Schnee laedt sie nur noch den Absprung – vorher stellte sie dort auch die
// Ski quer, und wer vor dem Kicker lud, waere quer hinaufgefahren.
export const TRICK = {
  spinAccel: 28,      // rad/s^2
  spinMax: 8.6,       // rad/s: ein 360 braucht so gut 0,85 s Luft
  spinDecay: 9,
  flipAccel: 22,
  flipMax: 7,
  flipDecay: 8,
  // Landefenster in rad Abweichung, wie am See. Beim Drehen zaehlt die
  // naechste halbe Umdrehung, beim Salto die naechste ganze.
  spinLand: { perfect: 0.3, clean: 0.6, sketchy: 1.2 },
  flipLand: { perfect: 0.3, clean: 0.65, sketchy: 1.2 },
  assistRise: 3.5,    // Landehilfe im Steigen ...
  assistLand: 9,      // ... und kurz vor dem Aufsetzen
  slideAngle: 1.35,   // rad, wie weit die Ski beim Sliden querstehen
  slideLerp: 7,
  slideMinSpeed: 3.5,
  slideDrag: 1.6,     // zusaetzlicher Widerstand quer zur Fahrt
  // Boxen (04.10., wie am See): einrasten, wer hoechstens so schraeg kommt
  // (rad, gut 50 Grad – am See 0,87), und schnell genug ist.
  boxWinkel: 0.9,
  boxMinTempo: 3,
  boxDrag: 0.12,      // 1/s: auf 6 m Deck verliert man so gut 5 Prozent
  boxDeck: 0.1,       // m, so hoch liegt das Holz ueber dem Schnee
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
  // Abgeschaltet (28.09., auf Ansage): die Rueckseite wird neu gedacht, und
  // dafuer soll man sie aus derselben festen Kamera sehen wie den Rest des
  // Tals. Die Anlage bleibt, ein true schaltet sie wieder ein.
  an: false,
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
  snowShade:  0xa7b7d7,
  snowDeep:   0x6f8ec4,
  sky:        0x86b9e8,
  skyHorizon: 0xf6e6d4,
  sun:        0xffe4bd,
  ambient:    0x8fb0dc,
  fog:        0xd6e6f5,
  pine:       0x2c4a44,
  pineDark:   0x1d332f,
  rock:       0x5d6673,
  wood:       0x6b4a35,
}
