import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const sessionSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/utils/tdvDeckSession.js'),
  'utf8'
)
const tinderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/TinderView.jsx'),
  'utf8'
)

test('tdvDeckSession: API de backup do baralho', () => {
  assert.match(sessionSource, /saveTdvDeckSession/)
  assert.match(sessionSource, /readTdvDeckSession/)
  assert.match(sessionSource, /clearTdvDeckSession/)
  assert.match(sessionSource, /goofly:tdv-deck:/)
})

test('TinderView: prioriza baralho do sessionStorage (free e pago)', () => {
  assert.match(tinderSource, /readTdvDeckSession/)
  assert.match(tinderSource, /saveTdvDeckSession/)
  assert.match(tinderSource, /localDeck\.length > 0/)
  assert.match(tinderSource, /restoredFromSession/)
  assert.match(
    tinderSource,
    /Preferir baralho local \(free e pago\)/
  )
})
