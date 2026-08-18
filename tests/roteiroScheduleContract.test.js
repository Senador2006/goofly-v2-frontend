import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyRoteiroScheduleEdit,
  applyRoteiroScheduleReorder,
  isScheduleTimePatch,
  minutesToTime,
  parseTimeToMinutes,
  resolveActivityDurationMinutes,
} from '../src/utils/roteiroScheduleContract.js'
import {
  getActivityDayNumber,
  moveActivityToIndexInSameDay,
  reorderActivityInSameDay,
  sortDayActivities,
} from '../src/utils/itineraryDayHelpers.js'

const emptyDayMap = new Map()

function act(partial) {
  return {
    day: 1,
    order: 0,
    ...partial,
  }
}

function durationOf(a) {
  return resolveActivityDurationMinutes(a)
}

function gapBetween(a, b) {
  const endA =
    parseTimeToMinutes(a.endTime || a.end_time) ??
    parseTimeToMinutes(a.startTime) + durationOf(a)
  const startB = parseTimeToMinutes(b.startTime || b.start_time || b.time)
  return startB - endA
}

describe('isScheduleTimePatch', () => {
  it('detecta campos de horário', () => {
    assert.equal(isScheduleTimePatch({ title: 'x' }), false)
    assert.equal(isScheduleTimePatch({ startTime: '10:00' }), true)
    assert.equal(isScheduleTimePatch({ end_time: '11:00' }), true)
  })
})

describe('applyRoteiroScheduleEdit', () => {
  const base = [
    act({
      id: 'a',
      order: 0,
      startTime: '09:00',
      endTime: '10:00',
      duration_minutes: 60,
    }),
    act({
      id: 'b',
      order: 1,
      startTime: '10:30',
      endTime: '12:00',
      duration_minutes: 90,
    }),
    act({
      id: 'c',
      order: 2,
      startTime: '12:15',
      endTime: '13:00',
      duration_minutes: 45,
    }),
  ]

  it('estende fim de K → posteriores andam; gaps e durações deles iguais', () => {
    const gapBC = 15
    const durC = 45
    const next = applyRoteiroScheduleEdit(base, emptyDayMap, 1, 'b', {
      endTime: '12:30',
      end_time: '12:30',
    })
    const b = next.find((x) => x.id === 'b')
    const c = next.find((x) => x.id === 'c')
    const a = next.find((x) => x.id === 'a')

    assert.equal(b.startTime, '10:30')
    assert.equal(b.endTime, '12:30')
    assert.equal(durationOf(b), 120)
    assert.equal(a.startTime, '09:00')
    assert.equal(a.endTime, '10:00')
    assert.equal(durationOf(c), durC)
    assert.equal(gapBetween(b, c), gapBC)
    assert.equal(c.startTime, '12:45')
    assert.equal(c.endTime, '13:30')
  })

  it('antecipa início de K → anteriores andam; gaps e durações deles iguais', () => {
    const gapAB = 30
    const durA = 60
    const next = applyRoteiroScheduleEdit(base, emptyDayMap, 1, 'b', {
      startTime: '10:00',
      start_time: '10:00',
      time: '10:00',
    })
    const a = next.find((x) => x.id === 'a')
    const b = next.find((x) => x.id === 'b')
    const c = next.find((x) => x.id === 'c')

    assert.equal(b.startTime, '10:00')
    assert.equal(b.endTime, '12:00')
    assert.equal(durationOf(b), 120)
    assert.equal(durationOf(a), durA)
    assert.equal(gapBetween(a, b), gapAB)
    assert.equal(a.endTime, '09:30')
    assert.equal(a.startTime, '08:30')
    assert.equal(c.startTime, '12:15')
    assert.equal(c.endTime, '13:00')
  })

  it('encolhe fim de K → posteriores puxam mantendo o mesmo gap', () => {
    const gapBC = 15
    const durC = 45
    const next = applyRoteiroScheduleEdit(base, emptyDayMap, 1, 'b', {
      endTime: '11:30',
      end_time: '11:30',
    })
    const b = next.find((x) => x.id === 'b')
    const c = next.find((x) => x.id === 'c')

    assert.equal(b.endTime, '11:30')
    assert.equal(durationOf(b), 60)
    assert.equal(durationOf(c), durC)
    assert.equal(gapBetween(b, c), gapBC)
    assert.equal(c.startTime, '11:45')
    assert.equal(c.endTime, '12:30')
  })

  it('duração de K muda; durações ≠ K estáticas', () => {
    const next = applyRoteiroScheduleEdit(base, emptyDayMap, 1, 'b', {
      endTime: '13:00',
      end_time: '13:00',
    })
    assert.equal(durationOf(next.find((x) => x.id === 'a')), 60)
    assert.equal(durationOf(next.find((x) => x.id === 'b')), 150)
    assert.equal(durationOf(next.find((x) => x.id === 'c')), 45)
  })

  it('dia com 1 atividade: só aplica patch', () => {
    const single = [
      act({
        id: 'only',
        order: 0,
        startTime: '09:00',
        endTime: '11:00',
        duration_minutes: 120,
      }),
    ]
    const next = applyRoteiroScheduleEdit(single, emptyDayMap, 1, 'only', {
      startTime: '10:00',
      start_time: '10:00',
      time: '10:00',
    })
    assert.equal(next.length, 1)
    assert.equal(next[0].startTime, '10:00')
    assert.equal(next[0].endTime, '11:00')
    assert.equal(durationOf(next[0]), 60)
  })

  it('patch sem campos de horário: no-op', () => {
    const next = applyRoteiroScheduleEdit(base, emptyDayMap, 1, 'b', {
      title: 'Novo',
    })
    assert.equal(next, base)
  })

  it('janela inválida (fim ≤ início): não aplica', () => {
    const next = applyRoteiroScheduleEdit(base, emptyDayMap, 1, 'b', {
      startTime: '13:00',
      start_time: '13:00',
      time: '13:00',
    })
    assert.equal(next, base)
  })

  it('outros dias permanecem intactos', () => {
    const mixed = [
      ...base,
      act({
        id: 'd2',
        day: 2,
        order: 0,
        startTime: '09:00',
        endTime: '10:00',
        duration_minutes: 60,
      }),
    ]
    const next = applyRoteiroScheduleEdit(mixed, emptyDayMap, 1, 'b', {
      endTime: '12:30',
      end_time: '12:30',
    })
    const d2 = next.find((x) => x.id === 'd2')
    assert.equal(d2.startTime, '09:00')
    assert.equal(d2.endTime, '10:00')
  })

  it('normaliza minutos com modulo 24h', () => {
    assert.equal(minutesToTime(-30), '23:30')
    assert.equal(minutesToTime(24 * 60 + 15), '00:15')
  })
})

