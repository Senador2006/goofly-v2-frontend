import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  occupiedStayDays,
  suggestFreeStayWindow,
  validateOneAccommodationPerDay,
  findAccommodationDayConflict,
  findChangedAccommodation,
  accommodationNeedsReorganize,
  resolveAccommodationDayOverlaps,
  previewAccommodationReplacements,
} from '../src/utils/accommodationStayContract.js'

describe('accommodationStayContract', () => {
  it('occupiedStayDays é inclusivo no check-in e no check-out', () => {
    assert.deepEqual(
      occupiedStayDays({ checkIn: '2026-06-01', checkOut: '2026-06-03' }),
      ['2026-06-01', '2026-06-02', '2026-06-03'],
    )
  })

  it('detecta sobreposição com mensagem de substituição', () => {
    const conflict = findAccommodationDayConflict([
      { id: 'a', name: 'Hotel A', checkIn: '2026-06-01', checkOut: '2026-06-03' },
      { id: 'b', name: 'Hotel B', checkIn: '2026-06-03', checkOut: '2026-06-06' },
    ])
    assert.ok(conflict)
    assert.equal(conflict.iso, '2026-06-03')
    assert.match(conflict.message, /Hotel B substituirá hospedagem Hotel A/)
    assert.match(conflict.message, /03\/06\/2026/)
  })

  it('resolve sobreposição encurtando a hospedagem anterior', () => {
    const { accommodations, warnings } = resolveAccommodationDayOverlaps([
      { id: 'a', name: 'Hotel A', checkIn: '2026-06-01', checkOut: '2026-06-05' },
      { id: 'b', name: 'Hotel B', checkIn: '2026-06-03', checkOut: '2026-06-06' },
    ])
    assert.equal(warnings.length, 1)
    assert.match(
      warnings[0].message,
      /Hospedagem Hotel B substituirá hospedagem Hotel A nos dias 03\/06\/2026 até 05\/06\/2026/,
    )
    const a = accommodations.find((x) => x.id === 'a')
    const b = accommodations.find((x) => x.id === 'b')
    assert.equal(a.checkIn, '2026-06-01')
    assert.equal(a.checkOut, '2026-06-02')
    assert.equal(b.checkIn, '2026-06-03')
    assert.equal(b.checkOut, '2026-06-06')
    assert.equal(validateOneAccommodationPerDay(accommodations), null)
  })

  it('resolve com priorityId faz a hospedagem editada vencer', () => {
    const { accommodations, warnings } = resolveAccommodationDayOverlaps(
      [
        { id: 'a', name: 'Hotel A', checkIn: '2026-06-01', checkOut: '2026-06-06' },
        { id: 'b', name: 'Hotel B', checkIn: '2026-06-04', checkOut: '2026-06-08' },
      ],
      { priorityId: 'a' },
    )
    assert.equal(warnings.length, 1)
    assert.match(warnings[0].message, /Hotel A substituirá hospedagem Hotel B/)
    const a = accommodations.find((x) => x.id === 'a')
    const b = accommodations.find((x) => x.id === 'b')
    assert.equal(a.checkOut, '2026-06-06')
    assert.equal(b.checkIn, '2026-06-07')
  })

  it('remove estadia totalmente coberta', () => {
    const { accommodations, warnings } = resolveAccommodationDayOverlaps([
      { id: 'a', name: 'Hotel A', checkIn: '2026-06-02', checkOut: '2026-06-04' },
      { id: 'b', name: 'Hotel B', checkIn: '2026-06-01', checkOut: '2026-06-06' },
    ])
    assert.ok(warnings.length >= 1)
    assert.equal(accommodations.some((x) => x.id === 'a'), false)
    assert.equal(accommodations.find((x) => x.id === 'b')?.checkIn, '2026-06-01')
  })

  it('previewAccommodationReplacements não muta a lista original', () => {
    const list = [
      { id: 'a', name: 'Hotel A', checkIn: '2026-06-01', checkOut: '2026-06-03' },
      { id: 'b', name: 'Hotel B', checkIn: '2026-06-03', checkOut: '2026-06-06' },
    ]
    const warnings = previewAccommodationReplacements(list)
    assert.equal(warnings.length, 1)
    assert.equal(list[0].checkOut, '2026-06-03')
  })

  it('permite hospedagens em dias consecutivos sem coincidir', () => {
    const msg = validateOneAccommodationPerDay([
      { id: 'a', name: 'A', checkIn: '2026-06-01', checkOut: '2026-06-03' },
      { id: 'b', name: 'B', checkIn: '2026-06-04', checkOut: '2026-06-06' },
    ])
    assert.equal(msg, null)
  })

  it('suggestFreeStayWindow aponta o primeiro intervalo livre', () => {
    const dest = { id: 'paris', arrivalDate: '2026-06-01', departureDate: '2026-06-08' }
    const window = suggestFreeStayWindow(dest, [
      { name: 'A', checkIn: '2026-06-01', checkOut: '2026-06-03' },
    ])
    assert.deepEqual(window, { checkIn: '2026-06-04', checkOut: '2026-06-08' })
  })

  it('suggestFreeStayWindow retorna null se o destino estiver coberto', () => {
    const dest = { id: 'paris', arrivalDate: '2026-06-01', departureDate: '2026-06-03' }
    const window = suggestFreeStayWindow(dest, [
      { name: 'A', checkIn: '2026-06-01', checkOut: '2026-06-03' },
    ])
    assert.equal(window, null)
  })

  it('findChangedAccommodation aponta estadia nova ou editada', () => {
    const previous = [
      { id: 'a', name: 'A', checkIn: '2026-06-01', checkOut: '2026-06-03', destinationId: 'paris' },
      { id: 'b', name: 'B', checkIn: '2026-06-04', checkOut: '2026-06-06', destinationId: 'paris' },
    ]
    const added = findChangedAccommodation(previous, [
      ...previous,
      { id: 'c', name: 'C', checkIn: '2026-06-07', checkOut: '2026-06-08', destinationId: 'lyon' },
    ])
    assert.equal(added?.id, 'c')

    const edited = findChangedAccommodation(previous, [
      previous[0],
      { ...previous[1], checkOut: '2026-06-05' },
    ])
    assert.equal(edited?.id, 'b')
  })

  it('accommodationNeedsReorganize só quando datas ou coords mudam', () => {
    const previous = [
      {
        id: 'a',
        name: 'A',
        checkIn: '2026-06-01',
        checkOut: '2026-06-03',
        coordinates: { latitude: 1, longitude: 2 },
      },
    ]
    assert.equal(
      accommodationNeedsReorganize(previous, { ...previous[0], name: 'A Renomeado' }),
      false,
    )
    assert.equal(
      accommodationNeedsReorganize(previous, { ...previous[0], checkOut: '2026-06-04' }),
      true,
    )
  })
})
