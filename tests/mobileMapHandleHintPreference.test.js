import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MOBILE_MAP_HANDLE_HINT_DISMISSED_KEY,
  readMobileMapHandleHintDismissed,
  writeMobileMapHandleHintDismissed,
} from '../src/utils/mobileMapHandleHintPreference.js'

describe('mobileMapHandleHintPreference', () => {
  it('persiste dismiss do brilho da aba do mapa', () => {
    const storage = new Map()
    globalThis.localStorage = {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    }

    assert.equal(readMobileMapHandleHintDismissed(), false)
    writeMobileMapHandleHintDismissed(true)
    assert.equal(storage.get(MOBILE_MAP_HANDLE_HINT_DISMISSED_KEY), 'true')
    assert.equal(readMobileMapHandleHintDismissed(), true)
  })
})
