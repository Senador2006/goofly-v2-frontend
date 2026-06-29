import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  readShowAccommodationRoutesPreference,
  writeShowAccommodationRoutesPreference,
  SHOW_ACCOMMODATION_ROUTES_STORAGE_KEY,
} from '../src/utils/mapAccommodationRoutesPreference.js'

describe('mapAccommodationRoutesPreference', () => {
  const storage = new Map()

  beforeEach(() => {
    storage.clear()
    globalThis.localStorage = {
      getItem: (k) => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    }
  })

  it('default true quando sem preferência', () => {
    assert.equal(readShowAccommodationRoutesPreference(), true)
  })

  it('persiste e lê false/true', () => {
    writeShowAccommodationRoutesPreference(false)
    assert.equal(storage.get(SHOW_ACCOMMODATION_ROUTES_STORAGE_KEY), 'false')
    assert.equal(readShowAccommodationRoutesPreference(), false)

    writeShowAccommodationRoutesPreference(true)
    assert.equal(readShowAccommodationRoutesPreference(), true)
  })
})
