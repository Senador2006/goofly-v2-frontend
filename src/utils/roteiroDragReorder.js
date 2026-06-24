/** @typedef {{ top: number, bottom: number, height: number, left?: number, width?: number }} SlotRect */

export const ROTEIRO_DRAG_HOLD_MS = 180
export const ROTEIRO_DRAG_MOVE_CANCEL_PX = 6
export const ROTEIRO_DRAG_SCROLL_EDGE_PX = 48
export const ROTEIRO_DRAG_LANDING_MS = 220
export const ROTEIRO_DRAG_EXPAND_MS = 280
export const ROTEIRO_DRAG_REVERT_MS = 240
export const ROTEIRO_DRAG_COMPACT_HEIGHT_PX = 72
export const ROTEIRO_DRAG_SCROLL_HEADER_EDGE_PX = 48
export const ROTEIRO_DRAG_EXPAND_IMAGE_H_PX = 144
export const ROTEIRO_DRAG_EXPAND_IMAGE_H_SM_PX = 160
/** @deprecated usar ghostIntersectsList / isGhostFullyOutsideList */
export const ROTEIRO_DRAG_ZONE_MARGIN_X = 36
/** @deprecated usar ghostIntersectsList / isGhostFullyOutsideList */
export const ROTEIRO_DRAG_ZONE_MARGIN_Y = 72

/** @deprecated use ROTEIRO_DRAG_EXPAND_MS */
export const ROTEIRO_DRAG_SETTLE_MS = ROTEIRO_DRAG_EXPAND_MS

/**
 * Índice de inserção (0…length) a partir da posição Y do pointer e retângulos dos slots.
 *
 * @param {number} clientY
 * @param {SlotRect[]} slotRects ordenados de cima para baixo
 * @returns {number}
 */
export function resolveInsertionIndex(clientY, slotRects) {
  if (!Array.isArray(slotRects) || slotRects.length === 0) return 0

  let insertionIndex = 0
  for (const rect of slotRects) {
    const mid = rect.top + rect.height / 2
    if (clientY > mid) insertionIndex += 1
  }
  return insertionIndex
}

/**
 * Converte índice visual de inserção para índice real após remover o item arrastado.
 *
 * @param {number} fromIndex
 * @param {number} insertionIndex
 * @returns {number}
 */
export function resolveTargetIndex(fromIndex, insertionIndex) {
  if (insertionIndex > fromIndex) return insertionIndex - 1
  return insertionIndex
}

/**
 * @param {number} fromIndex
 * @param {number} insertionIndex
 * @returns {boolean}
 */
export function isInsertionNoOp(fromIndex, insertionIndex) {
  if (fromIndex < 0 || insertionIndex == null) return true
  return resolveTargetIndex(fromIndex, insertionIndex) === fromIndex
}

/**
 * @param {number} fromIndex
 * @param {number} insertionIndex
 * @returns {boolean}
 */
export function shouldShowInsertLine(fromIndex, insertionIndex) {
  return !isInsertionNoOp(fromIndex, insertionIndex)
}

/**
 * @param {number} left
 * @param {number} top
 * @param {number} width
 * @param {number} [height]
 */
export function buildGhostRect(left, top, width, height = ROTEIRO_DRAG_COMPACT_HEIGHT_PX) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  }
}

/**
 * @param {{ left: number, top: number, right: number, bottom: number } | null | undefined} a
 * @param {{ left: number, top: number, right: number, bottom: number } | null | undefined} b
 */
export function rectsIntersect(a, b) {
  if (!a || !b) return false
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom)
}

/**
 * @param {{ left: number, top: number, right: number, bottom: number }} ghostRect
 * @param {DOMRect | { left: number, top: number, right: number, bottom: number } | null | undefined} listRect
 */
export function ghostIntersectsList(ghostRect, listRect) {
  if (!listRect) return false
  return rectsIntersect(ghostRect, listRect)
}

/**
 * @param {{ left: number, top: number, right: number, bottom: number }} ghostRect
 * @param {DOMRect | { left: number, top: number, right: number, bottom: number } | null | undefined} listRect
 */
export function isGhostFullyOutsideList(ghostRect, listRect) {
  return !ghostIntersectsList(ghostRect, listRect)
}

/**
 * Altura da capa que entra ao sair do modo compact (h-36 / sm:h-40).
 *
 * @param {any} activity
 * @param {boolean} [viewportSm]
 */
