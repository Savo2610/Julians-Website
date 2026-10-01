# Kabelsee

Wasserski am Kabel rund um eine kleine Insel. Ein 3D-Spiel für den Browser,
gebaut mit three.js, ganz ohne Server und ohne geladene Modelle oder Bilder:
jede Tanne, jeder Mast und jede Boje entsteht im Code.

Kamera, Licht, Farben und Oberfläche kommen aus dem Skital von
[veerka.mp](https://veerka.mp) (Repo `Julians-Website`). Dort liegt Schnee,
hier liegt ein Sommersee; die feste Kamera von schräg oben, die warme
tiefstehende Sonne, das Glas und der Frosttext sind dieselben.

![Kabelsee von oben](../../docs/kabelsee/10-ueberblick.jpg)

| | |
|---|---|
| ![Start am Steg](../../docs/kabelsee/02-steg.jpg) | ![360 über den Kicker](../../docs/kabelsee/04-sprung.jpg) |
| ![Backflip über den Kicker](../../docs/kabelsee/08-backflip.jpg) | ![Box-Slide auf der Westgeraden](../../docs/kabelsee/07-box.jpg) |
| ![Station mit Kiosk und Steg](../../docs/kabelsee/11-station.jpg) | ![Die Insel](../../docs/kabelsee/12-insel.jpg) |

Ein kurzes Video liegt unter [docs/kabelsee.webm](../../docs/kabelsee/kabelsee.webm).

## Spielen

```bash
npm install
npm run dev          # http://localhost:5173
```

Online unter **[kabelsee.veerka.mp](https://kabelsee.veerka.mp)**. Oder fertig
gebaut: `npm run build` legt alles in `dist/`, das sich von jedem statischen
Webspace ausliefern lässt (auch aus einem Unterordner).

| Taste | auf dem Wasser | in der Luft |
|---|---|---|
| `A` `D` / Pfeile | Kanten: nach außen schwingen, zurück in die Linie; auf Box und Rail die Ski quer stellen | drehen (180, 360, 540 …) |
| `W` | an der Hantel ziehen | Salto vorwärts |
| `S` | zurücklehnen, bremsen | Salto rückwärts |
| `Leertaste` | halten federt ein, loslassen springt | |
| `Shift` | | Grab |
| `Enter` | Session starten | |
| `R` | zurück an den Steg | |
| Mausrad | Kamera näher oder weiter | |

Am Handy gibt es Tasten, belegt wie die Tastatur: links die Wippe ◀ ▶
(A/D, je weiter außen der Daumen, desto stärker), rechts die Wippe ▲ ▼
(W/S), die große Taste **Sprung** (Leertaste) und **Grab**.

## So läuft eine Session

**Start am Steg.** Der Fahrer steht vorn auf dem Startsteg, über ihm läuft
das Kabel. Ein Mitnehmer kommt, mal nach zweieinhalb, mal nach gut vier
Sekunden; die letzten drei zählt die Anzeige herunter. Das Seil hängt erst
durch und strafft sich dann, und sobald es fast straff ist, steht **JETZT!**
im Bild. Wer in dem Moment in der Hocke ist (Leertaste halten), wird sauber
vom Steg gezogen. Wer die Hocke erst in der letzten knappen halben Sekunde
einnimmt (der grüne Teil im Balken), bekommt den **Katapult-Start**: 250
Punkte, Schwung und ein hoher Satz vom Steg, in dem man schon drehen darf –
ein 180 geht sicher. Wer steht, wird ins Wasser gerissen und probiert es mit
dem nächsten Bügel noch einmal.

**Fahren.** Das Seil zieht mit 54 km/h um die Insel. Ohne Lenken hängt man
genau hinter dem Mitnehmer. Mit `A`/`D` stellt man die Ski schräg und
schwingt nach außen: das Seil zieht dann schräg, das Wasser lässt nur die
Längsrichtung der Ski durch, und man wird schneller als das Seil, bis gut
85 km/h. Wer zu weit ausschwingt, merkt, wie die Ski von selbst flacher
werden. Ins Flache am Ufer oder steil gegen eine Rampe fahren heißt Sturz;
wer schräg an der Seite eines Kickers entlangschrammt, gleitet nur ab. Wer
Tempo verliert, gleitet nicht mehr und sinkt bis zu den Knöcheln ein.

**Rückwärts.** Mit Tempo reicht ein Sprung auf flachem Wasser für einen 180,
danach fährt man rückwärts weiter, die Hantel hinter dem Rücken. Das Lenken
ist dabei etwas zäher, und an der Hantel ziehen geht nicht. Sprünge, die man
rückwärts beginnt, heißen *Switch* und geben 25 Prozent mehr; ein zweiter 180
dreht einen wieder um.

**Kicker, Box und Rail.** Vier Kicker in drei Größen, eine Box und eine Rail
stehen auf den Geraden. Der kleine Kicker liegt genau auf der Linie, die
drei anderen seitlich versetzt; die muss man anfahren. Auf der Ostgeraden
liegt die Rail auf der Linie und der Kicker innen daneben: wer geradeaus
fährt, slidet, wer springen will, zieht vorher nach innen. Auf Box und Rail
springt man auch schräg von der Seite auf oder landet schräg darauf, die
Kante hält einen in der Spur. Mit `A`/`D` dreht man sich darauf; ohne Taste
rastet man längs, quer oder rückwärts ein. Quer gerutscht zählt
anderthalbfach, und eine Drehung auf der Box zählt beim Absprung mit: wer
auf der Rail einen 360 dreht und gerade herunterkommt, hat einen 360. Vor der Kante `Leertaste` halten und an der
Kante loslassen gibt den höchsten Absprung (kurz danach loslassen zählt auch
noch). In der Luft drehen `A`/`D`, `W`/`S` schlagen einen Salto, `Shift`
greift an die Ski. Wer nichts drückt, wird von selbst auf die nächste
Landestellung gedreht: beim Drehen die nächste halbe Umdrehung, beim Salto
die nächste ganze. Gewertet wird die Landung: **Perfekt** (×1,5),
**Sauber**, **Wackelig** (×0,55, kostet Tempo) oder Sturz, und gestürzt wird
erst, wer wirklich quer oder wirklich schräg (knapp 70 Grad daneben)
aufkommt.

**Slalom.** Auf der West- und der Südgeraden stehen sechs Fahnen im Wechsel
innen und außen, je 10 m neben der Linie und 26 m auseinander. Der Wimpel
zeigt, auf welcher Seite man vorbei muss: außen um die Fahne herum, so weit
hinaus, dass das Seil straff ist. Auf der Südgeraden führt der Slalom innen
am einen und außen am anderen Kicker vorbei, statt darüber. Jede Fahne gibt
mehr als die vorige derselben Runde (150, 200 … 400), alle sechs dazu 1200.
Anders als die Bojen zählen die Fahnen in jeder Runde neu.

**Punkte wie in Steep.** Jede Figur zählt für sich, aber die großen Zahlen
macht die **Kombo**: wer innerhalb von 3,5 Sekunden nach einer Landung den
nächsten Trick steht, eine Boje holt oder durch ein Tor fährt, hält die Kette
am Leben, und jede neue Figur hebt den Faktor bis ×5. Läuft die Zeit ab,
wird die Kette ausgezahlt; ein Sturz löscht sie. Dazu:

- 17 **Bojen** (50 Punkte), zu erkennen am leuchtenden Stein über dem
  Schwimmer und dem Kreis auf dem Wasser. Sie liegen in Bögen nach außen und
  innen: man holt sie nur, wenn man ausschwingt, und genau das macht schnell.
- 4 **Ringe** (250 Punkte) über den Kickern, dort wo man mit voll geladenem
  Absprung den höchsten Punkt hat.
- 300 Punkte für jede Runde.

Trickwerte: 180 = 150, 360 = 300, 540 = 550, 720 = 800, 1080 = 1500;
Backflip = 550, Frontflip = 550, Doppelsalto = 1500. Salto mit Drehung ist
ein **Cork** (rückwärts) oder **Rodeo** (vorwärts) und gibt 20 Prozent mehr
als beides einzeln. Grab 150 plus Haltezeit; Big Air ab 1,6 s Flug; Box 45
und Rail 55 je Meter. Namen setzen sich zusammen, etwa „Switch Cork 540
Method“.

Nach drei Runden lässt der Fahrer das Seil los, und die Auswertung zeigt
Punkte, besten Trick, größte Kombo, Bojen, Ringe, Slalom-Tore, Spitzentempo
und Stürze.
Der Rekord bleibt im Browser (`localStorage`).

## Technik

- **three.js 0.186** und **Vite 8**, JavaScript-Module ohne Framework. Alles
  läuft im Browser; es gibt keinen Server, keine Assets außer einem Favicon.
- **Eine Höhenfunktion** (`src/world/heightfield.js`) beschreibt See, Insel,
  Ufer und Hügel. Aus ihr entstehen das Gelände-Mesh, die Tiefenkarte des
  Wassers und die Ufer-Kollision.
- **Das Fahrmodell** (`src/player/rider-physics.js`) ist eine eigene kleine
  Rechnung ohne Physik-Engine: ein Punkt mit Geschwindigkeit, das Seil als
  steife Feder zum Mitnehmer, Wasser, das quer zu den Ski hart und längs
  kaum bremst. Es läuft in festen Schritten von 1/120 s und ohne three.js,
  damit die Tests damit ganze Runden im Terminal fahren können. Rückwärts
  ist dieselbe Rechnung, nur steht die Figur umgedreht darauf; auf Box und
  Rail ersetzt eine Führung die Wasserrechnung.
- **Was man befährt, ist Rechnung; was man sieht, folgt ihr**
  (`src/world/features.js`): Kicker und Box sind Profile, aus denen sowohl
  der Absprung als auch die Geometrie gebaut wird. Dort stehen auch Bojen,
  Ringe und die Slalomfahnen; gewertet wird der Slalom in
  `src/game/slalom.js`.
- **Wasser** (`src/world/water.js`): eigener Shader mit Farbe aus der Tiefe,
  zwei ziehenden Rauschlagen für die Kräuselung, Himmel im Streiflicht,
  Sonnenglitzer, Uferschaum, dem Schatten des Fahrers und dem **Kielwasser**
  aus `src/world/wake.js`. Das Kielwasser wird jedes Bild aus einer Liste von
  Wegpunkten neu gemalt, darum laufen die beiden Wellen mit dem Alter
  auseinander wie hinter einem Boot.
- **Kamera** (`src/player/camera.js`) wie im Skital: fest von schräg oben
  (Azimut 45°, 36° über dem Horizont, 38° Bildwinkel), sie dreht sich nie.
  Neu ist nur, dass sie mit dem Tempo atmet (bis zu 4 m weiter weg und 7°
  mehr Bildwinkel), und dass sie am Steg näher herangeht.
- Rechnung je Bild um 0,2 bis 0,5 ms; Pixelbudget wie im Skital (Handy
  höchstens 1,5-fach, Desktop höchstens 4,2 Mio. Pixel).

Zum Prüfen im Browser gibt es `window.__kabel`: `step(frames, dt)` rechnet
die Welt weiter (auch ohne laufende Schleife), `keys(['jump'])` drückt
Tasten, `overview()` zeichnet den ganzen See von oben.

## Entwickeln

```bash
npm install
npm run dev          # Entwicklungsserver
npm test             # node --test: Bahn, Ufer, Start, Runde, Sprung, 180, Rail, Slalom, Kombo
npm run build        # dist/
npm run preview:worker  # Build und lokal über wrangler, wie in Produktion
npm run deploy       # von Hand veröffentlichen (sonst per Push auf main)
npm run shots        # Bilder nach docs/ (nach dem Build)
npm run video        # docs/kabelsee.webm (braucht ffmpeg mit VP8)
```

`npm run shots` und `npm run video` starten `vite preview`, öffnen den Build
in Chromium (Playwright) und spulen die Welt mit `__kabel.step()` in feste
Momente vor. Darum sehen die Bilder bei jedem Lauf gleich aus.

## Veröffentlichen

Die Seite läuft als Cloudflare Worker `kabelsee`, nur mit statischen Dateien
(kein Worker-Code), unter der Custom Domain `kabelsee.veerka.mp`, genau wie
zeit.veerka.mp. Alles steht in `wrangler.jsonc`: `wrangler deploy` baut
vorher selbst mit vite und lädt `dist/` hoch; die Custom Domain legt den
DNS-Eintrag selbst an. `public/_headers` lässt die Dateien unter `/assets/`
ein Jahr im Cache, `index.html` wird immer neu gefragt.

Jeder Push auf `main` wird über Cloudflare Workers Builds gebaut und
veröffentlicht. Von Hand: `npm run deploy` (braucht `wrangler login` oder
`CLOUDFLARE_API_TOKEN`).

## Aufbau

```
src/
  config.js       alle Stellschrauben: See, Insel, Kabel, Fahrer, Tricks, Kamera, Farben
  core/           Geometrie-Helfer, Zufall, Rauschen, Tastatur, Touch
  world/          Höhenfeld, Gelände, Wasser, Kielwasser, Himmel, Kabelbahn,
                  Hindernisse und Sammelsachen, Aufbau der Gegend (populate.js)
  props/          Bäume, Masten und Mitnehmer, Seil, Kicker und Box,
                  Station, Pavillon, Zelte, Bulli, Boote, Schilf, Enten …
  player/         Fahrmodell, Figur, Kamera, Gischt
  game/           Mitnehmer, Tricks und Kombo, Slalom, Ablauf der Session, Anzeige
tests/            node --test (helpers.js: der Testfahrer)
tools/            screenshots.mjs, video.mjs
docs/             Bilder und Video
```

Regeln für die Arbeit am Code (auch für Coding-Agenten) stehen in
[CLAUDE.md](CLAUDE.md).

## Die Gegend

Im Norden die Anlage mit Kiosk, Dachterrasse, Sonnenschirmen, Board-Ständer
und dem Startsteg auf einer Landzunge; die Station zeigt mit der Schauseite
zur Kamera, wie alles im Skital. Im Osten eine Zeltwiese mit Bulli und
Lagerfeuer, im Süden der Badestrand mit Rettungsturm, im Westen ein
Bootshaus. Auf der Insel ein Pavillon auf der Kuppe, ein Lagerfeuer am Strand,
ein Ruderboot und ein Wäldchen aus Kiefern, Birken und ersten gelben
Laubbäumen. Ringsum Wald, der nach außen dichter wird, Schilf im Flachwasser
und drei Entenfamilien.
