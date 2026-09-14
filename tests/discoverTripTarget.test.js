import test from 'node:test'
import assert from 'node:assert/strict'

const { pickDiscoverTrip, discoverTdvPath } = await import('../src/utils/discoverTripTarget.js')

test('B13: pickDiscoverTrip prefere planejando, depois ativa, senão a primeira', () => {
  assert.equal(pickDiscoverTrip(null), null)
  assert.equal(pickDiscoverTrip([]), null)

  const planejando = { id: 'p', status: 'planejando' }
  const ativa = { id: 'a', status: 'ativa' }
  const concluida = { id: 'c', status: 'concluida' }

  assert.equal(pickDiscoverTrip([concluida, ativa, planejando])?.id, 'p')
  assert.equal(pickDiscoverTrip([concluida, ativa])?.id, 'a')
  assert.equal(pickDiscoverTrip([concluida])?.id, 'c')
})

test('B13: discoverTdvPath aponta para itinerary tab=tdv', () => {
  assert.equal(discoverTdvPath('trip-1'), '/trips/trip-1/itinerary?tab=tdv')
})
