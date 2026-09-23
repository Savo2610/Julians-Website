# Skiportfolio — Übergabe

Stand: 12.09.2026, Commit `112902f`. Dieses Dokument ist der Einstieg für jeden,
der hier weiterarbeitet. Es beschreibt nicht nur *was* da ist, sondern *warum* —
denn an mehreren Stellen sieht die naheliegende Lösung besser aus als die
gewählte, und ist es nicht.

---

## Korrektur nach Rueckmeldung: Oberflaechen und Huettenensemble 22.09.2026

Diese Fassung ersetzt die rechteckige Terrasse und den westlichen Standort
im folgenden Eintrag. Die Huette steht jetzt **rechts bei (23, -64)**, weiterhin
mit der Front zur festen Kamera. Ein gemeinsamer lokaler Grundriss verbindet
Haustuer und asymmetrischen Terrassenfluegel zur Piste. Die Dielen werden an
der neuneckigen Kontur zugeschnitten; keine frei liegende rechteckige Platte.
Drei Sitzgruppen, zwei an der Fassade angeschlossene Lichterketten und nur
hangseitige Bruestungen bilden einen zusammenhaengenden Vorplatz. Die linke
Piste bleibt frei. Funparkschild aus dem Vorplatz an die Piste versetzt und
seine im Brett verschwundene Beschriftung korrigiert; Wegweiser trennt jetzt
Huette und Park mit passenden Pfeilen.

**Ursache der weissen Spuren:** Der Fahrer stempelte auch auf Eis und Holz
in die Schneetextur. Deren aufgeworfener Rand ragte durch die nur 1,2 cm hoeheren
Belagsmeshes. `surfaces.js` teilt jetzt die echten See- und Terrassenkonturen
mit Spurerzeugung, Schneestaub und Terrain-Displacement. Sicherheitsabstand
fuer Skibreite und Spurrand; die Spurkette wird beim Materialwechsel getrennt.
Der Shader sperrt Verformung unter festen Oberflaechen zusaetzlich. Eisfarbe
staerker abgesetzt; kein Schneestaub auf Eis oder Holz.

Verifikation: `node --test tests/surfaces.test.js` (drei Regressionstests)
prueft Materialgrenzen, unterbrochene Spuren und bewegliche Moebel. Im Browser
mit echtem Fahrmodell und echten gerenderten Spuren gefahren: Eis und Holz
jeweils **0 Stempel**, Schneestrecke **98 Stempel**. Zu- und Ausfahrt erreichen
ihr Ziel; die Ausfahrt endet auf den Parkwellen (0,43 m Airtime), Eis/Holz/
Zufahrt bleiben am Boden. Sichtpruefung nach den Fahrten: kein weisser Belag
auf dem Holz, umgefahrene Moebel reagieren. Produktionsbuild und Diffpruefung
bestanden. Temporaere Browser-Pruefseite wieder entfernt.

---

## Huette, Terrasse und Seebucht 22.09.2026

Die Huette steht jetzt am westlichen Rand des Parkzugangs bei (0, -63),
mit unveraenderter Schauseite zur festen Kamera. Die alte erhoehte Terrasse
und ihre grosse Kollisionsscheibe sind entfernt. `apres-layout.js` legt eine
13 × 11 m grosse, leicht geneigte Bodenflaeche fest. `apresGround()` formt sie
nach den Pistenbaendern; der Holzbelag folgt derselben Hoehenfunktion mit
1,2 cm Abstand. Vier Schneezungen, getragene Lichterketten, ein sichtbares
Fenster und eine Tuer verbinden Haus und Vorplatz. Zwei sichtbare Musikboxen;
kein Ton, entsprechend der bestehenden Entscheidung.

`apres-terrace.js` baut drei Tische und sechs Baenke. Fahrtkontakt wird auf dem
letzten Bewegungssegment geprueft; Moebel rutschen und kippen entsprechend
Fahrtrichtung und Tempo. Gedrehte Stuetzpunkte nehmen das lokale Gelaende ab.
Die Moebel bleiben zehn Sekunden liegen und richten sich erst wieder auf,
wenn der Fahrer mindestens sieben Meter von Objekt und Stellplatz entfernt
ist. Keine neue Physikbibliothek. Ruhende Moebel ueberspringen Hoehenproben.
Debug: `window.__ski.props.apresTerrace.bodies` und `.hits`.

