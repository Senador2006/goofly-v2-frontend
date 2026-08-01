import { useCallback, useLayoutEffect, useRef } from 'react'
import { Icon } from '../common/Icon'
import { RoteiroDragOverlay } from './RoteiroDragOverlay'

const SLIDE_MS = 360
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

function inactiveLabelClass({ dayLockedPremium, dayPartialPremium, swapEnabled }) {
  let label =
    'relative z-[3] inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap bg-transparent ' +
    INACTIVE_PAD +
    ' transition-[color,box-shadow,transform,opacity] duration-300 ease-out '

  if (swapEnabled) {
    label += 'touch-none select-none cursor-grab active:cursor-grabbing '
  }

  if (dayLockedPremium) {
    label += 'text-neutral-400 dark:text-neutral-500 grayscale-[35%] '
  } else if (dayPartialPremium) {
    label += 'text-amber-900 dark:text-amber-200 '
  } else {
    label += 'text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white '
  }

  return label
}

function activeLabelClass({ dayLockedPremium, swapEnabled }) {
  let label =
    'relative z-[3] inline-flex items-center gap-1.5 rounded-full font-extrabold whitespace-nowrap bg-transparent ' +
    ACTIVE_PAD +
    ' transition-[color,box-shadow,transform,opacity] duration-300 ease-out '

  if (swapEnabled) {
    label += 'touch-none select-none cursor-grab active:cursor-grabbing '
  }

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

/** Lê o translate X atual do indicador (para retarget no meio de um slide). */
function readIndicatorTranslateX(indicator) {
  const t = indicator?.style?.transform || ''
  const m = /translate3d\(\s*([-\d.]+)px/.exec(t)
  if (m) return Number(m[1])
  return null
}

function DaySwapGhost({ day, style }) {
  if (!style || style.visible === false || day == null) return null

  return (
    <div
      className={
        'roteiro-day-swap-ghost pointer-events-none fixed z-[1] inline-flex items-center justify-center gap-1.5 rounded-full box-border ' +
        'px-4 py-2 text-[13px] sm:text-sm font-extrabold whitespace-nowrap ' +
        'border-2 border-primary bg-primary text-black shadow-[0_12px_28px_-10px_rgba(0,0,0,0.35),0_0_0_3px_rgba(254,198,65,0.35)] ' +
        (style.hasTarget ? 'scale-105' : 'scale-[1.02]')
      }
      style={{
        left: style.left,
        top: style.top,
        width: style.width,
        height: style.height,
      }}
    >
      <Icon name="swap_horiz" className="text-[16px] shrink-0" aria-hidden />
      <span>Dia {day}</span>
    </div>
  )
}

/**
 * Camadas: caixa cinza (z-1) → elipse (z-2) → rótulo do dia (z-3).
 *
 * @param {{
 *   days: number[]
 *   selectedDay: number
 *   onSelectDay: (day: number) => void
 *   getDayState: (day: number) => { dayLockedPremium?: boolean, dayPartialPremium?: boolean, isActive: boolean }
 *   swapEnabled?: boolean
 *   daySwap?: {
 *     isSwapMode?: boolean
 *     isDragging?: boolean
 *     draggingDay?: number | null
 *     pendingDay?: number | null
 *     targetDay?: number | null
 *     ghostStyle?: { left: number, top: number, width: number, height?: number, visible?: boolean, hasTarget?: boolean } | null
 *     focusReady?: boolean
 *     onChipPointerDown?: (day: number, event: import('react').PointerEvent) => void
 *     chipRefs?: import('react').MutableRefObject<Map<number, HTMLElement>>
 *     scrollRef?: import('react').RefObject<HTMLElement | null>
 *   } | null
 * }} props
 */
export function ItineraryDayChips({
  days,
  selectedDay,
  onSelectDay,
  getDayState,
  swapEnabled = false,
  daySwap = null,
}) {
  const containerRef = useRef(null)
  const indicatorRef = useRef(null)
  const localChipRefs = useRef(new Map())
  const chipRefs = daySwap?.chipRefs ?? localChipRefs
  const prevMetricsRef = useRef(null)
  const isSlidingRef = useRef(false)
  const slideTimerRef = useRef(null)
  const slideTargetRef = useRef(null)

  const activeState = getDayState(selectedDay)
  const isSwapMode = Boolean(swapEnabled && daySwap?.isSwapMode)
  const isDragging = Boolean(swapEnabled && daySwap?.isDragging)
  // Expansão / ícones só depois do delay (ghost já está na mão).
  const focusReady = Boolean(daySwap?.focusReady)
  const showSwapChrome = isDragging && focusReady

  const placeIndicator = useCallback(
    (animateSlide) => {
      const indicator = indicatorRef.current
      const activeEl = chipRefs.current.get(selectedDay)
      if (!indicator || !activeEl) return

      const next = measureChip(activeEl)
      const prev = prevMetricsRef.current

      setIndicatorSize(indicator, next)

      // Durante o arraste: só esconde e estaciona — sem matar o slide “bonito” de seleção normal.
      if (isDragging) {
        if (slideTimerRef.current) {
          clearTimeout(slideTimerRef.current)
          slideTimerRef.current = null
        }
        isSlidingRef.current = false
        slideTargetRef.current = selectedDay
        indicator.style.opacity = '0'
        indicator.style.transition = 'none'
        indicator.style.transform = `translate3d(${next.left}px, 0, 0)`
        prevMetricsRef.current = { ...next, selectedDay }
        return
      }

      // Pending / drag antes do focusReady: sem slide e sem expand visual dos chips.
      if (isSwapMode && !focusReady) {
        if (slideTimerRef.current) {
          clearTimeout(slideTimerRef.current)
          slideTimerRef.current = null
        }
        isSlidingRef.current = false
        slideTargetRef.current = selectedDay
        indicator.style.opacity = isDragging ? '0' : '1'
        indicator.style.transition = 'none'
        indicator.style.transform = `translate3d(${next.left}px, 0, 0)`
        prevMetricsRef.current = { ...next, selectedDay }
        return
      }

      if (isSwapMode && focusReady && !isDragging) {
        if (slideTimerRef.current) {
          clearTimeout(slideTimerRef.current)
          slideTimerRef.current = null
        }
        isSlidingRef.current = false
        slideTargetRef.current = selectedDay
        indicator.style.opacity = '1'
        indicator.style.transition = 'none'
        indicator.style.transform = `translate3d(${next.left}px, 0, 0)`
        prevMetricsRef.current = { ...next, selectedDay }
        return
      }

      indicator.style.opacity = '1'

      const canSlide =
        animateSlide &&
        prev != null &&
        prev.selectedDay !== selectedDay &&
        Math.abs(prev.left - next.left) >= 1

      if (slideTimerRef.current) {
        clearTimeout(slideTimerRef.current)
        slideTimerRef.current = null
      }

      if (canSlide) {
        const liveX = isSlidingRef.current ? readIndicatorTranslateX(indicator) : null
        const fromLeft = liveX != null ? liveX : prev.left

        slideTargetRef.current = selectedDay
        isSlidingRef.current = true
        indicator.style.transition = 'none'
        indicator.style.transform = `translate3d(${fromLeft}px, 0, 0)`

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!indicatorRef.current || slideTargetRef.current !== selectedDay) return
            indicatorRef.current.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASING}`
            indicatorRef.current.style.transform = `translate3d(${next.left}px, 0, 0)`
          })
        })

        slideTimerRef.current = setTimeout(() => {
          if (slideTargetRef.current !== selectedDay) return
          isSlidingRef.current = false
          slideTimerRef.current = null
          prevMetricsRef.current = { ...next, selectedDay }
        }, SLIDE_MS + 40)
        return
      }

      // Já no lugar certo (ou sem animar): ancora sem pular por isSliding residual.
      isSlidingRef.current = false
      slideTargetRef.current = selectedDay
      indicator.style.transition = 'none'
      indicator.style.transform = `translate3d(${next.left}px, 0, 0)`
      prevMetricsRef.current = { ...next, selectedDay }
    },
    [selectedDay, chipRefs, isDragging, isSwapMode, focusReady],
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
      // No meio do slide: só atualiza tamanho — não corta a animação com snap.
      if (isSlidingRef.current) {
        const indicator = indicatorRef.current
        const activeEl = chipRefs.current.get(selectedDay)
        if (indicator && activeEl) setIndicatorSize(indicator, measureChip(activeEl))
        return
      }
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
  }, [placeIndicator, days, chipRefs, selectedDay])

  useLayoutEffect(() => {
    if (isDragging) return
    const activeEl = chipRefs.current.get(selectedDay)
    activeEl?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [selectedDay, chipRefs, isDragging])

  useLayoutEffect(() => {
    if (daySwap?.scrollRef) {
      daySwap.scrollRef.current = containerRef.current
    }
  })

  return (
    <>
      <div
        ref={containerRef}
        className={
          'relative isolate flex items-center gap-2 overflow-x-auto no-scrollbar [-webkit-overflow-scrolling:touch] w-full ' +
          'py-2.5 px-1.5 sm:py-3 sm:px-2 ' +
          (isSwapMode ? 'roteiro-day-chips--swap-mode ' : '') +
          (isDragging ? 'roteiro-day-chips--dragging ' : '')
        }
      >
        {days.map((day) => {
          const state = getDayState(day)
          const { dayLockedPremium, dayPartialPremium, isActive } = state
          const isDragSource = isDragging && daySwap?.draggingDay === day
          const isSwapTarget = showSwapChrome && daySwap?.targetDay === day
          const isSwapPending = daySwap?.pendingDay === day && daySwap?.phase === 'pending'
          // Não expandir o chip de origem até focusReady (ghost já na mão).
          const useActiveSize = isActive && !(isDragSource && !focusReady)

          return (
            <div
              key={day}
              className={
                'relative shrink-0 roteiro-day-chip ' +
                (isDragSource ? 'roteiro-day-chip--dragging ' : '') +
                (isSwapTarget ? 'roteiro-day-chip--swap-target ' : '') +
                (isSwapPending ? 'roteiro-day-chip--swap-pending ' : '')
              }
              ref={(node) => {
                if (node) chipRefs.current.set(day, node)
                else chipRefs.current.delete(day)
              }}
            >
              {isDragSource ? (
                <span
                  aria-hidden
                  className={
                    'pointer-events-none absolute inset-0 z-[1] rounded-full ' +
                    'border-2 border-dashed border-primary ' +
                    'bg-primary/15 dark:bg-primary/20 ' +
                    'shadow-[inset_0_0_0_1px_rgba(254,198,65,0.35)]'
                  }
                />
              ) : !useActiveSize ? (
                <span aria-hidden className={inactiveShellClass(state)} />
              ) : null}
              {isSwapTarget ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -inset-0.5 z-[2] rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background-light dark:ring-offset-[#23220f] bg-primary/25"
                />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (swapEnabled) return
                  onSelectDay(day)
                }}
                onPointerDown={(event) => {
                  if (!swapEnabled || !daySwap?.onChipPointerDown) return
                  daySwap.onChipPointerDown(day, event)
                }}
                className={
                  (useActiveSize
                    ? activeLabelClass({ ...state, swapEnabled })
                    : inactiveLabelClass({ ...state, swapEnabled })) +
                  (isDragSource
                    ? ' !text-primary dark:!text-primary '
                    : '') +
                  (isSwapTarget && !isDragSource ? ' text-black dark:text-black ' : '')
                }
                aria-current={isActive ? 'true' : undefined}
                aria-grabbed={isDragSource ? 'true' : undefined}
              >
                {dayLockedPremium && !isDragSource ? (
                  <Icon
                    name="lock"
                    className={`text-[15px] shrink-0 ${useActiveSize ? 'text-amber-900/90 dark:text-amber-100' : ''}`}
                    aria-hidden
                  />
                ) : null}
                {dayPartialPremium && !dayLockedPremium && !isDragSource ? (
                  <Icon
                    name="more_horiz"
                    className={`text-[16px] shrink-0 opacity-90 ${
                      useActiveSize ? 'text-black/70' : 'text-amber-800/80 dark:text-amber-300/90'
                    }`}
                    title="Prévia parcial — há mais paradas neste dia"
                    aria-hidden
                  />
                ) : null}
                {swapEnabled && showSwapChrome ? (
                  <Icon
                    name="swap_horiz"
                    className={`text-[15px] shrink-0 ${
                      isDragSource
                        ? 'text-primary opacity-90'
                        : useActiveSize || isSwapTarget
                          ? 'text-black/70 opacity-80'
                          : 'opacity-80'
                    }`}
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

      {swapEnabled && isDragging ? (
        <RoteiroDragOverlay active>
          <DaySwapGhost day={daySwap?.draggingDay} style={daySwap?.ghostStyle} />
        </RoteiroDragOverlay>
      ) : null}
    </>
  )
}
