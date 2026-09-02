import {
  groupActivitiesByDay,
  getIsoDateForDay,
  sortDayActivities,
} from '../../utils/itineraryDayHelpers'
import {
  buildDayTimelineItems,
  filterRouteActivities,
  formatMealTimeLabel,
  getMealPositionLabel,
  getMealTypeLabel,
} from '../../utils/itineraryMealHelpers'
import {
  formatIsoDatePt,
  formatTripDateRange,
  resolveActivityDescription,
  resolveActivityLinks,
  resolveActivitySchedule,
  resolveActivityTitle,
} from '../../utils/itineraryPrintFormat'

/**
 * Layout estático para impressão / “Salvar como PDF” via diálogo do navegador.
 * Oculto na tela; visível apenas com `@media print`.
 */
export function ItineraryPrintView({
  trip,
  activities = [],
  days = [],
  dateToDayMap,
  destLabel,
  hasFullAccess = true,
  premiumRestriction = null,
}) {
  const grouped = groupActivitiesByDay(activities, dateToDayMap, days)
  const dateRange = formatTripDateRange(trip)
  const generatedAt = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  if (!activities.length) return null

  return (
    <div
      id="itinerary-print"
      className="hidden print:block bg-white text-black text-[11pt] leading-snug"
      aria-hidden="true"
    >
      <header className="border-b-2 border-black pb-4 mb-6">
        <p className="text-[9pt] uppercase tracking-[0.2em] text-neutral-600 mb-1">Goofly · Roteiro de viagem</p>
        <h1 className="text-[20pt] font-black leading-tight m-0">{destLabel || 'Viagem'}</h1>
        {dateRange ? <p className="text-[10pt] text-neutral-700 mt-2 m-0">{dateRange}</p> : null}
        <p className="text-[9pt] text-neutral-500 mt-2 m-0">
          {activities.length} {activities.length === 1 ? 'parada' : 'paradas'}
          {premiumRestriction?.total && !hasFullAccess
            ? ` · prévia (${premiumRestriction.visible}/${premiumRestriction.total} visíveis)`
            : ''}
          {' · '}Gerado em {generatedAt}
        </p>
      </header>

      {grouped.map(({ day, activities: dayActs }) => {
        if (!dayActs.length) return null
        const iso = getIsoDateForDay(dateToDayMap, day)
        const dayDateLabel = formatIsoDatePt(iso)

        return (
          <section key={day} className="mb-8 break-inside-avoid-page">
            <h2 className="text-[14pt] font-bold border-b border-neutral-300 pb-1 mb-4 m-0">
              Dia {day}
              {dayDateLabel ? (
                <span className="font-normal text-[10pt] text-neutral-600"> · {dayDateLabel}</span>
              ) : null}
            </h2>

            <ol className="list-none m-0 p-0 space-y-4">
              {buildDayTimelineItems(sortDayActivities(dayActs)).map((item, idx) => {
                if (item.type === 'mealSlot') {
                  const mealLabel = getMealTypeLabel(item.mealType)
                  const timeLabel = formatMealTimeLabel(item.startTime)
                  return (
                    <li
                      key={`meal-${item.slotKey}`}
                      className="break-inside-avoid-page pl-0 rounded-lg border border-dashed border-neutral-400 px-3 py-3 bg-neutral-50"
                    >
                      <p className="m-0 font-bold text-[11pt]">
                        {mealLabel} · {timeLabel}
                        <span className="font-normal text-[9pt] text-neutral-600">
                          {' '}
                          — sugestões de refeição
                        </span>
                      </p>
                      <ul className="m-0 mt-2 p-0 list-none space-y-2">
                        {item.options.map((opt, optIdx) => {
                          const title = resolveActivityTitle(opt, optIdx)
                          const description = resolveActivityDescription(opt)
                          const position = getMealPositionLabel(
                            opt.mealPosition ?? opt.meal_position ?? opt.position,
                          )
                          const links = resolveActivityLinks(opt)
                          return (
                            <li key={String(opt.id || `${item.slotKey}-${optIdx}`)} className="text-[10pt]">
                              <p className="m-0 font-semibold">{title}</p>
                              {position ? (
                                <p className="m-0 mt-0.5 text-[9pt] text-neutral-600">{position}</p>
                              ) : null}
                              {description ? (
                                <p className="m-0 mt-1 text-[9pt] text-neutral-800 whitespace-pre-wrap">
                                  {description}
                                </p>
                              ) : null}
                              {links.length > 0 ? (
                                <p className="m-0 mt-1 text-[9pt] text-neutral-700 break-all">
                                  Maps: {links.join(' · ')}
                                </p>
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                }

                const act = item.act
                const routeActs = filterRouteActivities(dayActs)
                const stopIndex = routeActs.findIndex((a) => String(a.id) === String(act.id))
                const title = resolveActivityTitle(act, stopIndex >= 0 ? stopIndex : idx)
                const schedule = resolveActivitySchedule(act)
                const description = resolveActivityDescription(act)
                const links = resolveActivityLinks(act)

                return (
                  <li key={String(act.id || `${day}-${idx}`)} className="break-inside-avoid-page pl-0">
                    <div className="flex gap-3 items-baseline">
                      <span className="shrink-0 w-8 h-8 rounded-full bg-[#fec641] text-black text-[10pt] font-black flex items-center justify-center">
                        {stopIndex >= 0 ? stopIndex + 1 : idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 font-bold text-[11pt]">{title}</p>
                        {schedule ? (
                          <p className="m-0 mt-0.5 text-[10pt] text-neutral-700">{schedule}</p>
                        ) : null}
                        {description ? (
                          <p className="m-0 mt-1.5 text-[10pt] text-neutral-800 whitespace-pre-wrap">{description}</p>
                        ) : null}
                        {links.length > 0 ? (
                          <ul className="m-0 mt-1.5 p-0 list-none text-[9pt] text-neutral-700">
                            {links.map((url) => (
                              <li key={url} className="break-all">
                                Ingresso / reserva: {url}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}

      <footer className="mt-10 pt-4 border-t border-neutral-300 text-[9pt] text-neutral-600">
        {!hasFullAccess && premiumRestriction ? (
          <p className="m-0 mb-2 font-semibold text-neutral-800">
            Prévia parcial — desbloqueie o roteiro completo no Goofly para ver e imprimir todas as paradas.
          </p>
        ) : null}
        <p className="m-0">goofly.app · Roteiro gerado automaticamente. Confirme horários e ingressos antes da viagem.</p>
      </footer>
    </div>
  )
}
