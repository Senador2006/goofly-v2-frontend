import { useRef, useState } from 'react'
import { DEFAULT_CURRENCY } from '../utils/tripCurrency'
import {
  createEmptyAccommodation,
} from '../utils/accommodationForm'
import { suggestStayWindowAllowingOverlap } from '../utils/accommodationStayContract'
import { applyDestinationDateRules, generateId } from '../utils/newTripFormHelpers'

export function useNewTripForm({ showStepErrors, clearFormErrors, clearApiError }) {
  const [formData, setFormData] = useState({
    destinations: [{ id: generateId(), city: '', country: '', arrivalDate: '', departureDate: '', order: 1 }],
    accommodations: [],
    interests: [],
    tripDescription: '',
    itineraryStyle: 'equilibrado',
    avoidPreferences: [],
    prioritizePreferences: [],
    avoidCustom: '',
    prioritizeCustom: '',
    budget: '',
    currency: DEFAULT_CURRENCY,
    travelers: { adults: 1, children: 0 },
  })
  const formDataRef = useRef(formData)
  formDataRef.current = formData

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    clearApiError()
  }

  const updateDestination = (index, updates) => {
    const prev = formDataRef.current
    const { dests, notices } = applyDestinationDateRules(prev.destinations, index, updates)
    setFormData({ ...prev, destinations: dests })
    if (notices.length > 0) {
      clearApiError()
      showStepErrors(notices)
    }
  }

  const addDestination = () => {
    const last = formData.destinations[formData.destinations.length - 1]
    const dep = last?.departureDate || ''
    setFormData((prev) => ({
      ...prev,
      destinations: [
        ...prev.destinations,
        { id: generateId(), city: '', country: '', arrivalDate: dep, departureDate: '', order: prev.destinations.length + 1 },
      ],
    }))
  }

  const removeDestination = (index) => {
    if (formData.destinations.length <= 1) return
    const removedId = formData.destinations[index]?.id
    setFormData((prev) => ({
      ...prev,
      destinations: prev.destinations.filter((_, i) => i !== index).map((d, i) => ({ ...d, order: i + 1 })),
      accommodations: (prev.accommodations || []).filter((a) => a.destinationId !== removedId),
    }))
  }

  const updateAccommodation = (accId, updates) => {
    setFormData((prev) => ({
      ...prev,
      accommodations: (prev.accommodations || []).map((a) =>
        a.id === accId ? { ...a, ...updates } : a,
      ),
    }))
  }

  const addAccommodation = (destinationId) => {
    const dest = formData.destinations.find((d) => d.id === destinationId)
    const window = dest
      ? suggestStayWindowAllowingOverlap(dest, formData.accommodations || [])
      : null
    if (!window) {
      showStepErrors([{
        code: 'stay_window',
        message: `Não foi possível sugerir datas em ${dest?.city || 'este destino'}.`,
        field: 'accommodation',
      }])
      return
    }
    clearFormErrors()
    setFormData((prev) => ({
      ...prev,
      accommodations: [
        ...(prev.accommodations || []),
        createEmptyAccommodation(dest, window, prev.accommodations),
      ],
    }))
  }

  const removeAccommodation = (accId) => {
    setFormData((prev) => ({
      ...prev,
      accommodations: (prev.accommodations || []).filter((a) => a.id !== accId),
    }))
  }

  const toggleMulti = (field, value) => {
    setFormData((prev) => {
      const arr = prev[field] || []
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value],
      }
    })
  }

  return {
    formData,
    formDataRef,
    setFormData,
    updateField,
    updateDestination,
    addDestination,
    removeDestination,
    updateAccommodation,
    addAccommodation,
    removeAccommodation,
    toggleMulti,
  }
}
