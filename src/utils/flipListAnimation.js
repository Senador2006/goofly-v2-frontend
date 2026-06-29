const SWAP_MOVE_MS = 380
const SWAP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const FLIP_MIN_DELTA_PX = 2
const MOVED_Z_INDEX = '20'
const NEIGHBOR_Z_INDEX = '10'
const SCROLL_EDGE_MARGIN = 40
/** Fração do desvio corrigida por frame — usado apenas em testes/utilitários legados. */
const SCROLL_FOLLOW_LERP = 0.16

export function prefersReducedFlipMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** @param {Map<string, HTMLElement>} elementsById */
export function captureFlipPositions(elementsById) {
  /** @type {Map<string, DOMRect>} */
  const positions = new Map()
  if (!(elementsById instanceof Map)) return positions
  for (const [id, el] of elementsById) {
    if (el && typeof el.getBoundingClientRect === 'function') {
      positions.set(String(id), el.getBoundingClientRect())
    }
  }
  return positions
}

/** Posição vertical do card no conteúdo rolável (imune a mudanças de scroll). */
export function contentOffsetTop(el, scrollEl) {
  if (!el || !scrollEl) return 0
  const er = el.getBoundingClientRect()
  const sr = scrollEl.getBoundingClientRect()
  return er.top - sr.top + scrollEl.scrollTop
}

/**
 * @param {Map<string, HTMLElement>} elementsById
 * @param {HTMLElement | null} scrollContainer
 */
export function captureReorderSnapshot(elementsById, scrollContainer = null) {
  const positions = captureFlipPositions(elementsById)
  /** @type {Map<string, number>} */
  const contentOffsets = new Map()
  if (scrollContainer) {
    for (const [id, el] of elementsById) {
      if (el) contentOffsets.set(String(id), contentOffsetTop(el, scrollContainer))
    }
  }
  return {
    positions,
    contentOffsets,
    scrollTop: scrollContainer?.scrollTop ?? 0,
  }
}

function resolveFlipDy(id, el, snapshot, scrollContainer) {
  const key = String(id)
  if (scrollContainer && snapshot?.contentOffsets?.has(key)) {
    const prev = snapshot.contentOffsets.get(key)
    const next = contentOffsetTop(el, scrollContainer)
    return (prev ?? 0) - next
  }
  const prev = snapshot?.positions?.get(key)
  if (!prev) return 0
  const next = el.getBoundingClientRect()
  return prev.top - next.top
}

function runAfterPaint(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}

/** @param {HTMLElement} el */
function resetSwapStyles(el) {
  el.style.transition = ''
  el.style.transform = ''
  el.style.transformOrigin = ''
  el.style.zIndex = ''
  el.style.position = ''
  el.style.willChange = ''
}

/** Desvio para alinhar o topo do card (visual) à margem superior. Negativo = topo cortado. */
export function scrollDeltaToShowCardTop(scrollEl, cardEl) {
  if (!scrollEl || !cardEl) return 0
  const cRect = scrollEl.getBoundingClientRect()
  const kRect = cardEl.getBoundingClientRect()
  return kRect.top - (cRect.top + SCROLL_EDGE_MARGIN)
}

/**
 * Delta para alinhar o topo final do card à margem superior.
 * `flipOffsetY` compensa o transform FLIP ainda ativo (ex.: movedDy).
 *
 * @param {HTMLElement} scrollEl
 * @param {HTMLElement} cardEl
 * @param {number} [flipOffsetY]
 * @returns {number}
 */
export function computeAlignCardTopDelta(scrollEl, cardEl, flipOffsetY = 0) {
  if (!scrollEl || !cardEl) return 0
  const cRect = scrollEl.getBoundingClientRect()
  const kRect = cardEl.getBoundingClientRect()
  const finalTop = kRect.top - flipOffsetY
  return finalTop - (cRect.top + SCROLL_EDGE_MARGIN)
}

