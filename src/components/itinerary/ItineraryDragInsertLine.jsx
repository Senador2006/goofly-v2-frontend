/**
 * Linha azul que indica onde a parada será inserida durante o drag.
 */
export function ItineraryDragInsertLine({ top, visible = true }) {
  if (!visible || top == null || !Number.isFinite(top)) return null

  return (
    <div
      className="roteiro-drag-insert-line pointer-events-none absolute inset-x-10 z-30 flex items-center"
      style={{ top: `${top}px`, transform: 'translateY(-50%)' }}
      aria-hidden
    >
      <span className="size-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_0_2px_rgba(59,130,246,0.25)]" />
      <span className="h-[3px] flex-1 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.45)]" />
      <span className="size-2 rounded-full bg-blue-500 shrink-0 shadow-[0_0_0_2px_rgba(59,130,246,0.25)]" />
    </div>
  )
}
