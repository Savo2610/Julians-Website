# Kabelsee – kabelsee.veerka.mp

Wasserski am Kabel rund um eine Insel, ein kleines Spiel neben dem Skital von
veerka.mp (Repo `Julians-Website`). Stand, Steuerung, Technik und Aufbau
stehen im [README](README.md).

**Jeder Push auf `main` geht über Cloudflare Workers Builds live** (Worker
`kabelsee`, `wrangler.jsonc`). Größere Änderungen am Fahrmodell, an der
Bahn oder am See daher auf einem eigenen Branch und erst nach Rückfrage auf
`main`. Vorher müssen `npm test` und `npm run build` durchlaufen.

Das Wichtigste in Kürze:

- Die Kamera dreht sich **nie** (Azimut 45°, 36° über dem Horizont, wie im
  Skital). Sie folgt nur und atmet mit dem Tempo. Alles mit einer
  Schauseite muss zur Kamera zeigen, also nach +x/+z; deshalb liegt die
  Station im Norden.
- `terrainHeight(x, z)` in `src/world/heightfield.js` ist die **einzige**
  Höhenquelle: Gelände-Mesh, Wassertiefe, Ufer-Kollision und das Setzen von
  Bäumen fragen alle dort.
- Was man **befährt**, steht in `src/world/features.js`; was man **sieht**
  (`src/props/obstacles.js`), wird aus denselben Profilen gebaut. Nie nur
  eine Seite ändern.
- Das Fahrmodell (`src/player/rider-physics.js`) und alles, was die Tests
  brauchen, bleibt ohne three.js und ohne DOM.
- Die Bahn braucht Wasser um sich: mindestens 16 m zum Ufer, 24 m zur Insel
  (der Test `Bahn hat Abstand zu Ufer und Insel` prüft es). Wer See, Insel
  oder Kabel verschiebt, muss ihn grün halten.
- Ringe und Slalomfahnen hängen am Fahrmodell: die Ringe sitzen am
  gemessenen Scheitel eines geladenen Sprungs, die Fahnen so, dass der
  Testfahrer den Slalom schafft (`Slalom: mit grossen Boegen …`). Wer
  Seiltempo, Schwerkraft oder Absprung ändert, misst beides nach.
- Alle Stellschrauben stehen in `src/config.js`. Kommentare und Commits auf
  **Deutsch**, und sie erklären das *Warum*, am besten mit einer gemessenen
  Zahl.
- Keine Modell- oder Bilddateien: Geometrie und Texturen entstehen im Code,
  im Stil des Skitals (flach schattiert, Eckfarben, gemergte Geometrie).
- Oberfläche wie im Skital: Frosttext ohne Behälter für alles, was nur kurz
  steht; Glas nur für das, was man bedient (Titel, Auswertung). Kein Ton.

Zum Prüfen im Browser: `window.__kabel.step(frames, dt)` rechnet ohne
laufende Schleife weiter, `keys([...])` drückt Tasten, `overview()` zeigt den
ganzen See. `npm run shots` und `npm run video` erzeugen die Bilder und das
Video in `docs/` neu.
