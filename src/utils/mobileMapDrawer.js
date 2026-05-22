/** Largura da barra arrastável (borda direita com mapa fechado). */
export const MOBILE_MAP_HANDLE_PX = 32
/** Botão de fechar com mapa aberto (meio-termo: visível sem ocupar demais). */
export const MOBILE_MAP_HANDLE_COMPACT_PX = 26
export const MOBILE_MAP_HANDLE_COMPACT_HEIGHT_PX = 54
/** Movimento mínimo (px) para considerar tap em vez de arrasto. */
export const MOBILE_MAP_TAP_THRESHOLD_PX = 8
/** Fração da largura para snap ao soltar. */
export const MOBILE_MAP_SNAP_RATIO = 0.35
/** Duração do slide do painel / handle (ms). */
export const MOBILE_MAP_DRAWER_MS = 520
/** Fade do painel ao abrir/fechar (ms). */
export const MOBILE_MAP_DRAWER_OPACITY_MS = 420
/** Desaceleração suave (sem “snap” agressivo no fim). */
export const MOBILE_MAP_DRAWER_EASE = 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'

/** CSS transition quando não está em arrasto. */
export function mobileMapDrawerTransitionStyle() {
  const motion = `${MOBILE_MAP_DRAWER_MS}ms ${MOBILE_MAP_DRAWER_EASE}`
  const fade = `${MOBILE_MAP_DRAWER_OPACITY_MS}ms ${MOBILE_MAP_DRAWER_EASE}`
  return [
    `transform ${motion}`,
    `left ${motion}`,
    `right ${motion}`,
    `width ${motion}`,
    `top ${motion}`,
    `height ${motion}`,
    `margin-top ${motion}`,
    `opacity ${fade}`,
  ].join(', ')
}

/**
 * Decide se o mapa fica aberto após soltar o handle.
 * Arrasto para a esquerda (dx negativo) abre; para a direita (dx positivo) fecha.
 * @param {{ wasOpen: boolean, dragDx: number, thresholdPx: number, tapThresholdPx?: number }} params
 */
export function resolveMobileMapSnap({
  wasOpen,
  dragDx,
  thresholdPx,
  tapThresholdPx = MOBILE_MAP_TAP_THRESHOLD_PX,
}) {
  if (Math.abs(dragDx) < tapThresholdPx) {
    return !wasOpen
  }
  if (wasOpen) {
    return dragDx < thresholdPx * MOBILE_MAP_SNAP_RATIO
  }
  return dragDx < -thresholdPx
}

/**
 * Painel full-screen ancorado à direita; entra da direita para a esquerda.
 * @param {{ open: boolean, isDragging: boolean, dragOffset: number }} params
 */
export function computeMapTranslate({ open, isDragging, dragOffset }) {
  if (isDragging && !open && dragOffset < 0) {
    return `translateX(calc(100% + ${dragOffset}px))`
  }
  if (isDragging && open && dragOffset > 0) {
    return `translateX(${dragOffset}px)`
  }
  return open ? 'translateX(0)' : 'translateX(100%)'
}

/**
 * Posição do handle: direita com mapa fechado; esquerda com mapa aberto.
 * @param {{ open: boolean, isDragging: boolean, dragOffset: number }} params
 * @returns {{ left?: number, right?: number }}
 */
export function computeHandleInset({ open, isDragging, dragOffset }) {
  if (isDragging && !open) {
    return { right: Math.max(0, -dragOffset) }
  }
  if (isDragging && open) {
    return { left: Math.max(0, dragOffset) }
  }
  if (open) {
    return { left: 0 }
  }
  return { right: 0 }
}

/**
 * Barra larga para abrir/arrastar; botão compacto com mapa aberto e parado.
 * @param {{ open: boolean, isDragging: boolean }} params
 */
export function resolveHandleWidthPx({ open, isDragging }) {
  if (open && !isDragging) {
    return MOBILE_MAP_HANDLE_COMPACT_PX
  }
  return MOBILE_MAP_HANDLE_PX
}