Die Seeoberflaeche lag bisher ueber unebenem Boden; zusaetzlich hob der
Gebirgsrand Teile des Eises um bis zu 7,86 m an. Eine eigene kleine Seebucht
in `WORLD.basins` macht das gesamte Eis befahrbar. `lakeRadius()` teilt die
unregelmaessige Uferkontur zwischen Mesh und Hoehenfeld, Seehoehe -3 m,
weicher vier Meter breiter Ufersaum. Der Uferzaun steht jetzt ausserhalb des
Eises. Pistenstangen im Huettenbereich und der Wegweiser wurden versetzt bzw.
ausgespart, damit sie nicht in Haus und Durchfahrt stehen.

Pruefung: sechs Fahrten mit echtem `Skier.update()` und Weltkollision im
Browser; alle Ziele in 0,85–2,78 s erreicht, keine ungewollte Airtime.
Die freie Spur (7,8/-66 → 7,8/-53) hat null Moebeltreffer. Gezielte Fahrten
bewegen alle neun Moebel, Rueckstellung nach Entfernung mit < 1e-10 m Fehler.
Separat geprueft: kein Treffer vier Meter ueber dem Tisch; keine Rueckstellung
neben dem wartenden Fahrer. Radiale Seeproben: exakt 0 m Hoehenabweichung zum
Eisniveau (ausgenommen 1,2 cm sichtbarer Belag). Huette und See visuell im
Browser geprueft. `npm run build` und `git diff --check` erfolgreich.
Kein Git-Remote konfiguriert; externer Versionsabgleich weiterhin unmoeglich.

---

## Landschaftsupdate 21.09.2026

Auf Wunsch nach mehr Fahr- und Entdeckungslust (Referenz: Bruno Simons
befahrbares Portfolio) ist jetzt auch die Landschaft selbst gestaltet:

- `landscape-layout.js`: sechs niedrige Schneeruecken, drei sanfte Bodenwellen
  und drei Nebenstrecken (Waldpassage, Sonnenrunde hinter der Werkstatt,
  Uferweg). Die Formen sind maximal 2,8 m hoch und werden **vor** den
  bestehenden Pistenbaendern in `terrainHeight()` addiert.
- Die Nebenstrecken teilen Wald-Freihaltung und Schnee-Praeparierung mit dem
  Wegenetz. Der Talplan zeigt sie ebenfalls, weitere Schilder brauchen sie
  nicht. 20 gezielt gesetzte Baeume gliedern die sechs kleinen Haine; kahle
  Laerchen ergaenzen die Tannen. Die Schneekappen der Tannen sind laenger und
  weniger scheibenfoermig.
- `landscape-details.js`: gefrorene Felsquelle am oberen Seeufer, Bank am
  Uferweg und reaktive Schneeschauer an den Hainbaeumen. Ein gemeinsamer
  Puffer mit 180 Partikeln, Ausloesung bei Fahrt innerhalb 3,6 m, danach 12 s
  Sperre. `window.__ski.props.landscape` liefert `treeCount` und `bursts`.
- Waermeres Sonnenlicht, etwas kuerzere Schatten, ruhigere Schnee-Normalen und
  700 statt 1400 Wetterflocken lassen die Formen deutlicher lesen.

Pruefung im Browser: alle drei Wege in beide Richtungen mit echtem
`Skier.update()` und automatischer Lenkung befahren. Alle sechs Fahrten kamen
in 3,3–4,4 s ohne Kollision an. Dabei wurden vier Schneeschauer ausgeloest.
Zusaetzlich alle Mittellinien alle 0,5 m gegen die echten Kollisionskreise plus
0,55 m Fahrerbreite geprueft: keine Treffer. Der umgefallene Stamm musste aus
der Waldpassage auf den angrenzenden Ruecken weichen, die Uferbank neben die
Fahrspur. Die Quelle erhielt eine Lichtung, weil sie sonst ganz verdeckt war.

