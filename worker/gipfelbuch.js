// Das Gipfelbuch, Gegenstueck zu src/menu/gipfelbuch.js.
//
// Wer oben an der Nordabfahrt das Buch findet, kann sich eintragen: ein Name
// und ein paar Zeilen. Oeffentlich steht ein Eintrag erst, wenn Julian ihn
// gelesen und freigegeben hat (frei = 1). Eine Sperrliste allein reicht fuer
// freien Text nicht, und das Tal ist seine Seite. Wer schreibt, sieht den
// eigenen Eintrag sofort – das Spiel merkt ihn sich im Browser.
//
// Freigeben und loeschen kann Julian direkt im Buch: angemeldet mit einem
// Einmalcode (GIPFELBUCH_OTP, worker/totp.js), danach haelt ein signiertes
// Cookie die Sitzung (GIPFELBUCH_SITZUNG). wrangler d1 execute geht weiter,
// siehe HANDOVER.
//
// Regeln: Name wie in den Bestenlisten (2–16 Zeichen), Text 3–240 Zeichen,
// keine Links (dafuer ist ein Gipfelbuch nicht da, und Spam kommt fast nur
// mit Links), hoechstens drei Eintraege je Adresse und Tag.

import { json, fehler } from './antwort.js'
import { nameGlaetten, gesperrt, adresse as adresseVon, signieren, pruefen } from './marken.js'
import { pruefeCode } from './totp.js'

const PRO_TAG = 3
const ZEIGEN = 40
export const TEXT_MIN = 3
export const TEXT_MAX = 240

export function textPruefen(roh) {
  if (typeof roh !== 'string') return { fehler: 'Text fehlt' }
  const text = roh.normalize('NFC').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  const laenge = [...text].length
  if (laenge < TEXT_MIN) return { fehler: 'Ein paar Worte mehr, bitte' }
  if (laenge > TEXT_MAX) return { fehler: `Höchstens ${TEXT_MAX} Zeichen` }
  if (/https?:|www\.|\.(com|de|net|org|io|ru|xyz|ly|me)\b/i.test(text)) return { fehler: 'Bitte ohne Links' }
  if (gesperrt(text)) return { fehler: 'So nicht ins Gipfelbuch' }
  return { text }
}

const oeffentlich = ({ id, name, text, erstellt }) => ({ id, name, text, erstellt })

// --- Julians Anmeldung -------------------------------------------------------

const COOKIE = 'gb_sitzung'
const SITZUNG_TAGE = 30
// Sechs Ziffern mit drei gueltigen Schritten sind 1 : 333 333 je Versuch.
// Zwanzig Fehlversuche je Tag, ueber alle Adressen zusammen (je Adresse
// hilft nicht, Adressen gibt es genug): so braucht Raten im Mittel 45 Jahre.
// Wer es versucht, sperrt Julian hoechstens einen Tag aus – freigeben geht
// dann noch mit wrangler.
const FEHL_PRO_TAG = 20

