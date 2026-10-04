// Das Gipfelbuch, Gegenstueck zu src/menu/gipfelbuch.js.
//
// Wer oben an der Nordabfahrt das Buch findet, kann sich eintragen: ein Name
// und ein paar Zeilen. Oeffentlich steht ein Eintrag erst, wenn Julian ihn
// gelesen und freigegeben hat (frei = 1). Eine Sperrliste allein reicht fuer
// freien Text nicht, und das Tal ist seine Seite. Wer schreibt, sieht den
// eigenen Eintrag sofort – das Spiel merkt ihn sich im Browser.
//
// Freigeben und loeschen gehen mit wrangler d1 execute, siehe HANDOVER.
//
// Regeln: Name wie in den Bestenlisten (2–16 Zeichen), Text 3–240 Zeichen,
// keine Links (dafuer ist ein Gipfelbuch nicht da, und Spam kommt fast nur
// mit Links), hoechstens drei Eintraege je Adresse und Tag.

import { json, fehler } from './antwort.js'
import { nameGlaetten, gesperrt, adresse as adresseVon } from './marken.js'

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

  return fehler('Nicht gefunden', 404)
}
