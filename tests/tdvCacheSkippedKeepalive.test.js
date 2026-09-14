import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  buildCacheSkippedUrl,
  getCacheSkippedPersistFailCount,
  noteCacheSkippedPersistFailure,
  persistCacheSkippedOnUnload,
  resetCacheSkippedPersistFailCount,
  trySendBeaconCacheSkipped,
} from '../src/utils/tdvCacheSkippedKeepalive.js'

test('B11: buildCacheSkippedUrl prefere path relativo same-origin', () => {
  assert.equal(
    buildCacheSkippedUrl('/api/v1'),
    '/api/v1/places/discover/cache-skipped'
  )
  assert.equal(
    buildCacheSkippedUrl('https://gateway.example/api/v1'),
    'https://gateway.example/api/v1/places/discover/cache-skipped'
  )
  assert.equal(buildCacheSkippedUrl(''), '/places/discover/cache-skipped')
})

test('B11: trySendBeacon usa Blob application/json', () => {
  const calls = []
  const ok = trySendBeaconCacheSkipped(
    '/api/v1/places/discover/cache-skipped',
    { tripId: 't1', places: [{ id: 'p1' }] },
    {
      sendBeacon(url, body) {
        calls.push({ url, body })
        return true
      },
    }
  )
  assert.equal(ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/v1/places/discover/cache-skipped')
  assert.ok(calls[0].body instanceof Blob)
  assert.equal(calls[0].body.type, 'application/json')
})

test('B11: persistCacheSkippedOnUnload prefere sendBeacon antes de fetch', async () => {
  resetCacheSkippedPersistFailCount()
  let fetchCalls = 0
  const result = await persistCacheSkippedOnUnload({
    baseURL: '/api/v1',
    body: { tripId: 't1', places: [] },
    sendBeacon: () => true,
    fetch: async () => {
      fetchCalls += 1
      return { ok: true }
    },
  })
  assert.deepEqual(result, { success: true, transport: 'sendBeacon' })
  assert.equal(fetchCalls, 0)
})

test('B11: fallback fetch keepalive quando sendBeacon indisponível', async () => {
  resetCacheSkippedPersistFailCount()
  const result = await persistCacheSkippedOnUnload({
    baseURL: '/api/v1',
    body: { tripId: 't1', places: [{ id: 'a' }] },
    sendBeacon: null,
    fetch: async (url, init) => {
      assert.match(String(url), /cache-skipped/)
      assert.equal(init.keepalive, true)
      assert.equal(init.credentials, 'include')
      return { ok: true }
    },
  })
  assert.deepEqual(result, { success: true, transport: 'fetch-keepalive' })
})

test('B11: métrica de falha incrementa contador', () => {
  resetCacheSkippedPersistFailCount()
  noteCacheSkippedPersistFailure('axios', new Error('boom'))
  assert.equal(getCacheSkippedPersistFailCount(), 1)
  resetCacheSkippedPersistFailCount()
  assert.equal(getCacheSkippedPersistFailCount(), 0)
})

test('B11: tdvDiscoverService documenta sendBeacon + fallback Axios', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/services/tdvDiscoverService.js'),
    'utf8'
  )
  assert.match(src, /persistCacheSkippedOnUnload/)
  assert.match(src, /transport: 'axios'/)
  assert.match(src, /noteCacheSkippedPersistFailure/)
})

test('B11: tdvDeckSession documenta precedência sessionStorage → cache-skipped', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/utils/tdvDeckSession.js'),
    'utf8'
  )
  assert.match(src, /Precedência no restore/)
  assert.match(src, /sessionStorage/)
  assert.match(src, /cache-skipped/)
})
