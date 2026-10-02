import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const base = join(dirname(fileURLToPath(import.meta.url)), '..')
const mealsHookPath = join(base, 'src/hooks/useItineraryMeals.js')
const dayMapPath = join(base, 'src/components/itinerary/ItineraryDayMap.jsx')
const sheetPath = join(base, 'src/components/itinerary/ItineraryMealMapSheet.jsx')
const mealsTogglePath = join(base, 'src/components/itinerary/MapMealsToggle.jsx')
const routesTogglePath = join(base, 'src/components/itinerary/MapAccommodationRoutesToggle.jsx')

const mealsHookSource = readFileSync(mealsHookPath, 'utf8')
const dayMapSource = readFileSync(dayMapPath, 'utf8')
const sheetSource = existsSync(sheetPath) ? readFileSync(sheetPath, 'utf8') : ''
const mealsToggleSource = readFileSync(mealsTogglePath, 'utf8')
const routesToggleSource = readFileSync(routesTogglePath, 'utf8')

describe('Mobile meal map continuity', () => {
  it('selecionar restaurante no mobile abre o mapa (continuidade espacial)', () => {
    assert.match(
      mealsHookSource,
      /if \(activityId && !isLgUp\) \{[\s\S]*?setMobileMapOpen\(true\)/,
    )
  })

  it('ItineraryMealMapSheet existe como place card ancorado', () => {
    assert.ok(existsSync(sheetPath))
    assert.match(sheetSource, /role="dialog"/)
    assert.match(sheetSource, /goofly-meal-map-sheet/)
    assert.match(sheetSource, /onPointerDown/)
    assert.match(sheetSource, /DISMISS_DISTANCE_PX/)
    assert.match(sheetSource, /bottom-8/)
  })

  it('mapa mobile usa bottom sheet em vez de balão Leaflet para refeição', () => {
    assert.match(dayMapSource, /ItineraryMealMapSheet/)
    assert.match(dayMapSource, /FocusHighlightedMealPin/)
    assert.match(dayMapSource, /showMealSheet/)
    assert.match(dayMapSource, /!isMobileMap && popupProps/)
    assert.match(dayMapSource, /flyMapToPoint/)
    assert.match(dayMapSource, /PIN_FOCUS_MIN_ZOOM|MOBILE_MEAL_FOCUS_MIN_ZOOM/)
    assert.doesNotMatch(dayMapSource, /flyTo\(meal\.coords,\s*MOBILE_MEAL_FOCUS_ZOOM/)
  })

  it('seleção no roteiro dispara frameNonce para zoom de enquadramento', () => {
    assert.match(mealsHookSource, /mealMapFrameNonce/)
    assert.match(mealsHookSource, /setMealMapFrameNonce\(\(n\) => n \+ 1\)/)
  })

  it('tap no pin mobile também bumpa frameNonce; dismiss de popup é por slot', () => {
    assert.match(
      mealsHookSource,
      /handleMealMapPinClick[\s\S]*?setMealMapFrameNonce\(\(n\) => n \+ 1\)/,
    )
    assert.match(mealsHookSource, /handleMealDismissIfSlot/)
    assert.match(dayMapSource, /onMealDismissIfSlot/)
  })

  it('abertura com frame pula FitBounds do dia (transição tipo desktop)', () => {
    assert.match(dayMapSource, /mobileMealFrameCoords/)
    assert.match(dayMapSource, /suppressDayFit/)
    assert.match(dayMapSource, /FitBoundsToPoints coords=\{fitCoords\} enabled=\{!suppressDayFit\}/)
  })

  it('chrome do mapa mobile é compacto (toggles icon-only)', () => {
    assert.match(mealsToggleSource, /compact\s*=\s*false/)
    assert.match(routesToggleSource, /compact\s*=\s*false/)
    assert.match(dayMapSource, /compact=\{isMobileMap\}/)
  })

  it('stats cedem espaço ao sheet de refeição no mobile', () => {
    assert.match(dayMapSource, /!disabled && hasMapContent && !showMealSheet && !showStopSheet/)
  })
})
