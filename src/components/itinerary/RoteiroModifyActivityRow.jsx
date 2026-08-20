import { Icon } from '../common/Icon'
import { resolveActivityTitle } from '../../utils/itineraryPrintFormat'
import { formatActivityDuration } from '../../utils/formatActivityDuration'
import { RoteiroModifyStopCard } from './RoteiroModifyStopCard'

/**
 * Linha enxuta de parada no modo «Modificar Roteiro» —
 * só horário, título, duração e ações essenciais (trocar / remover).
 */
export function RoteiroModifyActivityRow({
  act,
  index,
  isLast = false,
  swapArmed = false,
  motion = null,
  onSwap,
  onRemove,
  cardRef = null,
}) {
  const start = act?.startTime || act?.start_time || act?.time || '09:00'
  const end = act?.endTime || act?.end_time
  const scheduleLabel =
    typeof end === 'string' && end.trim() ? `${start}–${String(end).trim()}` : start
  const title = resolveActivityTitle(act, index)
  const durationLabel = formatActivityDuration(
    act,
    start,
    typeof end === 'string' ? end.trim() : null,
  )

  const motionClass =
    motion === 'enter'
      ? 'roteiro-modify-row--enter'
      : motion === 'exit'
        ? 'roteiro-modify-row--exit'
        : motion === 'swap-hide'
          ? 'roteiro-modify-row--swap-hide'
          : ''

  return (
    <div className={`relative pl-8 ${isLast ? '' : 'pb-2'} ${motionClass}`.trim()}>
      {!isLast && motion !== 'exit' ? (
        <div
          className="absolute left-[11px] top-7 bottom-0 w-px border-l border-dashed border-primary/50"
          aria-hidden
        />
      ) : null}
      <span
        className="absolute left-0 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-[10px] font-black text-[#1c1c0d]"
        aria-hidden
      >
        {index + 1}
      </span>
      <RoteiroModifyStopCard
        cardRef={cardRef}
        title={title}
        chipLabel={scheduleLabel}
        chipIcon="schedule"
        metaLabel={durationLabel}
        hint={swapArmed && motion !== 'exit' && motion !== 'swap-hide' ? 'Toque para trocar' : null}
        selected={swapArmed && motion !== 'exit' && motion !== 'swap-hide'}
        interactive={swapArmed && motion !== 'exit' && motion !== 'swap-hide'}
        onClick={
          swapArmed && motion !== 'exit' && motion !== 'swap-hide' ? onSwap : undefined
        }
        onKeyDown={
          swapArmed && motion !== 'exit' && motion !== 'swap-hide'
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSwap?.()
                }
              }
            : undefined
        }
        role={swapArmed && motion !== 'exit' && motion !== 'swap-hide' ? 'button' : undefined}
        tabIndex={swapArmed && motion !== 'exit' && motion !== 'swap-hide' ? 0 : undefined}
        aria-label={swapArmed ? `Trocar «${title}» pela curtida selecionada` : undefined}
        trailing={
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onRemove?.()
            }}
            disabled={motion === 'exit' || motion === 'swap-hide'}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-red-500/30 bg-red-500/10 text-red-600 transition-colors hover:bg-red-500/15 disabled:pointer-events-none disabled:opacity-40 dark:text-red-400"
            aria-label={`Remover ${title}`}
            title="Remover"
          >
            <Icon name="delete" className="text-base" />
          </button>
        }
      />
    </div>
  )
}
