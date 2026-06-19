import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('U-10 — Pagamento com seletor de viagem', () => {
  const pagamento = read('src/pages/Pagamento.jsx')
  const tripSelector = read('src/components/trips/TripSelector.jsx')
  const documentos = read('src/components/itinerary/DocumentosView.jsx')
  const itinerary = read('src/pages/Itinerary.jsx')

  it('Pagamento carrega lista de viagens via tripService.getTrips', () => {
    assert.match(pagamento, /tripService\.getTrips\(\)/)
  })

  it('Pagamento usa TripSelector', () => {
    assert.match(pagamento, /TripSelector/)
    assert.match(pagamento, /from '\.\.\/components\/trips\/TripSelector'/)
  })

  it('Pagamento sincroniza seleção com a URL via setSearchParams', () => {
    assert.match(pagamento, /setSearchParams\(\{ tripId/)
  })

  it('Pagamento normaliza tripId vazio na URL', () => {
    assert.match(pagamento, /normalizeTripId/)
    assert.match(pagamento, /searchParams\.get\('tripId'\)/)
  })

  it('Pagamento reseta checkout ao trocar viagem', () => {
    assert.match(pagamento, /setShowBrick\(false\)/)
    assert.match(pagamento, /useEffect\(\(\) => \{\s*setShowBrick\(false\)[\s\S]*?\}, \[tripId\]\)/)
  })

  it('Pagamento usa hasTripPlanningUnlocked para viagens já desbloqueadas', () => {
    assert.match(pagamento, /hasTripPlanningUnlocked/)
  })

  it('Pagamento exibe empty state quando não há viagens', () => {
    assert.match(pagamento, /EmptyState/)
    assert.match(pagamento, /\/trips\/new/)
  })

  it('Botão Pagar desabilitado sem viagem válida ou preço', () => {
    assert.match(pagamento, /const canPay =/)
    assert.match(pagamento, /disabled=\{loading \|\| !canPay\}/)
  })

  it('completeCheckout continua enviando tripId', () => {
    assert.match(pagamento, /userService\.completeCheckout\(\{ tripId \}\)/)
  })

  it('Admin unlock exige viagem selecionada', () => {
    assert.match(pagamento, /Selecione a viagem que deseja desbloquear/)
    assert.match(pagamento, /disabled=\{loading \|\| !tripId \|\| isSelectedUnlocked\}/)
  })

  it('TripSelector tem aria-label de acessibilidade', () => {
    assert.match(tripSelector, /aria-label="Selecione a viagem para desbloquear"/)
  })

  it('Itinerary mantém links com tripId na URL', () => {
    const matches = itinerary.match(/\/pagamento\?tripId=\$\{encodeURIComponent\(tripId\)\}/g)
    assert.ok(matches && matches.length >= 3, 'Itinerary deve manter links /pagamento?tripId=')
  })

  it('DocumentosView não gera tripId vazio no link de pagamento', () => {
    assert.doesNotMatch(documentos, /tripId \|\| ''/)
    assert.match(documentos, /encodeURIComponent\(tripId\)/)
  })
})
