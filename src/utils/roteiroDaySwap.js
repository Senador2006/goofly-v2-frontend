/** Hold parado no chip antes de entrar em modo troca (ms). */
export const ROTEIRO_DAY_SWAP_HOLD_MS = 180
/** Ghost na mão primeiro; em seguida foca o dia / expande (ms). */
export const ROTEIRO_DAY_SWAP_FOCUS_DELAY_MS = 90
/** Movimento durante pending inicia o arraste imediatamente (px). */
export const ROTEIRO_DAY_SWAP_MOVE_START_PX = 6
/** @deprecated use ROTEIRO_DAY_SWAP_MOVE_START_PX */
export const ROTEIRO_DAY_SWAP_MOVE_CANCEL_PX = ROTEIRO_DAY_SWAP_MOVE_START_PX
/** Tamanho mínimo do ghost (entre chip inativo e ativo). */
export const ROTEIRO_DAY_SWAP_GHOST_MIN_WIDTH_PX = 92
export const ROTEIRO_DAY_SWAP_GHOST_MIN_HEIGHT_PX = 36
/** Escala do tamanho do chip ativo aplicada ao ghost (< 1 = um pouco menor). */
export const ROTEIRO_DAY_SWAP_GHOST_SIZE_SCALE = 0.92

/** @typedef {{ day: number, left: number, right: number, top?: number, bottom?: number }} DayChipRect */

/**
 * Resolve o dia-alvo sob o pointer para highlight/swap.
 * Retorna `null` se estiver fora da fileira ou sobre o próprio `fromDay`
 * (highlight off = no-op no drop).
 *
 * @param {number} clientX
 * @param {DayChipRect[]} chipRects
 * @param {number} fromDay
 * @param {number} [clientY]
 * @returns {number | null}
 */
export function resolveDaySwapTarget(clientX, chipRects, fromDay, clientY) {
  if (!Array.isArray(chipRects) || chipRects.length === 0) return null
  if (!Number.isFinite(clientX)) return null

  const from = Math.floor(Number(fromDay))
  const hasY = clientY != null && Number.isFinite(clientY)

  for (const rect of chipRects) {
    if (!rect) continue
    const day = Math.floor(Number(rect.day))
    if (!Number.isFinite(day) || day < 1) continue

    const inX = clientX >= rect.left && clientX <= rect.right
    if (!inX) continue

    if (hasY) {
      const top = rect.top ?? Number.NEGATIVE_INFINITY
      const bottom = rect.bottom ?? Number.POSITIVE_INFINITY
      if (clientY < top || clientY > bottom) continue
    }

    if (Number.isFinite(from) && day === from) return null
    return day
  }

  return null
}
