import { readLatLng } from './coordinates.js'
import { toIsoCalendarPrefix } from './accommodationDayResolver.js'
import { suggestFreeStayWindow, resolveAccommodationDayOverlaps, validateOneAccommodationPerDay } from './accommodationStayContract.js'

export const ACCOMMODATION_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'apartment', label: 'Residência' },
  { value: 'other', label: 'Outro' },
]

export function accommodationTypeLabel(type) {
  return ACCOMMODATION_TYPES.find((t) => t.value === type)?.label || 'Hospedagem'
}

export function generateAccommodationId() {
  return 'acc-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

export function accommodationHasContent(acc) {
  return Boolean(String(acc?.name || acc?.address || '').trim())
}

export function createEmptyAccommodation(dest, dateHints = {}, existingAccommodations = []) {
  const suggested =
    dateHints.checkIn || dateHints.checkOut
      ? dateHints
      : suggestFreeStayWindow(dest, existingAccommodations, dateHints.preferredIso) || {}
  return {
    id: generateAccommodationId(),
    destinationId: dest?.id,
    type: 'hotel',
    name: '',
    address: '',
    checkIn: suggested.checkIn || dest?.arrivalDate || '',
    checkOut: suggested.checkOut || dest?.departureDate || '',
    nights: 0,
  }
}

export function getAccommodationsForDestination(accommodations, destinationId) {
  return (accommodations || []).filter(
    (a) => (a.destinationId || a.destination_id) === destinationId,
  )
}

export function nightsBetween(checkIn, checkOut) {
  const a = toIsoCalendarPrefix(checkIn)
  const b = toIsoCalendarPrefix(checkOut)
  if (!a || !b) return 0
  const ms = new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)
  return Math.max(0, Math.round(ms / 86400000))
}

export function serializeAccommodation(a) {
  return {
    id: a.id || generateAccommodationId(),
    destinationId: a.destinationId || a.destination_id,
    type: a.type || 'hotel',
    name: a.name?.trim() || a.address?.trim() || '',
    address: a.address?.trim() || a.name?.trim() || '',
    ...(a.coordinates ? { coordinates: a.coordinates } : {}),
    checkIn: a.checkIn,
    checkOut: a.checkOut,
    nights: a.nights || nightsBetween(a.checkIn, a.checkOut),
  }
}

export function validateAccommodationOverlaps(_destinations, accommodations) {
  return validateOneAccommodationPerDay(accommodations)
}

export function accommodationDestinationId(acc) {
  return acc?.destinationId || acc?.destination_id || null
}

/**
 * @param {Record<string, unknown>[]} destinations
 * @param {Record<string, unknown>[]} accommodations
 * @param {{ requireCoordinates?: boolean, resolveOverlaps?: boolean }} [options]
 */
export function validateAccommodationFields(destinations, accommodations, options = {}) {
  const resolveOverlaps = options.resolveOverlaps !== false
  const accs = resolveOverlaps
    ? resolveAccommodationDayOverlaps(accommodations || []).accommodations
    : accommodations || []
  for (const a of accs) {
    if (!accommodationHasContent(a)) continue
    const destId = a.destinationId || a.destination_id
    const dest = destinations.find((d) => d.id === destId)
    if (!dest) return 'Hospedagem sem destino associado'
    if (!a.type || !a.checkIn || !a.checkOut) {
      return `Preencha check-in e check-out da hospedagem em ${dest.city || 'um destino'}`
    }
    const checkInIso = toIsoCalendarPrefix(a.checkIn)
    const checkOutIso = toIsoCalendarPrefix(a.checkOut)
    const arrIso = toIsoCalendarPrefix(dest.arrivalDate)
    const depIso = toIsoCalendarPrefix(dest.departureDate)
    if (checkInIso && checkOutIso && checkInIso > checkOutIso) {
      return `Check-out deve ser no mesmo dia ou depois do check-in em ${dest.city}`
    }
    if (checkInIso && arrIso && checkInIso < arrIso) {
      return `Check-in deve ser a partir da chegada em ${dest.city}`
    }
    if (checkOutIso && depIso && checkOutIso > depIso) {
      return `Check-out deve ser até a saída de ${dest.city}`
    }
    if (options.requireCoordinates && !readLatLng(a)) {
      return 'Escolha o endereço nas sugestões do Google para fixar a hospedagem no mapa'
    }
  }
  return validateAccommodationOverlaps(destinations, accs)
}
