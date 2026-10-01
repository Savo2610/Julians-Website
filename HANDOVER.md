# veerka.mp — Übergabe

Stand: 01.10.2026. Dieses Dokument ist der Einstieg für jeden, der hier
weiterarbeitet. Es beschreibt nicht nur *was* da ist, sondern *warum* — denn an
mehreren Stellen sieht die naheliegende Lösung besser aus als die gewählte, und
ist es nicht.

---

## 1. Was das ist

Ein Three.js-Skigebiet, durch das man fährt, um Julians Links zu finden. Seit
dem 27.09.2026 ist es **veerka.mp** und hat dort die Kachelseite abgelöst
(die steckt in der Git-Historie, zuletzt `def8f43`). Jede Station im Tal ist
ein echter Link oder ein echtes Fenster.

Die Seite heißt **Julian Veerkamp**, nicht Portfolio – ein Portfolio an
Arbeiten gibt es noch nicht (Ansage 27.09.). „Skiportfolio“ war der
Arbeitsname bis zum Umzug; er lebt nur noch in Namen weiter, die man nicht
umbenennen sollte: `localStorage`-Schlüssel `skiportfolio.*`, die D1
`skiportfolio-slalom` und der Beta-Worker `skiportfolio-test`.

Das Leitbild: **eine zusammenhängende Gegend**, nicht „als hätte jemand eine
Kiste mit Spielzeug ausgekippt". Alles ist klein und dicht — im Zweifel
schrumpfen, nicht vergrößern. Ein Spielzeugtal, kein Skigebiet im Maßstab 1:1.

```bash
npm install && npm run dev
```

Vite 8, Three.js r185, reines ES-Modul-JavaScript, kein Framework, kein
Asset-Pipeline. Alle Geometrie wird im Code erzeugt, alle Texturen auf Canvas
gezeichnet. `npm run build` muss durchlaufen, bevor irgendetwas als fertig gilt.

---

## 2. Die harten Regeln

Diese sind über mehrere Sitzungen entstanden und jeweils teuer bezahlt. Wer sie
bricht, baut etwas, das zurückgenommen werden muss.

**Die Kamera dreht sich nie** — mit genau zwei Ausnahmen, siehe unten.
`CAMERA.azimuth = Math.PI * 0.25`, Elevation 0.63 rad (≈ 36°). Sie folgt dem
Fahrer, sonst nichts. Daraus folgt:

- WASD bleibt dauerhaft auf dieselben Himmelsrichtungen gelegt und wird aus
  Sicht des Fahrers gesteuert — klassisch, nicht bildschirmrelativ.
- Jedes Objekt mit einer Schauseite (Schilder, Displays, Türen) muss der Kamera
  zugewandt sein: `FACING = CAMERA.azimuth`. Displays brauchen zusätzlich eine
  **Pultneigung**, sonst liest man sie von oben nicht.
- Die Bildschirmbreite einer Achse ist `|cos(yaw − CAMERA.azimuth)|`.
  Bildschirm-rechts ≈ Welt `(0.707, −0.707)`, Bildschirm-unten ≈ `(+x, +z)`.
  `readableYaw()` in `src/world/props/slalom.js` rechnet das aus.
- **Verdeckung**: bei 36° ist ein Punkt verdeckt, wenn etwas um `dy * 1.376`
  höher und dahinter steht. Das ist der Grund, warum die Leuchtstrecke ihre
  Bögen *längs* und nicht quer hat — quer zeigt jeder Bogen fast genau in die
  Blickrichtung und wird zu einem senkrechten Strich.

*Die Ausnahme*: auf der **Nordabfahrt** geht die Kamera hinter den Fahrer und
dreht mit ihm (`CHASE` in `config.js`, Abschnitt 4). Das war eine ausdrückliche
Ansage und gilt nur dort. Die Steuerung blieb davon unberührt, weil A/D ohnehin
aus Sicht des Fahrers lenken — genau deshalb war der Modus überhaupt möglich.
**Seit 28.09. abgeschaltet** (`CHASE.an = false`): die Nordabfahrt macht nicht
so viel Spaß wie gedacht, die Rückseite wird neu gedacht, und dafür soll man
sie aus der festen Kamera sehen. Die Anlage steht noch, `true` schaltet sie
wieder ein. Vorschläge für die Rückseite: Sprung über die Klamm statt Steg,
Geisterfahrer, Skisprungschanze, Gipfelbuch mit Komoot.

*Die zweite Ausnahme* (26.09., auf Ansage): der **Drohnen-Rundflug**
(Abschnitt 4a‴). Dort steuert niemand – der Fahrer steht, jede Taste beendet
den Flug –, also gibt es keine Taste, deren Bedeutung sich mit dem Bild
dreht. Wer eine dritte erwägt: erst fragen.

**Es gibt genau eine Höhenfunktion.** `terrainHeight(x, z)` in
`src/world/heightfield.js` speist das Mesh *und* jede Kollisions- und
Platzierungsabfrage. Geometrie und Kollision können damit nie auseinanderlaufen.
Die Funktion **darf sich niemals selbst aufrufen** — deshalb sind die Höhen der
Pistenband-Stützpunkte feste Zahlen und keine Abfragen.

