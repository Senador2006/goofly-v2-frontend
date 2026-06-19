import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatTripLabel } from '../src/utils/tripLabel.js'

describe('formatTripLabel', () => {
  it('usa cidade do primeiro destino', () => {
    assert.equal(formatTripLabel({ id: 1, destinations: [{ city: 'Lisboa', country: 'Portugal' }] }), 'Lisboa')
  })

  it('fallback para Viagem {id} sem destinos', () => {
    assert.equal(formatTripLabel({ id: 42 }), 'Viagem 42')
  })

  it('fallback genérico sem trip', () => {
    assert.equal(formatTripLabel(null), 'Viagem')
  })
})
