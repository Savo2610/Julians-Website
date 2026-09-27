import test from 'node:test'
import assert from 'node:assert/strict'
import worker from '../worker/index.js'

const env = {
  ASSETS: { fetch: async () => new Response('<!doctype html>', { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } }) },
}

// Pistenpass und Bestzeit liegen im localStorage, der je Adresse gilt –
// www und ohne www waeren zwei getrennte Spielstaende.
test('www.veerka.mp leitet mit Pfad und Anhang auf veerka.mp um', async () => {
  const r = await worker.fetch(new Request('https://www.veerka.mp/?touch'), env)
  assert.equal(r.status, 301)
  assert.equal(r.headers.get('location'), 'https://veerka.mp/?touch')
})

test('Startseite kommt frisch, sonst zeigt sie nach einem Update ins Leere', async () => {
  const r = await worker.fetch(new Request('https://veerka.mp/'), env)
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('cache-control'), 'no-cache')
})

test('API wird nie umgeleitet, auch nicht auf www', async () => {
  const r = await worker.fetch(new Request('https://www.veerka.mp/api/gibtsnicht'), env)
  assert.equal(r.status, 404)
  assert.equal((await r.json()).fehler, 'Nicht gefunden')
})
