import { useCallback, useLayoutEffect, useRef } from 'react'
import { Icon } from '../common/Icon'

const SLIDE_MS = 300
const SLIDE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'

const INACTIVE_PAD = 'px-3.5 sm:px-4 py-[0.4375rem] sm:py-2 text-xs'
const ACTIVE_PAD = 'px-4 sm:px-[1.125rem] py-2 sm:py-2.5 text-[13px] sm:text-sm'

/** Caixa cinza atrás do rótulo (camada 1 — abaixo da elipse). */
function inactiveShellClass({ dayLockedPremium, dayPartialPremium }) {
  let shell =
    'pointer-events-none absolute inset-0 rounded-full z-[1] ' + INACTIVE_PAD + ' '

  if (dayLockedPremium) {
    shell +=
      'overflow-hidden ' +
      'bg-neutral-100 dark:bg-neutral-800 ' +
      'ring-2 ring-neutral-300 dark:ring-neutral-600 ' +
      "before:absolute before:inset-0 before:rounded-full before:z-[1] before:bg-[repeating-linear-gradient(-35deg,rgba(0,0,0,.055)_0px,rgba(0,0,0,.055)_4px,transparent_4px,transparent_8px)] " +
      "dark:before:bg-[repeating-linear-gradient(-35deg,rgba(255,255,255,.05)_0px,rgba(255,255,255,.05)_4px,transparent_4px,transparent_8px)] "
  } else if (dayPartialPremium) {
    shell +=
      'bg-amber-50 dark:bg-amber-950 ' +
      'ring-2 ring-dashed ring-amber-500/65 dark:ring-amber-400/40 '
  } else {
    shell += 'bg-neutral-100 dark:bg-neutral-800 '
  }

  return shell
}

function inactiveLabelClass({ dayLockedPremium, dayPartialPremium }) {
  let label =
    'relative z-[3] inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap bg-transparent ' +
    INACTIVE_PAD +
    ' transition-[color] duration-300 ease-out '

  if (dayLockedPremium) {
    label += 'text-neutral-400 dark:text-neutral-500 grayscale-[35%] '
  } else if (dayPartialPremium) {
    label += 'text-amber-900 dark:text-amber-200 '
  } else {
    label += 'text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white '
  }

  return label
}

function activeLabelClass({ dayLockedPremium }) {
  let label =
    'relative z-[3] inline-flex items-center gap-1.5 rounded-full font-extrabold whitespace-nowrap bg-transparent ' +
    ACTIVE_PAD +
    ' transition-[color] duration-300 ease-out '

  if (dayLockedPremium) {
    label += 'text-[#45340a] dark:text-amber-100 '
  } else {
    label += 'text-black dark:text-black '
  }

  return label
}

function indicatorFillClass({ dayLockedPremium, dayPartialPremium }) {
  if (dayLockedPremium) {
    return 'bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-950/90 dark:to-amber-900/70'
  }
  return 'bg-primary'
}

function measureChip(el) {
  return {
    left: el.offsetLeft,
    top: el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
  }
}

function setIndicatorSize(indicator, metrics) {
  indicator.style.width = `${metrics.width}px`
  indicator.style.height = `${metrics.height}px`
  indicator.style.top = `${metrics.top}px`
}

/**
 * Camadas: caixa cinza (z-1) → elipse (z-2) → rótulo do dia (z-3).
 */
