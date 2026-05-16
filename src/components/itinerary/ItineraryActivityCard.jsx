import { Icon } from '../common/Icon'

function formatDuration(act) {
  if (act.duration) return act.duration
  if (act.duration_minutes) {
    const h = Math.round((act.duration_minutes / 60) * 10) / 10
    return `${h}h`
  }
  return '2h'
}

export function ItineraryActivityCard({ act, index, isLast }) {
  const time = act.startTime || act.start_time || act.time || '09:00'
  const title = act.title || act.name || act.placeName || `Atividade ${index + 1}`
  const description = act.description || act.notes

  return (
    <div className={`relative pl-8 ${isLast ? '' : 'pb-8'}`}>
      {!isLast && (
        <div className="absolute left-0 top-3 bottom-0 w-px border-l-2 border-dashed border-primary/70" aria-hidden />
      )}
      <div className="absolute left-[-5px] top-1 size-3 rounded-full bg-primary border-4 border-white dark:border-card-dark ring-2 ring-primary z-10" />
      <article className="rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-[#23220f] overflow-hidden shadow-sm">
        {act.image_url ? (
          <div
            className="h-36 sm:h-40 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${act.image_url})` }}
            role="img"
            aria-label={title}
          />
        ) : null}
        <CardBody time={time} act={act} title={title} description={description} />
      </article>
    </div>
  )
}

function CardBody({ time, act, title, description }) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-primary bg-primary/15 px-2.5 py-1 rounded-full">
          <Icon name="schedule" className="text-sm" />
          {time}
        </span>
        <span className="text-[11px] font-semibold text-text-secondary">{formatDuration(act)}</span>
      </div>
      <h3 className="text-base font-bold text-[#1c1c0d] dark:text-white leading-snug">{title}</h3>
      {description ? <p className="text-sm text-text-secondary mt-2 leading-relaxed">{description}</p> : null}
    </div>
  )
}
