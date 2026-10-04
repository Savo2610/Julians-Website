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
