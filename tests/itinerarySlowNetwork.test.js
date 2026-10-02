import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const itinerarySource = readFileSync(join(root, 'src/pages/Itinerary.jsx'), 'utf8')
const dataHookSource = readFileSync(join(root, 'src/hooks/useItineraryData.js'), 'utf8')
const dayViewSource = readFileSync(join(root, 'src/hooks/useItineraryDayView.js'), 'utf8')
const bannersSource = readFileSync(
  join(root, 'src/components/itinerary/ItineraryStatusBanners.jsx'),
  'utf8',
)
const timelineSource = readFileSync(
  join(root, 'src/components/itinerary/ItineraryRoteiroTimeline.jsx'),
  'utf8',
)
const tripServiceSource = readFileSync(join(root, 'src/services/tripService.js'), 'utf8')
const apiSource = readFileSync(join(root, 'src/services/api.js'), 'utf8')
const chipsSource = readFileSync(join(root, 'src/components/itinerary/ItineraryDayChips.jsx'), 'utf8')
const drawerSource = readFileSync(
  join(root, 'src/components/itinerary/ItineraryMobileMapDrawer.jsx'),
  'utf8',
)
const indexCss = readFileSync(join(root, 'src/index.css'), 'utf8')
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8')

describe('Roteiro — carga em rede lenta', () => {
  it('GET trip e itinerário disparam em paralelo com AbortController', () => {
    assert.match(dataHookSource, /new AbortController/)
    assert.match(dataHookSource, /tripService\.getTrip\(tripId, \{ signal: ac\.signal \}\)/)
    assert.match(dataHookSource, /tripService\.getItinerary\(tripId, \{[\s\S]*signal: ac\.signal/)
    assert.match(dataHookSource, /ac\.abort\(\)/)
    assert.match(itinerarySource, /loading && !trip/)
    assert.match(itinerarySource, /itineraryError/)
    assert.match(bannersSource, /Tentar de novo/)
    assert.match(timelineSource, /RoteiroStopsSkeleton/)
  })

  it('não reseta selectedDay para a primeira parada quando o dia está vazio', () => {
    assert.doesNotMatch(dayViewSource, /setSelectedDay\(first\)/)
    assert.match(
      dayViewSource,
      /setSelectedDay\(\(previous\) =>\s*view\.days\.includes\(previous\) \? previous : view\.days\[0\]/,
    )
  })

  it('itinerário usa timeout maior e trata 404 como vazio', () => {
    assert.match(apiSource, /ITINERARY_TIMEOUT_MS = 60_000/)
    assert.match(tripServiceSource, /ITINERARY_TIMEOUT_MS/)
    assert.match(tripServiceSource, /isItineraryMissingError/)
    assert.match(tripServiceSource, /signal: options\.signal/)
  })
})

describe('Roteiro — layout mobile independente de CDN', () => {
  it('chips não usam scrollIntoView nem grid 0fr', () => {
    assert.doesNotMatch(chipsSource, /scrollIntoView/)
    assert.match(chipsSource, /container\.scrollTo/)
    assert.match(chipsSource, /document\?\.fonts\?\.ready|fontsReady/)
    assert.doesNotMatch(indexCss, /grid-template-rows:\s*0fr/)
    assert.match(indexCss, /\.itinerary-day-chips-slot \{\s*display:\s*none/s)
  })

  it('mapa mobile só monta aberto ou durante o arraste', () => {
    assert.match(drawerSource, /\{\(open \|\| isDragging\) \? \(/)
    assert.match(drawerSource, /<ItineraryDayMap/)
  })

  it('fontes Google usam display=swap e ícones têm caixa fixa', () => {
    assert.match(indexHtml, /Material\+Icons\+Outlined&display=swap/)
    assert.doesNotMatch(indexHtml, /display=optional/)
    assert.match(indexCss, /\.material-icons-outlined \{/)
    assert.match(indexCss, /width:\s*1em/)
    assert.match(indexCss, /overflow:\s*hidden/)
  })
})
