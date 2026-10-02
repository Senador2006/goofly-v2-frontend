/**
 * Circuit breaker leve para discover TDV (B09).
 * Em 429 do gateway, pausa novas chamadas de agente/prefetch até Retry-After.
 */

let openUntilMs = 0;

/** @param {number} [retryAfterSec] */
export function noteTdvDiscoverRateLimited(retryAfterSec = 60) {
  const sec = Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec : 60;
  openUntilMs = Math.max(openUntilMs, Date.now() + sec * 1000);
}

export function isTdvDiscoverCircuitOpen() {
  return Date.now() < openUntilMs;
}

export function tdvDiscoverCircuitRemainingMs() {
  return Math.max(0, openUntilMs - Date.now());
}

/** @internal testes */
export function __resetTdvDiscoverCircuit() {
  openUntilMs = 0;
}
