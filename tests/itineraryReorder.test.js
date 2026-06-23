import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getActivityDayNumber,
  reorderActivityInSameDay,
  sortDayActivities,
} from '../src/utils/itineraryDayHelpers.js'

const emptyMap = new Map()

function dayOrderTitles(activities, dayNum) {
  return sortDayActivities(
    activities.filter((a) => getActivityDayNumber(a, emptyMap) === dayNum),
  ).map((a) => a.title)
}

describe('reorderActivityInSameDay', () => {
  const base = [
    { id: 'a', title: 'Primeira', day: 1, order: 0, startTime: '09:00' },
    { id: 'b', title: 'Segunda', day: 1, order: 1, startTime: '11:00' },
    { id: 'c', title: 'Terceira', day: 1, order: 2, startTime: '14:00' },
    { id: 'd', title: 'Outro dia', day: 2, order: 0, startTime: '10:00' },
  ]

  it('move para baixo e atualiza order para refletir na UI', () => {
    const next = reorderActivityInSameDay(base, emptyMap, 1, 'a', 1)
    assert.deepEqual(dayOrderTitles(next, 1), ['Segunda', 'Primeira', 'Terceira'])
    assert.equal(next.find((a) => a.id === 'a')?.order, 1)
    assert.equal(next.find((a) => a.id === 'b')?.order, 0)
  })

  it('move para cima e atualiza order', () => {
    const next = reorderActivityInSameDay(base, emptyMap, 1, 'c', -1)
    assert.deepEqual(dayOrderTitles(next, 1), ['Primeira', 'Terceira', 'Segunda'])
    assert.equal(next.find((a) => a.id === 'b')?.order, 2)
    assert.equal(next.find((a) => a.id === 'c')?.order, 1)
  })

  it('não altera atividades de outros dias', () => {
    const next = reorderActivityInSameDay(base, emptyMap, 1, 'a', 1)
    const other = next.find((a) => a.id === 'd')
    assert.deepEqual(other, base.find((a) => a.id === 'd'))
  })

  it('retorna o array original quando o movimento é inválido', () => {
    assert.equal(reorderActivityInSameDay(base, emptyMap, 1, 'a', -1), base)
    assert.equal(reorderActivityInSameDay(base, emptyMap, 1, 'c', 1), base)
    assert.equal(reorderActivityInSameDay(base, emptyMap, 1, 'missing', 1), base)
  })

  it('reindexa order mesmo quando atividades tinham order igual', () => {
    const tied = [
      { id: 'x', title: 'X', day: 1, order: 0, startTime: '09:00' },
      { id: 'y', title: 'Y', day: 1, order: 0, startTime: '12:00' },
    ]
    const next = reorderActivityInSameDay(tied, emptyMap, 1, 'x', 1)
    assert.deepEqual(dayOrderTitles(next, 1), ['Y', 'X'])
    assert.equal(next.find((a) => a.id === 'x')?.order, 1)
    assert.equal(next.find((a) => a.id === 'y')?.order, 0)
  })
})
