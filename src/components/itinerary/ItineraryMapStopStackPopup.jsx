import { ItineraryMapStopPopup } from './ItineraryMapStopPopup'

/**
 * Popup do mapa quando várias paradas caem no mesmo ponto (stack).
 * Mostra o card completo da parada selecionada + seletor para as demais.
 *
 * @param {{
 *   members: Array<{
 *     pinId: string,
 *     order?: number | null,
 *     name?: string | null,
 *     startTime?: string | null,
 *     imageUrls?: string[],
 *   }>,
 *   selectedPinId: string | null,
 *   onSelect: (pinId: string) => void,
 * }} props
 */
export function ItineraryMapStopStackPopup({ members, selectedPinId, onSelect }) {
  const list = Array.isArray(members) ? members : []
  const selected = list.find((m) => m.pinId === selectedPinId) || list[0] || null

  return (
    <div
      className="goofly-map-stop-popup__inner goofly-map-stop-stack-popup"
      onWheel={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="goofly-map-stop-stack-popup__switcher px-2 pt-2 pb-1.5 border-b border-border-light dark:border-border-dark">
        <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-wide text-text-secondary">
          {list.length} paradas neste ponto
        </p>
        <div className="flex flex-wrap gap-1" role="listbox" aria-label="Escolher parada">
          {list.map((m) => {
            const isSelected = selected?.pinId === m.pinId
            const label = m.order != null ? String(m.order) : '·'
            return (
              <button
                key={m.pinId}
                type="button"
                role="option"
                aria-selected={isSelected}
                title={m.name || (m.order != null ? `Parada ${m.order}` : 'Parada')}
                className={
                  'inline-flex min-w-[1.75rem] h-7 items-center justify-center rounded-full px-2 text-xs font-extrabold transition-colors border ' +
                  (isSelected
                    ? 'border-[#FEC641] bg-[#FEC641] text-[#1c1c0d]'
                    : 'border-black/10 dark:border-white/15 bg-black/[0.04] dark:bg-white/[0.08] text-foreground dark:text-white hover:bg-black/[0.08]')
                }
                onClick={(e) => {
                  e.stopPropagation()
                  if (typeof onSelect === 'function') onSelect(m.pinId)
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {selected ? (
        <ItineraryMapStopPopup
          key={selected.pinId}
          order={selected.order}
          name={selected.name}
          startTime={selected.startTime}
          imageUrls={selected.imageUrls}
        />
      ) : null}
    </div>
  )
}
