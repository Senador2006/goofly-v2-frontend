import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const itinerarySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/Itinerary.jsx'),
  'utf8'
)

test('Itinerary define isTdvMode para cabeçalho compacto', () => {
  assert.match(itinerarySource, /const isTdvMode = isPlanning && mode === MODE_TDV/)
  assert.match(itinerarySource, /isTdvMode \? 'py-2/)
  assert.match(itinerarySource, /isTdvMode \? 'text-lg/)
})
