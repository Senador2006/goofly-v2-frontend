import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  isoToBrDisplay,
  maskBrDateInput,
  parseBrDateToIso,
  partsToIso,
  padDateSegment,
  resolveEffectiveDateMin,
  splitIsoToParts,
  todayIsoCalendarDate,
  countInclusiveCalendarDays,
  tripSpanDayCount,
  addCalendarDaysIso,
  tripSpanMaxDepartureIso,
  clampOrClearIso,
  isoInInclusiveRange,
  describeDateRangeViolation,
  daysInMonth,
  sanitizeDateSegment,
  finalizeDateParts,
  MAX_TRIP_DURATION_DAYS,
} from '../src/utils/dateInput.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('dateInput DD/MM/AAAA', () => {
  it('converte ISO para DD/MM/AAAA e partes', () => {
    assert.equal(isoToBrDisplay('2026-08-19'), '19/08/2026')
    assert.equal(isoToBrDisplay(''), '')
    assert.deepEqual(splitIsoToParts('2026-08-19'), {
      day: '19',
      month: '08',
      year: '2026',
    })
    assert.equal(partsToIso({ day: '19', month: '08', year: '2026' }), '2026-08-19')
    assert.equal(partsToIso({ day: '1', month: '08', year: '2026' }), null)
    assert.equal(padDateSegment('5', 2), '05')
  })

  it('rejeita datas de calendário inválidas', () => {
    assert.equal(partsToIso({ day: '31', month: '02', year: '2026' }), null)
    assert.equal(partsToIso({ day: '32', month: '01', year: '2026' }), null)
    assert.equal(partsToIso({ day: '15', month: '13', year: '2026' }), null)
    assert.equal(partsToIso({ day: '29', month: '02', year: '2024' }), '2024-02-29')
    assert.equal(partsToIso({ day: '29', month: '02', year: '2025' }), null)
  })

  it('limita mês ≤ 12 e dia ao máximo do mês', () => {
    assert.equal(daysInMonth(2, 2024), 29)
    assert.equal(daysInMonth(2, 2025), 28)
    assert.equal(daysInMonth(4), 30)
    assert.equal(daysInMonth(1), 31)

    assert.deepEqual(sanitizeDateSegment('month', '13', {}), { value: '12', advance: true })
    assert.deepEqual(sanitizeDateSegment('month', '00', {}), { value: '01', advance: true })
    assert.deepEqual(sanitizeDateSegment('month', '3', {}), { value: '03', advance: true })

    assert.deepEqual(sanitizeDateSegment('day', '32', { month: '01' }), {
      value: '31',
      advance: true,
    })
    assert.deepEqual(sanitizeDateSegment('day', '31', { month: '04' }), {
      value: '30',
      advance: true,
    })
    assert.deepEqual(sanitizeDateSegment('day', '30', { month: '02', year: '2025' }), {
      value: '28',
      advance: true,
    })
    assert.deepEqual(sanitizeDateSegment('day', '5', {}), { value: '05', advance: true })

    assert.deepEqual(finalizeDateParts({ day: '31', month: '02', year: '2025' }), {
      day: '28',
      month: '02',
      year: '2025',
    })
  })

  it('máscara enquanto digita (legado)', () => {
    assert.equal(maskBrDateInput('1'), '1')
    assert.equal(maskBrDateInput('1908'), '19/08')
    assert.equal(maskBrDateInput('19082026'), '19/08/2026')
  })

  it('parseia DD/MM/AAAA para ISO', () => {
    assert.equal(parseBrDateToIso('19/08/2026'), '2026-08-19')
    assert.equal(parseBrDateToIso('19/08/26'), '2026-08-19')
    assert.equal(parseBrDateToIso('2026-08-19'), '2026-08-19')
    assert.equal(parseBrDateToIso('31/02/2026'), null)
  })

  it('bloqueia datas anteriores a hoje no mínimo efetivo', () => {
    const now = new Date(2026, 7, 20) // 20/08/2026 local
    assert.equal(todayIsoCalendarDate(now), '2026-08-20')
    assert.equal(resolveEffectiveDateMin(undefined, { now }), '2026-08-20')
    assert.equal(resolveEffectiveDateMin('2026-08-10', { now }), '2026-08-20')
    assert.equal(resolveEffectiveDateMin('2026-09-01', { now }), '2026-09-01')
    assert.equal(resolveEffectiveDateMin('2026-08-10', { disallowPast: false, now }), '2026-08-10')
  })

  it('soma dias de calendário sem fuso e calcula teto de 45 dias', () => {
    assert.equal(addCalendarDaysIso('2026-08-20', 1), '2026-08-21')
    assert.equal(addCalendarDaysIso('2026-08-31', 1), '2026-09-01')
    assert.equal(addCalendarDaysIso('2026-12-31', 1), '2027-01-01')
    assert.equal(tripSpanMaxDepartureIso('2026-08-01'), '2026-09-14')
    assert.equal(clampOrClearIso('2026-08-10', '2026-08-15', '2026-08-20'), '')
    assert.equal(clampOrClearIso('2026-08-18', '2026-08-15', '2026-08-20'), '2026-08-18')
  })

  it('limita duração da viagem a 45 dias inclusivos', () => {
    assert.equal(countInclusiveCalendarDays('2026-08-01', '2026-08-01'), 1)
    assert.equal(countInclusiveCalendarDays('2026-08-01', '2026-09-14'), 45)
    assert.equal(countInclusiveCalendarDays('2026-08-01', '2026-09-15'), 46)
    assert.equal(
      tripSpanDayCount([
        { arrivalDate: '2026-08-01', departureDate: '2026-08-20' },
        { arrivalDate: '2026-08-20', departureDate: '2026-09-15' },
      ]),
      46,
    )
    assert.ok(MAX_TRIP_DURATION_DAYS === 45)
  })

  it('describeDateRangeViolation explica min/max', () => {
    const now = new Date(2026, 7, 20)
    assert.equal(
      describeDateRangeViolation('2026-08-10', '2026-08-20', undefined, { now }),
      'A data não pode ser anterior a hoje',
    )
    assert.equal(
      describeDateRangeViolation('2026-08-10', '2026-08-15', undefined, {
        now,
        disallowPast: false,
      }),
      'A data deve ser a partir de 15/08/2026',
    )
    assert.equal(
      describeDateRangeViolation('2026-09-20', undefined, '2026-09-14', { now }),
      'A data deve ser até 14/09/2026',
    )
    assert.equal(describeDateRangeViolation('2026-08-21', '2026-08-20', '2026-09-14', { now }), null)
    assert.equal(isoInInclusiveRange('2026-08-19', '2026-08-20', null), false)
  })
})

