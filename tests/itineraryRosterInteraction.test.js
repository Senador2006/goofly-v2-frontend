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
  it('chips de dia chamam handleSelectDay via ItineraryDayChips', () => {
    assert.match(itinerarySource, /onSelectDay=\{handleSelectDay\}/)
    assert.match(itinerarySource, /ItineraryDayChips/)
    assert.match(itinerarySource, /trackedFollowRef\.current = \{ id: null, reason: null \}/)
  })

  it('header de dias não usa pointer-events-none no container dos chips', () => {
    const dayChipsBlock = itinerarySource.slice(
      itinerarySource.indexOf('showRoteiroSidebar &&'),
      itinerarySource.indexOf('</header>')
    )
    const chipsSection = dayChipsBlock.slice(0, Math.min(dayChipsBlock.length, 2500))
    assert.doesNotMatch(chipsSection, /pointer-events-none[\s\S]{0,200}setSelectedDay/)
  })

  it('nova parada rastreada define trackedStopId e bloqueia inserção simultânea', () => {
    assert.match(itinerarySource, /setTrackedStopId\(nid\)/)
    assert.match(itinerarySource, /trackedFollowRef\.current = \{ id: nid, reason: 'create' \}/)
    assert.match(itinerarySource, /blockNewRoteiroStop/)
    assert.match(itinerarySource, /disabled=\{blockNewRoteiroStop\}/)
  })

  it('mudança de dia da parada rastreada sincroniza selectedDay e scroll', () => {
    assert.match(itinerarySource, /trackedFollowRef\.current = \{ id: act\.id, reason: 'day-change' \}/)
    assert.match(itinerarySource, /scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/)
  })

  it('mapa recebe highlightedIndex da parada rastreada', () => {
    assert.match(itinerarySource, /highlightedIndex=\{trackedMapHighlight\}/)
    assert.match(itinerarySource, /trackedMapIndex/)
    assert.match(itinerarySource, /preferLocalRoute=\{roteiroEditOpen\}/)
  })

  it('botão Nova parada exibe hint visual quando bloqueado', () => {
    assert.match(itinerarySource, /roteiro-new-stop-hint/)
    assert.match(itinerarySource, /Nomeie ou remova a parada em edição/)
  })
})
