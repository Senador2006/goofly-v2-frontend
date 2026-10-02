import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const itinerarySource = readFileSync(join(root, 'src/pages/Itinerary.jsx'), 'utf8')
const headerSource = readFileSync(join(root, 'src/components/itinerary/ItineraryHeader.jsx'), 'utf8')
const editSessionSource = readFileSync(join(root, 'src/hooks/useRoteiroEditSession.js'), 'utf8')
const dayViewSource = readFileSync(join(root, 'src/hooks/useItineraryDayView.js'), 'utf8')
const timelineSource = readFileSync(
  join(root, 'src/components/itinerary/ItineraryRoteiroTimeline.jsx'),
  'utf8',
)
const mapColumnSource = readFileSync(
  join(root, 'src/components/itinerary/ItineraryRoteiroMapColumn.jsx'),
  'utf8',
)

describe('Itinerary roster interaction', () => {
  it('chips de dia chamam handleSelectDay via ItineraryDayChips', () => {
    assert.match(headerSource, /onSelectDay=\{edit\.handleSelectDay\}/)
    assert.match(headerSource, /ItineraryDayChips/)
    assert.match(editSessionSource, /trackedFollowRef\.current = \{ id: null, reason: null \}/)
  })

  it('header de dias não usa pointer-events-none no container dos chips', () => {
    const dayChipsBlock = headerSource.slice(
      headerSource.indexOf('view.showRoteiroSidebar ?'),
      headerSource.indexOf('</header>'),
    )
    const chipsSection = dayChipsBlock.slice(0, Math.min(dayChipsBlock.length, 2500))
    assert.doesNotMatch(chipsSection, /pointer-events-none[\s\S]{0,200}setSelectedDay/)
  })

  it('nova parada rastreada define trackedStopId e bloqueia inserção simultânea', () => {
    assert.match(editSessionSource, /setTrackedStopId\(id\)/)
    assert.match(editSessionSource, /trackedFollowRef\.current = \{ id, reason: 'create' \}/)
    assert.match(editSessionSource, /blockNewRoteiroStop/)
    assert.match(timelineSource, /disabled=\{edit\.blockNewRoteiroStop\}/)
  })

  it('mudança de dia da parada rastreada sincroniza selectedDay e scroll', () => {
    assert.match(
      editSessionSource,
      /trackedFollowRef\.current = \{ id: activity\.id, reason: 'day-change' \}/,
    )
    assert.match(editSessionSource, /scrollIntoView\(\{ behavior: 'smooth', block: 'nearest' \}\)/)
  })

  it('mapa recebe highlightedIndex da parada rastreada', () => {
    assert.match(itinerarySource, /highlightedIndex=\{view\.trackedMapHighlight\}/)
    assert.match(mapColumnSource, /highlightedIndex=\{view\.trackedMapHighlight\}/)
    assert.match(dayViewSource, /trackedMapIndex/)
    assert.match(
      mapColumnSource,
      /preferLocalRoute=\{edit\.roteiroEditOpen \|\| edit\.likeReplace\.open\}/,
    )
  })

  it('botão Nova parada exibe hint visual quando bloqueado', () => {
    assert.match(timelineSource, /roteiro-new-stop-hint/)
    assert.match(timelineSource, /Nomeie ou remova a parada em edição/)
  })
})
