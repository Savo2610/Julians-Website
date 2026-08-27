# veerka.mp

Eine Seite, keine Build-Tools. Liegt als Worker mit statischen Assets bei
Cloudflare, das Repo bleibt hier auf GitHub.

```bash
npm run dev       # lokal auf http://localhost:8787
npm run deploy    # von Hand nach veerka.mp
```

## Struktur

| Pfad                       | Was drin ist                                        |
| -------------------------- | --------------------------------------------------- |
| `public/index.html`        | die komplette Seite – HTML, CSS und JS in einer Datei |
| `public/scene.js`          | die 3D-Szene hinter der Seite (three.js)            |
| `public/wallet.js`         | der Solana-Dialog: Wallet finden und senden         |
| `public/upload.js`         | der Upload-Dialog: Briefkasten in klein             |
| `public/dialog.js`         | das bisschen, das sich beide Dialoge teilen         |
| `public/vendor/three-*/`   | three.js, unverändert aus dem npm-Paket             |
| `public/img/*.webp`        | die Avatar-Fotos, 256 px, ~12 KB pro Stück          |
| `public/_headers`          | Cache-Regeln für Bilder und `vendor/`               |
| `img-src/*.jpg`            | die Originalfotos, werden **nicht** ausgeliefert     |
| `tools/optimize-avatars.sh`| macht aus `img-src/` das `public/img/`              |

## Die Szene beim Scrollen

`public/scene.js` baut eine Nachtabfahrt: oben der Gipfel, dann die Piste mit
dem Skifahrer, unten das Tal mit Hütte und Feuerwehrauto – und auf dem letzten
Viertel kommt eine FPV-Drohne angeflogen und geht neben dem Auto in den Schnee.
Der Scrollfortschritt (0 … 1) ist die einzige Eingabe, alles andere ergibt sich
daraus; auch der Absturz, der beim Zurückscrollen wieder zurückläuft. Die
Geometrie entsteht im Code – es gibt keine Modelldateien.

Die Stellschrauben stehen als `TUNE` und `COL` oben in der Datei: Länge der
Abfahrt, Höhenunterschied, Pistenbreite, Schwungweite, Kameraabstand, Farben.

Geladen wird das Modul erst nach dem ersten Bild und nur, wenn der Browser
WebGL kann und niemand *prefers-reduced-motion* eingestellt hat. Sonst bleibt
der Farbverlauf von vorher stehen; die Seite funktioniert ohne die Szene
vollständig.

Lokal (nur auf `localhost`) gibt es zum Ausprobieren einen Haken in der
Konsole:

```js
szene.springe(0.6)   // an diese Stelle der Abfahrt springen (0 … 1)
szene.bild(30)       // 30 Einzelbilder rechnen, ohne zu scrollen
```

### three.js aktualisieren

Die Version steckt im Ordnernamen, damit `_headers` sie ewig cachen darf. Für
ein Update einen neuen Ordner anlegen und den Import in `scene.js` umbiegen:

```bash
npm pack three@<version>
tar -xzf three-<version>.tgz package/build package/LICENSE
mkdir -p public/vendor/three-<version>
cp package/build/three.module.min.js package/build/three.core.min.js \
   package/LICENSE public/vendor/three-<version>/
```

## Die zwei Dialoge

Zwei Kacheln öffnen statt eines Links ein Fenster. Beide Module werden erst
beim ersten Klick geladen – ohne JavaScript bleibt die Kachel der Link, der
sie vorher war.

**Solana** (`wallet.js`) sucht Wallet-Erweiterungen über den Wallet Standard,
baut die Überweisung als rohe Bytes selbst zusammen und gibt sie der Wallet
zum Signieren und Senden. Der Betrag lässt sich in SOL oder Euro eintippen;
gesendet wird immer SOL. Ist keine Wallet da, steht dort eine Empfehlung.

**Upload** (`upload.js`) ist der Briefkasten von `upload.veerka.mp` in klein:
Dateien wählen oder hineinziehen, Fortschritt in Prozent, dazu ein Feld für
Text und Links. Gesprochen wird direkt mit der API dort, die ihre
Einwurf-Routen dafür nach veerka.mp herausgibt (CORS). Es gilt das anonyme
Limit von 50 MB pro Datei; für mehr führt ein Link auf die volle Seite.

Zum lokalen Ausprobieren muss der Uploader daneben laufen (`npm run dev` in
seinem Repo, Port 8788) und dort `DEV_HERKUNFT=http://localhost:8787` in
`.dev.vars` stehen. Sonst gingen Probe-Uploads in den echten Speicher.

## Fotos austauschen

Neues Foto nach `img-src/` legen, dann:

```bash
brew install webp    # einmalig
./tools/optimize-avatars.sh
```

Das Skript schneidet quadratisch zu und rechnet auf 256 px WebP herunter.
Der Avatar wird mit 90 px angezeigt, das reicht also auch auf 3x-Displays.
Anschließend die Liste `avatarSequence` in `public/index.html` anpassen.

Wichtig: Wird ein Foto unter *gleichem* Dateinamen ersetzt, sehen wiederkehrende
Besucher es wegen `_headers` bis zu 30 Tage lang nicht. Dann lieber einen neuen
Namen vergeben.

## Deployment

Jeder Push auf `main` wird von Cloudflare Workers Builds gebaut und
veröffentlicht. Der Worker heißt `website` – der Name in `wrangler.jsonc` muss
zu dem im Dashboard passen, sonst entsteht beim Build ein zweiter Worker.

Die Domains `veerka.mp` und `www.veerka.mp` hängen als Custom Domains am Worker
und stehen in `wrangler.jsonc`.
