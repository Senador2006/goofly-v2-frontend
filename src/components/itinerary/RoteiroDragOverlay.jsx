import { createPortal } from 'react-dom'

/**
 * Camada fixa acima do mapa e do restante da UI durante o drag de paradas.
 */
export function RoteiroDragOverlay({ active, children }) {
  if (!active || typeof document === 'undefined') return null

  return createPortal(
    <div className="roteiro-drag-overlay fixed inset-0 pointer-events-none" aria-hidden>
      {children}
    </div>,
    document.body,
  )
}
