import test from 'node:test'
import assert from 'node:assert/strict'
import { broadcastSchluessel } from '../worker/index.js'

// Der Worker reicht Dateien von broadcast.veerka.mp unter der Adresse des
// Spiels durch. Nur Schluessel in der Form des Dienstes kommen durch.
test('Broadcast: nur Schluessel in der Form des Dienstes', () => {
  assert.ok(broadcastSchluessel('2026/09/26/vh58tleJ-team2.jpg'))
  assert.ok(broadcastSchluessel('2026/09/27/abcd1234-Mein Video (2).mp4'))
  assert.equal(broadcastSchluessel('../geheim'), false)
  assert.equal(broadcastSchluessel('2026/09/26/vh58tleJ-..jpg'), false)
  assert.equal(broadcastSchluessel('2026/09/26/vh58tleJ-a/b.jpg'), false)
  assert.equal(broadcastSchluessel('https://example.com/x.jpg'), false)
  assert.equal(broadcastSchluessel(''), false)
  assert.equal(broadcastSchluessel(null), false)
})
