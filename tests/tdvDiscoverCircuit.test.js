import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  noteTdvDiscoverRateLimited,
  isTdvDiscoverCircuitOpen,
  tdvDiscoverCircuitRemainingMs,
  __resetTdvDiscoverCircuit,
} from '../src/utils/tdvDiscoverCircuit.js'

describe('tdvDiscoverCircuit (B09)', () => {
  beforeEach(() => {
    __resetTdvDiscoverCircuit()
  })

  it('abre o circuito após rate limit', () => {
    assert.equal(isTdvDiscoverCircuitOpen(), false)
    noteTdvDiscoverRateLimited(30)
    assert.equal(isTdvDiscoverCircuitOpen(), true)
    assert.ok(tdvDiscoverCircuitRemainingMs() > 0)
  })

  it('mantém o maior openUntil', () => {
    noteTdvDiscoverRateLimited(5)
    const first = tdvDiscoverCircuitRemainingMs()
    noteTdvDiscoverRateLimited(20)
    assert.ok(tdvDiscoverCircuitRemainingMs() >= first)
  })
})
