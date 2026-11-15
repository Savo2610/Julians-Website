import test from 'node:test'
import assert from 'node:assert/strict'
import { funkSchluessel } from '../worker/funk.js'

// Der Worker reicht Dateien von funk.veerka.mp unter der Adresse des
// Spiels durch. Nur Schluessel in der Form des Dienstes kommen durch.
test('Funk: nur Schluessel in der Form des Dienstes', () => {
  assert.ok(funkSchluessel('2026/09/26/vh58tleJ-team2.jpg'))
  assert.ok(funkSchluessel('2026/09/27/abcd1234-Mein Video (2).mp4'))
  assert.equal(funkSchluessel('../geheim'), false)
  assert.equal(funkSchluessel('2026/09/26/vh58tleJ-..jpg'), false)
  assert.equal(funkSchluessel('2026/09/26/vh58tleJ-a/b.jpg'), false)
  assert.equal(funkSchluessel('https://example.com/x.jpg'), false)
  assert.equal(funkSchluessel(''), false)
  assert.equal(funkSchluessel(null), false)
})
