import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'

const TRANSITION_MS = 280
const OVERLAY_Z = 'z-[1220]'

/**
 * Confirma substituição de dias entre hospedagens antes de persistir.
 */
export function AccommodationReplaceConfirmDialog({
  open,
  messages = [],
  confirming = false,
  confirmLabel = 'Confirmar e salvar',
  onCancel,
  onConfirm,
}) {
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
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !confirming) onCancel?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mounted, confirming, onCancel])

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
        onClick={() => {
          if (!confirming) onCancel?.()
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="acc-replace-confirm-title"
        aria-describedby="acc-replace-confirm-desc"
        className={`relative w-full max-w-md overflow-hidden rounded-t-3xl border border-border-light bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-card-dark sm:rounded-2xl motion-reduce:transition-none transition-all duration-300 ease-out ${
          visible ? 'opacity-100 sm:scale-100' : 'opacity-0 sm:scale-[0.96]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300">
            <Icon name="warning" className="text-xl" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="acc-replace-confirm-title"
              className="text-base font-black tracking-tight text-[#1c1c0d] dark:text-white"
            >
              Confirmar substituição?
            </h2>
            <div
              id="acc-replace-confirm-desc"
              className="mt-2 space-y-2 text-sm text-text-secondary dark:text-zinc-300 leading-relaxed"
            >
              {(messages || []).map((msg) => (
                <p key={msg} className="text-[#1c1c0d] dark:text-zinc-100">
                  {msg}
                </p>
              ))}
              <p className="text-xs text-text-secondary dark:text-zinc-400">
                As datas da hospedagem anterior serão ajustadas nos dias em comum.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <Button
            type="button"
            className="rounded-xl font-bold w-full"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? 'Salvando…' : confirmLabel}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="rounded-xl font-bold w-full"
            onClick={onCancel}
            disabled={confirming}
          >
            Voltar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
