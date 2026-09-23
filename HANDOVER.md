# Skiportfolio — Übergabe

Stand: 23.09.2026. Dieses Dokument ist der Einstieg für jeden, der hier
weiterarbeitet. Es beschreibt nicht nur *was* da ist, sondern *warum* — denn an
mehreren Stellen sieht die naheliegende Lösung besser aus als die gewählte, und
ist es nicht.

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
                     touch.js (Handymodus), device.js (TOUCH), noise.js, rng.js
  world/
    heightfield.js   terrainHeight(), Pistenbänder, PLATEAU/SUMMIT/LAKE/SPORT_HILL
    terrain.js       Mesh aus der Höhenfunktion
    world.js         Szene, Licht, Nebel
    populate.js      Setzt alles ins Tal — die zentrale Werkbank
    paths.js         Wegenetz: TRAILS und Verbindungen (Schneisen, Präparierung)
    wayfinding.js    Talplan und Wegweiser
    landscape-*.js   Schneerücken, Bodenwellen, Nebenstrecken, Quelle, Schauer
    surfaces.js      Wo Eis und Holz liegen — dort keine Spur, kein Staub
    apres-*.js       Hütte mit Terrasse und umwerfbaren Möbeln
    snow-trail.js    Spurkarte als Render-Target; stampDecal() stempelt hinein
    snow-writing.js  Schrift und Tasten-/Stickzeichen im Schnee
    drag-lift.js, magic-carpet.js, rail-ride.js, race.js, speed-check.js,
    light-run.js, north-run.js
    props/           Ein Modul je Gegenstand; screens.js = leuchtende Bildschirme
  player/
    skier.js         Fahrmodell, Sprung, Tricks
    skier-model.js   Die Figur
    top-camera.js    Kamera: fest, Verfolger (Nordabfahrt), Heranzoomen
    spray.js         Schneestaub
  stations/
    links.js         Alle echten Adressen an einer Stelle
    stations.js      Wo was steht und was es tut
    registry.js      Nähe prüfen, auslösen
    interaction.js   Enter/Tippen: öffnen oder heranzoomen und wählen
    ui.js            Glas-Einladung und Glas-Auswahl
  dialogs/           Wortgleich von veerka.mp übernommen — siehe unten
