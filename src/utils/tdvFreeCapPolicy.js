/** Antecipa prefetch com ~1 lote de folga (3–5 cartas); nunca esperar baralho zerar. */
export const PREFETCH_WHEN_REMAINING_AT_MOST = 5
/** Teto de cartas no baralho local (espelha TDV_CACHE_MAX do servidor). */
export const DECK_MAX_PLACES = 15
/** Retentativas quando o baralho esvazia aguardando resposta do agente (máx. 3; n8n já retornou vazio → sem retry). */
export const EMPTY_DECK_PREFETCH_MAX_ATTEMPTS = 3
export const EMPTY_DECK_PREFETCH_RETRY_MS = 2000
/** free_cap com issued < 10: race de re-cache — retry curto, não latchear paywall. */
export const FREE_CAP_SOFT_RETRY_MAX = 2
export const FREE_CAP_SOFT_RETRY_MS = 400
export const FREE_CAP_MAX_PLACES = 10
/** Espelho do default BE `TDV_PAID_MAX_BATCHES` (C20). */
export const PAID_MAX_BATCHES_DEFAULT = 30

export function isHardFreeCap(res, swipeCount = 0) {
  if (res?.placesSource !== 'free_cap') return false
  // Paywall = 10 swipes (curtidas+descartes). Prefetch/issued sozinho não bloqueia.
  const swiped = res?.tdvLimit?.placesSwiped
  if (typeof swiped === 'number') return swiped >= FREE_CAP_MAX_PLACES
  return swipeCount >= FREE_CAP_MAX_PLACES
}

/** C20 — teto de batches do agente em viagem unlocked. */
export function isPaidBatchCap(res) {
  if (res?.placesSource === 'paid_batch_cap') return true
  const limit = res?.tdvLimit
  if (!limit?.unlocked) return false
  if (limit.batchCapReached === true) return true
  const used = Number(limit.batchesUsed) || 0
  const max = Number(limit.paidMaxBatches) || PAID_MAX_BATCHES_DEFAULT
  return used >= max
}

/** Prefetch vazio/`none`: retry se ainda há orçamento de swipe + batches (base ou refill). */
export function shouldRetryPrefetchOnEmpty(res, swipeCount = 0) {
  const limit = res?.tdvLimit
  if (!limit) return true
  // Unlocked: não martelar o agente após teto pago (C20).
  if (limit.unlocked) return !isPaidBatchCap(res)
  const swiped = typeof limit.placesSwiped === 'number' ? limit.placesSwiped : swipeCount
  if (swiped >= FREE_CAP_MAX_PLACES) return false
  const batchesUsed = Number(limit.batchesUsed) || 0
  const freeMaxBatches = Number(limit.freeMaxBatches) || 2
  const freeRefillBatches = Number(limit.freeRefillBatches) || 1
  const refillCap = freeMaxBatches + freeRefillBatches
  // Base batches, flag de lote curto, ou slot de refill (3º) ainda disponível.
  if (refillEligible(limit) || batchesUsed < refillCap) return true
  const placesIssued = Number(limit.placesIssued) || 0
  return placesIssued > swiped
}

/**
 * Paywall free-cap = 10 swipes (like+dislike). Estoque/batches esgotados com
 * swipes < 10 → deckUnavailable, não paywall.
 */
export function shouldLatchFreeCapPaywall(res, swipeCount = 0) {
  if (res?.tdvLimit?.unlocked) return false
  if (isHardFreeCap(res, swipeCount)) return true
  const swiped =
    typeof res?.tdvLimit?.placesSwiped === 'number' ? res.tdvLimit.placesSwiped : swipeCount
  return swiped >= FREE_CAP_MAX_PLACES
}

export function refillEligible(limit) {
  return Boolean(limit?.refillEligible)
}