export function resolveExpandImageOffsetPx(activity, viewportSm = false) {
  const hasImage = Boolean(activity?.image_url || activity?.imageUrl)
  if (!hasImage) return 0
  return viewportSm ? ROTEIRO_DRAG_EXPAND_IMAGE_H_SM_PX : ROTEIRO_DRAG_EXPAND_IMAGE_H_PX
}

/**
 * Alinha o cabeçalho do card (alça de arrastar) à margem superior do scroll.
 *
 * @param {HTMLElement | null} scrollEl
 * @param {HTMLElement | null} cardEl
 * @param {number} [edgePx]
 */
export function scrollCardHeaderIntoView(scrollEl, cardEl, edgePx = ROTEIRO_DRAG_SCROLL_HEADER_EDGE_PX) {
  if (!scrollEl || !cardEl) return
  const handle = cardEl.querySelector('.roteiro-drag-handle')
  const target = handle instanceof HTMLElement ? handle : cardEl
  const scrollRect = scrollEl.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const delta = targetRect.top - (scrollRect.top + edgePx)
  if (Math.abs(delta) >= 2) {
    scrollEl.scrollTop += delta
  }
}

/**
 * Alinha o topo do card compacto antes de revelar o layout full,
 * compensando a capa que será inserida acima do conteúdo.
 *
 * @param {HTMLElement | null} scrollEl
 * @param {HTMLElement | null} cardEl
 * @param {number} [edgePx]
 * @param {number} [imageOffsetPx]
 */
export function scrollCompactCardBeforeExpand(
  scrollEl,
  cardEl,
  edgePx = ROTEIRO_DRAG_SCROLL_HEADER_EDGE_PX,
  imageOffsetPx = 0,
) {
  if (!scrollEl || !cardEl) return
  const scrollRect = scrollEl.getBoundingClientRect()
  const cardRect = cardEl.getBoundingClientRect()
  const delta = cardRect.top + imageOffsetPx - (scrollRect.top + edgePx)
  if (Math.abs(delta) >= 2) {
    scrollEl.scrollTop += delta
  }
}

/**
 * @deprecated usar isGhostFullyOutsideList com buildGhostRect
 */
export function isDropInsideListZone(clientX, clientY, listRect, margins = {}) {
  if (!listRect) return false
  const marginX = margins.marginX ?? ROTEIRO_DRAG_ZONE_MARGIN_X
  const marginY = margins.marginY ?? ROTEIRO_DRAG_ZONE_MARGIN_Y
  return (
    clientX >= listRect.left - marginX &&
    clientX <= listRect.right + marginX &&
    clientY >= listRect.top - marginY &&
    clientY <= listRect.bottom + marginY
  )
}

/**
 * Posição Y (px) da linha de inserção relativa ao container da lista.
 *
 * @param {number} insertionIndex
 * @param {SlotRect[]} slotRects
 * @param {DOMRect} listRect
 * @returns {number | null}
 */
export function resolveInsertLineTop(insertionIndex, slotRects, listRect) {
  if (!listRect || !Array.isArray(slotRects) || slotRects.length === 0) return null

  const n = slotRects.length
  const clamped = Math.max(0, Math.min(insertionIndex, n))

  if (clamped === 0) {
    return slotRects[0].top - listRect.top
  }
  if (clamped >= n) {
    return slotRects[n - 1].bottom - listRect.top
  }

  const prev = slotRects[clamped - 1]
  const next = slotRects[clamped]
  return (prev.bottom + next.top) / 2 - listRect.top
}

/**
 * Delta de scroll proporcional à proximidade da borda do container.
 *
 * @param {HTMLElement} scrollEl
 * @param {number} clientY
 * @param {number} [edgePx]
 * @returns {number}
 */
export function computeAutoScrollDelta(scrollEl, clientY, edgePx = ROTEIRO_DRAG_SCROLL_EDGE_PX) {
  if (!scrollEl) return 0
  const rect = scrollEl.getBoundingClientRect()
  const distTop = clientY - rect.top
  const distBottom = rect.bottom - clientY

  if (distTop < edgePx && distTop >= 0) {
    const t = 1 - distTop / edgePx
    return -Math.ceil(4 + t * 14)
  }
  if (distBottom < edgePx && distBottom >= 0) {
    const t = 1 - distBottom / edgePx
    return Math.ceil(4 + t * 14)
  }
  return 0
}
