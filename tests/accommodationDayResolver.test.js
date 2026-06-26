import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAccommodationsForDay,
  resolveAccommodationForDay,
  isAccommodationPlottable,
  accommodationDisplayLabel,
  pickPrimaryAccommodationForLegs,
  accommodationDateRangesOverlap,
} from '../src/utils/accommodationDayResolver.js'
import { buildDateToDayMap } from '../src/utils/itineraryDayHelpers.js'

const TRIP = {
  destinations: [
    {
      id: 'paris',
      city: 'Paris',
      arrivalDate: '2026-06-01',
      departureDate: '2026-06-06',
    },
    {
      id: 'lyon',
      city: 'Lyon',
      arrivalDate: '2026-06-07',
      departureDate: '2026-06-08',
    },
  ],
  accommodations: [
    {
      id: 'acc-paris-1',
      destinationId: 'paris',
      name: 'Hotel Paris A',
      coordinates: { latitude: 48.86, longitude: 2.34 },
      checkIn: '2026-06-01',
      checkOut: '2026-06-03',
    },
    {
      id: 'acc-paris-2',
      destinationId: 'paris',
      name: 'Hotel Paris B',
      coordinates: { latitude: 48.87, longitude: 2.35 },
      checkIn: '2026-06-04',
      checkOut: '2026-06-06',
    },
    {
      id: 'acc-lyon',
      destinationId: 'lyon',
      name: 'Hotel Lyon',
      coordinates: { latitude: 45.76, longitude: 4.84 },
      checkIn: '2026-06-07',
      checkOut: '2026-06-08',
    },
  ],
}

describe('accommodationDayResolver', () => {
  const dateMap = buildDateToDayMap(TRIP)

  it('resolveAccommodationsForDay retorna hotel correto por período', () => {
    const day2 = resolveAccommodationsForDay(TRIP, 2, dateMap)
    assert.equal(day2.length, 1)
    assert.equal(day2[0].id, 'acc-paris-1')

    const day5 = resolveAccommodationsForDay(TRIP, 5, dateMap)
    assert.equal(day5.length, 1)
    assert.equal(day5[0].id, 'acc-paris-2')

    const day7 = resolveAccommodationsForDay(TRIP, 7, dateMap)
    assert.equal(day7.length, 1)
    assert.equal(day7[0].id, 'acc-lyon')
  })

  it('resolveAccommodationForDay retorna primeira do array', () => {
    const single = resolveAccommodationForDay(TRIP, 2, dateMap)
    assert.equal(single?.id, 'acc-paris-1')
  })

  it('não plota dia fora do check-in/check-out', () => {
    assert.deepEqual(resolveAccommodationsForDay(TRIP, 10, dateMap), [])
  })

  it('pickPrimaryAccommodationForLegs escolhe a mais próxima da 1ª parada', () => {
    const accs = resolveAccommodationsForDay(TRIP, 2, dateMap)
    const primary = pickPrimaryAccommodationForLegs(accs, [{ coords: [48.865, 2.345] }])
    assert.ok(primary)
    assert.equal(primary.id, 'acc-paris-1')
  })

  it('accommodationDateRangesOverlap detecta sobreposição', () => {
    assert.equal(accommodationDateRangesOverlap('2026-06-01', '2026-06-04', '2026-06-03', '2026-06-06'), true)
    assert.equal(accommodationDateRangesOverlap('2026-06-01', '2026-06-02', '2026-06-04', '2026-06-06'), false)
  })

  it('isAccommodationPlottable exige texto e coordenadas', () => {
    assert.equal(isAccommodationPlottable({ name: 'X', coordinates: { latitude: 1, longitude: 2 } }), true)
    assert.equal(isAccommodationPlottable({ name: 'X' }), false)
    assert.equal(isAccommodationPlottable({ coordinates: { latitude: 1, longitude: 2 } }), false)
    assert.equal(accommodationDisplayLabel({ name: 'Hotel' }), 'Hotel')
  })
})
