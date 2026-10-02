import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const shell = read('src/pages/Itinerary.jsx')
const edit = read('src/hooks/useRoteiroEditSession.js')
const meals = read('src/hooks/useItineraryMeals.js')

test('C12 residual: sessão de edição preserva cancel refs, reset e limpeza do draft', () => {
  assert.match(edit, /dragReorderCancelRef/)
  assert.match(edit, /daySwapCancelRef/)
  assert.match(edit, /dragReorderCancelRef\.current\?\.\(\)/)
  assert.match(edit, /daySwapCancelRef\.current\?\.\(\)/)
  assert.match(edit, /\}, \[tripId\]\)/)
  assert.match(edit, /setDraftActivities\(null\)/)
  assert.match(edit, /setItinerary\(next\)/)
  assert.match(edit, /handleCancelRoteiroEdit\(\)/)
})

test('C12 residual: refeições preservam hydrate merge e atraso móvel', () => {
  assert.match(meals, /mergeMealSelections\(stored, activities, dateToDayMap\)/)
  assert.match(meals, /window\.setTimeout\(scroll, 520\)/)
})

test('C12 residual: shell importa e renderiza timeline extraída', () => {
  assert.match(shell, /import \{ ItineraryRoteiroTimeline \}/)
  assert.match(shell, /<ItineraryRoteiroTimeline/)
})
