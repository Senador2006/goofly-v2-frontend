import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const overlaySrc = readFileSync(
  join(root, 'src/components/itinerary/ItineraryTdvOverlayShell.jsx'),
  'utf8',
)
const mapColumnSrc = readFileSync(
  join(root, 'src/components/itinerary/ItineraryRoteiroMapColumn.jsx'),
  'utf8',
)

test('C18: overlay postUnlock não passa onItineraryUpdate (sem refetch/Serper por like)', () => {
  const overlayIdx = overlaySrc.indexOf('tdvMode="postUnlock"')
  assert.ok(overlayIdx > 0, 'overlay postUnlock deve existir')

  const before = overlaySrc.lastIndexOf('<TinderView', overlayIdx)
  const after = overlaySrc.indexOf('/>', overlayIdx)
  assert.ok(before >= 0 && after > before)
  const overlayBlock = overlaySrc.slice(before, after + 2)

  assert.match(overlayBlock, /tdvMode="postUnlock"/)
  assert.match(overlayBlock, /onModifyRoteiro=\{edit\.handleStartModifyRoteiro\}/)
  assert.doesNotMatch(overlayBlock, /onItineraryUpdate/)
})

test('C18: planning TDV mantém onItineraryUpdate para preview de regen', () => {
  const planningIdx = mapColumnSrc.indexOf('tdvMode="planning"')
  assert.ok(planningIdx > 0)
  const before = mapColumnSrc.lastIndexOf('<TinderView', planningIdx)
  const after = mapColumnSrc.indexOf('/>', planningIdx)
  const planningBlock = mapColumnSrc.slice(before, after + 2)
  assert.match(planningBlock, /onItineraryUpdate=\{refetchItinerary\}/)
})