Hoehenvergleich gegen `HEAD`: Stuetzpunkte plus 3-m-Nachbarschaften aller fuenf
Pistenbaender unveraendert; auch die Stegmitte hat exakt dieselbe Hoehe.
Laengsprofile der neuen Wege maximal 25,4 / 35,5 / 7,9 Grad (die Sonnenrunde
quert auch den bestehenden Plateaurand). Diese Zahlen sind Stichproben und
keine Aussage ueber jeden Quadratmeter des Gelaendes.
Sichtkontrolle von Talmitte, Quelle/Ufer und Sonnenrunde; dort rund 302–361
Draw Calls und 840–854 k Dreiecke. Build und Diff-Pruefung erfolgreich.
Kamera, Fahrmodell, Stationsziele und die stillgelegten Ideen bleiben erhalten.

---

## Gestaltungsupdate 21.09.2026

Ausgangspunkt: lokales `main` auf `4851caa`. Kein Remote konfiguriert; ein
Abgleich mit einem externen Repository war daher nicht moeglich.

Das Tal hat jetzt ein gemeinsames Wegenetz statt vier isolierter Arme:
`src/world/paths.js` enthaelt die bisherigen `TRAILS` und sechs Verbindungen.
Werkstatt, Kontakt, Tools und Lift sind verbunden; schmalere Abzweige fuehren
zum See/Loeschzug und zur Drohne. Gipfelzugang und Parkanschluss folgen den
vorhandenen Haengen. Die Mittellinien steuern sowohl Waldschneisen als auch
die Praeparierung im Terrainmaterial (kuehlerer, glatterer Schnee mit weichem
Rand). Keine zweite Hoehenquelle, keine neue Kameraregel.

`src/world/wayfinding.js` baut einen niedrigen Talplan am Start und sechs
Wegweiser an Entscheidungen. Die Karte folgt der festen Kameraprojektion;
Pfeile beziehen sich ebenfalls auf die sichtbare Richtung. Alle Tafeln schauen
zur Kamera. Gedeckte Wegfarben und Holzpfosten ersetzen die bunteren Schilder;
Stangen stehen alle 9 statt 4,6 Meter, Bodenpfeile sind 1,5 statt 2,2 Meter
gross. Stationsringe treten erst beim Annaehern deutlich hervor. Der
Fackelkranz ist ausgeduennt, zufaellige Felsen konzentrieren sich staerker auf
Flanken und Waldrand.

Stationen werden jetzt **vor** der Bepflanzung auf flache Plaetze verschoben.
Ihre Lichtungen benutzen die korrigierten Koordinaten, nicht mehr die alten.
Neue Verbindungen enden vor den Stationsobjekten und umrunden den Loeschzug
sowie den westlichen Pfosten des Nordtors.

Pruefung: Startplatz, Tools/See-Abzweig und Nordabfahrt/Park im Browser
angesehen. Alle sechs neuen Verbindungen mit 0,5-m-Schritten gegen die echten
Kollisionskreise inklusive 0,55 m Fahrerbreite geprueft: keine Treffer.
Startansicht bei 1280 × 800: 339 Draw Calls, rund 837.000 Dreiecke.
Schildtafeln verwenden ein Material statt sechs, damit die neue Orientierung
nicht sechs Draw Calls pro Tafel kostet. Build und `git diff --check` erfolgreich.
Der temporaere Browser-Pruefeinstieg wurde wieder entfernt. Die im Browser
vorhandenen Three.js-Deprecation-Warnungen bleiben ein separates Thema.

---

## 1. Was das ist

Ein Three.js-Skigebiet, durch das man fährt, um Julians Links zu finden. Es
ersetzt die bisherige Kachelseite und läuft am Ende auf **veerka.mp selbst**.
Jede Station im Tal ist ein echter Link oder ein echtes Fenster.

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

**Die Kamera dreht sich nie** — mit genau einer Ausnahme, siehe unten.
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
Wer eine zweite Ausnahme erwägt: erst fragen.

