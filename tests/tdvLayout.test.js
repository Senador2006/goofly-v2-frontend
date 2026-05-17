import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const tinderViewSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/TinderView.jsx'),
  'utf8'
)

test('TinderView: scroll na página inteira (não painel interno no histórico)', () => {
  assert.match(tinderViewSource, /overflow-y-auto/)
  assert.match(tinderViewSource, /belowFoldContent/)
  assert.doesNotMatch(tinderViewSource, /historyScrollContent/)
  assert.doesNotMatch(tinderViewSource, /flex-1 min-h-\[3\.75rem\]/)
})

test('TinderView: card maior e finalize antes do histórico', () => {
  assert.match(tinderViewSource, /max-h-\[min\(48dvh,320px\)\]/)
  assert.match(tinderViewSource, /finalizePanel/)
  const belowFoldBlock = tinderViewSource.slice(
    tinderViewSource.indexOf('const belowFoldContent'),
    tinderViewSource.indexOf('if (loading)')
  )
  assert.match(belowFoldBlock, /\{finalizePanel\}[\s\S]*\{choicesPanel\}/)
})

test('TinderView: espaço entre botões e bloco de finalizar', () => {
  assert.match(tinderViewSource, /mt-8 sm:mt-6/)
  assert.doesNotMatch(tinderViewSource, /-mt-2/)
})
