// Die Bestenliste des Kabelsees, Gegenstueck zu src/sommer/bestenliste.js.
//
// Wie beim Slalom (slalom.js) laesst sich im Browser nichts beweisen; die
// Pruefung macht Schummeln nur muehsam:
//
// 1. Beim Start am Steg holt das Spiel eine signierte Startmarke, nach der
//    dritten Runde eine Zielmarke. Dazwischen muessen mindestens 80 s
//    liegen: drei Runden sind 3 × 438 m Seil bei 15 m/s, also 88 s, und
//    vorbeiziehen kann man am Mitnehmer hoechstens um die 17 m Seil.
// 2. Die Punkte muessen moeglich sein: hoechstens 1 000 000 und hoechstens
//    8 000 je Sekunde der Session. Gefahren kam Julian auf 40 000 bis
//    60 000; Bojen, Ringe und Tore legen am Ende hoechstens das 1,5-Fache
//    drauf (session.js sammelBonus), also um 150 000 in gut 90 s. Die
//    Grenzen lassen dem reichlich Luft und fangen nur Unsinn.
// 3. Jede Startmarke zaehlt einmal, jede Adresse hoechstens 40 Eintraege am
//    Tag, Namen wie beim Slalom (marken.js).
// Die Marken tragen k: 'kabelsee', damit keine Slalom-Marke hier gilt.

import { json, fehler } from './antwort.js'
import { signieren, pruefen, nameGlaetten, adresse } from './marken.js'

const MIN_DAUER = 80
const MAX_DAUER = 20 * 60
const MAX_PUNKTE = 1000000
const PUNKTE_JE_S = 8000
const MARKE_GILT = 15 * 60 * 1000
const PRO_TAG = 40
const TAGE = 30

export function sessionPruefen({ punkte }, dauerMs) {
  if (!Number.isInteger(punkte) || punkte < 0) return 'Punkte fehlen'
  if (punkte === 0) return 'Ohne Punkte keine Liste'
  const s = dauerMs / 1000
  if (!(s >= MIN_DAUER)) return 'So schnell sind drei Runden nicht vorbei'
  if (s > MAX_DAUER) return 'Die Session hat zu lange gedauert'
  if (punkte > MAX_PUNKTE || punkte > s * PUNKTE_JE_S) return 'So viele Punkte gehen nicht'
  return null
}

async function rangliste(env, tage = TAGE) {
  const seit = Date.now() - tage * 86400000
  const { results } = await env.DB.prepare(`
    SELECT id, name, schluessel, punkte, erstellt FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY schluessel ORDER BY punkte DESC, erstellt) AS rn
      FROM kabelsee WHERE erstellt > ?1
    ) WHERE rn = 1 ORDER BY punkte DESC, erstellt LIMIT 500`).bind(seit).all()
  const zahl = await env.DB.prepare('SELECT COUNT(*) AS n FROM kabelsee WHERE erstellt > ?1').bind(seit).first('n')
  return { liste: results, sessions: zahl ?? 0 }
}

const oeffentlich = ({ id, name, punkte, erstellt }) => ({ id, name, punkte, erstellt })

export async function kabelsee(request, env, pfad) {
  if (pfad === '/api/kabelsee/top' && request.method === 'GET') {
    const { liste, sessions } = await rangliste(env)
    return json({ tage: TAGE, sessions, fahrer: liste.length, liste: liste.slice(0, 20).map(oeffentlich) }, 200,
      { 'cache-control': 'public, max-age=15' })
  }

  if (request.method !== 'POST') return fehler('Nicht gefunden', 404)
  let body = {}
  try { body = await request.json() } catch { /* leer ist erlaubt */ }

  if (pfad === '/api/kabelsee/start') {
    return json({ lauf: await signieren(env, { k: 'kabelsee', l: crypto.randomUUID(), t0: Date.now() }) })
  }

  if (pfad === '/api/kabelsee/ziel') {
    const start = await pruefen(env, body.lauf)
    if (start?.k !== 'kabelsee' || !start.l || start.t1) return fehler('Startmarke ungültig')
    if (Date.now() - start.t0 > MAX_DAUER * 1000) return fehler('Startmarke abgelaufen')
    return json({ ziel: await signieren(env, { k: 'kabelsee', l: start.l, t0: start.t0, t1: Date.now() }) })
  }

  if (pfad === '/api/kabelsee/eintragen') {
    const ziel = await pruefen(env, body.ziel)
    if (ziel?.k !== 'kabelsee' || !ziel.l || !ziel.t1) return fehler('Zielmarke ungültig')
    if (Date.now() - ziel.t1 > MARKE_GILT) return fehler('Zu lange gewartet – einfach nochmal fahren')
    const n = nameGlaetten(body.name)
    if (!n) return fehler('Name: 2–16 Zeichen, Buchstaben und Ziffern')
    const session = { punkte: body.punkte }
    const warum = sessionPruefen(session, ziel.t1 - ziel.t0)
    if (warum) return fehler(warum, 422)

    const wer = await adresse(request, 'kabelsee')
    const heute = await env.DB.prepare('SELECT COUNT(*) AS n FROM kabelsee WHERE wer = ?1 AND erstellt > ?2')
      .bind(wer, Date.now() - 86400000).first('n')
    if (heute >= PRO_TAG) return fehler('Für heute reicht es – morgen wieder', 429)

    const vorher = await env.DB.prepare(
      'SELECT MAX(punkte) AS p FROM kabelsee WHERE schluessel = ?1 AND erstellt > ?2',
    ).bind(n.schluessel, Date.now() - TAGE * 86400000).first('p')

    let id
    try {
      const r = await env.DB.prepare(
        'INSERT INTO kabelsee (lauf, name, schluessel, punkte, erstellt, wer) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
      ).bind(ziel.l, n.name, n.schluessel, session.punkte, Date.now(), wer).run()
      id = r.meta.last_row_id
    } catch (e) {
      if (String(e).includes('UNIQUE')) return fehler('Diese Session steht schon drin', 409)
      throw e
    }

    const { liste, sessions } = await rangliste(env)
    const platz = liste.findIndex((f) => f.schluessel === n.schluessel) + 1
    return json({
      id, platz, name: n.name,
      bestwert: vorher === null || session.punkte > vorher,
      tage: TAGE, sessions, fahrer: liste.length,
      liste: liste.slice(0, 20).map(oeffentlich),
    })
  }

  return fehler('Nicht gefunden', 404)
}