**Es gibt genau eine Höhenfunktion.** `terrainHeight(x, z)` in
`src/world/heightfield.js` speist das Mesh *und* jede Kollisions- und
Platzierungsabfrage. Geometrie und Kollision können damit nie auseinanderlaufen.
Die Funktion **darf sich niemals selbst aufrufen** — deshalb sind die Höhen der
Pistenband-Stützpunkte feste Zahlen und keine Abfragen.

**Kommentare auf Deutsch, und sie erklären das Warum.** Meist mit einer
gemessenen Zahl belegt („bei Breite 9.5 zerfiel die unterste Reihe zu einem
Fleck"). Kommentare, die wiederholen, was der Code ohnehin sagt, gehören nicht
hinein.

**Minimale Oberfläche.** Es gibt keine Leiste, kein Menü, kein dauerhaftes
Symbol in der Ecke. Die Steuerung steht als Tastenstempel im Schnee
(`src/world/snow-writing.js`). Was sonst eingeblendet wird, verschwindet nach
ein bis zwei Sekunden von selbst.

---

## 3. Aufbau

```
src/
  config.js          Alle Stellschrauben: WORLD, SKIER, CAMERA, TRICK, COLORS
  main.js            Loop, Renderer, window.__ski (Debug-Zugriff)
  core/              geometry.js (assemble/vertexColorMaterial), input.js,
                     noise.js (fbm), rng.js
  world/
    heightfield.js   terrainHeight(), Pistenbänder, PLATEAU/SUMMIT/LAKE/SPORT_HILL
    terrain.js       Mesh aus der Höhenfunktion
    world.js         Szene, Licht, Nebel
    populate.js      Setzt alles ins Tal — die zentrale Werkbank (723 Zeilen)
    snow-trail.js    Spurkarte als Render-Target; stampDecal() stempelt hinein
    snow-writing.js  Schrift und Tastenstempel im Schnee
    drag-lift.js     Schlepplift (Teller, kein Sessel)
    magic-carpet.js  Zauberteppich im Kinderland
    rail-ride.js     Rail im Funpark, dieselbe Mechanik wie der Teppich
    race.js          Rennstrecke mit Zeitnahme
    speed-check.js   Geschwindigkeitsmessung an der freien Piste
    light-run.js     Leuchtstrecke (Schussstrecke) im Kinderland
    props/           Ein Modul je Gegenstand
  player/
    skier.js         Fahrmodell, Sprung, Tricks (489 Zeilen)
    skier-model.js   Die Figur
    top-camera.js    Verfolgerkamera
    spray.js         Schneestaub
  stations/
    links.js         Alle echten Adressen an einer Stelle
    stations.js      Wo was steht und was es tut
    registry.js      Nähe prüfen, auslösen
    ui.js            Die Stationskarte als Pistenschild
  dialogs/           Wortgleich von veerka.mp übernommen — siehe unten
```

**`assemble(parts)`** in `core/geometry.js` verschmilzt viele Primitive mit
Vertexfarben zu *einem* Draw Call. Alles, was sich nicht einzeln bewegt, gehört
da hinein. Was in Mengen auftritt und sich einzeln bewegt (Pistenstangen,
Leuchtsegmente), ist eine `InstancedMesh`.

**Kennzahlen im Betrieb:** 0.05–0.13 ms/Frame, 262–419 Draw Calls,
~800–835 k Dreiecke. Wer etwas hinzufügt, prüft das nach.

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
| `NORTH_LANE` | −58,−72 → 6,−65 — 80 m | Nordabfahrt über die Rückseite |

**Pistenbänder** (`makeLane` in `heightfield.js`): ziehen das Gelände entlang
einer Linie auf ein gleichmäßiges Gefälle. `reach = width*0.5 + feather`,
Gewichte `w = 1/(d⁴ + 0.05)` über alle Segmente gemischt, `endFade` blendet
beide Enden aus. Die Bänder werden **der Reihe nach** angewendet — das spätere
gewinnt auf seiner eigenen Mittellinie, deshalb steht `SHOOT_LANE` bewusst
zuletzt.

**Vier Wege** vom Plateau (`TRAILS` in `stations/stations.js`): BERUF (blau, nach
Osten), SOZIALES (pink, nach Norden), SPORT (orange, nach Nordosten), TOOLS
(grün, nach Westen). Jede Station liegt an genau einem Weg, damit man einen
Strang zu Ende fahren kann.

**Stationen** — alle verdrahtet, alle Adressen in `stations/links.js`:

| Station | Ort | Ziel |
|---|---|---|
| Werkstatt (Hütte) | 25, 21 | Auswahl: GitHub / LinkedIn |
| Skikasse | −40, −2 | Auswahl: PayPal / Solana (Wallet-Fenster) |
| Signal (Notruftelefon) | 2, 0 | signal.me |
| Instagram (Fernrohr) | −66, −74 | instagram.com |
| Arbeitszeitrechner (Stechuhr) | −15, 23 | stempelt, dann zeit.veerka.mp |
| Rohrpost | −19, 25 | Kapsel fliegt, dann Upload-Fenster |
| Abkürzung (Felstunnel) | −34, 15 | Kurzlink-Fenster |
| Packlisten-App (Depot) | −48, 0 | packliste.veerka.mp |
| Abgestürzte Drohne | 51, 20 | Uniprojekt |
| Löschzug (Feuerwehrauto) | −15, 43 | jf.veerka.mp |

Stationen mit zwei Zielen zeigen `1` und `2` auf der Karte; die Taste `E`
entfällt dann. Eine Station gilt als verdrahtet, wenn sie `url`, `onUse` oder
eine Auswahl mit Inhalt hat.

**Anlagen**: Schlepplift (Teller, damit der Fahrer auf den Ski bleibt und die
Spur weiterläuft), Zauberteppich im Kinderland, Rail im Funpark, Rennstrecke
mit Zeitnahme, Speedcheck an der freien Piste, zwei Schneekanonen, Leucht-
strecke, Après-Ski-Hütte mit Terrasse, Gipfelkreuz.

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

**Wann sie greift**, entscheidet `world/north-run.js` an der Bahnmitte und nicht
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

Rest: das Gelände weicht von der Ausgleichsgeraden um gut fünf Zentimeter nach
oben wie nach unten ab. Bei fünf Zentimeter dicken Ski und dreiunddreißig Metern
Kamerahöhe ist das nicht mehr zu sehen.

**Charakter**: dichter Wald (Dichte-Aufschlag über `nordDist`), Felsriegel auf
dem Grat, Wildspuren im Schnee (`stampTrack` in `snow-writing.js`, gestempelt in
`main.js`). Nichts zum Anklicken — das war die ausdrückliche Wahl.

**Spielereien**: Fackeln und alle Pistenstangen kippen um, wenn man sie
erwischt, und richten sich nach Sekunden wieder auf (Fackeln verlöschen dabei).
Die Schneekanone verfolgt den Fahrer mit dem Strahl, feuert aber nur manchmal
(Einschaltdauer 4 s, Sperre 8 s, Chance 50 %) und nie, während man am Teppich
oder am Lift hängt.

---

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

---

## 6. Werkzeug zum Prüfen

`window.__ski` = `{ skier, world, camera, renderer, scene, trail, props, sky,
input, chase, stations, step }`.

`S.step(frames, dt)` spult die Welt ohne laufenden rAF-Loop vor — unentbehrlich,
denn **rAF läuft nicht, solange das Browser-Fenster verborgen ist**.

Weitere Fallen aus der Praxis:

- Der Konsolenpuffer wird beim Navigieren **nicht** geleert; alte Fehler stehen
  dort noch. Nicht darauf hereinfallen.
- Der Ladebalken braucht 30–45 s (`writeIntro` + `renderer.compile`). Zum Testen
  `document.getElementById('loader')?.remove()`.
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
  zeigen das **vorige** Bild. JS und Screenshot immer getrennt aufrufen.
- Die Lenkung im Autopiloten: `forward = (sin h, cos h)`, positiver
  Winkelfehler heißt Heading **erhöhen**, und das ist **links**. Zweimal
  falsch herum gebaut.
- Nach einem Versetzen des Fahrers `_prevGroundY` und `_rise` zurücksetzen,
  sonst erzeugt der Sprung in der Höhe einen riesigen `_rise` und der Fahrer
  hebt ab (einmal 94 Bilder Scheinflug gemessen).

---

## 7. Die drei Fenster

`src/dialogs/dialog.js`, `wallet.js`, `upload.js`, `kurz.js` sind **wortgleich
von veerka.mp übernommen**, damit beide Seiten jederzeit abgeglichen werden
können. Nicht umbauen, nur austauschen. `dialogs.css` ist dieselbe CSS-Datei mit
der Palette auf `.dialog` statt `:root` und `'Space Mono'` durch `var(--mono)`
ersetzt. Die drei `<dialog>`-Elemente stehen in `index.html`, geladen werden die
Module erst beim Benutzen der Station.

Auf localhost zeigen Upload und Kurzlink auf `localhost:8788`/`8790` und melden
`ERR_CONNECTION_REFUSED` — das ist ihr gewollter Entwicklungszweig und löst sich
auf veerka.mp von selbst.

Solange das Portfolio noch nicht auf veerka.mp liegt, hängen Upload und Kurzlink
am Hostnamen. Beim Umzug gegenprüfen.

---

## 8. Was verworfen wurde

Beides wurde gebaut, geprüft und auf Ansage wieder entfernt. **Nicht erneut
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

---

## 9. Offen

- **Spotify** (`https://stats.fm/savo`) und **Komoot**
  (`https://www.komoot.de/user/464140060326`) haben noch keinen Platz im Tal.
  Vom Nutzer ausdrücklich zurückgestellt, aber noch zu tun. Vorschlag aus der
  letzten Sitzung: Spotify auf die Terrasse der Après-Ski-Hütte („Höre was ich
  höre"), Komoot als Gipfelbuch am Gipfelkreuz („Wandern & Radfahren").
- **Slalomtore** kippen bewusst *nicht* um — sie sind Fahnenblätter, keine
  Pfosten. Angeboten, keine Antwort. Falls doch gewünscht, siehe
  `createPisteMarkers` in `props/fence.js` als Vorlage.
- **Ladezeit**: 30–45 s bis zum ersten Bild, zwischen der Zuweisung von
  `window.__ski` und dem ersten rAF. Verdächtig sind `writeIntro` und
  `renderer.compile`. Nie untersucht.
- **Umzug auf veerka.mp** steht noch aus.
- Die Nordabfahrt liegt seit `b3fcf57` in `main`. Zusammengeführt wurde mit
  `--no-ff`, damit sie an einem einzigen Commit hängt: `git revert -m 1 b3fcf57`
  nimmt sie komplett wieder ab. Das war die Bedingung, unter der sie gebaut
  wurde; der Zweig `rueckseite` kann stehenbleiben.
- Das Fernrohr steht seit der Nordabfahrt auf **−66, −74** statt −59, −71: es
  stand sonst 1,4 m neben der neuen Bahnmitte, mitten im Startbogen. Von sechs
  gemessenen Ausweichplätzen hatte dieser das geringste Relief (0,35).
- **Aufbauten auf gewölbtem Gelände** stehen mit einem Bein in der Luft, wenn
  sie nur an einem Punkt platziert werden: `world.place()` kennt genau eine
  Höhe. Das Tor hat es getroffen (0,85 m Luft), der Steg auch (1 m). Wer etwas
  Breites oder Langes setzt, misst das Gelände an dessen Enden und gibt es dem
  Bauteil mit — so wie `fuss` beim Tor und `neigung` beim Steg.
- Die Wände der Klamm zeigen aus der Nähe **facettiertes Dreiecksschattieren**.
  Aus dem Fahrbetrieb heraus fällt es nicht auf, aus einer bodennahen
  Standaufnahme schon. Nicht untersucht.
- `_m.mjs` im Wurzelverzeichnis ist eine Wegwerfdatei aus dem Prüfbetrieb und
  kann weg.

---

## 10. Verlauf

```
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
mit `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
