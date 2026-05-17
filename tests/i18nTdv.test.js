import test from 'node:test'
import assert from 'node:assert/strict'
import ptBR from '../src/i18n/messages/pt-BR.js'

test('chaves TDV de layout existem em pt-BR', () => {
  assert.equal(ptBR.tdv.history_section, 'Histórico e finalizar')
  assert.match(ptBR.tdv.photo_hint, /Teclado/)
  assert.match(ptBR.tdv.day_label.replace('{{day}}', '2'), /Dia 2/)
})