/**
 * Alinha o topo do card à margem superior (scroll suave instantâneo).
 *
 * @param {HTMLElement} scrollEl
 * @param {HTMLElement} cardEl
 * @param {number} [flipOffsetY]
 * @returns {number}
 */
export function scrollToAlignCardTopAfterMoveDown(scrollEl, cardEl, flipOffsetY = 0) {
  if (!scrollEl || !cardEl) return 0
  const delta = computeAlignCardTopDelta(scrollEl, cardEl, flipOffsetY)
  if (Math.abs(delta) < 2) return 0
  scrollEl.scrollTo({ top: scrollEl.scrollTop + delta, behavior: 'smooth' })
  return delta
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3
}

/**
 * Anima scrollTop em sincronia com a transição do card (mesma duração).
 *
 * @param {HTMLElement} scrollEl
 * @param {number} totalDelta
 * @param {number} durationMs
 */
function animateScrollDuringSwap(scrollEl, totalDelta, durationMs) {
  if (!scrollEl || Math.abs(totalDelta) < 2) return () => {}

  const startScroll = scrollEl.scrollTop
  const start = performance.now()
  let rafId = 0

  const tick = (now) => {
    const t = Math.min(1, (now - start) / durationMs)
    scrollEl.scrollTop = startScroll + totalDelta * easeOutCubic(t)
    if (t < 1) rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)
  return () => {
    if (rafId) cancelAnimationFrame(rafId)
  }
}

/** Desvio para alinhar a base do card (visual) à margem inferior. Positivo = base cortada. */
export function scrollDeltaToShowCardBottom(scrollEl, cardEl) {
  if (!scrollEl || !cardEl) return 0
  const cRect = scrollEl.getBoundingClientRect()
  const kRect = cardEl.getBoundingClientRect()
  return kRect.bottom - (cRect.bottom - SCROLL_EDGE_MARGIN)
}

/**
 * Ajuste suave de scroll a partir da posição atual — só corrige quando o card sai da âncora.
 *
 * @param {HTMLElement} scrollEl
 * @param {HTMLElement} cardEl
 * @param {-1 | 1} direction
 * @param {number} [lerp]
 * @returns {number} delta aplicado em scrollTop neste frame
 */
export function lerpScrollFollowSwapCard(scrollEl, cardEl, direction, lerp = SCROLL_FOLLOW_LERP) {
  if (!scrollEl || !cardEl || !direction) return 0

  let delta = 0
  if (direction === -1) {
    delta = scrollDeltaToShowCardTop(scrollEl, cardEl)
    if (delta >= 0) return 0
  } else if (direction === 1) {
    delta = scrollDeltaToShowCardBottom(scrollEl, cardEl)
    if (delta <= 0) return 0
  }

  const applied = delta * lerp
  if (Math.abs(applied) >= 0.5) scrollEl.scrollTop += applied
  return applied
}

/**
 * Correção única de scroll no início da animação — só ao mover para cima.
 *
 * @param {HTMLElement} scrollEl
 * @param {HTMLElement} movedEl
 * @param {-1 | 1} direction
 */
function applyInitialScrollCorrection(scrollEl, movedEl, direction) {
  if (!scrollEl || !movedEl || direction !== -1) return

  const delta = scrollDeltaToShowCardTop(scrollEl, movedEl)
  if (delta >= 0) return

  scrollEl.scrollTop += delta
}

/**
 * @param {Map<string, HTMLElement>} elementsById
 * @param {{ positions: Map<string, DOMRect>, contentOffsets?: Map<string, number> }} snapshot
 * @param {{ movedId?: string, neighborId?: string | null, direction?: -1 | 1 }} swap
 * @param {{ scrollContainer?: HTMLElement | null, moveMs?: number, onComplete?: () => void }} [options]
 */
