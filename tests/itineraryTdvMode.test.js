import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const itinerarySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/Itinerary.jsx'),
  'utf8'
)

test('Itinerary: planejamento com TDV e confirmação de apagar fora do header', () => {
  assert.match(itinerarySource, /MODE_TDV/)
  assert.match(itinerarySource, /<DeletePlanningOverlay/)
  assert.doesNotMatch(
    itinerarySource.slice(itinerarySource.indexOf('<header'), itinerarySource.indexOf('</header>') + '</header>'.length),
    /\{showDeleteConfirm &&/
  )
})
