const SWAP_MS = 420
const SWAP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
/** Revela o card real um pouco antes do fim, enquanto o ghost some. */
const REVEAL_LEAD_MS = 70
const FADE_MS = 90
/** Crossfade origem→destino no meio do trajeto. */
const MORPH_DELAY_RATIO = 0.32
const MORPH_DURATION_RATIO = 0.36

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function runAfterPaint(fn) {
  requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}

/** @param {HTMLElement} face @param {boolean} visible */
function prepareFace(face, visible) {
  face.setAttribute('aria-hidden', 'true')
  face.style.position = 'absolute'
  face.style.inset = '0'
  face.style.width = '100%'
  face.style.height = '100%'
  face.style.margin = '0'
  face.style.boxSizing = 'border-box'
  face.style.overflow = 'hidden'
  face.style.pointerEvents = 'none'
  face.style.opacity = visible ? '1' : '0'
  face.style.willChange = 'opacity'
}

/**
 * @param {HTMLElement} startClone
 * @param {HTMLElement | null} endClone
 * @param {DOMRect} fromRect
 * @param {number} zIndex
 */
function buildMorphGhost(startClone, endClone, fromRect, zIndex) {
  const wrapper = document.createElement('div')
  wrapper.className = 'roteiro-modify-swap-ghost'
  wrapper.setAttribute('aria-hidden', 'true')
  wrapper.style.cssText = [
    'position:fixed',
    `left:${fromRect.left}px`,
    `top:${fromRect.top}px`,
    `width:${fromRect.width}px`,
    `height:${fromRect.height}px`,
    'margin:0',
    'box-sizing:border-box',
    'pointer-events:none',
    `z-index:${zIndex}`,
    'opacity:1',
    'overflow:hidden',
    'will-change:left, top, width, height, opacity',
    'transition:none',
  ].join(';')

  prepareFace(startClone, true)
  wrapper.appendChild(startClone)

  let endFace = null
  if (endClone) {
    prepareFace(endClone, false)
    // Destino embaixo; origem em cima — crossfade no meio do voo.
    wrapper.insertBefore(endClone, startClone)
    endFace = endClone
  }

  return { wrapper, startFace: startClone, endFace }
}

/**
 * Anima dois cards trocando de lugar, com morph visual no meio do trajeto.
 *
 * Clona as faces de origem imediatamente; após o paint, `resolveDestinations`
 * devolve retângulos finais e elementos com a aparência de destino (para
 * crossfade curtida ↔ parada durante o voo).
 *
 * @param {HTMLElement | null} elA
 * @param {HTMLElement | null} elB
 * @param {{
 *   durationMs?: number,
 *   onComplete?: () => void,
 *   resolveDestinations?: () => {
 *     toA?: DOMRect | null,
 *     toB?: DOMRect | null,
 *     endElA?: HTMLElement | null,
 *     endElB?: HTMLElement | null,
 *   } | null,
 * }} [options]
 */
export function playCrossContainerSwap(elA, elB, options = {}) {
  const onComplete = typeof options.onComplete === 'function' ? options.onComplete : null
  const durationMs = options.durationMs ?? SWAP_MS
  const resolveDestinations =
    typeof options.resolveDestinations === 'function' ? options.resolveDestinations : null
  const complete = () => onComplete?.()

  if (!elA || !elB || prefersReducedMotion()) {
    complete()
    return
  }

  const fromA = elA.getBoundingClientRect()
  const fromB = elB.getBoundingClientRect()
  if (fromA.width < 2 || fromB.width < 2) {
    complete()
    return
  }

  // Faces de origem — clonar antes do React trocar o conteúdo.
  const startCloneA = /** @type {HTMLElement} */ (elA.cloneNode(true))
  const startCloneB = /** @type {HTMLElement} */ (elB.cloneNode(true))

  let revealed = false
  let cleaned = false
  /** @type {HTMLElement[]} */
  let wrappers = []

  const reveal = () => {
    if (revealed) return
    revealed = true
    complete()
  }

  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    reveal()
    for (const w of wrappers) w.remove()
    wrappers = []
  }

  runAfterPaint(() => {
    const dest = resolveDestinations?.() || null
    const toA = dest?.toA && dest.toA.width >= 2 ? dest.toA : fromB
    const toB = dest?.toB && dest.toB.width >= 2 ? dest.toB : fromA
    const endCloneA = dest?.endElA
      ? /** @type {HTMLElement} */ (dest.endElA.cloneNode(true))
      : null
    const endCloneB = dest?.endElB
      ? /** @type {HTMLElement} */ (dest.endElB.cloneNode(true))
      : null

    const morphA = buildMorphGhost(startCloneA, endCloneA, fromA, 60)
    const morphB = buildMorphGhost(startCloneB, endCloneB, fromB, 59)
    wrappers = [morphA.wrapper, morphB.wrapper]
    document.body.appendChild(morphA.wrapper)
    document.body.appendChild(morphB.wrapper)

    const fadeDelay = Math.max(0, durationMs - FADE_MS)
    const morphDelay = Math.round(durationMs * MORPH_DELAY_RATIO)
    const morphMs = Math.round(durationMs * MORPH_DURATION_RATIO)
    const moveTransition = [
      `left ${durationMs}ms ${SWAP_EASING}`,
      `top ${durationMs}ms ${SWAP_EASING}`,
      `width ${durationMs}ms ${SWAP_EASING}`,
      `height ${durationMs}ms ${SWAP_EASING}`,
      `opacity ${FADE_MS}ms ease-out ${fadeDelay}ms`,
    ].join(', ')
    const faceTransition = `opacity ${morphMs}ms ease-in-out ${morphDelay}ms`

    requestAnimationFrame(() => {
      morphA.wrapper.style.transition = moveTransition
      morphB.wrapper.style.transition = moveTransition

      morphA.wrapper.style.left = `${toA.left}px`
      morphA.wrapper.style.top = `${toA.top}px`
      morphA.wrapper.style.width = `${toA.width}px`
      morphA.wrapper.style.height = `${toA.height}px`
      morphA.wrapper.style.opacity = '0'

      morphB.wrapper.style.left = `${toB.left}px`
      morphB.wrapper.style.top = `${toB.top}px`
      morphB.wrapper.style.width = `${toB.width}px`
      morphB.wrapper.style.height = `${toB.height}px`
      morphB.wrapper.style.opacity = '0'

      if (morphA.endFace) {
        morphA.startFace.style.transition = faceTransition
        morphA.endFace.style.transition = faceTransition
        morphA.startFace.style.opacity = '0'
        morphA.endFace.style.opacity = '1'
      }
      if (morphB.endFace) {
        morphB.startFace.style.transition = faceTransition
        morphB.endFace.style.transition = faceTransition
        morphB.startFace.style.opacity = '0'
        morphB.endFace.style.opacity = '1'
      }

      window.setTimeout(reveal, Math.max(0, durationMs - REVEAL_LEAD_MS))
      window.setTimeout(cleanup, durationMs + 40)
    })
  })
}

export const CROSS_SWAP_MS = SWAP_MS
