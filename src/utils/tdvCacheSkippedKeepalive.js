/**
 * Persistência do baralho TDV no unload (pagehide / unmount SPA).
 *
 * Ordem de precedência no **restore** (`TinderView.loadPlaces`):
 *  1. `sessionStorage` (`tdvDeckSession`) — sync; cobre navegação SPA / remount
 *  2. Cache servidor (`POST .../cache-skipped`) — cobre hard reload / outra aba
 *
 * Ordem de **transporte** no unload (esta util):
 *  1. `navigator.sendBeacon` — preferido (sobrevive à navegação; cookies same-site)
 *  2. `fetch` + `keepalive` + `credentials: 'include'` — fallback BFF cookies
 *  3. Caller pode ainda cair no Axios (não keepalive) se ambos falharem
 *
 * Auth: cookies httpOnly (BFF). sendBeacon não envia Authorization custom —
 * ambientes só-Bearer legacy não são suportados neste caminho (Axios no fluxo normal cobre).
 */

const CACHE_SKIPPED_PATH = '/places/discover/cache-skipped'

let persistFailCount = 0

export function getCacheSkippedPersistFailCount() {
  return persistFailCount
}

export function resetCacheSkippedPersistFailCount() {
  persistFailCount = 0
}

export function noteCacheSkippedPersistFailure(transport, detail) {
  persistFailCount += 1
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    const message =
      detail && typeof detail === 'object' && detail.message
        ? detail.message
        : detail != null
          ? String(detail)
          : 'unknown'
    console.warn('[tdv-cache-skipped] persist failed', { transport, message })
  }
}

/**
 * Monta URL do endpoint. Prefere path relativo (`/api/v1/...`) para same-origin
 * (cookies first-party + sendBeacon confiável).
 */
export function buildCacheSkippedUrl(baseURL) {
  const base = String(baseURL || '').replace(/\/$/, '')
  if (!base) return CACHE_SKIPPED_PATH
  if (base.startsWith('/')) return `${base}${CACHE_SKIPPED_PATH}`
  return `${base}${CACHE_SKIPPED_PATH}`
}

export function trySendBeaconCacheSkipped(url, payload, deps = {}) {
  const sendBeacon =
    deps.sendBeacon ??
    (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
      ? navigator.sendBeacon.bind(navigator)
      : null)
  if (typeof sendBeacon !== 'function') {
    return false
  }
  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    return sendBeacon(url, blob) === true
  } catch (err) {
    noteCacheSkippedPersistFailure('sendBeacon', err)
    return false
  }
}

export async function tryFetchKeepaliveCacheSkipped(url, payload, deps = {}) {
  const fetchFn = deps.fetch ?? (typeof fetch === 'function' ? fetch : null)
  if (typeof fetchFn !== 'function') return false
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      noteCacheSkippedPersistFailure('fetch-keepalive', `HTTP ${res.status}`)
      return false
    }
    return true
  } catch (err) {
    noteCacheSkippedPersistFailure('fetch-keepalive', err)
    return false
  }
}

/**
 * @returns {Promise<{ success: boolean, transport: 'sendBeacon' | 'fetch-keepalive' | null }>}
 */
export async function persistCacheSkippedOnUnload({ baseURL, body, sendBeacon, fetch: fetchFn } = {}) {
  const url = buildCacheSkippedUrl(baseURL)
  if (trySendBeaconCacheSkipped(url, body, { sendBeacon })) {
    return { success: true, transport: 'sendBeacon' }
  }
  const ok = await tryFetchKeepaliveCacheSkipped(url, body, { fetch: fetchFn })
  if (ok) {
    return { success: true, transport: 'fetch-keepalive' }
  }
  return { success: false, transport: null }
}
