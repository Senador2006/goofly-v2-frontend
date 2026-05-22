import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const itinerarySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/Itinerary.jsx'),
  'utf8'
)

describe('Itinerary roster interaction', () => {
  it('chips de dia chamam setSelectedDay via ItineraryDayChips', () => {
    assert.match(itinerarySource, /onSelectDay=\{setSelectedDay\}/)
    assert.match(itinerarySource, /ItineraryDayChips/)
  })

  it('header de dias não usa pointer-events-none no container dos chips', () => {
    const dayChipsBlock = itinerarySource.slice(
      itinerarySource.indexOf('showRoteiroSidebar &&'),
      itinerarySource.indexOf('</header>')
    )
    const chipsSection = dayChipsBlock.slice(0, Math.min(dayChipsBlock.length, 2500))
    assert.doesNotMatch(chipsSection, /pointer-events-none[\s\S]{0,200}setSelectedDay/)
  })
})