// Die Tabelle legt der Worker selbst an: Workers Builds spielt keine
// Migrationen ein, und ein vergessenes `migrations apply` sperrte genau den
// aus, der es nachholen muesste.
let tabelleDa = false
async function versuche(env) {
  if (!tabelleDa) {
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS gipfelbuch_anmeldung (
      zeit INTEGER NOT NULL, ok INTEGER NOT NULL, schritt INTEGER)`).run()
    tabelleDa = true
  }
  return env.DB
}

async function anmelden(request, env) {
  if (!env.GIPFELBUCH_OTP || !env.GIPFELBUCH_SITZUNG) return fehler('Anmelden ist hier nicht eingerichtet', 503)
  const body = await request.json().catch(() => null)
  const db = await versuche(env)
  const jetzt = Date.now()
  const fehl = await db.prepare('SELECT COUNT(*) AS n FROM gipfelbuch_anmeldung WHERE ok = 0 AND zeit > ?1')
    .bind(jetzt - 86400000).first('n')
  if ((fehl ?? 0) >= FEHL_PRO_TAG) return fehler('Zu viele Versuche – morgen wieder', 429)

  const schritt = await pruefeCode(env.GIPFELBUCH_OTP, String(body?.code ?? '').replace(/\s/g, ''), jetzt)
  // Ein Code gilt nur einmal: wer ihn mitliest, kommt damit nicht mehr rein.
  const zuletzt = await db.prepare('SELECT MAX(schritt) AS s FROM gipfelbuch_anmeldung WHERE ok = 1').first('s')
  const ok = schritt !== null && schritt > (zuletzt ?? -1)
  await db.batch([
    db.prepare('INSERT INTO gipfelbuch_anmeldung (zeit, ok, schritt) VALUES (?1, ?2, ?3)').bind(jetzt, ok ? 1 : 0, ok ? schritt : null),
    db.prepare('DELETE FROM gipfelbuch_anmeldung WHERE zeit < ?1').bind(jetzt - 30 * 86400000),
  ])
  if (!ok) return fehler(schritt === null ? 'Der Code stimmt nicht' : 'Der Code war schon dran – den nächsten, bitte', 403)

  const bis = jetzt + SITZUNG_TAGE * 86400000
  const marke = await signieren(env, { zweck: 'gipfelbuch', bis }, 'GIPFELBUCH_SITZUNG')
  // HttpOnly: das Spiel muss die Marke nie lesen. SameSite=Strict genuegt
  // gegen fremde Seiten, die im Namen Julians freigeben wollen.
  return json({ ok: true, bis }, 200, {
    'set-cookie': `${COOKIE}=${marke}; Path=/api/gipfelbuch; Max-Age=${SITZUNG_TAGE * 86400}; HttpOnly; Secure; SameSite=Strict`,
  })
}

export async function istJulian(request, env) {
  if (!env.GIPFELBUCH_SITZUNG) return false
  const m = (request.headers.get('cookie') ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (!m) return false
  const inhalt = await pruefen(env, m[1], 'GIPFELBUCH_SITZUNG')
  return inhalt?.zweck === 'gipfelbuch' && inhalt.bis > Date.now()
}

async function verwalten(request, env, pfad) {
  if (!(await istJulian(request, env))) return fehler('Nicht angemeldet', 401)
  if (pfad === '/api/gipfelbuch/offen' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, text, erstellt FROM gipfelbuch WHERE frei = 0 ORDER BY erstellt DESC LIMIT 100',
    ).all()
    return json({ eintraege: results.map(oeffentlich) })
  }
  if (request.method !== 'POST') return fehler('Nicht gefunden', 404)
  const id = Number((await request.json().catch(() => null))?.id)
  if (!Number.isInteger(id) || id < 1) return fehler('Welcher Eintrag?')
  const r = pfad === '/api/gipfelbuch/freigeben'
    ? await env.DB.prepare('UPDATE gipfelbuch SET frei = 1 WHERE id = ?1').bind(id).run()
    : await env.DB.prepare('DELETE FROM gipfelbuch WHERE id = ?1').bind(id).run()
  if (!r.meta.changes) return fehler('Den Eintrag gibt es nicht mehr', 404)
  return json({ ok: true, id })
}

export async function gipfelbuch(request, env, pfad) {
  if (pfad === '/api/gipfelbuch/liste' && request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, name, text, erstellt FROM gipfelbuch WHERE frei = 1 ORDER BY erstellt DESC LIMIT ?1',
    ).bind(ZEIGEN).all()
    const zahl = await env.DB.prepare('SELECT COUNT(*) AS n FROM gipfelbuch WHERE frei = 1').first('n')
    return json({ eintraege: results.map(oeffentlich), zahl: zahl ?? 0 }, 200, { 'cache-control': 'public, max-age=30' })
  }

  if (pfad === '/api/gipfelbuch/eintragen' && request.method === 'POST') {
    const body = await request.json().catch(() => null)
    if (!body) return fehler('Das kam nicht an')
    const n = nameGlaetten(body.name)
    if (!n) return fehler('Name: 2–16 Buchstaben oder Ziffern')
    const t = textPruefen(body.text)
    if (t.fehler) return fehler(t.fehler)
    const wer = await adresseVon(request, 'gipfelbuch')
    const heute = await env.DB.prepare('SELECT COUNT(*) AS n FROM gipfelbuch WHERE wer = ?1 AND erstellt > ?2')
      .bind(wer, Date.now() - 86400000).first('n')
    if ((heute ?? 0) >= PRO_TAG) return fehler('Für heute ist genug geschrieben – morgen wieder', 429)
    const erstellt = Date.now()
    const r = await env.DB.prepare('INSERT INTO gipfelbuch (name, text, erstellt, wer) VALUES (?1, ?2, ?3, ?4)')
      .bind(n.name, t.text, erstellt, wer).run()
    return json({ id: r.meta.last_row_id, name: n.name, text: t.text, erstellt })
  }

  if (pfad === '/api/gipfelbuch/anmelden' && request.method === 'POST') return anmelden(request, env)
  if (pfad === '/api/gipfelbuch/abmelden' && request.method === 'POST') {
    return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/api/gipfelbuch; Max-Age=0; HttpOnly; Secure; SameSite=Strict` })
  }
  if (['/api/gipfelbuch/offen', '/api/gipfelbuch/freigeben', '/api/gipfelbuch/loeschen'].includes(pfad)) {
    return verwalten(request, env, pfad)
  }

  return fehler('Nicht gefunden', 404)
}
