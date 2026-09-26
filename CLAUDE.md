# Skiportfolio

**Lies zuerst [HANDOVER.md](HANDOVER.md)** — dort steht der vollständige Stand,
die Begründungen und was offen ist.

Das Wichtigste in Kürze:

- Die Kamera dreht sich **nie** (`CAMERA.azimuth = Math.PI * 0.25`, ≈36° von
  oben). WASD steuert klassisch aus Sicht des Fahrers. Alles mit einer
  Schauseite muss der Kamera zugewandt sein.
  Genau **eine** dokumentierte Ausnahme: auf der Nordabfahrt geht sie hinter
  den Fahrer und dreht mit (`CHASE`). Eine zweite nur nach Rückfrage.
- Was man **befährt**, ist Gelände; was man **sieht**, ist Aufbau. Schanzen,
  Steg und Bahnen stecken im Höhenfeld, das Holz liegt nur darauf.
- `terrainHeight(x, z)` in `src/world/heightfield.js` ist die **einzige**
  Höhenquelle für Mesh und Kollision und darf sich nie selbst aufrufen.
- Kommentare und Commits auf **Deutsch**, und sie erklären das *Warum*, meist
  mit einer gemessenen Zahl.
- Klein und dicht — ein Spielzeugtal. Im Zweifel schrumpfen.
- Alles muss als **eine zusammenhängende Gegend** lesbar bleiben, nicht wie eine
  ausgekippte Spielzeugkiste.
- Minimale Oberfläche: keine Leiste. Einzige Menüs: die Übersicht hinter `M`
  (Links, Talkarte, Pistenpass), die zwei Hinweispillen (für Nicht-Spieler
  gewünscht) und die Abzeichen-Pille oben links. Hinweise gehen von selbst.
- Pistenpass: Abzeichen nur fürs Finden und Können, **nie** für Hochladen,
  Wallet, Kurzlink oder Bezahlen. Geheime ohne Hinweis.
- Verworfen und nicht ohne Rückfrage neu anzufangen: **Halfpipe** (funktioniert
  im Fahrmodell nicht) und **Ton** (zweimal gebaut, zweimal abgelehnt).

`npm run dev` startet, `npm run build` muss durchlaufen, bevor etwas fertig ist.
Zum Prüfen im Browser: `window.__ski` und `S.step(frames, dt)`.
