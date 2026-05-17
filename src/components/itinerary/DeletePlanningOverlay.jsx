import { useEffect, useState } from 'react'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'

const TRANSITION_MS = 280

/**
 * Confirmação destrutiva em overlay — não altera o layout do header.
 */
export function DeletePlanningOverlay({ open, onClose, onConfirm, deleting = false, tripLabel }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
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
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mounted])

  useEffect(() => {
    if (!mounted) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !deleting) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mounted, deleting, onClose])

  if (!mounted) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      role="presentation"
      onClick={() => {
        if (!deleting) onClose()
      }}
    >
      <div
        className={`absolute inset-0 bg-foreground/40 dark:bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-planning-title"
        aria-describedby="delete-planning-desc"
        className={`relative w-full max-w-md rounded-2xl border border-red-500/25 bg-white dark:bg-card-dark shadow-2xl shadow-red-950/10 dark:shadow-black/50 overflow-hidden transition-all duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.96] translate-y-3'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-gradient-to-r from-red-500/80 via-red-600 to-red-500/80" aria-hidden />

        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div
              className="shrink-0 size-11 sm:size-12 rounded-2xl bg-red-500/15 dark:bg-red-500/20 border border-red-500/25 flex items-center justify-center"
              aria-hidden
            >
              <Icon name="delete_forever" className="text-2xl text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0 pt-0.5">
              <h2
                id="delete-planning-title"
                className="text-lg sm:text-xl font-black tracking-tight text-foreground dark:text-white leading-tight"
              >
                Apagar planejamento?
              </h2>
              {tripLabel ? (
                <p className="text-xs sm:text-sm text-text-secondary mt-1 truncate">{tripLabel}</p>
              ) : null}
            </div>
          </div>

          <p id="delete-planning-desc" className="mt-4 text-sm text-text-secondary leading-relaxed">
            Tem certeza que deseja apagar este planejamento? Todas as curtidas, descartes e o progresso do TDV serão
            perdidos. Esta ação não pode ser desfeita.
          </p>

          <div className="mt-5 sm:mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={deleting}
              className="w-full sm:w-auto rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onConfirm}
              disabled={deleting}
              className="w-full sm:w-auto rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-600/25 hover:shadow-red-600/35 focus-visible:ring-red-500/50"
            >
              <Icon name="delete" />
              {deleting ? 'Apagando...' : 'Sim, apagar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
