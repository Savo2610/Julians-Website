# Julian Veerkamp · [veerka.mp](https://veerka.mp)

Ein kleines Skital im Browser. Man fährt hindurch, und jede Station ist ein
echter Link: LinkedIn und GitHub in der Werkstatt, PayPal und Solana an der
Skikasse, Signal und Instagram am Kontaktposten, dazu Rohrpost, Kurzlink,
Arbeitszeitrechner und Packliste am Tools-Weg – und ein paar Dinge, die man
erst finden muss. Wer nicht spielen will, drückt `M` und hat alle Links als
Kacheln vor sich.

![Der Startplatz: Name und Tasten im Schnee, Wegweiser zu den vier Wegen](docs/tal.jpg)

## Steuerung

| Taste | |
|---|---|
| `W` `A` `S` `D` / Pfeile | fahren, lenken, bremsen – aus Sicht des Fahrers |
| `Shift` | kanten |
| `Leertaste` | springen, im Funpark Tricks |
| `Enter` / `E` | Station benutzen |
| `M` | Übersicht: Links, Talkarte, Pistenpass, Bestenliste |
| `R` | zurück zum Start |

Am Handy lenkt ein Daumenstick, der dort erscheint, wo man den Schnee
berührt; die Übersicht liegt hinter dem Kartenknopf oben rechts.

Im Tal stehen außerdem ein Tellerlift auf den Gipfel, die Nordabfahrt über
die Rückseite des Berges, ein Funpark mit Rail, ein Slalom mit Bestenliste,
ein Speedcheck, das Kinderland mit Zauberteppich und eine Hütte, deren
Möbel man umfahren kann. Der Pistenpass merkt sich, was man schon gefunden
hat. Es gibt keinen Ton, mit Absicht.

## Technik

- **three.js r185** mit **Vite 8**, reines ES-Modul-JavaScript, kein
  Framework. Alle Geometrie entsteht im Code, alle Texturen werden auf
  Canvas gemalt – es gibt keine Modell- oder Bilddateien.
- Eine einzige Höhenfunktion speist Gelände-Mesh und Kollision; Schanzen,
  Steg und Bahnen stecken darin, das Holz liegt nur obendrauf.
- Die Kamera dreht sich nie (mit zwei Ausnahmen: Nordabfahrt und
  Drohnen-Rundflug), deshalb zeigt alles mit einer Schauseite zur Kamera.
- **Cloudflare Worker** mit statischen Assets. Er springt nur für `/` und
  `/api/*` an: Umleitung von www, Slalom-Bestenliste in **D1** und die
  laufende Sendung von broadcast.veerka.mp für die gefrorene Quelle.

## Entwickeln

```bash
npm install
npm run dev          # Spiel auf http://localhost:5173
npm run dev:api      # Worker auf :8787 – vite reicht /api dorthin durch
npm test             # node --test
npm run build        # muss durchlaufen, bevor etwas fertig ist
```

Für die Bestenliste lokal einmal die Datenbank anlegen und ein Geheimnis
für die Marken hinterlegen:

```bash
npx wrangler d1 migrations apply skiportfolio-slalom --local
echo "SLALOM_GEHEIM=irgendwas-langes" > .dev.vars
```

Im Browser hilft `window.__ski`: `__ski.goto('kasse')` stellt den Fahrer vor
eine Station, `__ski.step(frames, dt)` spult die Welt vor, auch wenn das
Fenster verborgen ist.

## Veröffentlichen

Jeder Push auf `main` geht live: Cloudflare Workers Builds baut und
veröffentlicht den Worker `website` (etwa 40 Sekunden). Von Hand geht es mit
`npm run deploy`. Zum Ausprobieren vorher liefert `npm run dev:api` die ganze
Seite lokal so aus wie veerka.mp.

Das Geheimnis für die Marken der Bestenliste liegt als Secret am Worker
(`npx wrangler secret put SLALOM_GEHEIM`).

## Aufbau

```
src/
  core/         Werkzeug ohne Spielwissen: Geometrie, Eingabe, Handymodus
  world/        Gelände (heightfield.js), Aufbau (populate.js), Schnee, Himmel
    attractions/  Lift, Teppich, Rail, Slalom, Speedcheck, Nordabfahrt …
    areas/        Kinderland, Hütte mit Terrasse
    props/        ein Modul je Gegenstand
  player/       Fahrmodell, Figur, Kamera, Drohnen-Rundflug
  stations/     Stationen, ihre Links und was Enter dort tut
  menu/         Übersicht, Hinweise, Pistenpass, Bestenliste
  dialogs/      Solana, Briefkasten, Kurzlink
worker/         Cloudflare-Worker: Router, Bestenliste, Broadcast
tests/          node --test
```

## Abhängigkeiten nach außen

| Dienst | wofür | Voraussetzung |
|---|---|---|
| [s.veerka.mp](https://s.veerka.mp) | Kurzlink-Fenster | Host in `TURNSTILE_HOSTNAMES` und im Turnstile-Widget |
| [upload.veerka.mp](https://upload.veerka.mp) | Briefkasten an der Rohrpost | Herkunft in `CORS_HERKUNFT` des Upload-Workers |
| [broadcast.veerka.mp](https://broadcast.veerka.mp) | Bild im Eis der Quelle | keine – der Worker holt serverseitig |
| Solana RPC, CoinGecko, Binance | Solana-Fenster | keine – CORS `*` |

## Mehr

[HANDOVER.md](HANDOVER.md) ist die ausführliche Dokumentation: jede
Entscheidung mit Begründung und Messwert, was verworfen wurde und warum, was
offen ist. [CLAUDE.md](CLAUDE.md) fasst die Regeln für die Arbeit mit
Coding-Agenten zusammen.

Die frühere Kachelseite von veerka.mp steckt in der Historie dieses Repos
(`git log def8f43`).
