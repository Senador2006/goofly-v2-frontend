import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { routeDataMatchesDay } from '../src/utils/itineraryRouteDay.js'

describe('routeDataMatchesDay', () => {
  it('accepts payload when day matches', () => {
    assert.equal(routeDataMatchesDay({ day: 2, markers: [] }, 2), true)
  })

  it('rejects payload for another day', () => {
    assert.equal(routeDataMatchesDay({ day: 1, markers: [{ name: 'A' }] }, 2), false)
  })

  it('rejects payload without day field', () => {
    assert.equal(routeDataMatchesDay({ markers: [] }, 1), false)
  })

  it('accepts dayNumber alias', () => {
    assert.equal(routeDataMatchesDay({ dayNumber: 3 }, 3), true)
  })
})
