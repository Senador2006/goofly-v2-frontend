import { ItineraryActivityCardCompact } from './ItineraryActivityCardCompact'
import { Icon } from '../common/Icon'
import { formatActivityDuration } from '../../utils/formatActivityDuration'
import {
  formatMealTimeLabel,
  getMealTypeIcon,
  getMealTypeLabel,
} from '../../utils/itineraryMealHelpers'

/** Ghost flutuante da parada / bloco de refeição arrastado. */
export function ItineraryDragGhost({ activity, index, style }) {
  if (!activity || !style || style.visible === false) return null

  const isMeal =
    activity.__isMealGhost === true ||
    activity.isMealRecommendation === true ||
    Boolean(activity.mealType || activity.meal_type)

  const start = activity.startTime || activity.start_time || activity.time || '09:00'
  const end = activity.endTime || activity.end_time
  const scheduleLabel =
    typeof end === 'string' && end.trim() ? `${start}–${String(end).trim()}` : start
  const title =
    activity.title || activity.name || activity.placeName || `Atividade ${index + 1}`

  const animate = Boolean(style.animate)
  const outOfList = Boolean(style.outOfList)

  if (isMeal) {
    const mealType = activity.mealType || activity.meal_type || 'lunch'
    const mealLabel = getMealTypeLabel(mealType)
    const mealIcon = getMealTypeIcon(mealType)
    const timeLabel = formatMealTimeLabel(start)
    const optionCount = Number(activity.__mealOptionCount) || 0

    return (
      <div
        className={
          'roteiro-drag-ghost pointer-events-none fixed rounded-lg border-2 border-dashed ' +
          (outOfList
            ? 'roteiro-drag-ghost--out-of-list border-amber-600/90 bg-amber-100/95 dark:bg-amber-950/50 '
            : 'border-amber-500/70 bg-amber-50/95 dark:bg-amber-950/40 ') +
          'shadow-[0_16px_40px_-12px_rgba(180,83,9,0.4),0_0_0_3px_rgba(245,158,11,0.35)] ' +
          (animate ? 'roteiro-drag-ghost--animate' : 'scale-[1.02]')
        }
        style={{
          left: style.left,
          top: style.top,
          width: style.width,
        }}
      >
        <div className="flex items-center gap-2 px-3 py-2.5 min-h-[3.25rem]">
          <Icon name="drag_indicator" className="text-amber-800/60 dark:text-amber-200/60 shrink-0" aria-hidden />
          <span className="inline-flex items-center justify-center size-6 rounded-full border-2 border-amber-500/70 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 shrink-0">
            <Icon name={mealIcon} className="text-[14px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100 truncate">
              {mealLabel} · {timeLabel}
            </p>
            <p className="text-xs font-semibold text-[#1c1c0d] dark:text-white truncate leading-snug">
              {title}
              {optionCount > 1 ? (
                <span className="font-medium text-text-secondary"> · {optionCount} opções</span>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    )
  }

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
        durationLabel={formatActivityDuration(
          activity,
          start,
          typeof end === 'string' ? end.trim() : null,
        )}
      />
    </div>
  )
}
