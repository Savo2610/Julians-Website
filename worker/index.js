// Der Worker hinter veerka.mp. Die Seite selbst sind
// die gebauten Dateien aus dist/; der Worker springt nur an, wo
// run_worker_first in wrangler.jsonc es sagt:
//
// - /api/* – die Bestenlisten des Slaloms (slalom.js) und des Kabelsees
//   (kabelsee.js) und die laufende Sendung fuer die gefrorene Quelle
//   (broadcast.js). Gleicher Host wie das
//   Spiel: kein CORS, kein eigener DNS-Eintrag.
// - /      – www.veerka.mp leitet auf veerka.mp um. Pistenpass, Bestzeit und
//   Ticket liegen im localStorage, und der gilt je Adresse: ohne Umleitung
//   finge man auf www wieder bei null an.

import { fehler } from './antwort.js'
import { slalom } from './slalom.js'
import { kabelsee } from './kabelsee.js'
import { broadcast } from './broadcast.js'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/')) return startseite(request, env, url)
    try {
      if (url.pathname.startsWith('/api/slalom/')) return await slalom(request, env, url.pathname)
      if (url.pathname.startsWith('/api/kabelsee/')) return await kabelsee(request, env, url.pathname)
      if (url.pathname.startsWith('/api/broadcast/')) return await broadcast(request, url.pathname)
      return fehler('Nicht gefunden', 404)
    } catch (e) {
      console.error(e)
      return fehler('Da ist etwas schiefgegangen', 500)
    }
  },
}

// Nur Seitenaufrufe werden umgeleitet: ein 301 auf einen POST an /api/
// kaeme als GET an und verloere den Eintrag in die Bestenliste.
// no-cache, weil index.html nach einem Update sonst auf Dateien unter
// /assets/ zeigt, die es nicht mehr gibt. _headers greift hier nicht, sobald
// der Worker antwortet.
async function startseite(request, env, url) {
  if (url.hostname.startsWith('www.')) {
    url.hostname = url.hostname.slice(4)
    return Response.redirect(url.toString(), 301)
  }
  const r = await env.ASSETS.fetch(request)
  const antwort = new Response(r.body, r)
  antwort.headers.set('cache-control', 'no-cache')
  return antwort
}
