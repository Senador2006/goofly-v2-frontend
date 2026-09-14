import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8')

const sessionSource = readSrc('src/utils/tdvDeckSession.js')
const tinderView = readSrc('src/components/itinerary/TinderView.jsx')
const useTdvDeck = readSrc('src/hooks/useTdvDeck.js')
const useTdvSwipe = readSrc('src/hooks/useTdvSwipe.js')
const tdvFreeCapPolicy = readSrc('src/utils/tdvFreeCapPolicy.js')
const TdvPaywall = readSrc('src/components/itinerary/TdvPaywall.jsx')
const tdvSource = [tinderView, useTdvDeck, useTdvSwipe, tdvFreeCapPolicy, TdvPaywall].join('\n')

test('tdvDeckSession: API de backup do baralho', () => {
  assert.match(sessionSource, /saveTdvDeckSession/)
  assert.match(sessionSource, /readTdvDeckSession/)
  assert.match(sessionSource, /clearTdvDeckSession/)
  assert.match(sessionSource, /goofly:tdv-deck:/)
})

test('TinderView: prioriza baralho do sessionStorage (free e pago)', () => {
  assert.match(tdvSource, /readTdvDeckSession/)
  assert.match(tdvSource, /saveTdvDeckSession/)
  assert.match(tdvSource, /localDeck\.length > 0/)
  assert.match(tdvSource, /restoredFromSession/)
  assert.match(
    tdvSource,
    /Preferir baralho local \(free e pago\)/
  )
})

test('TinderView: baralho local restaura sem spinner nem discoverSession', () => {
  const loadStart = useTdvDeck.indexOf('const loadPlaces = useCallback')
  const loadEnd = useTdvDeck.indexOf('const lastTripIdRef', loadStart)
  assert.ok(loadStart >= 0 && loadEnd > loadStart)
  const loadPlaces = useTdvDeck.slice(loadStart, loadEnd)

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
