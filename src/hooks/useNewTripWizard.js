import { useEffect, useRef, useState } from 'react'
import { accommodationHasContent } from '../utils/accommodationForm'
import { resolveAccommodationDayOverlaps } from '../utils/accommodationStayContract'
import { addCalendarDaysIso, todayIsoCalendarDate, tripSpanMaxDepartureIso } from '../utils/dateInput'
import {
  collectStepErrors,
  furthestUnlockedStep as computeFurthestUnlocked,
} from '../utils/newTripFormValidation'
import { stepErrorKey } from '../utils/newTripStep1Validation'
import { useNewTripForm } from './useNewTripForm'

export function useNewTripWizard({ mapsReady, mapsUnavailable }) {
  const [step, setStep] = useState(1)
  const [maxReachedStep, setMaxReachedStep] = useState(1)
  const [errors, setErrors] = useState([])
  const [apiError, setApiError] = useState(null)
  const [stayNotice, setStayNotice] = useState(null)
  const [pendingStayAdvance, setPendingStayAdvance] = useState(null)
  const errorBannerRef = useRef(null)
  const stepRef = useRef(step)
  stepRef.current = step

  const clearApiError = () => setApiError(null)
  const clearFormErrors = () => {
    setErrors([])
    setApiError(null)
  }
  const showStepErrors = (list) => {
    setApiError(null)
    setErrors(list)
    requestAnimationFrame(() => {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }

  const form = useNewTripForm({ showStepErrors, clearFormErrors, clearApiError })
  const { formData, formDataRef, setFormData } = form
  const step1Options = () => ({
    requirePlaceSelection: true,
    requireAccommodationCoordinates: mapsReady,
    mapsUnavailable,
  })
  const collectForStep = (value, data = formData) =>
    collectStepErrors(value, data, step1Options())
  const furthestUnlockedStep = (visited, data = formData) =>
    computeFurthestUnlocked(visited, data, step1Options())
  const goToStep = (next) => {
    setStep(next)
    setMaxReachedStep((prev) => Math.max(prev, next))
  }

  useEffect(() => {
    const nextMax = furthestUnlockedStep(maxReachedStep, formData)
    if (step > nextMax) setStep(nextMax)
  }, [formData, maxReachedStep, step, mapsReady, mapsUnavailable])

  useEffect(() => {
    if (errors.length === 0) return
    const remaining = collectForStep(step, formData)
    const remainingKeys = new Set(remaining.map(stepErrorKey))
    const stillValid = errors.filter((e) => remainingKeys.has(stepErrorKey(e)))
    if (stillValid.length !== errors.length) setErrors(stillValid)
  }, [formData, step, errors, mapsReady, mapsUnavailable])

  const applyStayStepAndAdvance = (resolved, warnings) => {
    const empty = (formData.accommodations || []).filter((a) => !accommodationHasContent(a))
    setFormData((prev) => ({ ...prev, accommodations: [...empty, ...resolved] }))
    setStayNotice(warnings.length > 0 ? warnings.map((w) => w.message).join(' ') : null)
    setPendingStayAdvance(null)
    goToStep(3)
  }

  const advanceStepAfterValidation = (fromStep, data = formDataRef.current) => {
    const list = collectForStep(fromStep, data)
    if (list.length > 0) {
      showStepErrors(list)
      return
    }
    clearFormErrors()
    if (fromStep === 2) {
      const filled = (data.accommodations || []).filter(accommodationHasContent)
      const { accommodations: resolved, warnings } = resolveAccommodationDayOverlaps(filled)
      if (warnings.length > 0) {
        setPendingStayAdvance({ resolved, warningMessages: warnings.map((w) => w.message) })
        return
      }
      applyStayStepAndAdvance(resolved, warnings)
      return
    }
    setStayNotice(null)
    if (fromStep < 4) goToStep(fromStep + 1)
  }

  const handleNextClick = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        advanceStepAfterValidation(stepRef.current, formDataRef.current)
      })
    })
  }
  const handleBack = () => {
    clearFormErrors()
    setStayNotice(null)
    setPendingStayAdvance(null)
    if (step > 1) setStep(step - 1)
  }
  const tryGoToStep = (next) => {
    if (next === step) return
    const allowed = furthestUnlockedStep(maxReachedStep, formData)
    if (next > allowed) {
      const blocker = collectForStep(allowed, formData)
      if (blocker.length > 0) showStepErrors(blocker)
      return
    }
    for (let value = 1; value < next; value += 1) {
      const list = collectForStep(value, formData)
      if (list.length > 0) {
        showStepErrors(list)
        setMaxReachedStep((prev) => Math.max(prev, value))
        setStep(value)
        return
      }
    }
    clearFormErrors()
    setStayNotice(null)
    goToStep(next)
  }
  const handleFormSubmit = (event) => {
    event.preventDefault()
    if (step < 4) handleNextClick()
  }

  const skipStay = step === 2 && !(formData.accommodations || []).some(accommodationHasContent)
  const todayIso = todayIsoCalendarDate()
  const firstArrival = formData.destinations[0]?.arrivalDate || ''

  return {
    ...form,
    step,
    setStep,
    maxReachedStep,
    errors,
    apiError,
    setApiError,
    stayNotice,
    setStayNotice,
    pendingStayAdvance,
    setPendingStayAdvance,
    errorBannerRef,
    collectForStep,
    clearFormErrors,
    showStepErrors,
    applyStayStepAndAdvance,
    advanceStepAfterValidation,
    handleNextClick,
    handleBack,
    tryGoToStep,
    handleFormSubmit,
    skipStay,
    unlockedStep: furthestUnlockedStep(maxReachedStep),
    bannerMessages: [...errors.map((e) => e.message), ...(apiError ? [apiError] : [])],
    todayIso,
    addCalendarDaysIso,
    tripMaxDeparture: firstArrival ? tripSpanMaxDepartureIso(firstArrival) : undefined,
  }
}
