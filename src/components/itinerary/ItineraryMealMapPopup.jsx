import { Icon } from '../common/Icon'

import {

  formatMealTimeLabel,

  getMealPositionLabel,

  getMealTypeIcon,

  getMealTypeLabel,

} from '../../utils/itineraryMealHelpers'



/**

 * Popup minimalista para pin de refeição no mapa.

 *

 * @param {{

 *   mealType?: string | null

 *   name?: string | null

 *   startTime?: string | null

 *   mealPosition?: string | null

 *   optionCount?: number

 *   onViewOptions?: (() => void) | null

 *   onViewInTimeline?: (() => void) | null

 * }} props

 */

export function ItineraryMealMapPopup({

  mealType,

  name,

  startTime,

  mealPosition,

  optionCount = 1,

  onViewOptions = null,

  onViewInTimeline = null,

}) {

  const mealLabel = getMealTypeLabel(mealType)

  const mealIcon = getMealTypeIcon(mealType)

  const timeLabel = formatMealTimeLabel(startTime)

  const positionLabel = getMealPositionLabel(mealPosition)



  return (

    <div

      className="goofly-map-stop-popup__inner"

      onWheel={(e) => e.stopPropagation()}

      onClick={(e) => e.stopPropagation()}

    >

      <div className="goofly-map-stop-popup__body">

        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100 bg-amber-500/15 px-2 py-0.5 rounded-full mb-2">

          <Icon name={mealIcon} className="text-xs shrink-0" aria-hidden />

          {mealLabel} · {timeLabel}

        </span>

        <p className="m-0 text-sm font-bold text-foreground dark:text-white leading-snug">

          {name || 'Sugestão gastronômica'}

        </p>

        {positionLabel ? (

          <p className="m-0 text-xs text-text-secondary mt-1">{positionLabel}</p>

        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">

          {typeof onViewInTimeline === 'function' ? (

            <button

              type="button"

              onClick={(e) => {

                e.stopPropagation()

                onViewInTimeline()

              }}

              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-200 hover:underline"

            >

              <Icon name="list" className="text-sm" aria-hidden />

              Ver na timeline

            </button>

          ) : null}

          {optionCount > 1 && onViewOptions ? (

            <button

              type="button"

              onClick={(e) => {

                e.stopPropagation()

                onViewOptions()

              }}

              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-200 hover:underline"

            >

              Ver outras {optionCount - 1} {optionCount - 1 === 1 ? 'opção' : 'opções'}

              <Icon name="expand_more" className="text-sm" aria-hidden />

            </button>

          ) : null}

        </div>

      </div>

    </div>

  )

}

