# veerka.mp – das Skital

**Lies zuerst [HANDOVER.md](HANDOVER.md)** — dort steht der vollständige Stand,
die Begründungen und was offen ist.

Das ist **veerka.mp**: Jeder Push auf `main` geht über Cloudflare Workers
Builds live, eine Vorstufe gibt es nicht mehr. Fertige Runden gehen ohne
Rückfrage auf `main` (Ansage 27.09.); danach prüfen, dass veerka.mp den neuen
Stand ausliefert. Die Seite heißt **Julian Veerkamp** – nicht Portfolio, nicht
Skiportfolio (das war der Arbeitsname).

Das Wichtigste in Kürze:

- Die Kamera dreht sich **nie** (`CAMERA.azimuth = Math.PI * 0.25`, ≈36° von
  oben). WASD steuert klassisch aus Sicht des Fahrers. Alles mit einer
  Schauseite muss der Kamera zugewandt sein.
  Genau **zwei** dokumentierte Ausnahmen: auf der Nordabfahrt geht sie hinter
  den Fahrer und dreht mit (`CHASE`, seit 28.09. mit `CHASE.an` abgeschaltet), und im Drohnen-Rundflug fliegt sie ums
  Tal (`player/drone-flight.js`, niemand steuert). Weitere nur nach Rückfrage.
- Was man **befährt**, ist Gelände; was man **sieht**, ist Aufbau. Schanzen,
  Steg und Bahnen stecken im Höhenfeld, das Holz liegt nur darauf.
- `terrainHeight(x, z)` in `src/world/heightfield.js` ist die **einzige**
  Höhenquelle für Mesh und Kollision und darf sich nie selbst aufrufen.
- Kommentare und Commits auf **Deutsch**, und sie erklären das *Warum*, meist
  mit einer gemessenen Zahl.
- Klein und dicht — ein Spielzeugtal. Im Zweifel schrumpfen.
- Alles muss als **eine zusammenhängende Gegend** lesbar bleiben, nicht wie eine
  ausgekippte Spielzeugkiste.
- Minimale Oberfläche: keine Leiste. Einzige Menüs (alle in `src/menu/`): die
  Übersicht hinter `M` (Links, Talkarte, Pistenpass, Bestenliste), die zwei
  Hinweispillen (für Nicht-Spieler gewünscht) und die Abzeichen-Pille oben
  links. Hinweise gehen von selbst. Ohne WebGL oder JavaScript steht statt
  des Tals eine Linkliste aus denselben Kacheln (`menu/kacheln.js`).
- Pistenpass: stiller Erkundungsstand, Slalom-Medaillen, acht schwere
  Abzeichen. **Nie** etwas fürs Hochladen, Wallet, Kurzlink oder Bezahlen.
  Lieber wenige, schwierige als für alles eins (erste Fassung zu viel).
- Verworfen und nicht ohne Rückfrage neu anzufangen: **Halfpipe** (funktioniert
  im Fahrmodell nicht) und **Ton** (zweimal gebaut, zweimal abgelehnt).

`npm run dev` startet, `npm run dev:api` den Worker dazu (Bestenliste,
Broadcast). `npm test` und `npm run build` müssen durchlaufen, bevor etwas
fertig ist. Zum Prüfen im Browser: `window.__ski` und `S.step(frames, dt)`.
Fremde Dienste (Kurzlink, Upload) hängen an Hostlisten – siehe HANDOVER 4c.
