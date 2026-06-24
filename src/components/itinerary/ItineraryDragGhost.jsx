import { ItineraryActivityCardCompact } from './ItineraryActivityCardCompact'

function minutesBetweenStarts(startStr, endStr) {
  if (!startStr || !endStr) return null
  const [sh, sm] = String(startStr).split(':').map(Number)
  const [eh, em] = String(endStr).split(':').map(Number)
  if (![sh, sm, eh, em].every(Number.isFinite)) return null
  const mins = eh * 60 + em - (sh * 60 + sm)
  return mins > 0 ? mins : null
}

function formatDuration(act, startResolved, endResolved) {
  const fromWindow = minutesBetweenStarts(startResolved, endResolved)
  if (fromWindow != null) {
    const h = Math.round((fromWindow / 60) * 10) / 10
    return `${h}h`
  }
  if (act?.duration) return act.duration
  if (act?.duration_minutes) {
    const h = Math.round((act.duration_minutes / 60) * 10) / 10
    return `${h}h`
  }
  return '2h'
}

/** Ghost flutuante da parada arrastada (dentro de RoteiroDragOverlay). */
export function ItineraryDragGhost({ activity, index, style }) {
  if (!activity || !style || style.visible === false) return null

  const start = activity.startTime || activity.start_time || activity.time || '09:00'
  const end = activity.endTime || activity.end_time
  const scheduleLabel =
    typeof end === 'string' && end.trim() ? `${start}–${String(end).trim()}` : start
  const title =
    activity.title || activity.name || activity.placeName || `Atividade ${index + 1}`

  const animate = Boolean(style.animate)
  const outOfList = Boolean(style.outOfList)

  return (
    <div
      className={
        'roteiro-drag-ghost pointer-events-none fixed rounded-2xl border-2 ' +
        (outOfList
          ? 'roteiro-drag-ghost--out-of-list border-amber-500/90 bg-amber-50/95 dark:bg-amber-950/40 '
          : 'border-primary bg-background-light dark:bg-[#23220f] ') +
        'shadow-[0_16px_40px_-12px_rgba(0,0,0,0.35),0_0_0_3px_rgba(254,198,65,0.35)] ' +
        (animate ? 'roteiro-drag-ghost--animate' : 'scale-[1.02]')
      }
      style={{
        left: style.left,
        top: style.top,
        width: style.width,
      }}
    >
      <ItineraryActivityCardCompact
        index={index}
        scheduleLabel={scheduleLabel}
        title={title}
        durationLabel={formatDuration(
          activity,
          start,
          typeof end === 'string' ? end.trim() : null,
        )}
      />
    </div>
  )
}