**Kommentare auf Deutsch, und sie erklären das Warum.** Meist mit einer
gemessenen Zahl belegt („bei Breite 9.5 zerfiel die unterste Reihe zu einem
Fleck"). Kommentare, die wiederholen, was der Code ohnehin sagt, gehören nicht
hinein.

**Minimale Oberfläche.** Es gibt keine Leiste, kein dauerhaftes Symbol in
der Ecke. Die Steuerung steht als Tastenstempel im Schnee
(`src/world/snow-writing.js`). Was sonst eingeblendet wird, verschwindet von
selbst. Zwei ausdrücklich gewünschte Ausnahmen (26.09.): die **Übersicht**
hinter `M` (Abschnitt 4a′) und die beiden **Hinweise** unten
(`menu/hints.js`) – beide sind für Besucher, die nicht spielen wollen
oder mit WASD nicht zurechtkommen (beobachtet: vor allem Ältere).
Dazu seit 26.09. die Pistenpass-Meldung oben links (Abschnitt 4a″), die
ebenfalls von selbst geht – nur für Medaillen und Abzeichen, nicht für Orte.

---

## 3. Aufbau

```
index.html           Canvas, Ladebalken, Markup der drei Fenster, Aussehen der Linkliste
src/
  main.js            Loop, Renderer, window.__ski (Debug-Zugriff)
  config.js          Alle Stellschrauben: WORLD, SKIER, CAMERA, CHASE, TRICK, COLORS
  basis.css          Seite, Ladeblende, Glas, Frost, Tasten – für Tal und Kabelsee
  style.css          Einladung, Auswahl, Übersicht, Handymodus (holt basis.css)
  core/              Werkzeug ohne Spielwissen: geometry.js (assemble,
                     vertexColorMaterial), input.js, touch.js (Handymodus),
                     device.js (TOUCH), noise.js, rng.js, point-scale.js,
                     zeitscheiben.js (lange Rechnungen in Scheiben)
  world/             Gelände und alles, was darauf steht
    heightfield.js   terrainHeight() – die einzige Höhenquelle; Pistenbänder,
                     PLATEAU/SUMMIT/LAKE/SPORT_HILL, Klamm, Steg, Badesteg
    terrain.js       Mesh und Schnee-Shader aus der Höhenfunktion
    world.js         Terrain und Kollisionsraster (resolve, addCollider)
    populate.js      Setzt alles ins Tal — die zentrale Werkbank
    paths.js         Wegenetz: TRAILS und Verbindungen (Schneisen, Präparierung)
    landscape-*.js   Schneerücken, Bodenwellen, Nebenstrecken, Quelle, Schauer
    surfaces.js      Wo Eis und Holz liegen — dort keine Spur, kein Staub
    snow-trail.js    Spurkarte als Render-Target; stampDecal() stempelt hinein
    snow-writing.js  Schrift und Tasten-/Stickzeichen im Schnee, Wildspuren
    sky.js, weather.js  Himmel, Sonne, Gegenlicht; Schneefall
    wayfinding.js    Panoramatafel (PANORAMA) und Wegweiser
    trail-glints.js  Leuchtschleier auf den vier Wegen
    valley-map.js    Talkarte, aus der Welt gemalt
    rohrpost-netz.js Versand der Rohrpost: Kapseln, Maulwurf zum Funkmast,
                     Vorschau im Eis (siehe 4a)
    attractions/     Was den Fahrer übernimmt oder misst: drag-lift.js,
                     magic-carpet.js, rail-ride.js, race.js (Zeitnahme,
                     Slalom), speed-check.js, light-run.js, north-run.js
    areas/           Ensembles: kinderland.js, apres-layout.js und
                     apres-terrace.js (Hütte mit umwerfbaren Möbeln)
    props/           Ein Modul je Gegenstand, nur Geometrie und eigene
                     Bewegung; z. B. screens.js (leuchtende Bildschirme),
                     park-fence.js (bricht), map-board.js (Panoramatafel +
                     lawinenstufe()), signpost.js (Pfeiltafeln), frozen-fall.js,
                     badesteg.js, lake.js (Eis, Risse im Countdown)
  player/
    skier.js         Fahrmodell, Sprung, Tricks, Haltung
    skier-model.js   Die Figur
    top-camera.js    Kamera: fest, Verfolger (Nordabfahrt), Heranzoomen
    drone-flight.js  Drohnen-Rundflug (zweite Kamera-Ausnahme)
    spray.js         Schneestaub, auch der Goldstaub
  stations/          Was an einer Station passiert
    links.js         Alle echten Adressen an einer Stelle
    stations.js      Wo was steht und was es tut
    registry.js      Nähe prüfen, auslösen
    interaction.js   Enter/Tippen: öffnen oder heranzoomen und wählen
    antippen.js      Die Station selbst antippen (Kugel um die Station)
    ui.js            Einladung (Frosttext) und Auswahl (Glas, Leuchtfeld)
    marker.js        Ring im Schnee vor jeder Station
    ticket.js        Rundflug-Ticket (Skikasse → Drohne)
    broadcast.js     Laufende Sendung holen und ins Eis der Quelle legen;
                     auch die Vorschau eines eben eingeworfenen Bildes
  menu/              Die einzigen Menüs (CLAUDE.md)
    map-menu.js      Übersicht (M): Links, Talkarte, Pistenpass, Bestenliste
    kacheln.js       Die Link-Kacheln – reine Daten, auch für die Linkliste
    linkliste.js     Linkliste ohne Tal (kein WebGL, kein JavaScript)
    hints.js         Hinweise unten: Start-Hinweis, Festgefahren-Erkennung, R
    pistenpass.js    Erkundet, Medaillen, Abzeichen; Speicher und Meldung
    pass-regeln.js   Wann was im Pistenpass fällt
    bestenliste.js   Slalom-Bestenliste: Marken holen, eintragen, anzeigen;
                     listeZeichnen() auch für den Kabelsee
  dialogs/           Solana, Briefkasten, Kurzlink – siehe Abschnitt 7
  sommer/            Vom Badesteg in den Sommer (4a⁶)
    sommer.js        Countdown, Nachladen, Verwandlung hin und zurück
    verwandlung.js   Beide Welten mischen: Tauwelle, Abtauchen
    bestenliste.js   Bestenliste des Kabelsees: Marken, Fenster
  kabelsee/          Der Kabelsee (eigene README.md darin)
    see.js           Der See als Baustein, ohne eigenen Renderer
    main.js          Einstieg von /kabelsee/
    config.js, world/, props/, game/, player/, core/ (Eingabe, Touch)
kabelsee/index.html  Die eigene Seite des Kabelsees
worker/              Der Cloudflare-Worker hinter der Seite
  index.js           Router: www-Umleitung, Startseite no-cache, /api/*
  slalom.js          Bestenliste: Marken, Plausibilität, D1
  kabelsee.js        Bestenliste des Kabelsees, dieselbe D1
  marken.js          Was beide teilen: Marken, Namen, Adresse
  broadcast.js       Durchreiche zu broadcast.veerka.mp
  antwort.js         JSON-Antworten
  migrations/        Schema der D1 skiportfolio-slalom
public/              _headers (Cache für /assets/), Symbole, site.webmanifest
tools/               skifahrer-icon.mjs – rendert das Homescreen-Symbol neu;
                     kabelsee/ – Bilder und Video des Sees (Playwright)
docs/kabelsee/       Bilder und Video des Sees fürs README
tests/               node --test (npm test)
wrangler.jsonc       Worker "website" auf veerka.mp und www.veerka.mp
```

Abhängigkeiten laufen in eine Richtung: `core/` kennt nur `config.js`,
`world/` und `player/` bauen auf `core/`, `stations/` und `menu/` kennen die
Welt – die Welt kennt kein Menü. Einzige Querverbindung: `world/` holt aus
`stations/` die Stationen selbst (`populate.js`) und den Ring im Schnee
(`marker.js`, der auch vor Wegweisern und im Kinderland liegt). Verdrahtet
wird alles in `main.js`.

**`assemble(parts)`** in `core/geometry.js` verschmilzt viele Primitive mit
Vertexfarben zu *einem* Draw Call. Alles, was sich nicht einzeln bewegt, gehört
da hinein. Was in Mengen auftritt und sich einzeln bewegt (Pistenstangen,
Leuchtsegmente), ist eine `InstancedMesh`.

**Kennzahlen im Betrieb:** 0.05–0.13 ms/Frame, 300–420 Draw Calls,
~800–865 k Dreiecke. Wer etwas hinzufügt, prüft das nach.

**Pixel sind der Engpass, nicht Draw Calls** (gemessen 27.09. auf Julians
MacBook). Im Vollbild bei Pixelverhältnis 2 (3456 × 2160) dauerte ein Bild
18 ms, und auf 120 Hz ruckelte es alle 1–2 s. Im kleinen Claude-Browser
(800 px, Verhältnis 1) sah man davon nichts. Davon kostete das Gelände
11 ms: das Schneerelief rechnete 72 Sinus-Zufallswerte je Pixel. Es holt
sie jetzt aus einer 256²-Rauschtextur (`terrain.js`) und kostet noch 6 ms.
Außerdem ist das Bild am Desktop auf 4,2 Mio. Pixel gedeckelt
(`pixelRatio()` in `main.js`, auf dem Mac also 1,5). Zusammen sind es
9,4 statt 17,3 ms. Die eigenen Partikel-Shader rechnen in Gerätepixeln und
gleichen das über `core/point-scale.js` aus, sonst würden Flocken größer.
Die fünf Punktlichter kosten jedes Pixel mit (2,7 ms bei Verhältnis 2); kein
weiteres ohne Not. Transparente Materialien nie `DoubleSide` ohne
`forceSinglePass`, siehe Sendeturm (4a⁵).
Zum Messen: `devicePixelRatio` auf 2 überschreiben, `resize` auslösen, dann
`S.step` mit `gl.readPixels` dahinter takten.

`npm run build` teilt Three.js in ein eigenes Stück (`vite.config.js`): 145 kB
gzip, die im Cache bleiben, wenn sich nur das Tal ändert (70 kB).

---

## 4. Die Welt

**Geografie** (`config.js` → `WORLD.basins`): vier überlappende Kreise statt
einer Scheibe, damit die Welt wachsen kann, ohne in der Mitte leer zu werden.
Der vierte (−26, −68, Radius 34) ist die Rückseite des Berges. Er ist bewusst
klein, und die **Kartengröße bleibt bei 230 / 448 Segmenten** — hätte sie
mitwachsen müssen, wäre die Schneespur-Textur 11 % gröber geworden.

| Element | Ort | Zweck |
|---|---|---|
| `PLATEAU` | 0, 30 — Radius 11, Höhe 2.4 | Startplatz, Fackelkranz, Schrift im Schnee |
| `SUMMIT` | −58, −64 — Höhe 30 | Bergarm, Liftende, längste Abfahrt |
| `SPORT_HILL` | 27, −87 — Radius 68 | Flanke im Nordosten: Rennstrecke und Funpark |
| `LAKE` | −47, 41 — Radius 17 | Zugefrorener See |
| `BADESTEG` | −41,2, 25,0 → −42,4, 31,7 | Badesteg, 45 cm über dem Eis (4a⁶) |
| `NORTH_LANE` | −58,−72 → 6,−65 — 80 m | Nordabfahrt über die Rückseite |

**Pistenbänder** (`makeLane` in `heightfield.js`): ziehen das Gelände entlang
einer Linie auf ein gleichmäßiges Gefälle. `reach = width*0.5 + feather`,
Gewichte `w = 1/(d⁴ + 0.05)` über alle Segmente gemischt, `endFade` blendet
beide Enden aus. Die Bänder werden **der Reihe nach** angewendet — das spätere
gewinnt auf seiner eigenen Mittellinie, deshalb steht `SHOOT_LANE` bewusst
zuletzt.

**Vier Wege** vom Plateau (`TRAILS` in `world/paths.js`): BERUF (blau, nach
Osten), SOZIALES (pink, nach Norden), SPORT (orange, nach Nordosten), TOOLS
(grün, nach Westen). Jede Station liegt an genau einem Weg, damit man einen
Strang zu Ende fahren kann.

**Stationen** — alle verdrahtet, alle Adressen in `stations/links.js`:

| Station | Ort | Ziel |
|---|---|---|
| Werkstatt (Hütte) | 22, 28 | Auswahl: LinkedIn / GitHub (Weg heißt KARRIERE) |
| Skikasse | −40, −2 | Auswahl: PayPal / Solana (Wallet-Fenster) |
| Kontakt (Telefon + Fernglas) | 2, −3,5 | Auswahl: Signal / Instagram |
| Rohrpost | −19, 25 | Klappe auf, Upload-Fenster; beim Schließen der Versand (4a, Rohrpost) |
| Abkürzung (Felstunnel) | −34, 15 | Kurzlink-Fenster |
| Arbeitszeitrechner (Stechuhr) | −41, 13 | zoomt, Zeiger rasen; öffnen stempelt, dann zeit.veerka.mp |
| Packlisten-App (Depot) | −48, 0 | zoomt, Deckel klappt, Inhalt hüpft; packliste.veerka.mp |
| Abgestürzte Drohne | 51, 20 | Uniprojekt |
| Löschzug (Feuerwehrauto) | −15, 43 | zoomt, Blaulicht an; „Ausrücken“ fährt los und wechselt im selben Tab zu jf.veerka.mp/?einfahrt=1 (am Waldrand, eigene Baumgruppen) |
| Gefrorene Quelle (Eisfall am See) | −56,2, 27,7 (Fuß) | broadcast.veerka.mp, zeigt die laufende Sendung (4a⁵) |
| Badesteg (Nordufer des Sees) | −42,2, 30,6 (vorn) | Countdown, Verwandlung, Kabelsee (4a⁶) |

Eine Station gilt als verdrahtet, wenn sie `url`, `onUse` oder eine Auswahl
mit Inhalt hat. Wie man sie benutzt, steht im nächsten Abschnitt.

**Anlagen**: Schlepplift (Teller, damit der Fahrer auf den Ski bleibt und die
Spur weiterläuft), Zauberteppich im Kinderland, Rail im Funpark, Rennstrecke
mit Zeitnahme, Speedcheck an der freien Piste, zwei Schneekanonen, Leucht-
strecke, Après-Ski-Hütte mit Terrasse, Gipfelkreuz.

**Wegenetz** (`paths.js`): die vier Wege plus sechs Verbindungen zu einem
Netz; die Mittellinien steuern Waldschneisen *und* die Präparierung im
Terrainmaterial. `wayfinding.js` baut die Panoramatafel am Start und drei
Wegweiser, alle zur Kamera (GIPFELBAHN/TOOLS, HÜTTE/PARK und ZUM SEE/TOOLS
sind weg – sie zeigten auf etwas, das man von dort schon sieht).
Wegweiser und die vier Ausgangsschilder am Plateau sind **Pfeiltafeln**
(`createMarkerSign` in `signpost.js`): Holzmast mit Schneehaube wie vorher,
jede Tafel ein Pfeil in Wegfarbe mit weißem Rand und Schneekante, Spitze
zur Seite ihres Weges. Ein Zwischenstand mit modernen Leitsystem-Tafeln
(Stahlmast, abgerundet) passte nicht in die Landschaft und ist wieder weg.
Alle Wegweiser stehen auf einem **Federfuß** (`springMount` in
`signpost.js`), wie echte Pistenschilder: kein Kollisionskreis mehr – wer
dagegen fährt, drückt das Schild bis 1,25 rad weg, fährt durch (gut 10 %
Tempo weg, ab 6 m/s staubt Schnee) und es schwingt in etwa 1,5 s zurück
(gemessen 47° → 13° Nachschwinger → 0°). Vorher stand man nach dem Laden
beim Geradeausfahren am Pfosten von KONTAKT & GIPFEL fest.
Die Kreuzung am Kontaktposten ragt fest nach rechts (`side: 1`) – nach
links verdeckte sie den Posten. Die Kreuzung KONTAKT · LIFT / STARTPLATZ steht bei
(27,5, 23) links unter dem Kinderland statt bei (33, 15) neben dem Teppich.
Pfeile werden zum Zielpunkt gerechnet; wo der Weg erst später abbiegt,
steht ein fester Pfeil als vierter Eintrag der Zeile (WERKSTATT ↓,
KONTAKT · LIFT ↑).

**Leuchtschleier** (`world/trail-glints.js`) ersetzen die Winkel im Schnee:
je Weg huscht alle 9–18 s eine dünne Sternschnuppe vom Plateau aus den
Weg entlang (56 Punkte Schweif, Funken dahinter) – neue nur, solange der
Fahrer höchstens 20 m vom Startplatz entfernt ist (vorher 30). Farben gesättigt und hell,
normal gemischt – additiv oder in den gedeckten Wegfarben lasen sie sich
auf Tagschnee wie Rauch. Höchstens eine je Weg, sonst waren sechs
gleichzeitig im Bild. Stationen rutschen **vor** der Bepflanzung auf
flache Plätze; ihre Lichtungen benutzen die korrigierten Koordinaten.

**Landschaft** (`landscape-layout.js`, `landscape-details.js`): sechs niedrige
Schneerücken (≤ 2,8 m), drei Bodenwellen und drei Nebenstrecken, **vor** den
Pistenbändern in `terrainHeight()` addiert. Stützpunkte aller Pistenbänder
blieben dabei auf den Zentimeter gleich. Dazu Felsquelle, Uferbank und
Schneeschauer an Hainbäumen (180 Partikel, Auslösung innerhalb 3,6 m).

**Die Uferbank** (`props/lake-bench.js`) schaut aufs Eis, nicht zur Kamera, und
**zerbricht** ab 5 m/s (Grundtempo 13, Kanten 6,5 — wer bremsend kommt, lässt
sie stehen). Zehn Teile fliegen in Fahrtrichtung, legen sich im Schnee flach
(über die Längsachse, nicht über Eulerwinkel — die rasteten schräg nicht ein,
ein Pfosten blieb bei 50° stecken) und setzen sich nach 12 s wieder zusammen,
sobald der Fahrer ≥ 14 m weg ist. Die Kollision ist solange aus (`c.off` in
`World.resolve`); dort hängt auch das erste echte `onHit`.

**Hütte und See**: Die Après-Ski-Hütte steht rechts bei (23, −64), Front zur
Kamera, mit neuneckig zugeschnittener Terrasse, drei Sitzgruppen und
umwerfbaren Möbeln (`areas/apres-terrace.js`; stehen nach 10 s wieder auf, wenn der
Fahrer ≥ 7 m weg ist). Der See hat eine eigene Bucht in `WORLD.basins`, damit
das ganze Eis befahrbar ist; `lakeRadius()` teilt die Uferkontur zwischen Mesh
und Höhenfeld. **Weiße Spuren auf Eis und Holz** kamen vom Spurstempel, dessen
Rand durch den nur 1,2 cm höheren Belag ragte — `surfaces.js` sperrt jetzt
Spur, Staub und Verformung dort (drei Regressionstests in `tests/`).

**Ferne Bergkette** (`props/backdrop.js`, Idee aus dem Archiv, *Snow
Portfolio*): zwei durchgehende Grate um 272 und 372 m aus Ridged Noise,
Flächen mit eingebackenem Licht, unbeleuchtet. Der Dunst ist **die
Himmelsfarbe hinter jedem Punkt** (`skyColorGlsl` aus `sky.js`, Blickstrahl
mit der Kuppel geschnitten), nicht der Szenennebel: `FogExp2` 0.0052
verschluckt bei 255 m schon 83 %, und Nebel (kühl) und Horizont (warm)
passen nicht zusammen – die alten 43 Kegel standen deshalb grau vor Pfirsich.
Hinter dem Bergarm am höchsten, ringsum halb so hoch. Zu sehen **nur im
Rundflug**: die feste Kamera zeigt am oberen Bildrand noch 17° nach unten.

### Die Nordabfahrt (Rückseite)

Die jüngste und größte Erweiterung. Vom Gipfel führt eine zweite Piste nach
hinten, dorthin, wo vorher nichts war, und kommt in einem Rechtsbogen oben am
Funpark wieder heraus. Damit schließt sich eine Runde: Lift → Rückseite →
Funpark → Tal.

**Das Gelände kommt zuerst, das Band nur zum Glätten.** Derselbe Weg wie bei
der Rodelbahn: erst wurde die Rückseite mit `ridgeAlong()` (Kamm entlang einer
Linie, Amplitude je Stützpunkt) so geformt, dass sie von allein fällt —
`SCHULTER` trägt die Trasse, `GRAT` schließt die Außenseite der Kurve, `KAR`
ist die Mulde dazwischen. Erst danach zieht `NORTH_LANE` das Band darüber.
Gemessen bleibt der Eingriff unter 1,5 m (Auftrag ≤ 0,50 m, Abtrag ≤ 1,15 m).
Wer die Trasse verlegt, muss die Schulter neu rechnen, nicht das Band breiter
machen — sonst steht dort ein Damm.

**Der Einstieg ist ein Tor, kein Knopf.** `props/start-gate.js` steht quer über
dem Anfang der Bahn. Wer hindurchfährt, nimmt die Piste — keine Taste, kein
Menü, die Regel von der minimalen Oberfläche bleibt heil. Die beiden Pfosten
haben Kollision, das Tor als Ganzes nicht.

Es **trägt keinen Namen**. Unter dem Bogen hing eine Tafel mit der Aufschrift
NORDKAR; sie ist auf Ansage wieder verschwunden. Bogen und blauer Punkt sagen,
was zu sagen ist. Die Pfosten bekommen ihre Länge von `populate`
(`fuss: [links, rechts]`): der Start liegt auf einem gerundeten Rücken, das
Gelände fällt auf den 4,75 Metern bis zu den Pfosten um 0,85 und 0,70 Meter ab,
und ohne diese Zahlen schwebte das Tor mit beiden Beinen.

**Die Kamera** (`CHASE` in `config.js`, Logik in `player/top-camera.js`) geht
hinter den Fahrer: Elevation 0.30 rad statt 0.63, Abstand 14 statt 33, FOV 46.
Umgeschaltet wird nicht, sondern über gut eine Sekunde geblendet (`blende` 2.6).
Zwei Fallen, beide schon hineingetreten:

- Der Azimut ist ein **fortlaufender** Winkel und wird immer auf dem kürzesten
  Weg *vom aktuellen Wert aus* nachgezogen (`kuerzerWeg()`). Mischt man statt
  dessen jedes Bild zwischen festem und mitdrehendem Azimut, kippt das
  Vorzeichen genau dann, wenn der Fahrer von der festen Kamera wegzeigt, und
  die Kamera schwenkt einmal ganz herum.
- Gefolgt wird `heading + swing * 0.3`, nicht `facing`. Der Fahrer pendelt von
  selbst um bis zu 0.55 rad; diese Bewegung gehört ins Bild, nicht in die
  Kamera.

Dazu eine Bodenfreiheit von 1,3 m, gewichtet mit der Überblendung — bei 17°
steht die Kamera nur gut vier Meter über dem Blickpunkt und taucht am Steilstück
sonst in den Schnee.

**Wann sie greift**, entscheidet `world/attractions/north-run.js` an der Bahnmitte und nicht
am Tor: ein Tor liefert nur einen Moment, aber die Kamera braucht über die ganze
Fahrt eine Meinung. Hysterese in drei Richtungen — seitlich (ein bei 8 m, aus
bei 12,5 m), längs (2 m Sicherheitsabstand an beiden Enden) und zeitlich
(0,4 s Geduld, ein weiter Schwung ist noch kein Ausstieg). Dazu eine Sperre
`_gefahren`: ohne sie genügte ein Ausrollen im Gegenhang, um am Ziel wieder in
die Verfolgerkamera zu rutschen (gemessen: zurück auf die feste Kamera, eine
Dreiviertelsekunde später bei 77 von 80 Metern wieder hinter den Fahrer). Erst
fünfzehn Meter zurück bergauf zählt als „nochmal".

**Die Klamm** quert die Bahn zwischen Meter 48 und 62, wo das Gefälle auf sieben
Grad zurückgeht. Sie ist Gelände und schneidet als **letzter** Schritt nach dem
Pistenband — umgekehrt hätte das Band sie gleich wieder aufgefüllt. Viereinhalb
Meter tief, Wände mit gut 35°; wer hineingerät, fährt sie wieder hinaus (geprüft)
— dasselbe Prinzip wie beim See.

Der Steg darüber folgt dem Grundsatz der Funpark-Schanzen: **was man befährt,
ist Gelände, was man sieht, ist Aufbau.** Ein knapp sechs Meter breiter Streifen
bleibt ungeschnitten und trägt den Fahrer (`BRUECKE` im Höhenfeld), das Holz aus
`props/gorge-bridge.js` liegt nur darauf. Gemessen wird der Streifen *längs* der
Rinne — er ist ein Band quer darüber und kein Kreis. Eine eigene Stangenreihe
acht Meter davor trichtert hinein — sie lässt genau vor dem Steg 7,8 Meter einer
vierzehn Meter breiten Piste offen — und Fels an beiden Kanten macht die Rinne
überhaupt erst sichtbar: eine Mulde aus Schnee in einem Hang aus Schnee hat aus
der festen Kamera keine Kante.

**Drei Dinge am Steg sind Bedingung**, und alle drei waren erst falsch — der
Fahrer fuhr sichtbar durch das Holz:

1. Die Deckfläche liegt auf der lokalen Höhe **null**. Die Ski des Fahrers
   liegen auf der Geländehöhe, und die *ist* hier die Deckfläche. Lag das Deck
   bei +0,1, stand er bis zur Wade darin.
2. Der Steg wird **geneigt** gebaut (`neigung`, aus einer Ausgleichsgeraden
   durch fünfzehn Geländeproben in `populate`). Die Bahn fällt dort mit 8,95°;
   auf 14,5 Metern Länge sind das 2,2 Meter. Waagerecht steckte er oben einen
   Meter im Hang und schwebte unten einen Meter darüber.
3. Der Steg ist **breiter als der Streifen, der trägt** — 8,2 gegen 5,8 Meter.
   Nur deshalb ist überhaupt Holz zu sehen: im Streifen liegt das Gelände auf
   Deckhöhe, und jedes Brett dort oben zerschneidet sich mit dem Mesh zu Fetzen.
   Außen fällt der Saum ab, dort steht das Holz frei. Zu sehen ist am Ende eine
   Schneespur zwischen zwei hölzernen Randbohlen.

Rest war: das Gelände wich quer über die Spur um −13 bis +16 cm von der
Deckfläche ab (auf der Mittellinie nur 5 cm, deshalb lange übersehen) — wo es
tiefer lag, stand der Fahrer bis über die Ski im Schneebelag. Seit
`stegEbene()` in `heightfield.js` liegt das Gelände im tragenden Streifen
**exakt auf der Ebene des Stegs** (`BRUECKE.ebene`: Mitte, Richtung, Gefälle
als feste Zahlen, quer mit dem Saum, längs 1,5 m vor den Enden ausgeblendet).
Gemessen: ±1 cm.

**Charakter**: dichter Wald (Dichte-Aufschlag über `nordDist`), Felsriegel auf
dem Grat, Wildspuren im Schnee (`stampTrack` in `snow-writing.js`, gestempelt in
`main.js`). Nichts zum Anklicken — das war die ausdrückliche Wahl.

**Zerbrechliches**: Der **Zaun oben am Funpark** (`props/park-fence.js`)
bricht ab 5 m/s wie die Seebank, aber nur im Umkreis von 2,6 m um den
Aufprall; Pfosten und Latten sind zwei InstancedMeshes, gebaut wird nach
10 s, wenn der Fahrer ≥ 12 m weg ist. `onHit` darf `true` zurückgeben – dann
schiebt `World.resolve` nicht zurück, man fährt hindurch.

**Überspringen**: Kollisionskreise haben eine Höhe (`addCollider(x, z, r,
data, height)`, Standard unendlich). `resolve` bekommt die Flughöhe des
Fahrers und prüft gegen ein Halbkugelprofil. Steine tragen ihre gemessene
Kuppenhöhe (0,2–0,9 m), liegende Stämme 0,62 m (Wurzelteller nicht); der
Sprung mit der Leertaste hat 1,14 m Scheitel. Gemessen: ohne Sprung bleibt
man am Stein hängen, mit Sprung fliegt man drüber. Bäume, Zäune, Häuser
und Findlinge bleiben unendlich hoch. Nebenbei: die Kreise der Stämme lagen
quer zum Stamm (`sin/cos` vertauscht) und sind jetzt längs.

**Lawinenverbauung** (`props/avalanche-barrier.js`): eine Reihe
Schneebrücken an der Westflanke unter dem Gipfel, auf der Höhenlinie um
24 m vor der Waldkante. Sie ist die Grenze nach links unten – vorher fuhr
man dort in den Wald und kam nur kriechend heraus. Kollision durchgehend
(alle 0,9 m), nicht überspringbar.

**Schrift im Schnee**: Name und Tasten werden mit wenig Relief gestempelt
(`relief` in `stampDecal`, Name 0,3, Tasten 0,45) und kräftiger eingefärbt;
Blau zählt im Terrain-Shader als glatt. Vorher warfen Rille und Wall
Schatten in die Buchstaben und die Windrippen liefen hindurch – lesbar war
der Name erst, wenn man ihn platt gefahren hatte.

**Spielereien**: Fackeln und alle Pistenstangen kippen um, wenn man sie
erwischt, und richten sich nach Sekunden wieder auf (Fackeln verlöschen dabei).
Die Schneekanone verfolgt den Fahrer mit dem Strahl, feuert aber nur manchmal
(Einschaltdauer 4 s, Sperre 8 s, Chance 50 %) und nie, während man am Teppich
oder am Lift hängt.

---

## 4a. Stationen benutzen: Enter, Heranzoomen, Glas

**Tasten insgesamt** (`core/input.js`): WASD/Pfeile, Shift kanten,
Leertaste springen (im Park Tricks), Enter/E benutzen, `M` Übersicht,
`R` zurück zum Start, `Tab` Reiter der Übersicht (Links, Talkarte, Pistenpass, Bestenliste), Esc/Backspace zurück.

**Enter** (oder `E`, oder Antippen) ist die eine Taste. Vor einer Station
schwebt die Einladung: oben der Hinweis als kleines Wort in der
Stationsfarbe, darunter der Name, davor das ⏎-Zeichen (am Handy statt dessen
ein › hinter dem Namen) – Frosttext ohne Rahmen. **Die Station selbst ist
antippbar** (`stations/antippen.js`): Beobachtet wurde, dass Freunde am
Handy auf die Hütte tippten statt auf die Pille. Getroffen wird eine Kugel
(3,4 m, 1,8 m über dem Boden) um die Station, vor der man steht, nicht ein
Mesh – die Werkstatt führt als `object` nur die Bank. Ein Tipp ist unter
10 px und 450 ms, sonst ist es der Daumenstick. Ob getippt werden darf,
zählt beim Drücken, weil `main.js` beim Drücken eine offene Auswahl
schließt. Am Rechner wird der Zeiger über der Station zur Hand.

**Rohrpost verschickt (Zweig `rohrpost-versand`, 30.09., per `--no-ff` in `main`).** Vorher schoss
beim *Öffnen* des Upload-Fensters eine Kapsel aus dem Rohr, bevor etwas
geschickt war. Jetzt klappt beim Öffnen nur die Klappe weit auf; verschickt
wird beim **Schließen**. `dialogs/upload.js` zählt je Sitzung, was angekommen
ist (jede Datei und der Text je eins), und meldet beim `close` ein
Ereignis `rohrpost` mit `{ angekommen, gescheitert }` – so muss das Fenster
nichts vom Tal wissen. `world/rohrpost-netz.js` spielt es ab:
- je Sendung eine Kapsel (höchstens fünf) plopp in den Trichter, Klappe
  zu, je Kapsel eine Beule durchs Rohr, Schnee stiebt am Kragen;
- **gescheitert:** das Rohr hustet, eine Kapsel fliegt mit Rauch heraus,
  rollt vor dem Rohr aus und sinkt nach 6 s ein; die Spur wartet, bis sie
  liegt, sonst fährt die Kamera weg, bevor man sie sieht;
- dann läuft ein **Maulwurf** unter dem Schnee zum Funkmast (26 m/s, gut
  45 m, verlegt wie ein Rohr: zwei Geraden mit gerundetem Knick an Tunnel,
  Bank, Seeufer und Quellrahmen vorbei, gegen die ausgelesenen Hindernisse
  geprüft; der Schnee darauf dagegen ungleich, mit Klumpen daneben), der Mast funkt 2,2 s
  (`tower.userData.funken`). Die Kamera zoomt zum Einwerfen ans Rohr. Dem
  Maulwurf folgt sie (mit 28 m Abstand) **nur, wenn danach etwas im Eis der
  Quelle steht**, sonst ist sie zurück beim Fahrer, sobald er losläuft.
  Erst folgte sie immer mit 19 m – zu nah, und nur für einen Funkspruch
  quer durchs Tal zu viel. Die Spur ist
  **nicht** in die Schneetextur gestempelt – die hält für immer –, sondern
  ein InstancedMesh aus Hügelchen, die nach 3,2 s in 2,4 s wieder zutauen.
  Kein eigener Kopf-Buckel: der sah am Rohr aus wie ein Schneeball;
- **nichts geschickt:** die Klappe fällt zu, ein Hauch Dampf, nach 1,4 s
  steht sie wieder offen.
- **Bild oder Text dabei:** das erste geglückte Bild (kein SVG) und der
  Text kommen im Ereignis als `bild` und `text` mit und werden sofort im
  Browser gezeichnet (`feed.vorbereiten`): das Bild, sonst der Text –
  beides zusammen zeigt nur das Bild, ohne Zeile darunter. Die
  Kamera folgt dem Maulwurf und schwenkt bei der Ankunft zur Quelle; dort
  steht es 3,5 s ganz aufgetaut vor der Kamera (`fall.userData.setKlar`)
  und bleibt danach insgesamt 30 s im Eis (`feed.vorschau`), getaut nur
  noch nach der Entfernung wie eine Sendung – wer hinfährt, sieht es noch.
  Die laufende Sendung ist solange angehalten und kommt danach zurück. Es geht nie an einen Server – sehen kann es nur,
  wer es eingeworfen hat. Kann der Browser das Bild nicht lesen (HEIC in
  Chrome), bleibt der Text; ist nichts fertig, wenn der Maulwurf losläuft,
  fällt die Vorschau samt Kamerafahrt aus.
Esc, Enter, `M` oder Tippen holen die Kamera schon während des Einwerfens
zurück. Mit `prefers-reduced-motion` keine Kamerafahrt.

**Jede Station zoomt (Zweig `stationen-mit-auftritt`, 29./30.09., per `--no-ff` in `main`).** Stechuhr,
Depot und Löschzug öffneten ihre Seite sofort – wer im Tal gelernt hat,
dass man heranfährt und etwas auslöst, stand plötzlich woanders. Jetzt
haben sie eine Auswahl mit **einem** Ziel (`.station-sheet.einzeln`:
schmaler, ohne ←/→) und führen beim Heranzoomen etwas vor, über
`object.userData.select`: die Uhr rast und scheppert, im Depot klappt der
Deckel zu und weit auf, dann hüpft der Inhalt der Reihe nach (beim Öffnen
springt der Rucksack), der Löschzug schaltet Blaulicht und Scheinwerfer an
(vorher blinkte er immer – ein Auto, das schon blinkt, kann nicht
aufwachen). Uhr und Depot spielen ihr Stück **einmal** (die Uhr zweimal
„brrrt“, dann läuft sie normal) – in Schleife machte es nervös. Die
Lichthöfe sind additive Sprites, keine Lichtquellen. „Ausrücken“ lässt ihn
0,8 m zurücksetzen – die Nase schwenkt dabei schon zur Lücke hin
(Radius 5 m; zur Kamera hin ergab Rangieren keinen Sinn) – und dann in einem
flachen Linksbogen (Radius 6 m, 29°) auf die Lücke zwischen den Tannen
hinter ihm zufahren – geradeaus fuhr er zuerst durch eine Tanne, danach in einer
Rechtskurve zur Kamera; Julian wollte die Lücke (30.09.), Ausrichtung
unverändert. Gegen die ausgelesenen Stämme gerechnet bleibt jede Ecke
≥ 2,7 m von allen anderen weg (so nah wie geparkt); durch die Lücke selbst muss er nicht passen.
Dabei schließt eine Blende (`.ausfahrt`) in der Farbe, in der die
Lernwerkstatt aufwacht, und die hängt vom Farbschema ab: dunkel ist ihr
erstes Bild `#080b14`, hell schon die unscharfe Straße am Tag (erste Bilder
gemessen) – deshalb hell ein Verlauf aus diesem Bild, in zehn Streifen
gemittelt. Die Lernwerkstatt folgt nur `prefers-color-scheme`. Nach 1,9 s
geht es **im selben Tab** zu `jf.veerka.mp/?einfahrt=1`.
Ein neuer Tab zeigte weder Anfahren noch Übergang. `location.href` braucht
keine Nutzergeste, die Verzögerung ist also auch in Safari erlaubt. Kommt
man per Zurück aus dem bfcache, setzt `pageshow` Auto und Blende zurück.
Die Packliste klebt jetzt innen am Deckel, der an einem Scharnier hängt:
vorher zeigte sie vom Bild weg, was erst herangezoomt auffiel.

**Frost statt Pillen (29.09., als Zweig `oberflaeche-ohne-pillen` gebaut und
per `--no-ff` in `main` geführt).** Alles,
was nur kurz über dem Tal steht – Einladung, Hinweise unten, Zeitnahme,
Trickmeldung, Abzeichen, Bestenlisten-Angebot –, hat keinen Behälter mehr:
Schrift mit hellem Hof (`text-shadow`) und dahinter ein Hauch
(`.frost::before`: `backdrop-filter` mit radialer `mask-image`), der ohne
Kante ausläuft. Der Hof allein trug auf Schnee, über Tannen nicht. Vorher
waren es Glaspillen, und jede sah aus wie ein Knopf. Glas bleibt für das,
was man bedient (Auswahl, Übersicht, Fenster, Handyknöpfe); die Reiter der
Übersicht sind Wörter mit Strich statt Pillen-Umschalter. Fünf Entwürfe
standen zur Wahl (Frosttext, Eisscheibe, Wegweiser, Sucher, Nebelrand);
genommen: Frosttext mit Nebel als Hauch. Für die Einladung standen danach
Sucher-Ecken, Pistenstange, Leitlinie und Farbwort zur Wahl; genommen das
Farbwort, der Sucher war zu technisch.

**Register, Leuchtfeld und Stempel (29.09., derselbe Zweig).** Was man
bedient, bleibt Glas, aber ohne Kärtchen darin. Regel für die ganze Seite:
**ein Strich heißt schreiben, ein farbiger Schein heißt klicken.** Die
**Auswahl** an einer Station stellt die Ziele nebeneinander (passt zu ←/→
und A/D); hinter dem gewählten glimmt ein Schein in seiner Farbe, die
anderen sind grau. Am Handy sind alle farbig und der Schein kommt unter
dem Finger – grau sähe dort gesperrt aus. Die **Links** der Übersicht und
die **Talkarte** sind Register wie die Legende einer Pistenkarte: Gruppen
beginnen mit einem Strich in ihrer Wegfarbe, die gewählte Zeile glimmt.
Verworfen: erst gepunktete Führungslinien (wirkten wie Eingabefelder),
dann die Auswahl untereinander (man erwartet W/S, die aber hinausführen),
und ein Karussell (Ziele wandern, Maus-Zeigen würde sie wegdrehen, am
Handy zwei Tipps, und nur die Skikasse hat drei Ziele). Der **Pistenpass** ist ein
Stempelheft (Orte als Abhakliste, Medaillen und Abzeichen als runde
Farbstempel, schief nach einem Hash der Kennung, damit nichts wackelt).
Die **Fenster** (Solana, Upload, Kurzlink, Bestenliste) haben ein Zeichen
statt der Farbkachel, oben den Ort im Tal, Felder nur mit Unterstrich, und
die Hauptaktion ist „Senden →“ auf einem Schein in der Fensterfarbe, grau,
solange sie nicht geht. Entwurf „An den Geräten“ (Beschriftung über jedem Terminal) war
beliebt, scheiterte aber an Kontakt (schräg, Telefon und Fernglas
verdeckt), Skikasse (Rundflug hat kein Gerät) und Drohne.
**Falle:** Unter `opacity` 1 schaltet der Browser die Unschärfe des Hauchs
ab (das Element wird zur Backdrop Root). Deshalb atmet der Start-Hinweis
über die Schriftfarbe, und eine tote Station dimmt nur ihren Text. Beim
Ein- und Ausblenden fehlt der Hauch darum kurz – bisher unauffällig.

- Station, die ein **Fenster** öffnet (Rohrpost, Abkürzung): Enter öffnet
  es sofort, die Rohrpost klappt dabei ihre Klappe auf.
- Jede andere Station hat eine **Auswahl** – auch die mit nur einem Ziel
  (Stechuhr, Depot, Löschzug, Quelle; `.station-sheet.einzeln`, siehe
  unten), damit man überall erst heranfährt und etwas passiert, statt
  plötzlich auf einer anderen Seite zu stehen. Mehrere Ziele haben
  Skikasse (PayPal/Solana/Rundflug), Werkstatt (LinkedIn/GitHub), Kontakt
  (Signal/Instagram) und Drohne. Enter **zoomt heran**. Der Fahrer bleibt stehen
  (`input.locked`), unten klappt die Auswahl auf, die Ziele nebeneinander,
  ←/→ (auch A/D) wechseln, Enter öffnet, Esc/Backspace/W/S führen hinaus. Die Ziffern `1`/`2`
  gehen weiterhin direkt. Das 3D-Objekt zeigt die Wahl mit: das gewählte
  Terminal bzw. der Bildschirm leuchtet und hebt sich (`userData.select`),
  beim Öffnen blitzt es (`userData.press`), an der Kasse schiebt das Terminal
  einen Beleg heraus und der Kassierer winkt.

**Das Heranzoomen dreht die Kamera nicht.** `TopCamera.fokus()` ändert nur
Abstand und Blickpunkt; der Azimut bleibt. Die Grundregel ist heil, es gibt
keine zweite Ausnahme. Der Blickpunkt rückt um `focus.vor` zur Kamera hin,
damit das Objekt oberhalb der Auswahl steht.

**Warum Safari die Links vorher blockiert hat:** Die Taste setzte nur ein
Flag, geöffnet wurde im nächsten `requestAnimationFrame`. Safari zählt
`window.open` nur *während* einer Nutzergeste als erlaubt. Jetzt läuft alles
Auslösende synchron im `keydown`/`click` (`Input.onAction` →
`StationInteraction.press`). **Wer hier etwas ergänzt: nie `window.open` im
Loop aufrufen.**

**Die Skikasse** (`props/ticket-booth.js`) ist das erste Modell, das für zwei
Entfernungen gebaut ist: aus 33 m trägt die Dachtafel, aus 9,5 m Schalter,
Kassierer und Terminals. Die Terminals stehen **vor** der Traufe auf einem weit
vorspringenden Brett — die Sichtlinie zur Kamera steigt nur 0,73 m pro Meter,
eine schräge Markise lag genau darauf und verdeckte sie zur Hälfte (deshalb
jetzt eine senkrechte Blende). Die Werkstatt hat davor eine **Werkbank**
(`props/workbench.js`) mit den zwei Bildschirmen, gerade zur Kamera, weil die
Hütte selbst um 0,28 rad gedreht steht. Bildschirme sind Canvas-Zeichnungen
auf unbeleuchteten Flächen (`props/screens.js`); der Schein dahinter ist eine
additive Scheibe statt eines PointLights.

**Der Kontaktposten** (`props/contact-post.js`) hat Signal und Instagram
zusammengeholt: vorher Telefon unten am Weg, Fernrohr hinter dem Gipfel —
ein Gedanke an zwei Enden des Tals. Jetzt ein Holzpodest am Waldrand, wo der
soziale Weg nach Westen abknickt: links das gelbe Notruftelefon, rechts ein
pinkes Aussichtsfernglas, vorn zwei Tafeln wie an der Kasse. Gewählt hebt
sich der Hörer und über dem Kasten tippt eine Sprechblase; das Fernglas,
das sonst über den Wald schwenkt, dreht sich um und schaut einen an und
blitzt beim Öffnen. Lichtung nur 4,5 m, damit die Tannen dahinter bleiben.
Um 45° im Uhrzeigersinn aus der Kameraachse gedreht, entlang der Waldkante.

**Die drei Fenster** (Solana, Briefkasten, Kurzlink) tragen dasselbe Glas
(`dialogs.css` neu geschrieben, Code und Ids wie auf veerka.mp) und gehen
ohne Maus, siehe Abschnitt 7.

**Das Glas** (`.glass` in `style.css`) ist hell getönt, weil der Hintergrund
fast immer Schnee ist — klares Glas auf Weiß ist unsichtbar. Es ersetzt das
frühere Pistenschild auf ausdrücklichen Wunsch.

## 4a′. Übersicht, Talkarte und Schnellreise

Am hinteren Rand des Startplatzes (`PANORAMA` = −7,65, 20,65, genau hinter dem
Namen im Schnee; der Fackelkranz lässt dort eine Lücke) steht die
**Panoramatafel** (`props/map-board.js`): Vordach mit Schnee, Eiszapfen,
Schneewehen, Neigung 0,9 rad, rechts eine Lawinenwarnleuchte (Doppelblitz) über der **Lawinenwarnstufe des Tages** (`lawinenstufe()`): aus dem
Datum gezogen, für alle gleich, 1 an 56 %, 2 an 25 %, 3 an 12 %, 4 an 5 %,
5 an unter 1 % der Tage (über zehn Jahre nachgerechnet). Die Leuchte
blinkt erst ab Stufe 2, ab 4 schneller. `?lawine=4` erzwingt eine Stufe. Vorher stand sie als Pult bei (4, 24)
zwischen den Wegweisern im Platz. Die Karte ist **aus der Welt gemalt** (`world/valley-map.js`): Relief
aus `terrainHeight()` mit Licht von oben links und Höhenlinien alle 2,5 m,
Wald aus den echten Baumstandorten, See, Pisten, Wege, Lift. Gedreht wie die
feste Kamera, nach unten um 0,72 gestaucht. Gemalt wird **einmal** (1200 × 900,
rund 450 ms beim Aufbau); Pult (`boardMap`: Papiergrund, Titel, Ortsnamen) und
Übersicht teilen das Grundbild — vorher kostete das erste Öffnen noch einmal
461 ms, jetzt 4 ms.

Die Tafel ist eine Station (`id: 'talplan'`, `map: base`). **`M` überall**
öffnet die Übersicht (`menu/map-menu.js`) auf dem Reiter **Links**,
**Enter an der Tafel** auf dem Reiter **Talkarte**; `Tab` wechselt.

- *Kopf*: Name und der tippende Untertitel von veerka.mp (dieselben sieben
  Sätze, `SAETZE`). Bewusst nur hier – als Schild oder im Schnee wäre es
  Laufschrift.
- *Links*: die Kachelseite von veerka.mp (Wortlaut und Reihenfolge von dort)
  in Gruppen Karriere, Kontakt, Geld senden, Meine Tools, Außerdem. Klick
  oder Enter öffnet direkt; jede Kachel trägt „im Tal: Werkstatt“ usw. und
  bringt einen per Klick oder Leertaste hin. Die Adressen hängen weiter an
  den Stationen (`registry.open(station, pick)`), nicht ein zweites Mal im
  Menü. Fenster (Solana, Upload, Kurzlink) schließen die Übersicht vorher;
  wer sie mit Esc oder × schließt, ist wieder in der Übersicht auf derselben
  Kachel (ein `close`-Horcher in der Capture-Phase des Dokuments).
  Spotify und Komoot stehen nur hier (noch kein Platz im Tal).
- *Talkarte*: links die Karte mit Pins und „Du“, rechts die Legende,
  gruppiert nach den Wegen wie die Links (Karriere, Kontakt & Gipfel,
  Tools), dann Lifte und Orte (Start, Gipfel, Funpark, Hütte, See).
  In den *Links* stehen Gruppen mit mehr als zwei Zielen (die Tools) in
  zwei Spalten über die Breite von zwei Gruppen.
- *Fuß*: die ganze Steuerung.

Pfeiltasten gehen im Register räumlich (nächste Zeile in Richtung,
seitlicher Versatz zählt 2,5-fach). In der Karte gilt: ↑↓/←→ wählen (am Ende bleibt die Auswahl stehen — der
Sprung nach oben passierte außerhalb des sichtbaren Teils und sah aus wie
ein Fehler), Enter reist, Esc/M schließen; am Handy Ziel oder Pin antippen,
geöffnet über den Kartenknopf. **Drohne und Löschzug fehlen absichtlich** — sie sollen gefunden
werden. Die Reise ist ein Versetzen hinter einer hellen Blende, keine Fahrt;
man steht mit dem Rücken zur Kamera vor der Station, der Ankunftspunkt weicht
Kollisionskreisen aus (Werkbank vor der Werkstatt). Alle 15 Ziele geprüft:
richtige Station aktiv, kein Hindernis, 0 Bilder in der Luft.

**Hinweise und R** (`menu/hints.js`): Beim Start steht unten dezent,
ohne Glas, „M Übersicht & alle Links“ mit hellem Hof und langsamem Atmen –
anklickbar, sie bleibt, bis die
Übersicht einmal offen war oder man 30 s gefahren ist. **`R`** bringt von
überall zum Start (derselbe Weg wie die Schnellreise, `travelTo`) – außer
die Slalomzeit ist noch eingeblendet – im Lauf und 6 s nach dem Ziel
(`race.zeitSichtbar`): dann geht es
6 m über den Startbogen, ein laufender Lauf wird ohne Wertung abgebrochen
(28.09., auf Ansage). Die
Hinweis „R Zurück zum Start“ erscheint, wenn man festgefahren ist (4 s lang
Gas oder Lenkung, unter 4 m/s und keine 3 m vorangekommen) oder sich
verfranzt hat (7 s abseits jedes Weges mit ≥ 3 Bäumen im Umkreis von 4 m),
und geht nach 2 s freier Fahrt wieder. Am Handy ohne Tastenzeichen, der
Start-Hinweis entfällt dort (Kartenknopf).

**Linkliste ohne Tal** (27.09., auf Ansage): Wer kein WebGL oder kein
JavaScript hat, sah vorher nur den Ladebalken – die alte Kachelseite ging
ohne beides. Jetzt steht eine schlichte Liste mit denselben zwölf Kacheln
wie im Reiter Links da, im Hell der Ladeblende und mit den Wegfarben.
`menu/kacheln.js` hält die Kacheln als reine Daten (jede mit `link`, dem
Schlüssel in `LINKS`), `menu/linkliste.js` macht daraus HTML, und ein
Vite-Plugin (`vite.config.js`) setzt es beim Bauen an die Marke
`<!-- linkliste -->` in `index.html` – fehlt die Marke, bricht der Build
ab. Damit stehen alle Links auch für Suchmaschinen im Quelltext. Ohne
JavaScript schaltet ein `<noscript>`-Stil die Liste ein, ohne WebGL
`main.js` (Klasse `ohne-3d`, der Fehler bleibt in der Konsole). Das
Aussehen steht inline in `index.html`, weil `style.css` im Entwickeln am
Skript hängt; `:root` in den Selektoren hebt die Regeln über die gleich
starken in `style.css`. Drohne, Löschzug und Quelle fehlen auch hier.
`solana:` öffnet keinen neuen Tab (der bliebe leer). Geprüft mit
Headless-Chrome: ohne JS, mit `--disable-3d-apis`, am Handy (390 px) und
normal (Liste verborgen). Tests: `tests/linkliste.test.js`.

**Symbole** (27.09., auf Ansage die Kombination): Im Tab die Schneeflocke
der Ladeblende (`favicon.svg`, dazu `favicon-32.png` und `favicon.ico` für
Browser und Crawler ohne SVG-Favicon), auf dem Homescreen der Skifahrer aus
dem Spiel (`apple-touch-icon.png` 180, `icon-192/512.png` über
`site.webmanifest`). Der Skifahrer war als Tab-Symbol bei 16 px nur ein
bunter Fleck, die Flocke bleibt lesbar. Die Figur wird mit
`tools/skifahrer-icon.mjs` aus der laufenden Seite gerendert (Headless-
Chrome, `window.__ski`), damit sie nach neuen Farben oder goldenen Ski
wieder passt; die kleinen Größen macht `sips -z`.

`Skier.versetzen(x, z, heading)` ist der eine Weg, den Fahrer umzusetzen:
Spurkette reißen, `_prevGroundY` auf die **neue Bodenhöhe** (nicht `null` —
`null` zählt als 0, und an 9 von 15 Zielen hob der Fahrer ab), `_rise` null.

## 4a″. Pistenpass

`menu/pistenpass.js` (Listen, Speicher, Meldung) und `menu/pass-regeln.js`
(wann was fällt). Dritter Reiter **Pistenpass** in der Übersicht hinter `M`.
Speicher: `localStorage` `skiportfolio.pass`. Zurücksetzen:
`__ski.pass.zuruecksetzen()`.

**Die erste Fassung (37 Abzeichen, 14c573f) war zu viel** – für fast alles
kam eine Pille, und Pizza (5 s S halten) bekam jeder beim Anhalten. Ansage:
weniger, schwierigere, statt Abzeichen fürs Hinkommen ein Erkundungsstand.
Jetzt drei Teile:

- **Erkundet** (still): 15 Orte – die neun Stationen (erreicht =
  `registry.active`), See, Gipfel, Hüttenterrasse, Funpark, Kinderland
  (auf dem Teppich), Nordabfahrt (bis unten). Ein Balken und Namensmarken,
  Drohne und Löschzug als „???“. **Keine Pille pro Ort**, nur beim letzten.
- **Slalom-Medaillen** 4,50 / 4,20 / 3,90 (`MEDALS`), mit Meldung.
- **Abzeichen** (8): offen *Raser* (58 km/h am Speedcheck – mit gerader
  Ideallinie gemessen 59–60, 60 hätte nur ein Autopilot) und *540er*.
  Geheim, nur „?“ ohne Hinweis: 720er, Hausverbot (vier Seitenwechsel am
  Tellerlift, `rider.offset` über ±1,1), Seebank zerlegt, unten in der
  Klamm, eine Minute nichts gedrückt, 0–5 Uhr.

Nie ein Abzeichen fürs **Benutzen** (Hochladen, Wallet, Kurzlink,
Bezahlen) – sonst Datenmüll und Cent-Beträge für einen Stempel.

Meldung oben links (oben Mitte ist die Zeitnahme, unten Trick und Hinweise),
geht nach 3 s. Am Handy rutscht sie unter die Zeit, solange die Zeitnahme
steht – Medaillen kommen genau dann, und nebeneinander passt es nicht. Die Umrechnung von Spielständen der ersten Fassung
(`ALT_ORTE`) ist mit beta weggefallen: auf veerka.mp beginnt jeder neu,
`localStorage` gilt je Adresse.

**Goldene Ski**: alles erkundet + Slalom-**Silber** + Raser + 540er (Gold
ausdrücklich nicht – Julians eigene Bestzeit war 4,18). `Skier.vergolden()`.
Die normalen Ski sind seit 26.09. **gelbgrün** (vorher gelb – Gold sah dann kaum
anders aus). Metall ohne Umgebungsbild wurde nur ocker, deshalb Emission mit langsamem Schimmer und ein **Goldstaub-Schweif**
(zweite `Spray`-Instanz, 260 Teilchen). Additiv war er auf Tagschnee weiß,
Größe 0,16 ergab aus 33 m zwei Pixel – jetzt normal gemischt, 0,45–0,75.

## 4a‴. Drohnen-Rundflug und Ticket

An der **Skikasse** gibt es als dritte Wahl ein **Rundflug-Ticket**
(`stations/ticket.js`, `localStorage` `skiportfolio.rundflug`, `3` wählt
direkt). Umsonst und immer nur eins – ein Stapel wäre eine Währung. An der
**Drohne** (jetzt eine Station mit Auswahl: Uniprojekt / Rundflug) wird es
entwertet; ohne Ticket schüttelt sich die Wahl (`action` gibt `false`
zurück, `ui.nope`) und der Untertitel sagt „Ticket an der Skikasse lösen“.
Untertitel dürfen dafür Funktionen sein (`ui.refresh`).

Der Flug (`player/drone-flight.js`): 17 handgesetzte Punkte, jeder mit
eigenem Blickziel – Plateau von Süden, Löschzug und See, Werkzeuge von
Westen, hoch zum Gipfel (46 m), hinter den Berg auf Nordabfahrt und Klamm,
über Hütte und Funpark zurück. 511 m, 12 m/s, mit je 4 s Anfahr- und
Bremsrampe ≈ 47 s. Die Untergrenze (Gelände + 8 m, neun Proben im Umkreis
von 5 m) wird über ein Fenster maximiert und dann gemittelt, damit die
Drohne nicht über jeden Hügel hüpft; gemessen nie unter 7,6 m. In Kurven
bis 0,22 rad Schräglage, Bildwinkel 62°. Die abgestürzte Drohne ist
während des Flugs unsichtbar (sie ist ja in der Luft). Schatten, Himmel
und Schneefall folgen dem Blick der Drohne statt dem Fahrer. Esc/Enter/M/R
oder Tippen beenden; hinterher `chase.snap()`. Die Aussicht-Regel im
Pistenpass zählt den Flug nicht mit. Der Rundflug ist der einzige Ort, an
dem man den Horizont und damit die **ferne Bergkette** sieht (Abschnitt 4);
Horizont im Bild bei 2–6 s, 14 s, 20–22 s, 38–42 s und in der Landung.

Kosten: im Flug bis 561 Draw Calls und 912 k Dreiecke (man sieht mehr vom
Tal als von oben), 0,005 ms je Update.

**Bezahlen mit dem eigenen Solana-Token** ist besprochen, nicht gebaut:
im reinen Frontend wäre es nur Deko (jeder setzt das Ticket in der
Konsole). Echt ginge es nur mit einem Worker, der die Überweisung auf der
Kette prüft und ein signiertes Ticket ausstellt – und auch dann läuft der
Flug selbst im Browser. Dasselbe gilt für ein **Slalom-Scoreboard**: ohne
Server-Plausibilität (Zeitstempel, Torfolge, Mindestzeit) ist jede Zeit
fälschbar.

## 4a⁗. Slalom-Bestenliste

Server: `worker/slalom.js`, Spiel: `menu/bestenliste.js`. Der Worker
springt nur für `/` und `/api/*` an (`run_worker_first`), alles andere
bleibt Asset. Gleicher Host wie das Spiel – kein CORS, kein DNS. D1
`skiportfolio-slalom` (Schema in `worker/migrations/`; die Einträge aus
der beta-Zeit sind mit umgezogen). Geheimnis `SLALOM_GEHEIM` als Secret
(beim Umzug neu erzeugt; es signiert nur Marken, die höchstens eine
Viertelstunde gelten), lokal in `.dev.vars`.

Ablauf: Startbogen → `POST start` (signierte Startmarke), Ziel → `POST ziel`
(Zielmarke mit beiden Serverzeiten). Nur wenn beides klappt, steht acht
Sekunden „⏎ In die Bestenliste“ unter der Zeitnahme; Enter (oder Tippen)
öffnet ein Fenster mit Name, danach Platz und Liste (nur bei neuer
Bestzeit, siehe unten). Gefragt wird nie.
Reiter **Bestenliste** in der Übersicht (M): Treppchen für die ersten drei,
Zeilen bis Platz 20, beste Zeit je Name der letzten 30 Tage, eigene
Einträge umrandet (`skiportfolio.slalom.eigene`), unten „Zum Slalom-Start“.

Eintragen darf man **jede** Zeit, angeboten wird es aber nur bei einer
**neuen eigenen Bestzeit** in diesem Browser (`lastRun.bestzeit`, der
erste Lauf zählt immer). Ansage 27.09.; eine Fassung „nur unter 5 s“ war
dazwischen kurz live.

Gegen Schummeln (bewusst nur „mühsam“, beweisen lässt sich im Browser
nichts): Serveruhr zwischen den Marken muss zur Fahrzeit passen (−0,8 bis
+0,6 s), Zeit ≥ 3,4 s (Autopilot 3,58–3,62), Strafzeit und vier steigende
Zwischenzeiten stimmig, jede Marke einmal, 40 Einträge je Adresse und Tag,
Namen 2–16 Zeichen mit Sperrliste. Wer Anfragen mit passenden Pausen
skriptet, kommt durch. Tests: `tests/slalom-worker.test.js`.

Löschen: `npx wrangler d1 execute skiportfolio-slalom --remote --command
"DELETE FROM fahrten WHERE name = '…'"`. Lokal: `npm run dev:api` (Eintrag
`api` in `.claude/launch.json`, baut vorher einmal), vite reicht `/api` an
8787 durch. Die lokale D1 liegt unter `.wrangler/`; zwei `wrangler dev`
gleichzeitig sperren sich dort gegenseitig (SQLITE_BUSY) – ein zweiter
braucht `--persist-to` in ein eigenes Verzeichnis.

## 4a⁵. Gefrorene Quelle: Broadcast im Eis

Seit 27.09. zeigt die Felsquelle am oberen Seeufer, was gerade auf
broadcast.veerka.mp läuft. Die Quelle ist mitten im Fallen erstarrt
(`props/frozen-fall.js`), und im Eis steckt die Sendung: Bild oder Text.
Videos liefen nicht zuverlässig und sind seit 27.09. wieder draußen; eine
Sendung nur mit Video zeigt den Dateinamen. Vorher hing dort nur ein Vorhang aus 13 Zapfen.

**Maße (zweite Runde, 27.09.):** 5,2 × 4,4 m. Der Fuß steht 1,9 m draußen
auf dem Seeeis, und der Fall reicht die Böschung hinauf bis zu ihrer Kante
(2,8 m Gefälle auf 3 m). Gerahmt ist er von zehn Findlingen: je drei an den
Seiten und vier im Sturz oben, alle mit Zapfen und Schneehaube. Die drei
Findlinge der alten Felsquelle sind darin aufgegangen. Mehr als 0,5 rad
Neigung geht nicht, sonst stößt die Böschung durchs Eis (nachgerechnet
über die ganze Breite).

**Versteckt, mit Absicht:** kein Ring im Schnee, nicht auf der Karte
(`VERSTECKT` in `map-menu.js`), nicht im Pistenpass. Aus der Kamerahöhe
sieht man nur einen bereiften Felsen mit Eis und einem Hauch Farbe.
**Sichtbarkeit nach Entfernung** (Ansage 27.09.): Auf der vorderen Hälfte
des Sees, bis 19 m vom Fuß, ist das Bild ganz klar. Bis 30 m taut der Reif
wieder zu (smoothstep). Die Seemitte liegt 18 m vom Fuß entfernt. Seitlich
zählt jeder Meter 1,6-fach: Stechuhr und Abkürzung liegen 21 und 26 m weg,
aber genau seitlich. Dort war das Bild schon klar, gewünscht war es erst
„ein Stück weiter links“. Gewichtet sind es jetzt 34 und 41,5 m, das Eis ist
dort zu. Es taut etwa 5 m hinter der Stechuhr Richtung See auf. Enter
zoomt heran und taut immer ganz auf. Enter öffnet broadcast.veerka.mp, und
Eiskristalle steigen auf.

**Das Bild steckt im Eis:** Parallaxe (0,035 in UV) setzt es hinter die
Oberfläche, der Reif verwischt es über die Mip-Stufen, und zum Fensterrand
hin verliert es sich. Aufgetaut liegt **nichts** darüber: Rinnen, Risse,
Blasen, Restreif und der wandernde Glanzstreif sind über dem Bild auf
Wunsch weg (27.09.). Sie blieben nur im Eis drumherum; den Glanzstreif gibt
es gar nicht mehr.
Die Einladung („Gefrorene Quelle · Gerade auf Sendung“ bzw. „Funkstille“)
schwebt 3,2 m vor dem Fuß auf dem Eis (`labelAt` in der Station, `ui.js`).
Am Fuß verdeckte sie das untere Drittel des Bildes. Die rote Lampe des Funkturms (wie auf der
Broadcast-Seite) atmet rechts im Eis, solange gesendet wird, und leuchtet
auch durch den Reif. Der Schein auf dem Schnee hat die Mittelfarbe des Bildes.
Die Fläche lehnt 0,5 rad zurück: bei 36° Kamerahöhe bleiben 86 % der
Bildhöhe statt 59 %.

**Sendeturm (27.09.):** Links hinter der Quelle steht ein kleiner rot-weißer
Gittermast mit Hütte, Schüssel und Warnlicht (`props/radio-tower.js`,
`TOWER_OFFSET` in `landscape-details.js`: 4,9 m links, 1,4 m hangauf). Mit
3,4 m ist er kleiner als der Eisfall (4,4 m), damit er ihm nicht die Schau
stiehlt, und er steht vor den Tannen statt dazwischen. Beim ersten Versuch
(5,6 / 3,2 m) steckte er im Wald und war vom See aus kaum zu finden. Das
Licht blitzt alle 1,6 s, auf Sendung alle 0,8 s. Nur auf Sendung wandern
rote Funkbögen von der Spitze weg, in der Bildebene. Sie sind rot, nicht
additiv, weil Licht vor Schnee nur weiß wird. **Einseitig**, nie
`DoubleSide` bei transparenten Materialien: three.js zeichnet sie dann
zweimal und baut dafür jeden Frame den Shaderschlüssel neu. Die sechs Bögen
taten das 12-mal je Frame; das gab alle 1–2 s einen Ruckler.

**Daten:** `worker/broadcast.js` reicht `/api/broadcast/state` (nur `message`,
20 s Cache) und `/api/broadcast/file?key=` (mit Range) durch.
Der Broadcast-Dienst schickt keinen CORS-Kopf, und WebGL nimmt fremde
Bilder nicht als Textur. Am Dienst selbst ist nichts geändert.
Durchgelassen werden nur Schlüssel in der Form des Dienstes und nur
JPEG/PNG/WebP/GIF/AVIF. Kein SVG, denn das könnte unter dem Namen des
Spiels Skript ausführen. Kein Ton, denn das Tal bleibt still. Tests:
`tests/broadcast-worker.test.js`.
Gefragt wird erst, wenn der Fahrer näher als 55 m kommt, danach höchstens
einmal pro Minute. Bilder werden im Browser auf 1280 px verkleinert (das
erste Testbild hatte 2,6 MB). Mehrere Anhänge wechseln alle 8 s. Kurzer Text (≤ 140 Zeichen) läuft als Zeile
unter dem Bild, langer bekommt eine eigene Folie vor dunklem Tiefenwasser.
Zum Prüfen: `__ski.props.broadcast.zeigen({ id, text, createdAt,
expiresAt, attachments: [] })` legt eine erfundene Sendung ins Eis.

## 4a⁶. Badesteg und Kabelsee: in den Sommer

Seit 01.10. (Branch `kabelsee`, noch nicht auf `main`) steht am Nordufer des
Eissees ein **Badesteg**. Vorn auf dem Steg Enter: der Fahrer stellt sich an
die Spitze, die Kamera fährt heran, **3 – 2 – 1**, das Eis reißt vom Steg
aus, und bei null **verwandelt sich die Welt** in den Kabelsee – Wasserski
am Kabel rund um eine Insel. Man steht auf dessen Startsteg, der Bügel kommt
gleich, und es geht los. Nach drei Runden: noch eine Session (Enter), in die
Bestenliste (B, nur bei neuem Rekord) oder **zurück in den Winter (Esc)**.
Esc geht jederzeit, am Handy die Schneeflocke oben rechts (dort, wo im Tal
der Kartenknopf sitzt). Wunsch von Julian, 01.10.: ein Countdown, keiner
am See; die Verwandlung als Überraschung am Ende.

**Der Kabelsee ist eingezogen.** Er war ein eigenes Repo (`Kabelsee`,
`kabelsee.veerka.mp`); seine Geschichte hängt über einen Subtree-Commit
hier an (`git log -- src/kabelsee` zeigt nur die Zeit danach, die alten
Commits stehen unter `kabelsee-import/` im Baum von `4c7babe`). Eine
Codebasis, kein Nebeneinander (Ansage):

- `src/kabelsee/` – der See wie vorher, nur ohne eigenen Renderer.
  `see.js` baut ihn als Baustein (`createKabelsee`), `main.js` ist der
  Einstieg der eigenen Seite **veerka.mp/kabelsee/** (vite baut beide
  Seiten, `kabelsee/index.html`). `README.md` darin beschreibt das Spiel.
- Gemeinsam: `core/` (rng, noise, point-scale waren gleich, `assemble()`
  streicht Normalen/UVs nur, wenn Teile sonst nicht zusammenpassen) und
  `src/basis.css` (Glas, Frost, Tasten).
- Getrennt mit Absicht: Eingabe und Touch (`kabelsee/core/`). Am See
  gibt es Wippen statt Daumenstick, und die Tasten bedeuten anderes.
- Die Anzeige des Sees hängt unter `.kabelsee-hud` – beide Spiele haben
  `.trick-hud`, `.hint`, `.fade`.

**Die Regeln des Sees** (aus seinem alten CLAUDE.md) gelten weiter: feste
Kamera (Azimut 45°, 36°), `kabelsee/world/heightfield.js` ist dort die
einzige Höhenquelle; was man befährt, steht in `features.js`, was man sieht,
in `props/obstacles.js`, aus denselben Profilen; das Fahrmodell bleibt ohne
three.js und DOM; die Bahn hält 16 m zum Ufer und 24 m zur Insel (Test);
Ringe und Slalomfahnen hängen am gemessenen Fahrmodell – wer Seiltempo,
Schwerkraft oder Absprung ändert, misst beides nach.

**Ablauf** (`src/sommer/sommer.js`, Zustände winter → countdown → hin →
sommer → zurueck → winter):

- Der **Badesteg** steckt im Höhenfeld (`BADESTEG` in `heightfield.js`):
  6,8 m lang, 2,2 m breit, 45 cm über dem Eis – so hoch steht die Böschung
  1,2 m hinter der Uferlinie, dort setzt er an. Man befährt ihn und hüpft
  vorn aufs Eis. Holz, Pfähle, Leiter und Rettungsring mit Wasserski-Hantel
  liegen nur darauf (`props/badesteg.js`). Er zeigt nach Süden, zehn Grad
  nach Westen: im Bild nach links unten wie der Startsteg am Kabelsee.
  Genau radial zur Seemitte lag er im Bild waagerecht. `surfaces.js` hält
  Spur und Staub vom Holz fern (Test in `surfaces.test.js`).
- **Station** `kabelsee` vorn auf dem Steg, Radius 2,6 m, ohne Ring im
  Schnee. Keine Auswahl: der Countdown ist die Vorführung.
- **Countdown**: Fahrer gleitet in 0,7 s an die Spitze, Kamera auf **26 m**
  heran – so weit steht die Kamera des Kabelsees am Startsteg, mit
  gleichem Winkel und gleicher Brennweite; im Moment der Verwandlung sind
  beide Fahrer gleich groß am selben Fleck. Zahl als Frosttext. Risse im
  Eis (`risse()` in `props/lake.js`) wachsen mit jedem Schlag bis 9,5 m,
  zum Ende leuchtet türkis Wasser durch. Esc bricht ab.
- **Nachladen**: in 30 m Umkreis wird das Modul geholt (33 kB See, 2 kB
  Verwandlung), nach Enter gebaut – in Scheiben (`core/zeitscheiben.js`),
  am Stück wären es 450 ms (370 davon das Gelände mit 145 000 Ecken), also
  ein Ruck mitten im Countdown. Freigegeben wird mit `scheduler.yield`/
  MessageChannel, nicht mit rAF: im verdeckten Fenster (1 Bild/s) zog sich
  der Bau sonst über eine Minute. Dann `compileAsync`. Gemessen: 0,6 s bis
  fertig, im Entwicklungsmodus. Der See bleibt danach gebaut.
- **Ein Renderer**: der See zeichnet im Kontext des Tals, kein iframe, kein
  zweiter WebGL-Kontext. Schatten PCF wie im Tal (PCFSoft meldet r185
  ohnehin als veraltet).
- **Verwandlung** (`src/sommer/verwandlung.js`), 1,8 s: beide Welten in je
  eine Fläche (HalfFloat, 4× MSAA, linear), ein Bild mischt und macht am
  Ende ACES und sRGB – so sehen beide aus wie sonst. Zwei Arten zum
  Vergleichen, Julian konnte sich nicht vorstellen, welche besser wirkt:
  **Tauwelle** (Standard): vom Fahrer aus läuft ein ausgefranster Tauring
  über das Bild, am Rand Brechung, kühler Schein, Glitzer.
  **Abtauchen** (`?verwandlung=tauchen`): Kamera stürzt aufs Eis, heller
  Blitz mit Ring, Sommer taucht aus der Nähe auf. Zurück läuft dieselbe
  Verwandlung rückwärts, Mitte ist dann der Fahrer im Sommerbild.
  Die Anzeige des Sees blendet erst ab 60 % ein.
- **Bügel**: 2,8 s nach Beginn der Verwandlung, ohne zweiten Countdown
  („Gleich kommt der Bügel“). Mit 1,6 s kam er noch in der Verwandlung,
  und man wurde vom Steg gerissen, bevor man den See sah. Wer den Start
  verpatzt, bekommt einen neuen Bügel mit der gewohnten Anzeige des Sees.
- Solange Sommer ist, **steht das Tal still** (kein Schritt, kein Bild),
  seine Anzeigen sind weg (`:root.sommer` in `sommer.css`, eine Regel
  statt einer Liste), seine Tasten gehören dem See (`sommer.taste()`).
  Danach steht der Fahrer wieder vorn auf dem Steg und rollt aufs Eis.

**Bestenliste**: `worker/kabelsee.js`, Tabelle `kabelsee` in derselben D1
(`0002_kabelsee.sql`). Marken wie beim Slalom (geteilt in `worker/marken.js`,
mit `k: 'kabelsee'`, damit keine Slalom-Marke gilt). Startmarke beim Start
am Steg, Zielmarke nach Runde drei; dazwischen mindestens **80 s** (drei
Runden = 3 × 438 m bei 15 m/s = 88 s), höchstens 20 min, höchstens
250 000 Punkte und **2 500 je Sekunde** (Rekord beim Bau: 7 690). Angebot nur
bei neuem eigenen Rekord in diesem Browser (`kabelsee.best`, derselbe
Schlüssel wie auf der eigenen Seite). Der Name ist derselbe wie am Slalom.
Reiter **Bestenliste** der Übersicht: Slalom, darunter Kabelsee mit „Zum
Badesteg“. Die eigene Seite /kabelsee/ hat keine Bestenliste.

Zum Prüfen: `__ski.sommer.starten()` vor dem Steg (oder
`__ski.goto('kabelsee', 0, 0)`), dann `__ski.step(…)`; der See liegt danach
unter `__ski.sommer.see` (`rider`, `session`, `step` gibt es dort als
`advance`). Für Bilder im verdeckten Fenster `requestAnimationFrame` leer
setzen, sonst läuft die Schleife zwischen den Aufnahmen weiter.

## 4b. Handymodus

Erkannt über `pointer: coarse` ohne feinen Zeiger, oder über einen Android-/
iOS-Browser mit Touchscreen (`core/device.js`): Samsungs mit S-Pen (Fold 6)
melden sonst `any-pointer: fine` und blieben beim Tastenmodus. Zum
Prüfen am Rechner mit `?touch` erzwingbar; dann trägt `<html>` die Klasse
`touch`.

- **Daumenstick** (`core/touch.js`): erscheint dort, wo der Finger den Schnee
  berührt, und lenkt **bildschirmbezogen** — Daumen nach oben heißt im Bild
  nach oben. Mit fester Kamera ist ein Wohin auf dem Bildschirm genau eine
  Himmelsrichtung; der Stick regelt nur den Winkelfehler zur Fahrtrichtung
  aus (`GAIN` 2.1). **Auf der Nordabfahrt ist er ein Lenkrad**: dort dreht
  die Kamera mit, und bildschirmbezogen hieß jeder seitliche Daumen „weiter
  drehen“ — das Ziel wanderte mit dem Bild, man fuhr Kreise. Hinter dem
  Fahrer ist die Seitenlage der Einschlag (weich in der Mitte: 15 px ≈
  0,45 rad/s, voll ≈ 3,9 rad/s), nach unten gezogen rollt man aus;
  übergeblendet mit `chase.verfolgt`. Schub ab 35 % Ausschlag, loslassen =
  ausrollen. Zieht
  der Daumen weit hinaus, wandert der Stick mit. Geprüft mit echten
  Pointer-Ereignissen: oben/rechts/unten-links kommen als oben/rechts/
  unten-links an.
- **Sprungknopf** nur im Funpark oder auf der Rail, gehalten statt getippt.
- **Kartenknopf** oben rechts, nur am Handy (dort gibt es kein `M`), weg,
  solange Karte, Auswahl oder Lift offen sind. Das einzige Bedienelement,
  das immer da ist — auf ausdrücklichen Wunsch.
- **Solana** öffnet am Handy wie auf veerka.mp direkt die Wallet-App
  (`solana:`-Link); bleibt die Seite 1,6 s sichtbar, weil keine App da ist,
  kommt doch das Fenster mit der Empfehlung.
- **Zwei Finger** zoomen. Ein Tipp in den Schnee schließt eine offene Auswahl.
- Im Schnee steht statt WASD ein Stickzeichen, unten einmal ein Hinweis, der
  beim ersten Berühren verschwindet.
- **Hochformat**: bei 390 × 844 sah man vorher nur 18° breit. Der Bildwinkel
  wächst bis 56°, den Rest holt der Abstand (≤ 1,35×). Pixelverhältnis am
  Handy höchstens 1,5.

## 4c. Hosting und Dienste

**veerka.mp** ist der Cloudflare-Worker `website` mit statischen Assets,
verbunden mit dem GitHub-Repo `Savo2610/Julians-Website`. **Jeder Push auf
`main` wird von Workers Builds gebaut und veröffentlicht** (`npx wrangler
deploy`; der `build`-Eintrag in `wrangler.jsonc` lässt vorher vite laufen,
`.node-version` hält Node 24). Von Hand: `npm run deploy`. `veerka.mp` und
`www.veerka.mp` hängen als Custom Domains am Worker; www leitet mit 301 auf
veerka.mp um (`worker/index.js`), weil Pistenpass, Bestzeit und Ticket im
`localStorage` liegen und der je Adresse gilt.

**Es gibt keine Vorstufe mehr.** beta.veerka.mp (Worker
`skiportfolio-test`) war der Testbetrieb bis zum Umzug und ist seit dem
27.09. gelöscht (Ansage). Ausprobiert wird lokal: `npm run dev`, für den
Worker `npm run dev:api` – der baut vorher und liefert dann auf 8787 die
ganze Seite so aus wie veerka.mp.

**Arbeitsweise** (Ansage 26.09., für veerka.mp bestätigt 27.09.: jede
fertige Runde sofort live, ohne Rückfrage): Tests und Build, deutsch
committen, Commit-Nummer hier im Verlauf nachtragen, `git push` auf `main`.
Danach prüfen, dass veerka.mp dieselbe `assets/index-*.js` ausliefert wie
`dist/` – Workers Builds braucht dafür etwa 40 Sekunden. Schlägt der Build
fehl, bleibt der alte Stand online; den Fehler zeigt der Check
„Workers Builds: website“ am Commit auf GitHub.

**Cache**: `public/_headers` gibt `/assets/*` ein Jahr (die Dateinamen
tragen einen Hash). Die Startseite setzt der Worker selbst auf `no-cache` –
die Regel dafür in `_headers` griff nicht mehr, sobald der Worker für `/`
antwortet.

**Die fremden Dienste**, geprüft am 27.09. von veerka.mp aus:

| Dienst | Im Code | Was freigegeben sein muss | Stand |
|---|---|---|---|
| Kurzlink (s.veerka.mp) | `dialogs/kurz.js` | `TURNSTILE_HOSTNAMES` im Worker `kurz` und Domainliste des Turnstile-Widgets „kurz“ | veerka.mp und www eingetragen; Turnstile löst sich, der Knopf wird „Kürzen“ |
| Upload (upload.veerka.mp) | `dialogs/upload.js` | `CORS_HERKUNFT` im Worker `upload` | veerka.mp und www: Preflight 204; fremde Herkunft 405 |
| Solana | `dialogs/wallet.js` | nichts – publicnode, CoinGecko und Binance antworten mit CORS `*` | geprüft |
| Broadcast | `worker/broadcast.js` | nichts – der Worker holt serverseitig | geprüft |
| Bestenliste | `worker/slalom.js`, `worker/kabelsee.js` | D1-Bindung und Secret `SLALOM_GEHEIM` am Worker; für den Kabelsee die Tabelle aus `0002_kabelsee.sql` (remote anlegen, siehe 9) | Slalom am Worker `website`, Kabelsee noch nicht |

Die Repos der Dienste liegen unter `~/Git/` (`kurz`, `file-uploader`,
`broadcast`). In beiden Hostlisten und im Turnstile-Widget steht noch
`beta.veerka.mp` – harmlos, weil dort nichts mehr läuft; beim nächsten
Deploy des jeweiligen Dienstes kann es mit raus. **Wer dort deployt, prüft die Hostlisten**: im Repo `kurz`
stand einmal nur `s.veerka.mp`, live schon drei Hosts – ein Deploy aus dem
Repo hätte das Kurzlink-Fenster hier still ausgesperrt. Beim Solana-Fenster
ist der tote Ersatz-RPC leorpc entfernt; ohne Schlüssel trägt sonst keiner
(mainnet-beta 403, drpc 400, onfinality 429).

Auf localhost zeigen Upload und Kurzlink auf `localhost:8788`/`8790` (ihr
Entwicklungszweig) und melden ohne die Worker daneben
`ERR_CONNECTION_REFUSED`. Das ist gewollt.

## 5. Fahrmodell

Kein Physiksimulator — ein Fahrgefühl aus wenigen Zahlen (`config.js` → `SKIER`).
Grundtempo 13, bergab bis 18, mit Shift gekantet 6.5. Der Fahrer pendelt von
selbst um seine Zielrichtung (`swingAmplitude` 0.55 rad, Wellenlänge 18), damit
aus der Spur eine Schlangenlinie wird, ohne dass man dauernd lenkt.

**Sprünge** sind der heikelste Teil. Der Fahrer bekommt seine Höhe aus der
Steigrate des Bodens (`_rise`), nicht aus einem Absprungimpuls: übersteigt die
Steigrate 3.2 und läge die ballistische Bahn über dem Boden, geht er in die Luft
mit `vy = min(_rise − G·dt, 14)`. `G = 18`, `airDrag = 0.16`.

Gemessen am großen Kicker: 1.18 s Flugzeit, 3.37 m Höhe, 12.3 Einheiten weit
bei 12.5 Einheiten Landung.

**Daraus folgt: Halfpipes funktionieren in diesem Modell nicht.** Der Fahrer
behält beim Steigen seine Richtung — eine Wand gibt nicht zurück, was sie nimmt,
sie wirft einen *hinaus*. Gemessen: Absprung bei Versatz 4.5, Landung bei 9–16.
Zusätzlich reichte die Auslaufzone der Überhöhung unter den Zauberteppich und
kippte ihn. Der Versuch wurde vollständig zurückgebaut; ein Kommentar in
`heightfield.js` hält beide Gründe fest. **Airtime nur über Kicker mit Landung,
die in Fahrtrichtung werfen.**

Tricks liegen alle auf der Leertaste — am Boden Slide, in der Luft Drehung —
und nur im Funpark (`inFunpark(...)`).

**Haltung** (`_applyPose` in `skier.js`) liegt nur auf der Darstellung, das
Fahrmodell merkt nichts davon. Die Ruhelage ist pixelgleich zur alten Figur;
dafür hängt jedes Bein an seiner Hüfte (`legSides`, Drehpunkt `HIP`).

- **Abfahrtshocke** (`tuck`) ab Tempo 13,3, voll bei 17 — mit W fährt man in
  der Ebene genau 13, sonst hockte er immer. Gemessen am Lenken, nicht an
  `turn`: die Schwünge allein treiben `turn` auf 0,87. Vom Gipfel ≈ 9 % der Zeit.
- **Schräg zum Hang** (`cross`, Quergefälle gegen lokales +X): die Ski
  liegen immer auf dem Hang, jedes Bein so lang, dass der Schuh auf seiner
  Bindung bleibt. Knie zum Berg, Gegenneigung der Schultern und Bergski vorn
  sind nur **angedeutet** und hängen an `poise` (0 bergauf und unter Tempo 4,
  voll ab Tempo 10 bergab). Die volle Kommaform (Hüfte 20 cm zum Berg) war
  richtig und sah übertrieben aus, bergauf wie kurz vor dem Umfallen —
  Ansage: sachter, keine Skisimulation.
- **Pflug** mit S: Schaufeln zusammen (`ploughYaw` 0,21, ab 0,22 stoßen die
  Schaufeln an), Innenkanten,
  Arme leicht raus, breitere Spur und Schneestaub an den Enden.
- **Ski mittig**: bis 26.09. lag jeder Skikörper 7,5 cm neben seiner
  Bindung (Extrusion nicht zurückgesetzt, seit dem ersten Commit).
- **Am Tellerlift** wird der benutzte Teller erst **nach** `skier.update()`
  gespannt (`lift.spannen`). Vorher hing er um den Weg eines Bildes zurück
  (12 cm bei 60 fps) und flackerte bei schwankender Bildrate. Ein Umbau mit
  Sitzpunkt im Fahrer und greifender Hand (d187faf) ist wieder zurück –
  Ansage: angedeutet reicht, so wie es war.

---

## 6. Werkzeug zum Prüfen

`window.__ski` = `{ skier, world, camera, renderer, scene, trail, props, sky,
input, chase, stations, interaction, mapMenu, hints, glints, pass, regeln,
goldstaub, flight, bestenliste, step, goto }`. `goto('kasse')` stellt den
Fahrer vor eine Station (Ids in `stations.js`).

`S.step(frames, dt)` spult die Welt ohne laufenden rAF-Loop vor — unentbehrlich,
denn **rAF läuft nicht, solange das Browser-Fenster verborgen ist**.

Weitere Fallen aus der Praxis:

- Der Konsolenpuffer wird beim Navigieren **nicht** geleert; alte Fehler stehen
  dort noch. Nicht darauf hereinfallen.
- Der Ladebalken verschwindet erst mit dem ersten rAF — im **verborgenen**
  Browserfenster also nie. Das waren die „30–45 s Ladezeit“ früherer Notizen;
  sichtbar ist die Seite nach knapp zwei Sekunden da. Zum Testen
  `document.getElementById('loader')?.remove()`.
- Tasten zum Prüfen: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }))`
  — sie laufen durch denselben synchronen Weg wie echte.
- CSS-Übergänge laufen im verborgenen Fenster nicht weiter. Für Screenshots
  `*{transition:none!important;animation:none!important}` einhängen.
- `computer zoom` schneidet nicht zu. Für kleine UI stattdessen
  `resize_window({width, height})`, danach `resize_window({preset:'desktop'})`.
- `setTimeout` ist im verborgenen Fenster etwa doppelt so langsam.
- Nach einer Dateiänderung hängt Vite `?t=...` an die Modul-URL. Ein
  dynamischer `import()` derselben Datei liefert dann eine **zweite Instanz** —
  Singletons prüft man über `window.__ski`, nicht über einen eigenen Import.
- Für Rechnungen ohne Browser: eine Wegwerfdatei `./_m.mjs` im **Projektwurzel-
  verzeichnis** (node findet `three` aus dem Scratchpad heraus nicht).
  `heightfield.js` selbst importiert kein `three` und lässt sich deshalb auch
  aus einem Skript im Scratchpad heraus direkt importieren — der bequemste Weg,
  Höhen, Quer- und Längsprofile zu messen.
- **rAF läuft weiter, sobald das Browserfenster sichtbar ist**, und verschiebt
  den Fahrer zwischen zwei Werkzeugaufrufen. Für reproduzierbare Messungen
  `window.requestAnimationFrame = () => 0` setzen. Umgekehrt hängt
  `await new Promise(r => rafOrig(r))` im verborgenen Fenster ewig.
- Screenshots, die im selben `browser_batch` hinter einem JS-Aufruf stehen,
  zeigen das **vorige** Bild. JS und Screenshot immer getrennt aufrufen –
  und auch dann kam bei gestopptem rAF etwa jedes dritte Bild noch einmal
  veraltet. Im Zweifel ein zweites Mal auslösen.
- Einen festen Moment im Rundflug anfahren (für Vorher-nachher-Bilder):
  Flug einmal mit der echten Drohne starten
  (`S.flight.start(S.stations.stations.find(s => s.label === 'Abgestürzte Drohne').object)`),
  gut eine Sekunde warten, dann `f._t = t - 1/60; f._roll = 0; f._kurs = null;
  S.step(1)`. Rollwinkel und Kurs hängen sonst am vorigen Bild.
- Die Lenkung im Autopiloten: `forward = (sin h, cos h)`, positiver
  Winkelfehler heißt Heading **erhöhen**, und das ist **links**. Zweimal
  falsch herum gebaut.
- Nach einem Versetzen des Fahrers `_prevGroundY` und `_rise` zurücksetzen,
  sonst erzeugt der Sprung in der Höhe einen riesigen `_rise` und der Fahrer
  hebt ab (einmal 94 Bilder Scheinflug gemessen).

---

## 7. Die drei Fenster

`src/dialogs/dialog.js`, `wallet.js`, `upload.js` und `kurz.js` stammen
**unverändert von der früheren Kachelseite** (dort `public/*.js`, zuletzt
`def8f43`); einzige Änderung: Turnstile steht in `kurz.js` auf
`theme: 'light'`. Früher galt „nicht umbauen, nur austauschen“, damit beide
Seiten abgleichbar blieben. Seit dem Umzug gibt es nur noch diese Fassung –
der Grund ist weg, umbauen ist erlaubt. `dialogs.css` ist das Glas des Tals,
nicht mehr das dunkle Violett von dort. Die drei `<dialog>`-Elemente stehen
in `index.html`, geladen werden die Module erst beim Benutzen der Station.

- **Solana** (`wallet.js`) sucht Wallet-Erweiterungen über den Wallet
  Standard, baut die Überweisung als rohe Bytes selbst und gibt sie der
  Wallet zum Signieren und Senden. Betrag in SOL oder Euro, gesendet wird
  immer SOL. Ohne Wallet steht dort eine Empfehlung (Solflare). Am Handy
  öffnet die Kasse direkt die Wallet-App (Abschnitt 4b).
- **Briefkasten** (`upload.js`) ist upload.veerka.mp in klein: Dateien
  wählen oder hineinziehen, Fortschritt, dazu ein Textfeld. Gesprochen wird
  direkt mit der API dort (CORS, Abschnitt 4c). Anonym gelten 50 MB pro
  Datei; für mehr führt ein Link auf die volle Seite. Lokal muss der
  Uploader daneben laufen (Port 8788) mit `DEV_HERKUNFT` auf diese Seite in
  seiner `.dev.vars`, sonst gingen Probe-Uploads in den echten Speicher.
- **Kurzlink** (`kurz.js`) ist s.veerka.mp in klein; der fertige Link landet
  gleich in der Zwischenablage. Turnstile wird erst beim Öffnen des Fensters
  nachgeladen. Es gelten die öffentlichen Limits: 5 Links pro Minute, 20
  pro Tag. Der QR-Code bleibt auf der vollen Seite. Lokal läuft der
  Kurzlink-Worker auf 8790; Turnstile geht dort nur mit den Testschlüsseln
  (README im Repo `kurz`).

**Tastatur** (`dialogs/keyboard.js`): wird nach dem Öffnen darübergelegt.
Fokus gleich im Feld (Betrag, Dateiwahl, Adresse) statt auf dem
Schließen-Knopf; Enter sendet im Betrag, ↑↓ gehen die Betragsvorschläge
durch, ⌘/Strg+Enter sendet im Textfeld der Rohrpost, Esc schließt. Unten eine
Tastenzeile wie unter der Stationsauswahl. Beim Schließen wird der Fokus
abgegeben — sonst löste das nächste Enter im Spiel den Knopf erneut aus. Am
Handy kein Autofokus, sonst klappt sofort die Tastatur hoch.

---

## 8. Was verworfen wurde

Alles hier wurde gebaut, geprüft und auf Ansage wieder entfernt. **Nicht erneut
anfangen, ohne zu fragen.**

**Halfpipe** (siehe Abschnitt 5). Der Fahrmodell-Grund ist strukturell, nicht
eine Frage der Abstimmung.

**Ton** (Commits `c218775`, `00075fe`, entfernt in `112902f`). Zwei Anläufe:

1. Voll synthetisiertes Web Audio — rosa Rauschen durch einen tempoabhängigen
   Tiefpass, Kantenband beim Schwung, leiser Windteppich, Landeschlag, Klopfen
   für umgestoßene Pfosten, pentatonische Tonleiter auf der Schussstrecke.
   Urteil: *„hört sich leider nicht gut an, einfach nur nach nervigem Wind"*.
2. Nachgebessert: Windteppich ersatzlos gestrichen, aus dem Tiefpass ein
   Hochpass bei 700 Hz gemacht (gefiltertes Rauschen unter 400 Hz *ist* Wind),
   Band 1200→2400 Hz, Deckel bei 4800 gegen das Zischen, Körnung mit Audiorate,
   echte Stille unter 1.3 m/s (gemessen 0.0 RMS im Stand gegen 0.025 in Fahrt).
   Messbar sauber — und trotzdem nicht gewollt.

Urteil: **das Skigebiet bleibt still.** Wer Ton doch noch will, findet die
komplette Anlage in `git show c218775:src/audio/audio.js`.

**Gefrorener Bach zur Quelle** (27.09., Commits `1e0a99e` und `44010bd`,
entfernt auf Ansage). Er kam vom Westrand herunter und lief durch eine
Kerbe im Steinsturz in den Eisfall. Dafür gab es ein Bett im Höhenfeld
(`BACH`) und einen Schwemmkegel über dem Graben hinter der Böschungskante.
Die erste Fassung war unbeleuchtet und türkis und sah aufgemalt aus. Die
zweite hatte Seefarben, Licht und Schatten und einen ausgefransten Rand,
hat aber trotzdem nicht überzeugt. Zurück auf den Stand `vor-fluss`. Der
Code steckt in `git show 44010bd`.

**Schwung auf der Rückseite** (29.09., Branch `schwung-rueckseite`, nie
gepusht, auf Ansage gelöscht). Tempo aufsummiert statt Zieltempo (Hang,
Reibung, Luft, Kurven; W nur bis 13 m/s), dazu Kante und zwei Wellen auf der
Nordabfahrt, ein gespannter Absprung mit Timing und Landungen, die nur den
Anteil entlang des Hangs behalten, ohne automatische Schwünge. Gemessen
5,72 statt 6,12 s. Urteil: *gefällt nicht*. Damit ist auch Skicross auf
dem heutigen Fahrmodell vom Tisch; die Rückseite bleibt offen (Ideen in
Abschnitt 1, Nordabfahrt).

---

## 9. Offen

- **Spotify** (`https://stats.fm/savo`) und **Komoot**
  (`https://www.komoot.de/user/464140060326`) haben noch keinen Platz im Tal
  (in der Übersicht stehen sie schon, unter „Außerdem“).
  Vom Nutzer ausdrücklich zurückgestellt, aber noch zu tun. Vorschlag aus der
  letzten Sitzung: Spotify auf die Terrasse der Après-Ski-Hütte („Höre was ich
  höre"), Komoot als Gipfelbuch am Gipfelkreuz („Wandern & Radfahren").
- **Die Rodelbahn als Slalom** (`race.js`): 17 statt 13 m breit, zwei
  Stützpunkte 1 m nach links gerückt (rechts Fels und Wald bei 8 m), die
  Pistenkanone 3,2 m auf die Piste versetzt. Vier Tore, streng im Wechsel
  links/rechts, gleichmäßig verteilt (≈ 13 m), 4,6 aus der Mitte, Nachsicht
  0,5 — vorher traf man sie, indem man in der Rinne blieb. (Fünf Tore im
  kürzer werdenden Rhythmus, in Kurven nach innen, waren zu unruhig.) Das nächste Tor glimmt im Schnee,
  getroffen blitzt grün, verfehlt rot (+2 s). Zwischenzeiten gegen die
  Bestzeit, Bestzeit in `localStorage` (`skiportfolio.slalom`). Medaillen
  Gold 3,90 / Silber 4,20 / Bronze 4,50 (26.09.). Ein Testfahrer mit
  Vorausschau schafft 3,58 s, aber Julians Bestzeit nach Tagen Übung war
  4,18 – die alten Grenzen 3,60 / 3,85 / 4,20 waren für Menschen zu eng. **Die Strecke dauert nur gut drei
  Sekunden** — länger ginge nur mit einer neuen Trasse.
- **Slalomtore** kippen bewusst *nicht* um — sie sind Fahnenblätter, keine
  Pfosten. Angeboten, keine Antwort. Falls doch gewünscht, siehe
  `createPisteMarkers` in `props/fence.js` als Vorlage.
- **Frost statt Pillen, Register, Stempel, Fenster** sind seit 29.09. in
  `main`, vorher nur in Chrome und der Handy-Emulation geprüft. Noch in
  Safari ansehen: `backdrop-filter` zusammen mit `mask-image` am Hauch.
  Zurücknehmen lässt sich alles mit einem `git revert -m 1` auf den
  Zusammenführungs-Commit.
- Handymodus größtenteils nur in der Emulation geprüft. Auf dem echten
  Handy bestätigt (30.09.): Heranzoomen und die Ausfahrt des Löschzugs
  samt Blende. Sonst Safari-Eigenheiten (Adressleiste, `100vh`) dort
  ansehen.
- **Rohrpost** (seit 30.09. in `main`) ist nur in Chrome und mit dem
  lokalen Uploader geprüft. Auf dem iPhone ansehen: Vorschau eines Fotos
  (Safari liest HEIC, Chrome nicht – dort bleibt nur der Text).
- Die Nordabfahrt liegt seit `b3fcf57` in `main`. Zusammengeführt wurde mit
  `--no-ff`, damit sie an einem einzigen Commit hängt: `git revert -m 1 b3fcf57`
  nimmt sie komplett wieder ab. Der Zweig `rueckseite` ist gelöscht (er war
  vollständig in `main`).
- **Aufbauten auf gewölbtem Gelände** stehen mit einem Bein in der Luft, wenn
  sie nur an einem Punkt platziert werden: `world.place()` kennt genau eine
  Höhe. Das Tor hat es getroffen (0,85 m Luft), der Steg auch (1 m). Wer etwas
  Breites oder Langes setzt, misst das Gelände an dessen Enden und gibt es dem
  Bauteil mit — so wie `fuss` beim Tor und `neigung` beim Steg.
- **Kabelsee (Branch `kabelsee`) vor dem Zusammenführen:**
  1. Julian probiert lokal (`npm run dev`, für die Bestenliste zusätzlich
     `npm run dev:api` nach `npx wrangler d1 migrations apply
     skiportfolio-slalom --local`) und entscheidet **Tauwelle oder
     Abtauchen** (`?verwandlung=tauchen`). Die andere fliegt dann raus.
  2. **Vor** dem Push auf `main` die Tabelle in der echten D1 anlegen:
     `npx wrangler d1 migrations apply skiportfolio-slalom --remote`. Ohne
     sie antwortet `/api/kabelsee/*` mit 500, das Spiel zeigt dann einfach
     kein Angebot und keine Liste.
  3. `kabelsee.veerka.mp` ist noch der alte Worker `kabelsee` aus dem alten
     Repo. Vorschlag: dort auf `veerka.mp/kabelsee/` umleiten (oder die
     Custom Domain an den Worker `website` hängen) und das Repo `Kabelsee`
     auf GitHub archivieren. Nicht gemacht – das ist außen sichtbar und
     braucht ein Ja.
  4. Nur in Chrome geprüft, verdecktes Fenster, Bild für Bild gespult. Auf
     dem echten Handy ansehen: Bildrate während der Verwandlung (zwei
     Welten mit MSAA), Speicher mit beiden Welten.
  5. Im Sommer gibt es kein `M`; die Übersicht kommt erst wieder im Winter.
- Die Wände der Klamm zeigen aus der Nähe **facettiertes Dreiecksschattieren**.
  Aus dem Fahrbetrieb heraus fällt es nicht auf, aus einer bodennahen
  Standaufnahme schon. Nicht untersucht.

---

## 10. Verlauf

Die Historie der Kachelseite hängt seit dem Umzug über einen
Zusammenführungs-Commit an `main` (`git log def8f43`); die Commit-Nummern
des Tals sind dabei gleich geblieben.

```
39a4402  Badesteg am Eissee: Countdown, Verwandlung, Kabelsee im Tal   (Branch kabelsee)
ee24ba8  Kabelsee einsortieren: ein Repo, ein Kern, zwei Seiten         (Branch kabelsee)
4c7babe  Kabelsee mit seiner Geschichte hereinholen (Subtree)            (Branch kabelsee)
9e19c9f  Ferne Bergkette: zwei Grate, die sich im Himmel aufloesen (Merge)
e298036  Rohrpost verschickt: Kapseln, Maulwurf zum Funkmast, Vorschau im Eis (Merge)
6c5cb7d  Stationen mit Auftritt: Stechuhr, Depot und Loeschzug zoomen heran (Merge)
225c7c1  Oberflaeche ohne Pillen: Frost, Leuchtfeld, Register, Stempelheft (Merge)
be201b3  Auswahl nebeneinander mit Leuchtfeld, keine Linien mehr zum Anklicken
f670e31  Farbwort, antippbare Stationen, Register, Stempelheft, Fenster ohne Kaestchen
d0e551b  Frost statt Pillen: Anzeigen ueber dem Tal ohne Behaelter
098f9df  R zum Slalom-Start nur bei eingeblendeter Zeit
2b284bf  R im Slalom fuehrt zum Slalom-Start
459c2d5  Symbole: Schneeflocke im Tab, Skifahrer auf dem Homescreen
9887de5  Linkliste fuer alle ohne WebGL oder JavaScript
f84b84f  beta.veerka.mp geloescht, Runden gehen direkt auf main
984dd9c  Das Skital wird veerka.mp (#1, Merge auf GitHub)
38da8fd  Das Skital loest die Kachelseite auf veerka.mp ab (Merge)
711bee8  Dokumentation fuer veerka.mp: README, Uebergabe, CLAUDE.md
ee6f87a  Seite heisst wieder Julian Veerkamp
b41208f  Worker aufgeteilt, www-Umleitung, Betrieb auf veerka.mp vorbereitet
93aab7c  Aufraeumen: Menues, Anlagen und Bereiche in eigene Ordner
6a4679f  Ruckler auf Retina: Schneerelief aus Rauschtextur, 4,2 Mio. Pixel
5ef97dc  Ruckler behoben, Video aus der gefrorenen Quelle entfernt
f208498  Kleiner Sendeturm links hinter der gefrorenen Quelle
56ca9ab  Bach wieder entfernt, zurueck auf vor-fluss
44010bd  Bach wie der See: beleuchtet, ausgefranst, breiter
1e0a99e  Gefrorener Bach vom Gebirgsrand in die gefrorene Quelle
00c2813  Gefrorene Quelle: erst ab dem See sichtbar, Pille vor dem Eis, ohne Schleier
fefc225  Gefrorene Quelle gross, im Felsrahmen, klar vom See aus
596e0e5  Gefrorene Quelle: laufende Broadcast-Sendung im Eis am See
e9aa98a  Bestenliste: jede Zeit erlaubt, Angebot nur bei neuer Bestzeit
885762b  Bestenliste nur fuer Zeiten unter 5 Sekunden
23abd92  Slalom-Bestenliste mit Worker und D1
76c527f  Drohnen-Rundflug mit Ticket von der Skikasse
50f83d6  Ski gelbgruen statt gruen
356771b  Ski gruen, Gold nur mit vollem Pistenpass
2dcbc33  Pistenpass verschlankt: Erkundet, Medaillen, acht Abzeichen
14c573f  Pistenpass: Abzeichen fuers Finden und Koennen, goldene Ski
90c450a  Wegweiser auf Federfuss
4defffc  Ski mittig unter die Bindung
d7621fa  Slalom: Medaillen 3,90 / 4,20 / 4,50
6e37e07  Tellerlift wieder wie vorher, nur ohne Flackern
9d2bf4d  Wegweiser: Pfeile gerade statt schraeg
25bb595  Leuchtschleier nur noch in 20 m um den Start
d187faf  Tellerlift: Teller nicht mehr im Fahrer
8434c9f  Hanghaltung sachter, bergauf gar nicht
772b26b  Abfahrtshocke, Kommaform am Hang, Pflug beim Bremsen
047d51d  Panoramatafel 1,2 m nach rechts
0e7217d  Wegweiser aus dem Kinderland an den Karriereweg
58c16e7  Pfeiltafeln, Lawinenwarnstufe des Tages, leisere Schleier
4b59df2  Moderne Markierungen, Leuchtschleier, Esc zurueck in die Uebersicht
d95967a  Uebersicht fuer Nichtspieler, R zum Start, Zaun, Lawinenschutz
bea0c1b  Werkstatt hangab, Karte scrollt unter der Maus nicht zurueck
46fd15d  Werkstatt naeher am Start, Loeschzug am Waldrand
7edb46f  Slalom: vier Tore streng im Wechsel
2423356  LinkedIn vorn, Slalom, Lenkrad auf der Nordabfahrt, Steg eben
cf0e3cf  Kontaktposten, Stechuhr hinter die Abkuerzung, Seebank, Tastatur
24841cc  Talkarte aus der Welt gemalt, Schnellreise-Menue
debe2c1  Fenster im Glas, toter Solana-Ersatzknoten entfernt
69349de  Hosting auf beta.veerka.mp
7845cc0  Aufraeumen, Hosting vorbereitet
805b372  Enter statt Ziffern: Glas, Heranzoomen, Safari-Fix, Handymodus
493ad64  Wegenetz, Landschaft, Huettenensemble und Seebucht
b3fcf57  Nordabfahrt ueber die Rueckseite des Berges (Merge, --no-ff)
a7fa99a  Uebergabe: richtige Commit-Nummer im Verlauf
4a92a7a  Steg auf das Gelaende gelegt, zweiter Gipfel weg, Tor ohne Namen
f3e3591  Klamm mit Holzsteg auf der Nordabfahrt
2769ab9  Rueckseite ausgestalten: Wald, Grat, Felsriegel, Wildspuren
6f1a356  Startbogen und Verfolgerkamera auf der Nordabfahrt
bbea97d  Rueckseite des Berges: Nordkar und Trasse der neuen Abfahrt
d40ba74  Uebergabe: HANDOVER.md und CLAUDE.md
112902f  Ton wieder entfernt
00075fe  Ton: kein Wind mehr, Stille im Stand, Schnee im Mittenband
c218775  Sounddesign: Schneeteppich, Landung, Klopfen, Tonleiter
02c0f85  Echte Links von veerka.mp, ihre drei Fenster, Stationskarte als Pistenschild
f0ff74a  Umkippbare Pistenstangen, Auswahl an der Werkstatt, Kanone an der Piste
870d8dc  Umstossbare Fackeln, Stechuhr am Tools-Weg, mehr Airtime
```

Commits sind deutsch, erklären das Warum und nennen gemessene Zahlen. Sie enden
mit `Co-Authored-By:`-Zeile des jeweiligen Modells.
