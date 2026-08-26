import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'

const TRANSITION_MS = 280
/** Acima do MobileNav (z-[1100]). */
const OVERLAY_Z = 'z-[1200]'
const DISMISS_PX = 72

/**
 * Barra de exportação em tela cheia na base — uma ação: salvar/imprimir em PDF.
 * Portal no body para ficar acima da MobileNav; arraste para baixo para fechar.
 */
export function ItineraryExportSheet({ open, onClose, onExportPdf }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ active: false, startY: 0 })

  useEffect(() => {
    if (open) {
      setMounted(true)
      setDragY(0)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [mounted, onClose])

  const onHandlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { active: true, startY: e.clientY }
    setDragging(true)
  }

  const onHandlePointerMove = (e) => {
    if (!dragRef.current.active) return
    setDragY(Math.max(0, e.clientY - dragRef.current.startY))
  }

  const onHandlePointerUp = (e) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    const dy = Math.max(0, e.clientY - dragRef.current.startY)
    setDragging(false)
    if (dy >= DISMISS_PX) {
      setDragY(0)
      onClose()
      return
    }
    setDragY(0)
  }

  if (!mounted || typeof document === 'undefined') return null

  const sheetOffset = visible ? dragY : 24

  return createPortal(
    <div
      className={`fixed inset-0 ${OVERLAY_Z} flex items-end justify-center p-0 print:hidden sm:items-center sm:p-6`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={`absolute inset-0 bg-foreground/40 dark:bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="itinerary-export-title"
        className={`relative w-full overflow-hidden rounded-t-3xl border-x-0 border-b-0 border-t border-border-light bg-white shadow-2xl dark:border-white/10 dark:bg-card-dark dark:shadow-black/50 sm:max-w-sm sm:rounded-2xl sm:border motion-reduce:transition-none ${
          dragging ? '' : 'transition-all duration-300 ease-out'
        } ${visible ? 'opacity-100 sm:scale-100' : 'opacity-0 sm:scale-[0.96]'}`}
        style={{ transform: `translate3d(0, ${sheetOffset}px, 0)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex cursor-grab touch-none justify-center pt-2.5 pb-1 active:cursor-grabbing sm:hidden"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
          aria-label="Arraste para fechar"
        >
          <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-white/20" />
        </div>

        <div className="px-5 pt-2 pb-[max(1.5rem,var(--goofly-mobile-nav-height,4.5rem))] sm:p-5 sm:pb-5">
          <div className="flex items-start justify-between gap-3">
            <h2
              id="itinerary-export-title"
              className="text-base font-black tracking-tight text-foreground dark:text-white"
            >
              Exportar roteiro
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-zinc-100 dark:hover:bg-white/10"
              aria-label="Fechar"
            >
              <Icon name="close" className="text-lg" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onExportPdf()
              onClose()
            }}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-border-light bg-background-light px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-primary/35"
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-[#45340a] dark:text-primary">
              <Icon name="picture_as_pdf" className="text-xl" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-[#1c1c0d] dark:text-white">
                Exportar para PDF
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-text-secondary">
                Abre a impressão — escolha «Salvar como PDF»
              </span>
            </span>
            <Icon name="chevron_right" className="shrink-0 text-text-secondary" aria-hidden />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
