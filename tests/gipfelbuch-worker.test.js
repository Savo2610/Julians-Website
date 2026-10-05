import test from 'node:test'
import assert from 'node:assert/strict'
import { textPruefen, TEXT_MAX } from '../worker/gipfelbuch.js'

test('Gipfelbuch: Text wird geglaettet und begrenzt', () => {
  assert.deepEqual(textPruefen('  Schöne   Abfahrt!  '), { text: 'Schöne Abfahrt!' })
  assert.deepEqual(textPruefen('Zeile eins\n\n\n\nZeile zwei'), { text: 'Zeile eins\n\nZeile zwei' })
  assert.match(textPruefen('hi').fehler, /Worte/)
  assert.match(textPruefen('x'.repeat(TEXT_MAX + 1)).fehler, /Höchstens/)
  assert.ok(textPruefen('x'.repeat(TEXT_MAX)).text)
  assert.match(textPruefen(42).fehler, /fehlt/)
})

test('Gipfelbuch: keine Links, keine Beleidigungen', () => {
  assert.match(textPruefen('Schau mal auf https://example.org').fehler, /Links/)
  assert.match(textPruefen('www.irgendwas zum Kaufen').fehler, /Links/)
  assert.match(textPruefen('billig bei shop.com kaufen').fehler, /Links/)
  assert.match(textPruefen('du bist ein Arschl0ch').fehler, /So nicht/)
  // Ueber Wortgrenzen hinweg wird nicht gesucht: "Alpen ist schön" bleibt.
  assert.ok(textPruefen('Die Alpen ist schön, sagt man.').text)
  assert.ok(textPruefen('Danke für die Klammschanze, 24,6 m!').text)
})

// --- Julians Anmeldung -------------------------------------------------------

import { base32, code, pruefeCode } from '../worker/totp.js'
import { gipfelbuch, istJulian } from '../worker/gipfelbuch.js'

// RFC 6238, Anhang B: Geheimnis "12345678901234567890", SHA-1, 8 Ziffern –
// die letzten sechs davon sind unser Code.
const RFC = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'

test('TOTP: Testwerte aus RFC 6238', async () => {
  assert.equal(new TextDecoder().decode(base32(RFC)), '12345678901234567890')
  assert.equal(new TextDecoder().decode(base32('gezd gnbv gy3t qojq gezd gnbv gy3t qojq')), '12345678901234567890')
  assert.equal(await code(RFC, Math.floor(59 / 30)), '287082')
  assert.equal(await code(RFC, Math.floor(1111111109 / 30)), '081804')
  assert.equal(await code(RFC, Math.floor(1234567890 / 30)), '005924')
  assert.equal(await code(RFC, Math.floor(2000000000 / 30)), '279037')
})

test('TOTP: ein Schritt daneben gilt, zwei nicht', async () => {
  const t = 1234567890 * 1000
  const s = Math.floor(1234567890 / 30)
  assert.equal(await pruefeCode(RFC, '005924', t), s)
  assert.equal(await pruefeCode(RFC, '005924', t + 30000), s)
  assert.equal(await pruefeCode(RFC, '005924', t + 60000), null)
  assert.equal(await pruefeCode(RFC, '5924', t), null)
  assert.equal(await pruefeCode(RFC, undefined, t), null)
})

// Gerade genug D1, um die Anmeldung durchzuspielen.
function falscheDb() {
  const versuche = []
  const anweisung = (sql, args = []) => ({
    bind: (...a) => anweisung(sql, a),
    run: async () => {
      if (sql.startsWith('INSERT INTO gipfelbuch_anmeldung')) versuche.push({ zeit: args[0], ok: args[1], schritt: args[2] })
      return { meta: { changes: 1 } }
    },
    first: async () => {
      if (sql.includes('ok = 0')) return versuche.filter((v) => !v.ok && v.zeit > args[0]).length
      if (sql.includes('MAX(schritt)')) return Math.max(-1, ...versuche.filter((v) => v.ok).map((v) => v.schritt))
      return null
    },
    all: async () => ({ results: [] }),
  })
  return { versuche, prepare: (sql) => anweisung(sql), batch: async (l) => Promise.all(l.map((a) => a.run())) }
}

const anfrage = (body, cookie) => new Request('https://veerka.mp/api/gipfelbuch/anmelden', {
  method: 'POST', body: JSON.stringify(body), headers: cookie ? { cookie } : {},
})

test('Gipfelbuch: Anmelden mit Code, einmal je Code, Sitzung im Cookie', async () => {
  const env = { DB: falscheDb(), GIPFELBUCH_OTP: RFC, GIPFELBUCH_SITZUNG: 'test-sitzung' }
  const jetzt = await code(RFC, Math.floor(Date.now() / 30000))

  const falsch = await gipfelbuch(anfrage({ code: jetzt === '000000' ? '000001' : '000000' }), env, '/api/gipfelbuch/anmelden')
  assert.equal(falsch.status, 403)

  const r = await gipfelbuch(anfrage({ code: jetzt }), env, '/api/gipfelbuch/anmelden')
  assert.equal(r.status, 200)
  const keks = r.headers.get('set-cookie')
  assert.match(keks, /HttpOnly; Secure; SameSite=Strict/)
  const cookie = keks.split(';')[0]

  const nochmal = await gipfelbuch(anfrage({ code: jetzt }), env, '/api/gipfelbuch/anmelden')
  assert.equal(nochmal.status, 403, 'derselbe Code ein zweites Mal')

  assert.equal(await istJulian(new Request('https://veerka.mp/', { headers: { cookie: `x=1; ${cookie}` } }), env), true)
  assert.equal(await istJulian(new Request('https://veerka.mp/', { headers: { cookie: cookie + 'x' } }), env), false)
  assert.equal(await istJulian(new Request('https://veerka.mp/', { headers: { cookie } }), { ...env, GIPFELBUCH_SITZUNG: 'anders' }), false)
  const offen = await gipfelbuch(new Request('https://veerka.mp/api/gipfelbuch/offen'), env, '/api/gipfelbuch/offen')
  assert.equal(offen.status, 401, 'ohne Cookie nichts zu lesen')
})

test('Gipfelbuch: nach zwanzig Fehlversuchen am Tag ist zu', async () => {
  const env = { DB: falscheDb(), GIPFELBUCH_OTP: RFC, GIPFELBUCH_SITZUNG: 'test-sitzung' }
  for (let i = 0; i < 20; i++) env.DB.versuche.push({ zeit: Date.now() - 1000, ok: 0, schritt: null })
  const jetzt = await code(RFC, Math.floor(Date.now() / 30000))
  const r = await gipfelbuch(anfrage({ code: jetzt }), env, '/api/gipfelbuch/anmelden')
  assert.equal(r.status, 429)
})
