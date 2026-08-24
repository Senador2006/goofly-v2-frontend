import { RoteiroModifyStopCard } from './RoteiroModifyStopCard'

/** Ghost flutuante da curtida arrastada no modo Modificar Roteiro. */
export function RoteiroModifyDragGhost({ like, style }) {
  if (!like || !style || style.visible === false) return null

  const title = like.name || like.title || 'Curtida'

  return (
    <div
      className="pointer-events-none fixed z-[80] scale-[1.03] rounded-md shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35),0_0_0_3px_rgba(254,198,65,0.35)]"
      style={{
        left: style.left,
        top: style.top,
        width: style.width,
      }}
      aria-hidden
    >
      <RoteiroModifyStopCard
        title={title}
        chipLabel="Curtida"
        chipIcon="favorite"
        selected
        className="bg-background-light dark:bg-[#23220f]"
      />
    </div>
  )
}
