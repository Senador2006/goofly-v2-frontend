/**
 * Alinha o topo de `element` perto do topo visível de `container` (scroll suave).
 * @param {Element | null | undefined} element
 * @param {Element | null | undefined} container
 * @param {number} [offsetTop=8]
 */
export function scrollElementToContainerTop(element, container, offsetTop = 8) {
  if (!element || !container) return

  const delta =
    element.getBoundingClientRect().top - container.getBoundingClientRect().top - offsetTop

  if (Math.abs(delta) < 2) return
  container.scrollTo({ top: container.scrollTop + delta, behavior: 'smooth' })
}

/**
 * Espera layout estável (ex.: expandir card) antes de alinhar o scroll.
 * @param {Element | null | undefined} element
 * @param {Element | null | undefined} container
 * @param {number} [offsetTop=8]
 */
export function scrollElementToContainerTopAfterLayout(element, container, offsetTop = 8) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollElementToContainerTop(element, container, offsetTop)
    })
  })
}
