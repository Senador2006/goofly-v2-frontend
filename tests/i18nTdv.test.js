import test from 'node:test'
import assert from 'node:assert/strict'
import ptBR from '../src/i18n/messages/pt-BR.js'

test('chaves TDV de layout existem em pt-BR', () => {
  assert.equal(ptBR.tdv.history_section, 'Histórico')
  assert.equal(ptBR.tdv.undo_action, 'Desfazer última ação')
  assert.equal(ptBR.tdv.finalize_action, 'Finalizar e gerar roteiro')
  assert.equal(ptBR.tdv.photo_hint, undefined)
  assert.match(ptBR.tdv.empty_title, /Sem mais lugares/)
  assert.match(ptBR.tdv.retry, /Tentar de novo/)
})
