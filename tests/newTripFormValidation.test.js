import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  collectStep1Errors,
  collectStep3Errors,
  firstStep1Error,
} from '../src/utils/newTripStep1Validation.js'
import {
  collectStepErrors,
  furthestUnlockedStep,
} from '../src/utils/newTripFormValidation.js'
import { todayIsoCalendarDate, addCalendarDaysIso } from '../src/utils/dateInput.js'

function dest(partial = {}) {
  return {
    id: 'd1',
    city: 'Paris',
    country: 'França',
    arrivalDate: '',
    departureDate: '',
    ...partial,
  }
}

describe('newTripStep1Validation', () => {
  it('exige cidade, país e datas', () => {
    const errors = collectStep1Errors([dest({ city: '', country: '' })])
    assert.ok(errors.some((e) => e.code === 'city_required'))
    assert.equal(firstStep1Error([dest({ city: 'Paris', country: '' })]), 'Preencha o país')
  })

  it('rejeita datas anteriores a hoje', () => {
    const today = todayIsoCalendarDate()
    const yesterday = addCalendarDaysIso(today, -1)
    const errors = collectStep1Errors([
      dest({ arrivalDate: yesterday, departureDate: today }),
    ])
    assert.ok(errors.some((e) => e.code === 'dates_before_today'))
  })

  it('exige saída pelo menos 1 dia após a chegada', () => {
    const today = todayIsoCalendarDate()
    const errors = collectStep1Errors([
      dest({ arrivalDate: today, departureDate: today }),
    ])
    assert.ok(errors.some((e) => e.code === 'departure_after_arrival'))
  })

  it('exige sequência entre destinos', () => {
    const today = todayIsoCalendarDate()
    const day2 = addCalendarDaysIso(today, 2)
    const day5 = addCalendarDaysIso(today, 5)
    const errors = collectStep1Errors([
      dest({ id: 'a', arrivalDate: today, departureDate: day5 }),
      dest({
        id: 'b',
        city: 'Lyon',
        country: 'França',
        arrivalDate: day2,
        departureDate: day5,
      }),
    ])
    assert.ok(errors.some((e) => e.code === 'dest_sequence'))
  })

  it('rejeita span acima 15 dias', () => {
    const start = '2030-01-01'
    const end = '2030-02-20' // 51 dias
    const errors = collectStep1Errors([
      dest({ arrivalDate: start, departureDate: end }),
    ])
    assert.ok(errors.some((e) => e.code === 'trip_span_exceeded'))
  })

  it('aceita destino válido futuro', () => {
    const today = todayIsoCalendarDate()
    const dep = addCalendarDaysIso(today, 5)
    assert.deepEqual(
      collectStep1Errors([dest({ arrivalDate: today, departureDate: dep })]),
      [],
    )
  })
})

describe('collectStep3Errors', () => {
  it('exige interesses e adultos', () => {
    assert.ok(collectStep3Errors({ interests: [], travelers: { adults: 1 } }).length === 1)
    assert.ok(
      collectStep3Errors({ interests: ['historia'], travelers: { adults: 0 } }).some(
        (e) => e.code === 'adults_required',
      ),
    )
    assert.deepEqual(
      collectStep3Errors({ interests: ['historia'], travelers: { adults: 2 } }),
      [],
    )
  })
})

describe('furthestUnlockedStep', () => {
  it('rebloqueia quando o passo 1 fica inválido', () => {
    const today = todayIsoCalendarDate()
    const dep = addCalendarDaysIso(today, 3)
    const valid = {
      destinations: [dest({ arrivalDate: today, departureDate: dep })],
      accommodations: [],
      interests: ['historia'],
      travelers: { adults: 1 },
    }
    assert.equal(furthestUnlockedStep(4, valid), 4)

    const broken = {
      ...valid,
      destinations: [dest({ city: '', arrivalDate: today, departureDate: dep })],
    }
    assert.equal(furthestUnlockedStep(4, broken), 1)
    assert.ok(collectStepErrors(1, broken).length > 0)
  })

  it('libera o próximo passo quando o atual fica válido, sem exigir visita prévia', () => {
    const today = todayIsoCalendarDate()
    const dep = addCalendarDaysIso(today, 3)
    const incomplete = {
      destinations: [dest({ city: '', arrivalDate: '', departureDate: '' })],
      accommodations: [],
      interests: [],
      travelers: { adults: 1 },
    }
    assert.equal(furthestUnlockedStep(1, incomplete), 1)

    const step1Ok = {
      ...incomplete,
      destinations: [dest({ arrivalDate: today, departureDate: dep })],
    }
    // Passo 1 válido com visited=1 → libera só o próximo (2)
    assert.equal(furthestUnlockedStep(1, step1Ok), 2)

    // Já visitou até 2 e passo 1+2 ok → libera 3
    assert.equal(furthestUnlockedStep(2, step1Ok), 3)

    const allOk = {
      ...step1Ok,
      interests: ['historia'],
    }
    assert.equal(furthestUnlockedStep(3, allOk), 4)
  })
})
