import api, { AI_TIMEOUT_MS } from './api'
import {
  isTdvDiscoverCircuitOpen,
  noteTdvDiscoverRateLimited,
} from '../utils/tdvDiscoverCircuit'
import {
  noteCacheSkippedPersistFailure,
  persistCacheSkippedOnUnload,
} from '../utils/tdvCacheSkippedKeepalive'

/**
 * Cliente HTTP do discover/session/summary/cache-skipped TDV (B14).
 * Endpoints: { data: [places], totalLikes, placesSource?, summary? }
 */

function unwrapDiscover(res) {
  const data = res.body.data
  const meta = res.body.meta || {}
  const summary = meta.summary || {}
  const places = Array.isArray(data) ? data : Array.isArray(meta.places) ? meta.places : []
  return {
    places,
    totalLikes: meta.totalLikes ?? summary.likesCount ?? 0,
    placesSource: meta.placesSource ?? null,
    tdvLimit: meta.tdvLimit ?? null,
    agentMs: typeof meta.agentMs === 'number' ? meta.agentMs : null,
    likedPlaces: summary.likedPlaces ?? [],
    dislikedPlaces: summary.dislikedPlaces ?? [],
  }
}

function assertDiscoverCircuitClosed() {
  if (!isTdvDiscoverCircuitOpen()) return
  const err = new Error('TDV discover temporariamente pausado (rate limit)')
  err.code = 'TDV_DISCOVER_CIRCUIT_OPEN'
  throw err
}

function noteDiscoverRateLimitFromError(err) {
  const status = err?.response?.status
  const code = err?.response?.data?.error?.code || err?.response?.body?.error?.code
  if (status !== 429 && code !== 'TDV_DISCOVER_RATE_LIMIT_EXCEEDED') return
  const raw = err?.response?.headers?.['retry-after']
  const retryAfter = parseInt(raw, 10)
  noteTdvDiscoverRateLimited(Number.isFinite(retryAfter) ? retryAfter : 60)
}

function withDiscoverCircuit(requestPromise) {
  assertDiscoverCircuitClosed()
  return requestPromise.then(unwrapDiscover).catch((err) => {
    noteDiscoverRateLimitFromError(err)
    throw err
  })
}

export const tdvDiscoverService = {
  discoverSession: (tripId, excludePlaceIds, requestConfig = {}) =>
    withDiscoverCircuit(
      api.get('/places/discover/session', {
        params: {
          tripId,
          ...(Array.isArray(excludePlaceIds) &&
            excludePlaceIds.length > 0 && {
              excludePlaceIds: excludePlaceIds.map((id) => String(id)).join(','),
            }),
        },
        timeout: AI_TIMEOUT_MS,
        ...requestConfig,
      }),
    ),

  discover: (tripId, excludePlaceIds, requestConfig = {}) =>
    withDiscoverCircuit(
      api.get('/places/discover', {
        params: {
          tripId,
          ...(Array.isArray(excludePlaceIds) &&
            excludePlaceIds.length > 0 && {
              excludePlaceIds: excludePlaceIds.map((id) => String(id)).join(','),
            }),
        },
        timeout: AI_TIMEOUT_MS,
        ...requestConfig,
      }),
    ),

  cacheSkippedPlaces: (tripId, places, requestConfig = {}) => {
    const body = { tripId, places }
    // pagehide/unmount: sendBeacon → fetch keepalive → Axios (ver tdvCacheSkippedKeepalive).
    if (requestConfig.keepalive) {
      return persistCacheSkippedOnUnload({
        baseURL: api.defaults?.baseURL,
        body,
      }).then((result) => {
        if (result.success) {
          return { success: true, transport: result.transport }
        }
        return api
          .post('/places/discover/cache-skipped', body)
          .then(() => ({ success: true, transport: 'axios' }))
          .catch((err) => {
            noteCacheSkippedPersistFailure('axios', err)
            return { success: false, transport: 'axios' }
          })
      })
    }
    return api.post('/places/discover/cache-skipped', body, requestConfig)
  },

  getTdvSummary: (tripId) =>
    api.get('/places/discover/summary', { params: { tripId } }).then((res) => {
      const data = res.body?.data || {}
      return {
        likedPlaces: data.likedPlaces ?? [],
        dislikedPlaces: data.dislikedPlaces ?? [],
        likesCount: data.likesCount ?? data.likedPlaces?.length ?? 0,
        dislikesCount: data.dislikesCount ?? data.dislikedPlaces?.length ?? 0,
      }
    }),
}
