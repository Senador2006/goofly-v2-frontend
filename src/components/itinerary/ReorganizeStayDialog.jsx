import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'

const TRANSITION_MS = 280
const OVERLAY_Z = 'z-[1210]'

export function ReorganizeStayDialog({ open, onKeep, onReorganize, stayName }) {
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

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(
    <div
      className={`fixed inset-0 ${OVERLAY_Z} flex items-end justify-center p-0 sm:items-center sm:p-6`}
      role="presentation"
    >
      <div
        className={`absolute inset-0 bg-foreground/40 dark:bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        aria-hidden
        onClick={onKeep}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reorganize-stay-title"
        aria-describedby="reorganize-stay-desc"
        className={`relative w-full max-w-md overflow-hidden rounded-t-3xl border border-border-light bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-card-dark sm:rounded-2xl motion-reduce:transition-none transition-all duration-300 ease-out ${
          visible ? 'opacity-100 sm:scale-100' : 'opacity-0 sm:scale-[0.96]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[#45340a] dark:text-primary">
            <Icon name="route" className="text-xl" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="reorganize-stay-title"
              className="text-base font-black tracking-tight text-[#1c1c0d] dark:text-white"
            >
              Reorganizar paradas?
            </h2>
            <p
              id="reorganize-stay-desc"
              className="mt-2 text-sm text-text-secondary leading-relaxed"
            >
              O otimizador pode mudar a ordem do dia para ficar mais perto
              {stayName ? ` de ${stayName}` : ' da estadia'}. Suas paradas curtidas no TDV são
              preservadas.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Button type="button" className="rounded-xl font-bold w-full" onClick={onReorganize}>
            Reorganizar
          </Button>
          <Button type="button" variant="secondary" className="rounded-xl font-bold w-full" onClick={onKeep}>
            Manter como está
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
