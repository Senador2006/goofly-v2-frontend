import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'

export function ItineraryPremiumBanner({ tripId, restriction, onAdminUnlock, showAdminUnlock }) {
  if (!restriction?.total || restriction.visible >= restriction.total) return null

  const hidden = restriction.total - restriction.visible

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-primary/10 p-4 sm:p-5">
      <BannerHeader hidden={hidden} restriction={restriction} />
      <ul className="text-xs text-text-secondary space-y-1.5 mb-4">
        <li className="flex items-center gap-2">
          <Icon name="check" className="text-primary text-sm shrink-0" />
          Roteiro completo em todos os dias
        </li>
        <li className="flex items-center gap-2">
          <Icon name="check" className="text-primary text-sm shrink-0" />
          Documentos de viagem inteligentes e checklist por IA
        </li>
      </ul>
      <Link to={`/pagamento?tripId=${encodeURIComponent(tripId || '')}`} className="block">
        <Button className="w-full rounded-full font-bold">
          <Icon name="workspace_premium" />
          Desbloquear roteiro completo
        </Button>
      </Link>
      {showAdminUnlock ? (
        <Button variant="secondary" className="w-full mt-2 rounded-full text-xs" size="sm" onClick={onAdminUnlock}>
          Liberar planejamento completo
        </Button>
      ) : null}
    </div>
  )
}

function BannerHeader({ hidden, restriction }) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <div className="rounded-full bg-primary/25 p-2 shrink-0">
        <Icon name="lock" className="text-xl text-primary" />
      </div>
      <div>
        <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">
          Prévia gratuita — {restriction.visible} de {restriction.total} atividades
        </p>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">
          Mais {hidden} {hidden === 1 ? 'parada' : 'paradas'} no roteiro otimizado. Desbloqueie para ver horários,
          ordem e dias completos.
        </p>
      </div>
    </div>
  )
}
