// Die Bestenliste des Slaloms. Der Worker liefert sonst nur die Dateien aus
// dist/ aus; er springt allein fuer /api/* an (run_worker_first).
//
// Das Spiel laeuft ganz im Browser, also kann eine Zeit nie bewiesen werden –
// wer will, schickt irgendeine Zahl. Was hier geprueft wird, macht das nur
// muehsam genug, dass es sich fuer ein Spielzeugtal nicht lohnt:
//
// 1. Die Uhr laeuft auch hier. Beim Durchfahren des Startbogens holt das
//    Spiel eine signierte Startmarke, im Ziel eine Zielmarke. Die Zeit
//    dazwischen muss zur gemeldeten Fahrzeit passen: −0,8 bis +0,6 s fuer
//    das Netz. Nach oben knapp, denn dort liegt der Betrug – wer 4,4 s
//    faehrt und 3,6 meldet, faellt auf. Unter 24 Bildern je Sekunde laeuft
//    die Spieluhr langsamer als die Wanduhr (dt ist bei 1/24 gedeckelt);
//    ein so langsamer Rechner faehrt keine Bestzeit und verliert nichts.
// 2. Die Zeit muss moeglich sein. Der Testfahrer mit Vorausschau schafft
//    3,58 s; unter 3,4 s gilt nichts.
// 3. Jede Startmarke zaehlt einmal (UNIQUE in der Tabelle), jede Adresse
//    hoechstens 40 Eintraege am Tag.
// 4. Namen: 2–16 Zeichen, nur Buchstaben, Ziffern, Leerzeichen, - _ ' und
//    eine kurze Sperrliste. Loeschen geht mit wrangler d1 execute.

const PENALTY = 2
const GATES = 4
const MIN_ZEIT = 3.4
const MIN_FAHRT = 3.0
const MARKE_GILT = 15 * 60 * 1000   // so lange darf man ueber dem Namen gruebeln
const PRO_TAG = 40
const TAGE = 30

// Teilwoerter, nach dem Glaetten von 0→o, 1→i, 3→e, 4→a, 5→s, @→a.
const SPERRE = [
  'nazi', 'hitler', 'fotze', 'hure', 'schlampe', 'wichser', 'neger', 'nigg',
  'fick', 'fuck', 'cunt', 'whore', 'slut', 'bitch', 'kanake', 'schwuchtel',
  'spast', 'missgeburt', 'arschloch', 'penis', 'vagina', 'porn', 'sieg heil',
]

const json = (daten, status = 200, extra = {}) => new Response(JSON.stringify(daten), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
})
const fehler = (text, status = 400) => json({ fehler: text }, status)

// --- Marken: base64url(JSON) . base64url(HMAC-SHA256) -----------------------

const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64 = (text) => Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

async function schluessel(env) {
  if (!env.SLALOM_GEHEIM) throw new Error('SLALOM_GEHEIM fehlt')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SLALOM_GEHEIM),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

async function signieren(env, inhalt) {
  const roh = new TextEncoder().encode(JSON.stringify(inhalt))
  const sig = await crypto.subtle.sign('HMAC', await schluessel(env), roh)
  return `${b64(roh)}.${b64(sig)}`
}

async function pruefen(env, marke) {
  if (typeof marke !== 'string' || marke.length > 400) return null
  const [teil, sig] = marke.split('.')
  if (!teil || !sig) return null
  try {
    const roh = unb64(teil)
    const ok = await crypto.subtle.verify('HMAC', await schluessel(env), unb64(sig), roh)
    return ok ? JSON.parse(new TextDecoder().decode(roh)) : null
  } catch {
    return null
  }
}

// --- Namen -------------------------------------------------------------------

