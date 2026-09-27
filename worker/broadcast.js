// Die gefrorene Quelle am See zeigt, was gerade auf broadcast.veerka.mp
// laeuft. Der Dienst schickt keinen CORS-Kopf, und WebGL nimmt ein Bild von
// fremder Adresse nicht als Textur – also holt der Worker beides und reicht
// es unter der eigenen Adresse weiter. Am Broadcast-Dienst aendert sich
// nichts. Gegenstueck im Spiel: src/stations/broadcast.js.

import { json, fehler } from './antwort.js'

const BROADCAST = 'https://broadcast.veerka.mp'
// So sehen die Schluessel dort aus: 2026/09/26/vh58tleJ-team2.jpg. Alles
// andere (Punkte am Anfang, Schraegstriche im Namen) kommt nicht durch.
const SCHLUESSEL = /^\d{4}\/\d{2}\/\d{2}\/[\w-]{4,}-[\w.\- ()]{1,200}$/

export const broadcastSchluessel = (key) => typeof key === 'string' && SCHLUESSEL.test(key) && !key.includes('..')

async function broadcastStand() {
  const r = await fetch(`${BROADCAST}/api/state`, { cf: { cacheTtl: 20, cacheEverything: true } })
  if (!r.ok) return json({ message: null, fehler: r.status }, 502)
  const { message: m } = await r.json()
  // Nur, was die Quelle braucht – Anmeldestand und Grenzen des Dienstes
  // gehen niemanden im Tal etwas an.
  const message = m && {
    id: m.id,
    text: String(m.text ?? '').slice(0, 2000),
    createdAt: m.createdAt,
    expiresAt: m.expiresAt,
    attachments: (m.attachments ?? []).map(({ key, name, contentType, size, inline }) => ({ key, name, contentType, size, inline: inline || null })),
  }
  return json({ message }, 200, { 'cache-control': 'public, max-age=20' })
}

async function broadcastDatei(request, url) {
  const key = url.searchParams.get('key') ?? ''
  if (!broadcastSchluessel(key)) return fehler('Schlüssel ungültig')
  const kopf = {}
  const range = request.headers.get('range')
  if (range) kopf.range = range
  const r = await fetch(`${BROADCAST}/api/file?key=${encodeURIComponent(key)}`, { headers: kopf })
  if (r.status !== 200 && r.status !== 206) return fehler('Nicht gefunden', r.status === 416 ? 416 : 404)
  // Nur Bilder, und kein SVG: alles andere liefe unter dem Namen des Spiels
  // aus und koennte dort Skript mitbringen. Videos liefen nicht zuverlaessig
  // und sind seit 27.09. wieder draussen; Ton war nie dabei.
  const typ = r.headers.get('content-type') ?? ''
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(typ.split(';')[0].trim())) {
    return fehler('Diese Sorte zeigt die Quelle nicht', 415)
  }
  const aus = new Headers({
    'content-type': typ,
    'cache-control': 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'",
    'accept-ranges': 'bytes',
  })
  for (const h of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const v = r.headers.get(h)
    if (v) aus.set(h, v)
  }
  return new Response(r.body, { status: r.status, headers: aus })
}

export function broadcast(request, pfad) {
  if (request.method !== 'GET') return fehler('Nicht gefunden', 404)
  if (pfad === '/api/broadcast/state') return broadcastStand()
  if (pfad === '/api/broadcast/file') return broadcastDatei(request, new URL(request.url))
  return fehler('Nicht gefunden', 404)
}
