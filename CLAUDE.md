# veerka.mp – das Skital

**Lies zuerst [HANDOVER.md](HANDOVER.md)** — dort steht der vollständige Stand,
die Begründungen und was offen ist.

Das ist **veerka.mp**: Jeder Push auf `main` geht über Cloudflare Workers
Builds live, eine Vorstufe gibt es nicht mehr. Deshalb (Ansage 29.09.):

- **Große Änderungen** – neue Anlagen, Umbauten am Fahrmodell oder Gelände,
  Prototypen – bekommen einen **eigenen Branch** und werden nur lokal geprüft
  (`npm run dev`). Auf `main` kommen sie erst, wenn Julian es sagt.
- **Kleine Verbesserungen** – Korrekturen, Feinschliff, Doku – dürfen nach
  `npm test` und `npm run build` direkt auf `main`.
- Im Zweifel ist es groß. Nach jedem Push auf `main` prüfen, dass veerka.mp
  den neuen Stand ausliefert.

Die Seite heißt **Julian Veerkamp** – nicht Portfolio, nicht
Skiportfolio (das war der Arbeitsname).

Das Wichtigste in Kürze:

- Die Kamera dreht sich **nie** (`CAMERA.azimuth = Math.PI * 0.25`, ≈36° von
  oben). WASD steuert klassisch aus Sicht des Fahrers. Alles mit einer
  Schauseite muss der Kamera zugewandt sein.
  Genau **zwei** dokumentierte Ausnahmen: auf der Nordabfahrt geht sie hinter
  den Fahrer und dreht mit (`CHASE`, seit 28.09. mit `CHASE.an` abgeschaltet), und im Drohnen-Rundflug fliegt sie ums
  Tal (`player/drone-flight.js`, niemand steuert). Weitere nur nach Rückfrage.
  Der Kabelsee hat dieselbe Kamera; die Verwandlung dorthin ist ein Bild
  über zwei Welten, keine Kamerafahrt.
- Was man **befährt**, ist Gelände; was man **sieht**, ist Aufbau. Schanzen,
  Steg und Bahnen stecken im Höhenfeld, das Holz liegt nur darauf.
- `terrainHeight(x, z)` in `src/world/heightfield.js` ist die **einzige**
  Höhenquelle für Mesh und Kollision und darf sich nie selbst aufrufen.
  Eine Stufe ist keine Schanze: wo eine Kante nicht abwerfen soll (Badesteg),
  deckelt `kantenSprung()` den Absprung. Über eine Lücke (Klammschanze der
  Nordabfahrt) fliegt man nur, wo `freiFlug()` es sagt – sonst sinkt der
  Fahrer im Flug mit dem Boden darunter mit.
- Kommentare und Commits auf **Deutsch**, und sie erklären das *Warum*, meist
  mit einer gemessenen Zahl.
- Klein und dicht — ein Spielzeugtal. Im Zweifel schrumpfen.
- Alles muss als **eine zusammenhängende Gegend** lesbar bleiben, nicht wie eine
  ausgekippte Spielzeugkiste.
- Minimale Oberfläche: keine Leiste. Einzige Menüs (alle in `src/menu/`): die
  Übersicht hinter `M` (Links, Talkarte, Pistenpass, Bestenliste), die zwei
  Hinweise unten (für Nicht-Spieler gewünscht) und die Abzeichen-Meldung oben
  links. Hinweise gehen von selbst. Was nur kurz über dem Tal steht, ist
  **Frosttext** ohne Behälter (`.frost`), keine Pille; Glas nur für das,
  was man bedient. Stationen zoomen heran und führen etwas vor, bevor sie
  eine Seite öffnen – auch mit nur einem Ziel. Ohne WebGL oder JavaScript
  steht statt des Tals eine Linkliste aus denselben Kacheln
  (`menu/kacheln.js`).
- Pistenpass: stiller Erkundungsstand, Slalom-Medaillen, acht schwere
  Abzeichen, dazu *Abgeräumt* vom Kabelsee (zählt nicht für Gold). **Nie** etwas fürs Hochladen, Wallet, Kurzlink oder Bezahlen.
  Lieber wenige, schwierige als für alles eins (erste Fassung zu viel).
- Verworfen und nicht ohne Rückfrage neu anzufangen: **Halfpipe** (funktioniert
  im Fahrmodell nicht) und **Ton** (zweimal gebaut, zweimal abgelehnt).
- **Kabelsee** (`src/kabelsee/`, HANDOVER 4a⁶): Wasserski im Sommer, vom
  Badesteg am Eissee aus (`src/sommer/`) und allein unter `/kabelsee/`.
  Eine Codebasis mit dem Tal, kein Nebeneinander: Gemeinsames liegt in
  `src/core/` und `src/basis.css`, getrennt bleiben nur Eingabe und Touch.
  Am See gilt `src/kabelsee/world/heightfield.js` als einzige Höhenquelle;
  was man befährt (`features.js`) und was man sieht (`props/obstacles.js`)
  ändert man nur gemeinsam; das Fahrmodell bleibt ohne three.js und DOM.
  Wer Seiltempo, Schwerkraft oder Absprung ändert, misst Ringe und
  Slalomfahnen nach (Tests). Ein Countdown am Badesteg, keiner am See.

- **Tiere** (`src/world/tiere/`, HANDOVER 4a⁷): Schneehase, Schneehühner,
  Fuchs. Selten, schüchtern, nie zwei auf einmal; sie kommen und gehen nur
  außerhalb des Bildes. Herbeirufen: `__ski.tiere.rufen('hase')`.

`npm run dev` startet (Tal auf `/`, Kabelsee auf `/kabelsee/`),
`npm run dev:api` den Worker dazu (Bestenlisten, Broadcast). `npm test` und `npm run build` müssen durchlaufen, bevor etwas
fertig ist. Zum Prüfen im Browser: `window.__ski` und `S.step(frames, dt)`; am See
`window.__kabel`, im Tal `__ski.sommer.see`.
Fremde Dienste (Kurzlink, Upload) hängen an Hostlisten – siehe HANDOVER 4c.
