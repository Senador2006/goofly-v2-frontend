import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { accommodationDisplayLabel, isAccommodationPlottable } from '../../utils/accommodationDayResolver'
import { accommodationTypeLabel } from '../../utils/accommodationForm'

function formatStayDates(acc) {
  const checkIn = String(acc?.checkIn || acc?.check_in || '').slice(0, 10)
  const checkOut = String(acc?.checkOut || acc?.check_out || '').slice(0, 10)
  if (!checkIn && !checkOut) return null
  const fmt = (iso) => {
    if (!iso) return ''
    const [y, m, d] = iso.split('-')
    if (!y || !m || !d) return iso
    return `${d}/${m}`
  }
  return `${fmt(checkIn)} – ${fmt(checkOut)}`
}

/**
 * Âncora de estadia na timeline do dia (saída de manhã / volta à noite).
 */
export function ItineraryStayAnchor({
  placement = 'start',
  stay,
  tripId,
  hasFullAccess,
  canEdit = true,
  onManage,
}) {
  const isStart = placement === 'start'
  const label = stay ? accommodationDisplayLabel(stay) : ''
  const dates = stay ? formatStayDates(stay) : null
  const plottable = stay ? isAccommodationPlottable(stay) : false

  if (stay) {
    return (
      <div
        className={`mb-4 rounded-2xl border border-primary/25 bg-primary/[0.07] dark:bg-primary/10 px-3 py-3 sm:px-4 ${
          placement === 'end' ? 'mt-4 mb-0' : ''
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[#45340a] dark:text-primary"
              aria-hidden
            >
              <Icon name="home" className="text-lg" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-wide text-text-secondary dark:text-zinc-400">
                {isStart ? 'Sai da hospedagem' : 'Volta à hospedagem'}
              </p>
              <p className="text-sm font-bold text-[#1c1c0d] dark:text-white break-words">{label}</p>
              <p className="text-xs text-text-secondary dark:text-zinc-300 mt-0.5">
                {[accommodationTypeLabel(stay.type), dates].filter(Boolean).join(' · ')}
              </p>
              {!plottable ? (
                <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-1 leading-snug">
                  Escolha o endereço no Google para o pin aparecer no mapa.
                </p>
              ) : null}
            </div>
          </div>
          {canEdit && hasFullAccess && isStart ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full rounded-xl !py-2 !px-3 text-xs font-bold sm:w-auto sm:shrink-0 sm:!py-1.5 sm:!px-2.5"
              onClick={() => onManage?.({ intent: 'manage', focusStayId: stay?.id })}
            >
              Gerenciar hospedagens
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  if (!isStart) return null

  if (hasFullAccess) {
    return (
      <div className="mb-4 rounded-2xl border border-dashed border-primary/35 bg-primary/5 px-4 py-4">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[#45340a] dark:text-primary"
            aria-hidden
          >
            <Icon name="hotel" className="text-lg" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">Ainda sem hospedagem neste dia</p>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Informe sua estadia para ancorar o mapa (saída de manhã e volta à noite).
            </p>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                className="mt-3 rounded-xl font-bold"
                onClick={() => onManage?.({ intent: 'add' })}
              >
                <Icon name="add" />
                Gerenciar hospedagens
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-gradient-to-br from-amber-500/12 to-transparent px-4 py-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300"
          aria-hidden
        >
          <Icon name="lock" className="text-lg" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">Ainda sem hospedagem neste dia</p>
          <p className="text-xs text-text-secondary mt-1 leading-relaxed">
            No plano completo você ancora o mapa na sua estadia, mesmo depois de pular essa etapa.
          </p>
          <Link
            to={`/pagamento?tripId=${encodeURIComponent(tripId)}`}
            className="mt-3 inline-flex"
          >
            <Button type="button" size="sm" className="rounded-xl font-bold">
              <Icon name="workspace_premium" />
              Roteiro completo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
