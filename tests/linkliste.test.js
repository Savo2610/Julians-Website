import test from 'node:test'
import assert from 'node:assert/strict'
import { LINKS } from '../src/stations/links.js'
import { KACHELN } from '../src/menu/kacheln.js'
import { linklisteHtml } from '../src/menu/linkliste.js'

const html = linklisteHtml()
const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, '&'))
const kacheln = KACHELN.flatMap((g) => g.kacheln)

// Wer das Tal nicht sieht, bekommt dieselben Links wie die Uebersicht –
// aus links.js, nicht aus einer zweiten Liste.
test('Linkliste: jede Kachel der Uebersicht, Adressen aus links.js', () => {
  assert.equal(hrefs.length, kacheln.length)
  for (const k of kacheln) assert.ok(hrefs.includes(LINKS[k.link]), k.label)
  for (const h of hrefs) assert.ok(Object.values(LINKS).includes(h), h)
})

// Die Fundstuecke sollen gefunden werden, auch hier nicht verraten.
test('Linkliste: Drohne, Loeschzug und Quelle bleiben versteckt', () => {
  for (const key of ['jugendfeuerwehr', 'kidrohne', 'broadcast']) assert.ok(!hrefs.includes(LINKS[key]), key)
})

test('Linkliste: nur Webadressen oeffnen einen neuen Tab', () => {
  assert.match(html, /href="solana:[^"]+"><span/)
  assert.equal((html.match(/target="_blank" rel="noopener"/g) ?? []).length, hrefs.filter((h) => h.startsWith('http')).length)
})
