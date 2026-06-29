import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  completeTimeOnBlur,
  isCompleteTimeValue,
  maskTime24Input,
  normalizeTimeValue,
} from '../src/utils/timeInput.js'

describe('maskTime24Input', () => {
  it('aceita apenas dígitos e insere ":" após as horas', () => {
    assert.equal(maskTime24Input('09'), '09:')
    assert.equal(maskTime24Input('0900'), '09:00')
    assert.equal(maskTime24Input('abc12:34xyz'), '12:34')
  })

  it('limita horas a 23 e minutos a 59', () => {
    assert.equal(maskTime24Input('2599'), '23:59')
    assert.equal(maskTime24Input('2460'), '23:59')
    assert.equal(maskTime24Input('1266'), '12:59')
  })

  it('prefixa hora unitária com zero', () => {
    assert.equal(maskTime24Input('9'), '09:')
  })
})

describe('normalizeTimeValue', () => {
  it('normaliza valores legados', () => {
    assert.equal(normalizeTimeValue('9:5'), '09:05')
    assert.equal(normalizeTimeValue('23:59'), '23:59')
    assert.equal(normalizeTimeValue(''), '')
  })
})

describe('completeTimeOnBlur', () => {
  it('completa parcial com zeros à direita', () => {
    assert.equal(completeTimeOnBlur('09:'), '09:00')
    assert.equal(completeTimeOnBlur('9'), '09:00')
  })

  it('permite vazio quando opcional', () => {
    assert.equal(completeTimeOnBlur('', { allowEmpty: true }), '')
    assert.equal(completeTimeOnBlur('09:', { allowEmpty: true }), '09:00')
  })
})

describe('isCompleteTimeValue', () => {
  it('detecta HH:MM completo', () => {
    assert.equal(isCompleteTimeValue('09:00'), true)
    assert.equal(isCompleteTimeValue('9:00'), false)
    assert.equal(isCompleteTimeValue('09:'), false)
  })
})
