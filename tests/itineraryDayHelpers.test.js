import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildDateToDayMap,
  getActivityDayNumber,
  groupActivitiesByDay,
} from '../src/utils/itineraryDayHelpers.js'
import { getTripDayCount } from '../src/utils/planningAccess.js'

const DATE_ONLY_TRIP = {
  destinations: [
    {
      arrivalDate: '2026-06-01',
      departureDate: '2026-06-03',
    },
  ],
}

describe('buildDateToDayMap — calendário sem TZ local', () => {
  it('itera YYYY-MM-DD inclusivo (date-only)', () => {
    const map = buildDateToDayMap(DATE_ONLY_TRIP)
    assert.equal(map.size, 3)
    assert.equal(map.get('2026-06-01'), 1)
    assert.equal(map.get('2026-06-02'), 2)
    assert.equal(map.get('2026-06-03'), 3)
  })

  it('usa prefixo ISO mesmo com horário UTC', () => {
    const map = buildDateToDayMap({
      destinations: [
        {
          arrivalDate: '2026-06-01T12:00:00.000Z',
          departureDate: '2026-06-03T12:00:00.000Z',
        },
      ],
    })
    assert.equal(map.size, 3)
    assert.equal(map.get('2026-06-01'), 1)
    assert.equal(map.get('2026-06-03'), 3)
  })

  it('getTripDayCount alinha com o mapa', () => {
    assert.equal(getTripDayCount(DATE_ONLY_TRIP), 3)
    assert.equal(getTripDayCount({ destinations: [] }), 1)
  })
})

describe('groupActivitiesByDay', () => {
  it('não empurra atividade sem dia para o dia 1', () => {
    const map = buildDateToDayMap(DATE_ONLY_TRIP)
    const grouped = groupActivitiesByDay(
      [
        { id: 'a', title: 'Sem dia' },
        { id: 'b', title: 'Dia 2', day: 2 },
      ],
      map,
      [1, 2, 3],
    )
    assert.equal(grouped.find((g) => g.day === 1).activities.length, 0)
    assert.equal(grouped.find((g) => g.day === 2).activities.length, 1)
    assert.equal(getActivityDayNumber({ title: 'Sem dia' }, map), null)
  })
})
