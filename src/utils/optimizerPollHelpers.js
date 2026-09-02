/** Deve bater com OPTIMIZER_ASYNC_MAX_WAIT_MS no backend (10 min). */

export const OPTIMIZER_ASYNC_MAX_WAIT_MS = 600_000



/** Alinhado a OPTIMIZER_TRANSPORT_RETRY_DELAY_MS no backend (~60s). */

export const OPTIMIZER_POLL_RETRY_OPTIMIZE_MS = 60_000



/** @param {Record<string, unknown> | null | undefined} meta */

export function isOptimizerRunning(meta) {

  return Boolean(meta && typeof meta === 'object' && meta.status === 'running')

}



/**

 * Roteiro ainda aguardando resultado do agente (overlay / poll).

 * @param {{ optimizer_meta?: Record<string, unknown> | null, optimization_score?: number | null }} [itinerary]

 */

export function isOptimizerPending(itinerary) {

  if (!itinerary || typeof itinerary !== 'object') return false

  const meta = itinerary.optimizer_meta

  if (!isOptimizerRunning(meta)) return false

  const score = Number(itinerary.optimization_score)

  if (Number.isFinite(score) && score > 0) return false

  return true

}



/** @param {Record<string, unknown> | null | undefined} meta */

export function isOptimizerCompleted(meta) {

  if (!meta || typeof meta !== 'object') return true

  if (meta.status === 'completed') return true

  if (meta.status === 'running') return false

  if (meta.optimizationFailed === true || meta.status === 'failed') return true

  const score = Number(meta.optimizationScore ?? meta.optimization_score)

  if (Number.isFinite(score) && score > 0) return true

  return Boolean(meta.stats)

}



/**

 * Poll GET /itinerary até o agente aplicar o roteiro (callback ou retry automático).

 *

 * @param {string} tripId

 * @param {(tripId: string, options?: { refresh?: boolean }) => Promise<unknown>} fetchItinerary

 * @param {{ maxWaitMs?: number, intervalMs?: number, retryOptimize?: (tripId: string) => Promise<unknown> }} [options]

 */

export async function pollItineraryUntilOptimizerReady(tripId, fetchItinerary, options = {}) {

  const maxWaitMs = Number(options.maxWaitMs) || OPTIMIZER_ASYNC_MAX_WAIT_MS

  const intervalMs = Number(options.intervalMs) || 3000

  const deadline = Date.now() + maxWaitMs

  const startedAt = Date.now()

  const graceMs = Number(options.graceMs) || 120_000

  const expectOptimization = Boolean(options.expectOptimization)

  let retriedOptimize = false



  while (Date.now() < deadline) {

    const itineraryData = await fetchItinerary(tripId, { refresh: true })

    if (!isOptimizerPending(itineraryData)) {

      const withinGrace = expectOptimization && Date.now() - startedAt < graceMs

      const score = Number(itineraryData?.optimization_score)

      const completed =

        Number.isFinite(score) && score > 0

          ? true

          : isOptimizerCompleted(itineraryData?.optimizer_meta)

      if (!withinGrace || completed || itineraryData?.optimizer_meta?.status === 'failed') {

        return itineraryData

      }

    }



    if (

      !retriedOptimize &&

      options.retryOptimize &&

      Date.now() - startedAt >= OPTIMIZER_POLL_RETRY_OPTIMIZE_MS

    ) {

      retriedOptimize = true

      try {

        await options.retryOptimize(tripId)

      } catch {

        /* backend também agenda retry; continua poll */

      }

    }



    await new Promise((resolve) => setTimeout(resolve, intervalMs))

  }



  const err = new Error('A otimização está demorando mais do que o esperado.')

  err.code = 'OPTIMIZER_ASYNC_TIMEOUT'

  throw err

}


