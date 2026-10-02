import test from 'node:test'
import assert from 'node:assert/strict'
import { buildNewTripPayload } from '../src/utils/newTripPayload.js'

function formData(overrides = {}) {
  return {
    destinations: [{
      id: 'd1',
      city: ' Paris ',
      country: ' França ',
      arrivalDate: '2030-01-01',
      departureDate: '2030-01-05',
    }],
    accommodations: [],
    interests: ['historia'],
    tripDescription: '',
    itineraryStyle: 'equilibrado',
    avoidPreferences: [],
    prioritizePreferences: [],
    avoidCustom: '',
    prioritizeCustom: '',
    budget: '',
    currency: 'BRL',
    travelers: { adults: 1, children: 0 },
    ...overrides,
  }
}

test('buildNewTripPayload limita preferência customizada a 500 caracteres', () => {
  const payload = buildNewTripPayload(formData({ avoidCustom: `  ${'x'.repeat(550)}  ` }))
  assert.equal(payload.avoidPreferences[0], `custom: ${'x'.repeat(500)}`)
})

test('buildNewTripPayload limita viajantes aos mínimos aceitos', () => {
  const payload = buildNewTripPayload(formData({ travelers: { adults: -2, children: -3 } }))
  assert.deepEqual(payload.travelers, { adults: 1, children: 0 })
})
