import test from 'node:test'
import assert from 'node:assert/strict'
import { getRequestErrorMessage } from '../src/utils/errors.js'

test('getRequestErrorMessage prioriza error.message da API', () => {
  const err = { response: { data: { error: { message: 'Limite atingido' } } } }
  assert.equal(getRequestErrorMessage(err), 'Limite atingido')
})

test('getRequestErrorMessage usa err.message quando API não tem corpo', () => {
  assert.equal(getRequestErrorMessage({ message: 'Network Error' }), 'Network Error')
})

test('getRequestErrorMessage usa fallback customizado', () => {
  assert.equal(getRequestErrorMessage({}, 'Erro ao curtir'), 'Erro ao curtir')
})

test('getRequestErrorMessage ignora strings vazias', () => {
  assert.equal(
    getRequestErrorMessage({ response: { data: { error: { message: '   ' } } } }, 'Fallback'),
    'Fallback'
  )
})
