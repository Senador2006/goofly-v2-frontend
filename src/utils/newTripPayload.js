import { CUSTOM_PREF_MAX } from '../constants/newTripFormOptions.js'
import {
  accommodationHasContent,
  generateAccommodationId,
  serializeAccommodation,
} from './accommodationForm.js'
import { resolveAccommodationDayOverlaps } from './accommodationStayContract.js'
import { normalizeTripCurrency } from './tripCurrency.js'

export function buildNewTripPayload(formData) {
  const destinations = formData.destinations.map((d, i) => ({
    id: d.id,
    city: d.city.trim(),
    country: d.country.trim(),
    ...(d.coordinates ? { coordinates: d.coordinates } : {}),
    arrivalDate: d.arrivalDate,
    departureDate: d.departureDate,
    order: i + 1,
  }))
  const rawAccommodations = (formData.accommodations || [])
    .filter(accommodationHasContent)
    .map((a) => serializeAccommodation({ ...a, id: a.id || generateAccommodationId() }))
  const { accommodations } = resolveAccommodationDayOverlaps(rawAccommodations)
  const avoidPreferences = [...(formData.avoidPreferences || [])]
  const avoidCustom = formData.avoidCustom?.trim().slice(0, CUSTOM_PREF_MAX)
  if (avoidCustom) avoidPreferences.push('custom: ' + avoidCustom)
  const prioritizePreferences = [...(formData.prioritizePreferences || [])]
  const prioritizeCustom = formData.prioritizeCustom?.trim().slice(0, CUSTOM_PREF_MAX)
  if (prioritizeCustom) prioritizePreferences.push('custom: ' + prioritizeCustom)

  return {
    destinations,
    accommodations,
    interests: formData.interests,
    tripDescription: formData.tripDescription?.trim() || undefined,
    itineraryStyle: formData.itineraryStyle || 'equilibrado',
    avoidPreferences,
    prioritizePreferences,
    budget: formData.budget ? Number(formData.budget) : undefined,
    currency: normalizeTripCurrency(formData.currency),
    travelers: {
      adults: Math.max(1, Number(formData.travelers.adults) || 1),
      children: Math.max(0, Number(formData.travelers.children) || 0),
    },
  }
}
