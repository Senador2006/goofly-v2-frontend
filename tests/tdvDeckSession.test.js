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

test('TinderView: baralho local restaura sem spinner nem discoverSession', () => {
  const loadStart = tinderSource.indexOf('const loadPlaces = useCallback')
  const loadEnd = tinderSource.indexOf('const lastTripIdRef', loadStart)
  assert.ok(loadStart >= 0 && loadEnd > loadStart)
  const loadPlaces = tinderSource.slice(loadStart, loadEnd)

  const readIdx = loadPlaces.indexOf('readTdvDeckSession(tripId)')
  const loadingIdx = loadPlaces.indexOf('setLoading(true)')
  assert.ok(readIdx >= 0, 'lê sessionStorage no loadPlaces')
  assert.ok(loadingIdx > readIdx, 'lê o baralho local antes de setLoading(true)')

  const localIf = loadPlaces.indexOf('if (localDeck.length > 0)')
  const discoverIdx = loadPlaces.indexOf('discoverSession')
  assert.ok(localIf >= 0 && discoverIdx > localIf)
  const restoreBranch = loadPlaces.slice(localIf, discoverIdx)
  assert.match(restoreBranch, /\breturn\b/)
  assert.match(restoreBranch, /getTdvSummary/)
  assert.doesNotMatch(restoreBranch, /discoverSession/)
  assert.doesNotMatch(restoreBranch, /cacheSkippedPlaces/)
})