describe('applyRoteiroScheduleReorder', () => {
  const base = [
    act({
      id: 'a',
      order: 0,
      startTime: '09:00',
      endTime: '10:00',
      duration_minutes: 60,
    }),
    act({
      id: 'b',
      order: 1,
      startTime: '10:30',
      endTime: '12:00',
      duration_minutes: 90,
    }),
    act({
      id: 'c',
      order: 2,
      startTime: '12:15',
      endTime: '13:00',
      duration_minutes: 45,
    }),
  ]

  it('swap adjacente A↔B: âncora, gaps e durações preservados', () => {
    const next = applyRoteiroScheduleReorder(base, emptyDayMap, 1, (list) =>
      reorderActivityInSameDay(list, emptyDayMap, 1, 'a', 1),
    )
    const ordered = sortDayActivities(
      next.filter((x) => getActivityDayNumber(x, emptyDayMap) === 1),
    )
    assert.deepEqual(
      ordered.map((x) => x.id),
      ['b', 'a', 'c'],
    )

    const b = ordered[0]
    const a = ordered[1]
    const c = ordered[2]

    assert.equal(b.startTime, '09:00')
    assert.equal(b.endTime, '10:30')
    assert.equal(durationOf(b), 90)
    assert.equal(durationOf(a), 60)
    assert.equal(durationOf(c), 45)
    assert.equal(gapBetween(b, a), 30)
    assert.equal(gapBetween(a, c), 15)
    assert.equal(a.startTime, '11:00')
    assert.equal(a.endTime, '12:00')
    assert.equal(c.startTime, '12:15')
    assert.equal(c.endTime, '13:00')
  })

  it('move índice 0 → último: invariantes mantidos', () => {
    const next = applyRoteiroScheduleReorder(base, emptyDayMap, 1, (list) =>
      moveActivityToIndexInSameDay(list, emptyDayMap, 1, 'a', 2),
    )
    const ordered = sortDayActivities(
      next.filter((x) => getActivityDayNumber(x, emptyDayMap) === 1),
    )
    assert.deepEqual(
      ordered.map((x) => x.id),
      ['b', 'c', 'a'],
    )

    assert.equal(ordered[0].startTime, '09:00')
    assert.equal(durationOf(ordered[0]), 90)
    assert.equal(durationOf(ordered[1]), 45)
    assert.equal(durationOf(ordered[2]), 60)
    assert.equal(gapBetween(ordered[0], ordered[1]), 30)
    assert.equal(gapBetween(ordered[1], ordered[2]), 15)
    assert.equal(ordered[1].startTime, '11:00')
    assert.equal(ordered[1].endTime, '11:45')
    assert.equal(ordered[2].startTime, '12:00')
    assert.equal(ordered[2].endTime, '13:00')
  })

  it('reorder no-op: lista inalterada (mesma referência)', () => {
    const next = applyRoteiroScheduleReorder(base, emptyDayMap, 1, (list) =>
      moveActivityToIndexInSameDay(list, emptyDayMap, 1, 'b', 1),
    )
    assert.equal(next, base)
  })

  it('dia com 2 atividades: troca simples', () => {
    const pair = [
      act({
        id: 'x',
        order: 0,
        startTime: '08:00',
        endTime: '09:00',
        duration_minutes: 60,
      }),
      act({
        id: 'y',
        order: 1,
        startTime: '09:30',
        endTime: '10:30',
        duration_minutes: 60,
      }),
    ]
    const next = applyRoteiroScheduleReorder(pair, emptyDayMap, 1, (list) =>
      reorderActivityInSameDay(list, emptyDayMap, 1, 'y', -1),
    )
    const ordered = sortDayActivities(next)
    assert.deepEqual(
      ordered.map((x) => x.id),
      ['y', 'x'],
    )
    assert.equal(ordered[0].startTime, '08:00')
    assert.equal(ordered[0].endTime, '09:00')
    assert.equal(gapBetween(ordered[0], ordered[1]), 30)
    assert.equal(ordered[1].startTime, '09:30')
    assert.equal(ordered[1].endTime, '10:30')
  })
})