export function ItineraryDayChips({ days, selectedDay, onSelectDay, getDayState }) {
  const containerRef = useRef(null)
  const indicatorRef = useRef(null)
  const chipRefs = useRef(new Map())
  const prevMetricsRef = useRef(null)
  const isSlidingRef = useRef(false)
  const slideTimerRef = useRef(null)
  const slideTargetRef = useRef(null)

  const activeState = getDayState(selectedDay)

  const placeIndicator = useCallback(
    (animateSlide) => {
      const indicator = indicatorRef.current
      const activeEl = chipRefs.current.get(selectedDay)
      if (!indicator || !activeEl) return

      const next = measureChip(activeEl)
      const prev = prevMetricsRef.current

      setIndicatorSize(indicator, next)
      indicator.style.opacity = '1'

      const canSlide =
        animateSlide &&
        prev != null &&
        prev.selectedDay !== selectedDay &&
        prev.left !== next.left

      const startSlide = canSlide && slideTargetRef.current !== selectedDay

      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current)
        slideTimerRef.current = null
      }

      if (startSlide) {
        slideTargetRef.current = selectedDay
        isSlidingRef.current = true
        indicator.style.transition = 'none'
        indicator.style.transform = `translate3d(${prev.left}px, 0, 0)`

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!indicatorRef.current || slideTargetRef.current !== selectedDay) return
            indicatorRef.current.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASING}`
            indicatorRef.current.style.transform = `translate3d(${next.left}px, 0, 0)`
          })
        })

        slideTimerRef.current = setTimeout(() => {
          isSlidingRef.current = false
          slideTimerRef.current = null
          prevMetricsRef.current = { ...next, selectedDay }
        }, SLIDE_MS + 40)
      } else if (!isSlidingRef.current) {
        indicator.style.transition = 'none'
        indicator.style.transform = `translate3d(${next.left}px, 0, 0)`
        prevMetricsRef.current = { ...next, selectedDay }
      }
    },
    [selectedDay]
  )

  useLayoutEffect(() => {
    placeIndicator(true)

    return () => {
      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current)
        slideTimerRef.current = null
      }
    }
  }, [placeIndicator, days])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return undefined

    const onLayoutChange = () => {
      if (isSlidingRef.current) return
      placeIndicator(false)
    }

    const ro = new ResizeObserver(onLayoutChange)
    ro.observe(container)
    for (const el of chipRefs.current.values()) {
      if (el) ro.observe(el)
    }

    window.addEventListener('resize', onLayoutChange)
    container.addEventListener('scroll', onLayoutChange, { passive: true })

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onLayoutChange)
      container.removeEventListener('scroll', onLayoutChange)
    }
  }, [placeIndicator, days])

  useLayoutEffect(() => {
    const activeEl = chipRefs.current.get(selectedDay)
    activeEl?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [selectedDay])

  return (
    <div
      ref={containerRef}
      className="relative isolate flex items-center gap-2 overflow-x-auto no-scrollbar [-webkit-overflow-scrolling:touch] w-full py-0.5"
    >
      {days.map((day) => {
        const state = getDayState(day)
        const { dayLockedPremium, dayPartialPremium, isActive } = state

        return (
          <div
            key={day}
            className="relative shrink-0"
            ref={(node) => {
              if (node) chipRefs.current.set(day, node)
              else chipRefs.current.delete(day)
            }}
          >
            {!isActive ? (
              <span aria-hidden className={inactiveShellClass(state)} />
            ) : null}
            <button
              type="button"
              onClick={() => onSelectDay(day)}
              className={isActive ? activeLabelClass(state) : inactiveLabelClass(state)}
              aria-current={isActive ? 'true' : undefined}
            >
              {dayLockedPremium ? (
                <Icon
                  name="lock"
                  className={`text-[15px] shrink-0 ${isActive ? 'text-amber-900/90 dark:text-amber-100' : ''}`}
                  aria-hidden
                />
              ) : null}
              {dayPartialPremium && !dayLockedPremium ? (
                <Icon
                  name="more_horiz"
                  className={`text-[16px] shrink-0 opacity-90 ${
                    isActive ? 'text-black/70' : 'text-amber-800/80 dark:text-amber-300/90'
                  }`}
                  title="Prévia parcial — há mais paradas neste dia"
                  aria-hidden
                />
              ) : null}
              <span>Dia {day}</span>
            </button>
          </div>
        )
      })}

      <div
        ref={indicatorRef}
        aria-hidden
        className={`pointer-events-none absolute left-0 z-[2] rounded-full will-change-transform opacity-0 ${indicatorFillClass(activeState)}`}
      />
    </div>
  )
}