export function nameGlaetten(roh) {
  if (typeof roh !== 'string') return null
  const name = roh.normalize('NFC').replace(/\s+/g, ' ').trim()
  const laenge = [...name].length
  if (laenge < 2 || laenge > 16) return null
  if (!/^[\p{L}\p{N}][\p{L}\p{N} _'\-]*$/u.test(name)) return null
  const flach = name.toLowerCase()
    .replace(/0/g, 'o').replace(/1/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5/g, 's')
  const ohneLuecken = flach.replace(/[\s_'\-]/g, '')
  if (SPERRE.some((w) => flach.includes(w) || ohneLuecken.includes(w.replace(/\s/g, '')))) return null
  return { name, schluessel: ohneLuecken }
}

// --- Plausibilitaet ------------------------------------------------------------

export function fahrtPruefen({ zeit, fahrzeit, verfehlt, tore }, uhr) {
  if (![zeit, fahrzeit].every(Number.isFinite)) return 'Zeit fehlt'
  if (!Number.isInteger(verfehlt) || verfehlt < 0 || verfehlt > GATES) return 'Tore passen nicht'
  if (Math.abs(fahrzeit + verfehlt * PENALTY - zeit) > 0.011) return 'Strafzeit passt nicht'
  if (zeit < MIN_ZEIT || fahrzeit < MIN_FAHRT) return 'Das ist schneller als möglich'
  if (zeit > 60) return 'Zu langsam für die Liste'
  if (!Array.isArray(tore) || tore.length !== GATES || !tore.every(Number.isFinite)) return 'Tore fehlen'
  for (let i = 0; i < GATES; i++) {
    // Das erste Tor steht sieben Meter hinter dem Start; der Autopilot
    // war nach 0,33 s dort.
    if (tore[i] <= (i ? tore[i - 1] : 0.15) || tore[i] >= zeit) return 'Zwischenzeiten passen nicht'
  }
  if (uhr !== undefined) {
    const s = uhr / 1000
    if (s < fahrzeit - 0.8 || s > fahrzeit + 0.6) return 'Die Uhr sagt etwas anderes'
  }
  return null
}

async function adresse(request) {
  const ip = request.headers.get('cf-connecting-ip') ?? 'lokal'
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`slalom:${ip}`))
  return b64(h).slice(0, 22)
}

// Die Besten je Name im Zeitfenster. Ohne LIMIT, damit auch der Platz eines
// Eintrags jenseits der ersten zwanzig stimmt; gedeckelt bei 500.
async function rangliste(env, tage = TAGE) {
  const seit = Date.now() - tage * 86400000
  const { results } = await env.DB.prepare(`
    SELECT id, name, schluessel, zeit, verfehlt, erstellt FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY schluessel ORDER BY zeit, erstellt) AS rn
      FROM fahrten WHERE erstellt > ?1
    ) WHERE rn = 1 ORDER BY zeit, erstellt LIMIT 500`).bind(seit).all()
  const zahl = await env.DB.prepare('SELECT COUNT(*) AS n FROM fahrten WHERE erstellt > ?1').bind(seit).first('n')
  return { liste: results, fahrten: zahl ?? 0 }
}

const oeffentlich = ({ id, name, zeit, verfehlt, erstellt }) => ({ id, name, zeit, verfehlt, erstellt })

// --- Broadcast ---------------------------------------------------------------
//
// Die gefrorene Quelle am See zeigt, was gerade auf broadcast.veerka.mp
// laeuft. Der Dienst schickt keinen CORS-Kopf, und WebGL nimmt ein Bild von
// fremder Adresse nicht als Textur – also holt der Worker beides und reicht
// es unter der eigenen Adresse weiter. Am Broadcast-Dienst aendert sich
// nichts.

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

// --- Routen ------------------------------------------------------------------

async function api(request, env, pfad) {
  if (pfad === '/api/broadcast/state' && request.method === 'GET') return broadcastStand()
  if (pfad === '/api/broadcast/file' && request.method === 'GET') return broadcastDatei(request, new URL(request.url))

  if (pfad === '/api/slalom/top' && request.method === 'GET') {
    const { liste, fahrten } = await rangliste(env)
    return json({ tage: TAGE, fahrten, fahrer: liste.length, liste: liste.slice(0, 20).map(oeffentlich) }, 200,
      { 'cache-control': 'public, max-age=15' })
  }

  if (request.method !== 'POST') return fehler('Nicht gefunden', 404)
  let body = {}
  try { body = await request.json() } catch { /* leer ist erlaubt */ }

  if (pfad === '/api/slalom/start') {
    return json({ lauf: await signieren(env, { l: crypto.randomUUID(), t0: Date.now() }) })
  }

  if (pfad === '/api/slalom/ziel') {
    const start = await pruefen(env, body.lauf)
    if (!start?.l || start.t1) return fehler('Startmarke ungültig')
    if (Date.now() - start.t0 > 5 * 60 * 1000) return fehler('Startmarke abgelaufen')
    return json({ ziel: await signieren(env, { l: start.l, t0: start.t0, t1: Date.now() }) })
  }

  if (pfad === '/api/slalom/eintragen') {
    const ziel = await pruefen(env, body.ziel)
    if (!ziel?.l || !ziel.t1) return fehler('Zielmarke ungültig')
    if (Date.now() - ziel.t1 > MARKE_GILT) return fehler('Zu lange gewartet – einfach nochmal fahren')
    const n = nameGlaetten(body.name)
    if (!n) return fehler('Name: 2–16 Zeichen, Buchstaben und Ziffern')
    const fahrt = {
      zeit: Math.round(Number(body.zeit) * 100) / 100,
      fahrzeit: Number(body.fahrzeit),
      verfehlt: body.verfehlt,
      tore: body.tore,
    }
    const warum = fahrtPruefen(fahrt, ziel.t1 - ziel.t0)
    if (warum) return fehler(warum, 422)

    const wer = await adresse(request)
    const heute = await env.DB.prepare('SELECT COUNT(*) AS n FROM fahrten WHERE wer = ?1 AND erstellt > ?2')
      .bind(wer, Date.now() - 86400000).first('n')
    if (heute >= PRO_TAG) return fehler('Für heute reicht es – morgen wieder', 429)

    const vorher = await env.DB.prepare(
      'SELECT MIN(zeit) AS z FROM fahrten WHERE schluessel = ?1 AND erstellt > ?2',
    ).bind(n.schluessel, Date.now() - TAGE * 86400000).first('z')

    let id
    try {
      const r = await env.DB.prepare(
        'INSERT INTO fahrten (lauf, name, schluessel, zeit, verfehlt, erstellt, wer) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
      ).bind(ziel.l, n.name, n.schluessel, fahrt.zeit, fahrt.verfehlt, Date.now(), wer).run()
      id = r.meta.last_row_id
    } catch (e) {
      if (String(e).includes('UNIQUE')) return fehler('Dieser Lauf steht schon drin', 409)
      throw e
    }

    const { liste, fahrten } = await rangliste(env)
    const platz = liste.findIndex((f) => f.schluessel === n.schluessel) + 1
    return json({
      id, platz, name: n.name,
      bestzeit: vorher === null || fahrt.zeit < vorher,
      tage: TAGE, fahrten, fahrer: liste.length,
      liste: liste.slice(0, 20).map(oeffentlich),
    })
  }

  return fehler('Nicht gefunden', 404)
}

export default {
  async fetch(request, env) {
    const pfad = new URL(request.url).pathname
    if (!pfad.startsWith('/api/')) return env.ASSETS.fetch(request)
    try {
      return await api(request, env, pfad)
    } catch (e) {
      console.error(e)
      return fehler('Da ist etwas schiefgegangen', 500)
    }
  },
}
