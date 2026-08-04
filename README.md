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
| `public/img/*.webp`        | die Avatar-Fotos, 256 px, ~12 KB pro Stück          |
| `public/_headers`          | Cache-Regeln für die Bilder                         |
| `img-src/*.jpg`            | die Originalfotos, werden **nicht** ausgeliefert     |
| `tools/optimize-avatars.sh`| macht aus `img-src/` das `public/img/`              |

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
