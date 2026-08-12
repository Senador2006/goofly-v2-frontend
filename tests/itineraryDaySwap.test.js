import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getActivityDayNumber,
  sortDayActivities,
  swapActivitiesBetweenDays,
  getIsoDateForDay,
} from '../src/utils/itineraryDayHelpers.js'
import { resolveDaySwapTarget } from '../src/utils/roteiroDaySwap.js'

const emptyMap = new Map()

function dayTitles(activities, dayNum, dateToDayMap = emptyMap) {
  return sortDayActivities(
    activities.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  ).map((a) => a.title)
}

function dayOrders(activities, dayNum, dateToDayMap = emptyMap) {
  return sortDayActivities(
    activities.filter((a) => getActivityDayNumber(a, dateToDayMap) === dayNum),
  ).map((a) => a.order)
}

describe('swapActivitiesBetweenDays', () => {
  const base = [
    { id: 'a1', title: 'D1-A', day: 1, order: 0, startTime: '09:00' },
    { id: 'a2', title: 'D1-B', day: 1, order: 1, startTime: '11:00' },
    { id: 'b1', title: 'D2-A', day: 2, order: 0, startTime: '10:00' },
    { id: 'c1', title: 'D3-A', day: 3, order: 0, startTime: '12:00' },
  ]

  it('troca conteúdos de Dia 1 ↔ Dia 2', () => {
    const next = swapActivitiesBetweenDays(base, emptyMap, 1, 2)
    assert.deepEqual(dayTitles(next, 1), ['D2-A'])
    assert.deepEqual(dayTitles(next, 2), ['D1-A', 'D1-B'])
    assert.deepEqual(dayTitles(next, 3), ['D3-A'])
  })

  it('preserva order relativo dentro de cada dia', () => {
    const next = swapActivitiesBetweenDays(base, emptyMap, 1, 2)
    assert.deepEqual(dayOrders(next, 2), [0, 1])
    assert.deepEqual(
      sortDayActivities(next.filter((a) => getActivityDayNumber(a, emptyMap) === 2)).map((a) => a.id),
      ['a1', 'a2'],
    )
  })

  it('sincroniza day/dayNumber/day_number e datas via dateToDayMap', () => {
    const dateMap = new Map([
      ['2026-06-01', 1],
      ['2026-06-02', 2],
      ['2026-06-03', 3],
    ])
    const withDates = [
      {
        id: 'a1',
        title: 'D1',
        day: 1,
        order: 0,
        dayDate: '2026-06-01',
        canonicalDate: '2026-06-01',
        day_date: '2026-06-01',
      },
      {
        id: 'b1',
        title: 'D2',
        day: 2,
        order: 0,
        dayDate: '2026-06-02',
        canonicalDate: '2026-06-02',
      },
    ]
    const next = swapActivitiesBetweenDays(withDates, dateMap, 1, 2)
    const movedTo2 = next.find((a) => a.id === 'a1')
    const movedTo1 = next.find((a) => a.id === 'b1')
    assert.equal(movedTo2.day, 2)
    assert.equal(movedTo2.dayNumber, 2)
    assert.equal(movedTo2.day_number, 2)
    assert.equal(movedTo2.dayDate, '2026-06-02')
    assert.equal(movedTo2.canonicalDate, '2026-06-02')
    assert.equal(movedTo2.day_date, '2026-06-02')
    assert.equal(movedTo1.day, 1)
    assert.equal(movedTo1.dayDate, '2026-06-01')
    assert.equal(getIsoDateForDay(dateMap, 2), '2026-06-02')
  })

  it('troca com dia vazio', () => {
    const onlyDay1 = [
      { id: 'a1', title: 'Só', day: 1, order: 0 },
      { id: 'c1', title: 'Outro', day: 3, order: 0 },
    ]
    const next = swapActivitiesBetweenDays(onlyDay1, emptyMap, 1, 2)
    assert.deepEqual(dayTitles(next, 1), [])
    assert.deepEqual(dayTitles(next, 2), ['Só'])
    assert.deepEqual(dayTitles(next, 3), ['Outro'])
  })

  it('no-op: mesmo dia retorna a mesma referência', () => {
    assert.equal(swapActivitiesBetweenDays(base, emptyMap, 1, 1), base)
  })

  it('no-op: dias inválidos retornam a mesma referência', () => {
    assert.equal(swapActivitiesBetweenDays(base, emptyMap, 0, 1), base)
    assert.equal(swapActivitiesBetweenDays(base, emptyMap, 1, NaN), base)
    assert.equal(swapActivitiesBetweenDays(base, emptyMap, -1, 2), base)
  })

  it('no-op: nenhum dos dias tem atividades', () => {
    assert.equal(swapActivitiesBetweenDays(base, emptyMap, 8, 9), base)
  })

  it('não altera atividades de um terceiro dia', () => {
    const next = swapActivitiesBetweenDays(base, emptyMap, 1, 2)
    assert.deepEqual(
      next.find((a) => a.id === 'c1'),
      base.find((a) => a.id === 'c1'),
    )
  })
})

describe('resolveDaySwapTarget', () => {
  const chips = [
    { day: 1, left: 0, right: 80, top: 10, bottom: 40 },
    { day: 2, left: 90, right: 170, top: 10, bottom: 40 },
    { day: 3, left: 180, right: 260, top: 10, bottom: 40 },
  ]

  it('retorna o dia sob o pointer', () => {
    assert.equal(resolveDaySwapTarget(120, chips, 1, 20), 2)
  })

  it('retorna null fora da fileira', () => {
    assert.equal(resolveDaySwapTarget(400, chips, 1, 20), null)
  })

  it('retorna null sobre o próprio fromDay (sem highlight)', () => {
    assert.equal(resolveDaySwapTarget(40, chips, 1, 20), null)
  })

  it('retorna null para lista vazia', () => {
    assert.equal(resolveDaySwapTarget(40, [], 1), null)
  })
})