describe('formulários usam DateInput segmentado', () => {
  it('NewTrip e hospedagem não usam input type=date', () => {
    const newTrip = readFileSync(join(root, 'src/pages/NewTrip.jsx'), 'utf8')
    const stay = readFileSync(join(root, 'src/components/planning/AccommodationStayForm.jsx'), 'utf8')
    const step1 = readFileSync(join(root, 'src/utils/newTripStep1Validation.js'), 'utf8')
    assert.match(newTrip, /<DateInput/)
    assert.match(stay, /<DateInput/)
    assert.doesNotMatch(newTrip, /type="date"/)
    assert.doesNotMatch(stay, /type="date"/)
    assert.match(step1, /não podem ser anteriores a hoje/)
    assert.match(step1, /MAX_TRIP_DURATION_DAYS|1 mês e meio/)
    assert.match(newTrip, /tryGoToStep/)
    assert.match(newTrip, /tripSpanMaxDepartureIso/)
  })

  it('DateInput sanitiza dia/mês e reporta datas fora do intervalo', () => {
    const source = readFileSync(join(root, 'src/components/common/DateInput.jsx'), 'utf8')
    assert.match(source, /placeholder: 'dd'/)
    assert.match(source, /placeholder: 'mm'/)
    assert.match(source, /placeholder: 'aaaa'/)
    assert.match(source, /sanitizeDateSegment/)
    assert.match(source, /finalizeDateParts/)
    assert.match(source, /describeDateRangeViolation/)
    assert.match(source, /commitIso/)
    assert.match(source, /showPicker/)
    assert.match(source, /calendar_today/)
  })
})
