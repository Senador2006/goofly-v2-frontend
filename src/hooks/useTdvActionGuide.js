import { useCallback, useEffect, useState } from 'react'
import {
  TDV_HINT_CHOICES_TO_HIDE,
  readTdvCoachSeen,
  readTdvHintCount,
  writeTdvCoachSeen,
  writeTdvHintCount,
} from '../utils/tdvCoachSession'

function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Holofote uma vez por viagem e rótulos que somem após duas escolhas.
 * Com prefers-reduced-motion o holofote não abre — ficam só os rótulos.
 */
export function useTdvActionGuide(tripId) {
  const [coachSeen, setCoachSeen] = useState(() => readTdvCoachSeen(tripId))
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)
  const [hintCount, setHintCount] = useState(() => readTdvHintCount(tripId))
  const [hintsFading, setHintsFading] = useState(false)

  useEffect(() => {
    setCoachSeen(readTdvCoachSeen(tripId))
    setHintCount(readTdvHintCount(tripId))
    setHintsFading(false)
  }, [tripId])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const finishCoach = useCallback(() => {
    writeTdvCoachSeen(tripId)
    setCoachSeen(true)
  }, [tripId])

  const recordChoice = useCallback(() => {
    const current = readTdvHintCount(tripId)
    if (current >= TDV_HINT_CHOICES_TO_HIDE) return
    const next = current + 1
    writeTdvHintCount(tripId, next)
    setHintCount(next)
    if (next >= TDV_HINT_CHOICES_TO_HIDE) setHintsFading(true)
  }, [tripId])

  useEffect(() => {
    if (!hintsFading) return undefined
    const id = window.setTimeout(() => setHintsFading(false), 320)
    return () => window.clearTimeout(id)
  }, [hintsFading])

  return {
    coachSeen,
    reducedMotion,
    finishCoach,
    recordChoice,
    hintsFading,
    hintsDismissed: hintCount >= TDV_HINT_CHOICES_TO_HIDE && !hintsFading,
  }
}