tests/               node --test (npm test)
wrangler.jsonc       Testbetrieb auf beta.veerka.mp
```

**`assemble(parts)`** in `core/geometry.js` verschmilzt viele Primitive mit
Vertexfarben zu *einem* Draw Call. Alles, was sich nicht einzeln bewegt, gehört
da hinein. Was in Mengen auftritt und sich einzeln bewegt (Pistenstangen,
Leuchtsegmente), ist eine `InstancedMesh`.

**Kennzahlen im Betrieb:** 0.05–0.13 ms/Frame, 300–420 Draw Calls,
~800–855 k Dreiecke. Wer etwas hinzufügt, prüft das nach.

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

Eine Station gilt als verdrahtet, wenn sie `url`, `onUse` oder eine Auswahl
mit Inhalt hat. Wie man sie benutzt, steht im nächsten Abschnitt.

**Anlagen**: Schlepplift (Teller, damit der Fahrer auf den Ski bleibt und die
Spur weiterläuft), Zauberteppich im Kinderland, Rail im Funpark, Rennstrecke
mit Zeitnahme, Speedcheck an der freien Piste, zwei Schneekanonen, Leucht-
strecke, Après-Ski-Hütte mit Terrasse, Gipfelkreuz.

**Wegenetz** (`paths.js`): die vier Wege plus sechs Verbindungen zu einem
Netz; die Mittellinien steuern Waldschneisen *und* die Präparierung im
Terrainmaterial. `wayfinding.js` baut den Talplan am Start und sechs
Wegweiser, alle zur Kamera. Stationen rutschen **vor** der Bepflanzung auf
flache Plätze; ihre Lichtungen benutzen die korrigierten Koordinaten.

**Landschaft** (`landscape-layout.js`, `landscape-details.js`): sechs niedrige
Schneerücken (≤ 2,8 m), drei Bodenwellen und drei Nebenstrecken, **vor** den
Pistenbändern in `terrainHeight()` addiert. Stützpunkte aller Pistenbänder
blieben dabei auf den Zentimeter gleich. Dazu Felsquelle, Uferbank und
Schneeschauer an Hainbäumen (180 Partikel, Auslösung innerhalb 3,6 m).

**Hütte und See**: Die Après-Ski-Hütte steht rechts bei (23, −64), Front zur
Kamera, mit neuneckig zugeschnittener Terrasse, drei Sitzgruppen und
umwerfbaren Möbeln (`apres-terrace.js`; stehen nach 10 s wieder auf, wenn der
Fahrer ≥ 7 m weg ist). Der See hat eine eigene Bucht in `WORLD.basins`, damit
das ganze Eis befahrbar ist; `lakeRadius()` teilt die Uferkontur zwischen Mesh
und Höhenfeld. **Weiße Spuren auf Eis und Holz** kamen vom Spurstempel, dessen
Rand durch den nur 1,2 cm höheren Belag ragte — `surfaces.js` sperrt jetzt
Spur, Staub und Verformung dort (drei Regressionstests in `tests/`).

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

## 4a. Stationen benutzen: Enter, Heranzoomen, Glas

**Enter** (oder `E`, oder Antippen) ist die eine Taste. Vor einer Station
schwebt eine Glasblase mit Name, einem Wort und dem ⏎-Zeichen.

- Station mit **einem Ziel**: Enter öffnet es sofort.
- Station mit **Auswahl** (Skikasse: PayPal/Solana, Werkstatt:
  GitHub/LinkedIn): Enter **zoomt heran**. Der Fahrer bleibt stehen
  (`input.locked`), unten klappt eine Glas-Auswahl auf, ←/→ (auch A/D)
  wechseln, Enter öffnet, Esc/Backspace/W/S führen hinaus. Die Ziffern `1`/`2`
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

**Das Glas** (`.glass` in `style.css`) ist hell getönt, weil der Hintergrund
fast immer Schnee ist — klares Glas auf Weiß ist unsichtbar. Es ersetzt das
frühere Pistenschild auf ausdrücklichen Wunsch.

## 4b. Handymodus

Erkannt über `pointer: coarse` ohne feinen Zeiger (`core/device.js`), zum
Prüfen am Rechner mit `?touch` erzwingbar; dann trägt `<html>` die Klasse
`touch`.

- **Daumenstick** (`core/touch.js`): erscheint dort, wo der Finger den Schnee
  berührt, und lenkt **bildschirmbezogen** — Daumen nach oben heißt im Bild
  nach oben. Mit fester Kamera ist ein Wohin auf dem Bildschirm genau eine
  Himmelsrichtung; der Stick regelt nur den Winkelfehler zur Fahrtrichtung
  aus (`GAIN` 2.1). Auf der Nordabfahrt nimmt er den mitdrehenden Azimut
  (`chase.azimuthNow`). Schub ab 35 % Ausschlag, loslassen = ausrollen. Zieht
  der Daumen weit hinaus, wandert der Stick mit. Geprüft mit echten
  Pointer-Ereignissen: oben/rechts/unten-links kommen als oben/rechts/
  unten-links an.
- **Sprungknopf** nur im Funpark oder auf der Rail, gehalten statt getippt.
- **Zwei Finger** zoomen. Ein Tipp in den Schnee schließt eine offene Auswahl.
- Im Schnee steht statt WASD ein Stickzeichen, unten einmal ein Hinweis, der
  beim ersten Berühren verschwindet.
- **Hochformat**: bei 390 × 844 sah man vorher nur 18° breit. Der Bildwinkel
  wächst bis 56°, den Rest holt der Abstand (≤ 1,35×). Pixelverhältnis am
  Handy höchstens 1,5.

## 4c. Hosting

**beta.veerka.mp** ist ein reiner Asset-Worker (`wrangler.jsonc`, Name
`skiportfolio-test`) ohne eigenen Code. `npm run deploy:test` baut und lädt
hoch (vorher einmal `npx wrangler login`). `public/_headers` gibt `/assets/*`
ein Jahr Cache (Dateinamen tragen einen Hash) und `index.html` `no-cache`. Der
Produktiv-Worker `website` bleibt davon unberührt. Geplant war test.veerka.mp —
dort hing noch ein A-Eintrag auf einen gekündigten Server.

Auf beta gilt der Produktionszweig der Fenster. Geprüft am 23.09. von
beta.veerka.mp aus:

- **Kurzlink**: `beta.veerka.mp` steht jetzt in `TURNSTILE_HOSTNAMES` des
  Workers `kurz` und in den Domains des Turnstile-Widgets „kurz". Das Repo
  `~/Documents/Claude/kurz` ist nachgezogen — dort stand nur `s.veerka.mp`,
  live schon drei Hosts; ein Deploy aus dem Repo hätte veerka.mp still
  ausgesperrt. Turnstile löst sich auf beta, der Knopf wird „Kürzen".
- **Solana**: RPC publicnode, CoinGecko und Binance antworten mit CORS.
  Der Ersatz-RPC leorpc scheitert — auch von veerka.mp aus, also kein
  beta-Problem, aber ein toter Fallback in `wallet.js` (wortgleich mit
  veerka.mp, dort mitändern).
- **Upload** nicht geprüft.

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
input, chase, stations, interaction, step, goto }`. `goto('kasse')` stellt den
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
- **Umzug auf veerka.mp** steht noch aus; beta.veerka.mp ist die Vorstufe.
- Handymodus bisher nur in der Emulation geprüft, nicht auf einem echten
  iPhone — Safari-Eigenheiten (Adressleiste, `100vh`) dort ansehen.
- Die Nordabfahrt liegt seit `b3fcf57` in `main`. Zusammengeführt wurde mit
  `--no-ff`, damit sie an einem einzigen Commit hängt: `git revert -m 1 b3fcf57`
  nimmt sie komplett wieder ab. Der Zweig `rueckseite` ist gelöscht (er war
  vollständig in `main`).
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

---

## 10. Verlauf

```
         Hosting auf beta.veerka.mp
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
