import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const itinerarySrc = readFileSync(join(root, 'src/pages/Itinerary.jsx'), 'utf8')
const dataHookSrc = readFileSync(join(root, 'src/hooks/useItineraryData.js'), 'utf8')
const finalizeHookSrc = readFileSync(join(root, 'src/hooks/useFinalizeTdv.js'), 'utf8')
const modesHookSrc = readFileSync(join(root, 'src/hooks/usePlanningModes.js'), 'utf8')
const editHookSrc = readFileSync(join(root, 'src/hooks/useRoteiroEditSession.js'), 'utf8')
const mealsHookSrc = readFileSync(join(root, 'src/hooks/useItineraryMeals.js'), 'utf8')
const mapHookSrc = readFileSync(join(root, 'src/hooks/useItineraryMapUi.js'), 'utf8')
const stayHookSrc = readFileSync(join(root, 'src/hooks/useItineraryStay.js'), 'utf8')
const actionsHookSrc = readFileSync(join(root, 'src/hooks/useItineraryPageActions.js'), 'utf8')
const dayViewHookSrc = readFileSync(join(root, 'src/hooks/useItineraryDayView.js'), 'utf8')

test('C12: Itinerary orquestra useItineraryData / useFinalizeTdv / usePlanningModes', () => {
  assert.match(itinerarySrc, /useItineraryData\(tripId\)/)
  assert.match(itinerarySrc, /useFinalizeTdv\(/)
  assert.match(itinerarySrc, /usePlanningModes\(/)
  assert.match(itinerarySrc, /from '\.\.\/hooks\/useItineraryData'/)
  assert.match(itinerarySrc, /from '\.\.\/hooks\/useFinalizeTdv'/)
  assert.match(itinerarySrc, /from '\.\.\/hooks\/usePlanningModes'/)
})

test('C12: useItineraryData — load paralelo, debounce 400ms, single-flight refetch', () => {
  assert.match(dataHookSrc, /tripService\.getTrip\(tripId/)
  assert.match(dataHookSrc, /tripService\.getItinerary\(tripId/)
  assert.match(dataHookSrc, /setTimeout\(refetchItineraryImmediate, 400\)/)
  assert.match(dataHookSrc, /refetchInFlightRef/)
  assert.match(dataHookSrc, /AbortController/)
})

test('C12: useFinalizeTdv — inFlight + sessionStorage resume + poll optimizer', () => {
  assert.match(finalizeHookSrc, /finalizeInFlightRef/)
  assert.match(finalizeHookSrc, /markFinalizeTdvSession/)
  assert.match(finalizeHookSrc, /readFinalizeTdvSession/)
  assert.match(finalizeHookSrc, /pollItineraryUntilOptimizerReady/)
  assert.match(finalizeHookSrc, /finalizeResumeKey/)
  assert.match(finalizeHookSrc, /onSuccess\?\.\(/)
})

test('C12: usePlanningModes — unlocked=1, tab=tdv, overlay timers, tab guards', () => {
  assert.match(modesHookSrc, /unlockedFlag !== '1'/)
  assert.match(modesHookSrc, /tdvTabFlag !== 'tdv'/)
  assert.match(modesHookSrc, /TDV_OVERLAY_MS/)
  assert.match(modesHookSrc, /tdv-mobile-lock/)
  assert.match(modesHookSrc, /if \(finalizingTdv\) return/)
  assert.match(modesHookSrc, /planning_unlocked_at/)
})

test('C12: finalize success força mode roteiro via onSuccess (sem setMode no hook de data)', () => {
  assert.match(finalizeHookSrc, /onSuccess\?\.\(/)
  assert.doesNotMatch(finalizeHookSrc, /setMode\(MODE_ROTEIRO\)/)
  assert.match(itinerarySrc, /setModeRef\.current\(MODE_ROTEIRO\)/)
})

test('C12: shell fino orquestra hooks e componentes extraídos', () => {
  assert.ok(itinerarySrc.split(/\r?\n/).length < 700)
  for (const hook of [
    'useItineraryMapUi',
    'useItineraryMeals',
    'useItineraryStay',
    'useItineraryPageActions',
    'useItineraryDayView',
    'useRoteiroEditSession',
  ]) {
    assert.match(itinerarySrc, new RegExp(`${hook}\\(`))
  }
  for (const component of [
    'ItineraryHeader',
    'ItineraryStatusBanners',
    'ItineraryRoteiroTimeline',
    'ItineraryRoteiroEditFooter',
    'ItineraryRoteiroMapColumn',
    'ItineraryTdvOverlayShell',
    'ItineraryGlobalOverlays',
  ]) {
    assert.match(itinerarySrc, new RegExp(`<${component}`))
  }
})

test('C12: hooks extraídos mantêm responsabilidades da página', () => {
  assert.match(editHookSrc, /useRoteiroDragReorder/)
  assert.match(editHookSrc, /useRoteiroDaySwap/)
  assert.match(editHookSrc, /trackedFollowRef/)
  assert.match(mealsHookSrc, /mergeMealSelections/)
  assert.match(mapHookSrc, /setMobileMapOpen\(false\)/)
  assert.match(stayHookSrc, /clearItineraryRouteCache/)
  assert.match(actionsHookSrc, /deleteInFlightRef/)
  assert.match(dayViewHookSrc, /resolveEffectiveSelectedDay/)
})

test('C12: fluxos JSX críticos permanecem compostos pela página', () => {
  assert.match(itinerarySrc, /requestFinalizeTdv/)
  assert.match(itinerarySrc, /handleFinalizeTdv/)
  assert.match(itinerarySrc, /refetchItinerary/)
  assert.match(
    readFileSync(join(root, 'src/components/itinerary/ItineraryTdvOverlayShell.jsx'), 'utf8'),
    /tdvMode="postUnlock"/,
  )
  assert.match(
    readFileSync(join(root, 'src/components/itinerary/ItineraryRoteiroMapColumn.jsx'), 'utf8'),
    /tdvMode="planning"/,
  )
})
