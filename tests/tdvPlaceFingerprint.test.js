import test from 'node:test'
import assert from 'node:assert/strict'
import { placeContentKey } from '../src/utils/tdvPlaceFingerprint.js'

test('placeContentKey: mesmo POI com ids distintos gera a mesma chave', () => {
  const a = placeContentKey({ id: '1', name: 'Torre de Belém', city: 'Lisboa', country: 'PT' })
  const b = placeContentKey({ id: '2', name: 'Torre de Belém', city: 'Lisboa', country: 'PT' })
  assert.ok(a)
  assert.equal(a, b)
})

test('placeContentKey: nomes diferentes geram chaves diferentes', () => {
  const a = placeContentKey({ name: 'Castelo', city: 'Lisboa' })
  const b = placeContentKey({ name: 'Miradouro', city: 'Lisboa' })
  assert.notEqual(a, b)
})