export function playReorderSwapAnimation(elementsById, snapshot, swap, options = {}) {
  const onComplete = typeof options.onComplete === 'function' ? options.onComplete : null
  const complete = () => onComplete?.()

  if (!(elementsById instanceof Map) || !snapshot?.positions) {
    complete()
    return
  }

  const movedId = swap?.movedId != null ? String(swap.movedId) : ''
  const neighborId = swap?.neighborId != null ? String(swap.neighborId) : null
  const direction = swap?.direction === 1 ? 1 : swap?.direction === -1 ? -1 : 0
  if (!movedId) {
    complete()
    return
  }

  const scrollContainer = options.scrollContainer ?? null
  const moveMs = options.moveMs ?? SWAP_MOVE_MS

  const movedEl = elementsById.get(movedId)
  if (!movedEl) {
    complete()
    return
  }

  const focusMovedCardAfterMoveDown = () => {
    if (direction === 1 && scrollContainer) {
      scrollToAlignCardTopAfterMoveDown(scrollContainer, movedEl)
    }
  }

  if (prefersReducedFlipMotion()) {
    focusMovedCardAfterMoveDown()
    complete()
    return
  }

  const movedDy = resolveFlipDy(movedId, movedEl, snapshot, scrollContainer)
  if (Math.abs(movedDy) < FLIP_MIN_DELTA_PX) {
    focusMovedCardAfterMoveDown()
    complete()
    return
  }

  /** @type {Array<{ el: HTMLElement, dy: number, zIndex: string }>} */
  const animItems = [{ el: movedEl, dy: movedDy, zIndex: MOVED_Z_INDEX }]

  if (neighborId) {
    const neighborEl = elementsById.get(neighborId)
    if (neighborEl) {
      const neighborDy = resolveFlipDy(neighborId, neighborEl, snapshot, scrollContainer)
      if (Math.abs(neighborDy) >= FLIP_MIN_DELTA_PX) {
        animItems.push({ el: neighborEl, dy: neighborDy, zIndex: NEIGHBOR_Z_INDEX })
      }
    }
  }

  applyInitialScrollCorrection(scrollContainer, movedEl, direction)

  let finished = false
  let stopScrollDuringSwap = () => {}

  for (const { el, dy, zIndex } of animItems) {
    el.style.willChange = 'transform'
    el.style.position = 'relative'
    el.style.zIndex = zIndex
    el.style.transition = 'none'
    el.style.transform = `translate3d(0, ${dy}px, 0)`
  }

  runAfterPaint(() => {
    let pending = animItems.length
    /** @type {Map<HTMLElement, (ev: TransitionEvent) => void>} */
    const handlers = new Map()

    const finishOnce = () => {
      if (finished) return
      finished = true
      stopScrollDuringSwap()
      for (const [el, handler] of handlers) {
        el.removeEventListener('transitionend', handler)
      }
      for (const { el } of animItems) resetSwapStyles(el)
      complete()
    }

    if (direction === 1 && scrollContainer) {
      const scrollDelta = computeAlignCardTopDelta(scrollContainer, movedEl, movedDy)
      stopScrollDuringSwap = animateScrollDuringSwap(scrollContainer, scrollDelta, moveMs)
    }

    const onTransitionEnd = (ev) => {
      if (ev.propertyName !== 'transform') return
      pending -= 1
      if (pending <= 0) finishOnce()
    }

    for (const { el } of animItems) {
      handlers.set(el, onTransitionEnd)
      el.style.transition = `transform ${moveMs}ms ${SWAP_EASING}`
      el.style.transform = 'translate3d(0, 0, 0)'
      el.addEventListener('transitionend', onTransitionEnd)
    }

    window.setTimeout(finishOnce, moveMs + 80)
  })
}

/** @deprecated Use playReorderSwapAnimation with captureReorderSnapshot */
export function playFlipListAnimation(elementsById, previousPositions, options = {}) {
  playReorderSwapAnimation(
    elementsById,
    { positions: previousPositions, contentOffsets: new Map() },
    {},
    options,
  )
}
