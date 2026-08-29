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
| `public/kurz.js`           | der Kurzlink-Dialog: s.veerka.mp in klein           |
| `public/dialog.js`         | das bisschen, das sich alle Dialoge teilen          |
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

Unten im Tal kommt der Skifahrer zum Stehen, richtet sich auf und dreht sich zu
dem Wrack um. Im Hochformat geht dafür zum Schluss der Bildwinkel etwas auf,
sonst fiele er aus dem schmalen Ausschnitt; ab einem Seitenverhältnis von 0.85
bleibt die Brennweite unverändert.

Die Stellschrauben stehen als `TUNE` und `COL` oben in der Datei: Länge der
Abfahrt, Höhenunterschied, Pistenbreite, Schwungweite, Kameraabstand, Farben.

### Ostereier

Drei kleine Zugaben, alle folgenlos und beliebig oft auslösbar:

* **Sternschnuppe** – zieht alle paar Sekunden über den Grat. Sie fliegt flach,
  weil die Kamera während der ganzen Abfahrt rund 20° nach unten schaut und
  vom Himmel nie mehr als ein schmales Band über den Gipfeln im Bild ist.
* **Drohne anklicken** – sie zittert kurz, rappelt sich auf und dreht in
  sieben Sekunden eine Ehrenrunde, bevor sie sich wieder in den Schnee legt;
  Kontrollleuchte dabei grün. Dazu erscheint ein Schild mit dem Link zum
  Uniprojekt. Der Kreis hängt an der Blickachse und sein Radius am
  tatsächlichen Bildwinkel – sonst fliegt sie im Hochformat seitlich aus dem
  Bild. Am Ende landet sie exakt wieder in der Lage, in der sie lag, damit
  beim Übergang nichts springt. Im Anflug fliegt sie bewusst *keinen* Kreis:
  der wirkte dort wie vorgespult.
* **Feuerwehrauto anklicken** – Fahrlicht an, und es dreht in sieben Sekunden
  eine Runde durch den Talkessel, bevor es wieder auf demselben Fleck steht.
  Die Runde ist ein voller Kreis: Anfangs- und Endwinkel sind derselbe,
  deshalb kommt es von allein genau zurück, und mit `smoothstep` auf dem
  Winkel fährt es aus dem Stand an und rollt wieder aus. Der Mittelpunkt
  liegt links vom Auto, damit die Runde nach rechts durchs freie Bild geht
  und nicht hinter den Kacheln verschwindet – und der Radius ist mit sechs
  Metern klein, weil die Kamera nur rund dreißig Meter entfernt steht.
  Dazu erscheint ein Schild mit dem Link zur Lernwerkstatt.

### Der Übergang zur Lernwerkstatt

Das Schild am Feuerwehrauto führt nicht einfach weg, es fährt hin: ein Klick
darauf lässt das Auto geradeaus beschleunigen, das Bild zieht sich auf `#080b14`
zu – dieselbe Nacht, mit der `jf.veerka.mp` anfängt – und drüben rollt dasselbe
Fahrzeug wieder ins Bild. Den Anstoß dafür gibt der Anhang `?einfahrt=1`, den
die Startseite der Jugendfeuerwehr auswertet und danach gleich wieder aus der
Adresszeile nimmt.

Der Vorhang entsteht in `scene.js` und nicht im HTML: ohne Szene gibt es auch
nichts zu überblenden. Beim Zurück-Knopf holt der Browser die Seite samt
zugezogenem Vorhang aus dem Cache, deshalb räumt ein `pageshow` mit
`e.persisted` beides wieder auf.

Als `<a>` mit dem echten Ziel bleibt das Schild ein normaler Link: Mittelklick
und Cmd-Klick öffnen weiter einen Tab, nur der schlichte Linksklick nimmt den
Umweg über die Ausfahrt.

Die Links stecken absichtlich nur in der Szene und in keiner Kachel – sie sind
als Überraschung gedacht. Der Preis dafür: Suchmaschinen, Screenreader und alle
ohne WebGL oder mit *prefers-reduced-motion* sehen sie nie.

Angeklickt wird zweistufig: der Klick auf das Objekt lässt nur das Schild
erscheinen, erst das Schild ist der Link. Ein Klick irgendwo in die Landschaft
soll niemanden ungefragt von der Seite werfen, und als richtiges `<a>` zeigt der
Browser beim Draufhalten auch das Ziel an. Nach neun Sekunden verschwindet das
Schild wieder.

Anklickbar sind die beiden erst ganz unten im Tal. Das Canvas selbst hört keine
Zeigerereignisse (`pointer-events: none`, sonst schluckt es die Links) – der
Listener hängt am Fenster und prüft per Raycast gegen zwei unsichtbare Kugeln,
die als Trefferflächen an Drohne und Auto hängen.

Geladen wird das Modul erst nach dem ersten Bild und nur, wenn der Browser
WebGL kann und niemand *prefers-reduced-motion* eingestellt hat. Sonst bleibt
der Farbverlauf von vorher stehen; die Seite funktioniert ohne die Szene
vollständig.

Lokal (nur auf `localhost`) gibt es zum Ausprobieren einen Haken in der
Konsole:

```js
szene.springe(0.6)   // an diese Stelle der Abfahrt springen (0 … 1)
szene.bild(30)       // 30 Einzelbilder rechnen, ohne zu scrollen
szene.masse(390, 844)          // Bildausschnitt erzwingen, z. B. Handyformat
szene.klickbar[0].userData.tun()  // Auto auf die Runde schicken (1 = Drohne)
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

## Die drei Dialoge

Drei Kacheln öffnen statt eines Links ein Fenster. Alle Module werden erst
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

**Kurzlink** (`kurz.js`) ist `s.veerka.mp` in klein: Adresse eintippen, Knopf,
fertiger Kurzlink – und der landet gleich in der Zwischenablage. Der QR-Code
bleibt auf der vollen Seite; sein Encoder ist dort eine getestete Datei und
hätte hier nur eine zweite, ungetestete Kopie ergeben.

An der API musste dafür nichts geöffnet werden, sie antwortet ohnehin allen
(CORS `*`). Der Türsteher ist Turnstile: das Widget wird erst beim Öffnen des
Fensters nachgeladen – vorher spricht die Startseite mit niemandem bei
Cloudflare – und `veerka.mp` muss an zwei Stellen erlaubt sein, in der
Domain-Liste des Widgets im Turnstile-Dashboard und in `TURNSTILE_HOSTNAMES`
des Kurzlink-Workers. Es gelten die öffentlichen Limits von dort: 5 Links pro
Minute, 20 pro Tag.

Lokal läuft der Kurzlink-Worker auf Port 8790 (`npx wrangler dev --port 8790`
in seinem Repo). Turnstile lässt sich dort nur mit den Testschlüsseln von
Cloudflare ausprobieren, siehe das README im Kurzlink-Repo.

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
