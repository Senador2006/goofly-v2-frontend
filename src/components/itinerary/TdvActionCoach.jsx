import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../../i18n'

const STEP_MS = 1600
const STEP_IDS = ['dislike', 'like', 'finalize']

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function readAnchorRect(anchors, stepId) {
  const node = anchors[stepId]?.current
  if (!node) return null
  const box = node.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return null
  return {
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
  }
}

function sameRect(prev, next) {
  return (
    prev &&
    prev.top === next.top &&
    prev.left === next.left &&
    prev.width === next.width &&
    prev.height === next.height
  )
}

/**
 * Escurece a tela e acende X, coração e check, um de cada vez.
 * Toque na área escura ou Escape encerra. Toque no botão recortado fica com o próprio handler.
 */
export function TdvActionCoach({ active, isPostUnlock, anchors, onFinish }) {
  const t = useT()
  const [stepIndex, setStepIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const onFinishRef = useRef(onFinish)
  const finishedRef = useRef(false)
  onFinishRef.current = onFinish

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinishRef.current()
  }, [])

  useEffect(() => {
    if (!active) return undefined
    finishedRef.current = false
    setStepIndex(0)
    return undefined
  }, [active])

  useEffect(() => {
    if (!active) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, finish])

  useEffect(() => {
    if (!active) return undefined
    const id = window.setTimeout(() => {
      if (stepIndex >= STEP_IDS.length - 1) finish()
      else setStepIndex(stepIndex + 1)
    }, STEP_MS)
    return () => window.clearTimeout(id)
  }, [active, stepIndex, finish])

  useLayoutEffect(() => {
    if (!active) return undefined
    const stepId = STEP_IDS[stepIndex]
    const update = () => {
      const next = readAnchorRect(anchors, stepId)
      setRect((prev) => {
        if (!next) return null
        if (sameRect(prev, next)) return prev
        return next
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [active, stepIndex, anchors])

  if (!active || !rect || typeof document === 'undefined') return null

  const stepId = STEP_IDS[stepIndex]
  const copy = coachCopy(t, isPostUnlock)[stepId]
  const viewWidth = window.innerWidth
  const viewHeight = window.innerHeight
  const holeRight = rect.left + rect.width
  const holeBottom = rect.top + rect.height
  const captionLeft = clamp(rect.left + rect.width / 2, 128, Math.max(128, viewWidth - 128))

  const panels = [
    { top: 0, left: 0, width: viewWidth, height: Math.max(0, rect.top) },
    { top: rect.top, left: 0, width: Math.max(0, rect.left), height: rect.height },
    { top: rect.top, left: holeRight, width: Math.max(0, viewWidth - holeRight), height: rect.height },
    { top: holeBottom, left: 0, width: viewWidth, height: Math.max(0, viewHeight - holeBottom) },
  ].filter((panel) => panel.width > 0 && panel.height > 0)

  return createPortal(
    <div role="dialog" aria-modal="false" aria-labelledby="tdv-coach-word">
      {panels.map((panel) => (
        <button
          key={`${panel.top}-${panel.left}-${panel.width}-${panel.height}`}
          type="button"
          tabIndex={-1}
          aria-label={t('tdv.coach_skip')}
          className="fixed z-[1250] cursor-default border-0 bg-black/70 p-0"
          style={panel}
          onClick={finish}
        />
      ))}
      <div
        className={`pointer-events-none fixed z-[1251] rounded-full ring-4 ${copy.ring}`}
        style={{
          top: rect.top - 5,
          left: rect.left - 5,
          width: rect.width + 10,
          height: rect.height + 10,
        }}
      />
      <div
        className="pointer-events-none fixed z-[1251] flex w-max max-w-[15rem] -translate-x-1/2 -translate-y-full flex-col items-center gap-1 pb-3 text-center"
        style={{ top: rect.top - 10, left: captionLeft }}
      >
        <p id="tdv-coach-word" className={`text-3xl font-extrabold leading-none ${copy.wordClass}`}>
          {copy.word}
        </p>
        <p className="text-sm font-medium leading-snug text-white">{copy.detail}</p>
      </div>
    </div>,
    document.body,
  )
}

function coachCopy(t, isPostUnlock) {
  return {
    dislike: {
      ring: 'ring-red-500',
      wordClass: 'text-red-500',
      word: t('tdv.intro_pill_no'),
      detail: t('tdv.coach_no_detail'),
    },
    like: {
      ring: 'ring-primary',
      wordClass: 'text-primary',
      word: t('tdv.intro_pill_want'),
      detail: t('tdv.coach_want_detail'),
    },
    finalize: {
      ring: 'ring-emerald-400',
      wordClass: 'text-emerald-400',
      word: isPostUnlock ? t('tdv.modify_intro_pill') : t('tdv.intro_pill_generate'),
      detail: isPostUnlock ? t('tdv.coach_modify_detail') : t('tdv.coach_generate_detail'),
    },
  }
}
