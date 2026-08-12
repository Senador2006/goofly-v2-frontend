import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatActivityDuration,
  formatActivityDurationMinutes,
  minutesBetweenStarts,
} from '../src/utils/formatActivityDuration.js'

describe('formatActivityDurationMinutes', () => {
  it('formata minutos abaixo de 1h', () => {
    assert.equal(formatActivityDurationMinutes(45), '45min')
    assert.equal(formatActivityDurationMinutes(1), '1min')
  })

  it('formata horas cheias', () => {
    assert.equal(formatActivityDurationMinutes(120), '2h')
    assert.equal(formatActivityDurationMinutes(60), '1h')
  })

  it('formata horas + minutos sem decimal', () => {
    assert.equal(formatActivityDurationMinutes(90), '1h30')
    assert.equal(formatActivityDurationMinutes(220), '3h40')
    assert.equal(formatActivityDurationMinutes(205), '3h25')
  })

  it('usa fallback para inválido ou zero', () => {
    assert.equal(formatActivityDurationMinutes(0), '2h')
    assert.equal(formatActivityDurationMinutes(-10), '2h')
    assert.equal(formatActivityDurationMinutes(null), '2h')
    assert.equal(formatActivityDurationMinutes(undefined), '2h')
    assert.equal(formatActivityDurationMinutes('abc'), '2h')
    assert.equal(formatActivityDurationMinutes(0, '1h'), '1h')
  })
})

describe('minutesBetweenStarts', () => {
  it('calcula minutos da janela', () => {
    assert.equal(minutesBetweenStarts('09:00', '12:40'), 220)
    assert.equal(minutesBetweenStarts('10:00', '11:30'), 90)
  })

  it('retorna null quando inválido ou não positivo', () => {
    assert.equal(minutesBetweenStarts('12:00', '09:00'), null)
    assert.equal(minutesBetweenStarts(null, '12:00'), null)
    assert.equal(minutesBetweenStarts('09:00', ''), null)
  })
})

describe('formatActivityDuration', () => {
  it('prioriza janela Início–Fim', () => {
    assert.equal(
      formatActivityDuration(
        { duration_minutes: 120, duration: '2h' },
        '09:00',
        '12:40',
      ),
      '3h40',
    )
  })

  it('usa duration_minutes quando não há fim', () => {
    assert.equal(
      formatActivityDuration({ duration_minutes: 90 }, '09:00', null),
      '1h30',
    )
    assert.equal(
      formatActivityDuration({ durationMinutes: 45 }, '09:00', null),
      '45min',
    )
  })

  it('reusa duration string válida', () => {
    assert.equal(formatActivityDuration({ duration: '1h30' }, null, null), '1h30')
    assert.equal(formatActivityDuration({ duration: '45min' }, null, null), '45min')
  })

  it('ignora duration decimal legada e cai no fallback', () => {
    assert.equal(formatActivityDuration({ duration: '3.7h' }, null, null), '2h')
  })
})
