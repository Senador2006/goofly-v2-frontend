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
  assert.match(tinderViewSource, /min\(calc\(100dvh-15rem\),380px\)/)
  assert.match(tinderViewSource, /finalizePanel/)
  const belowFoldBlock = tinderViewSource.slice(
    tinderViewSource.indexOf('const belowFoldContent'),
    tinderViewSource.indexOf('if (loading)')
  )
  assert.match(belowFoldBlock, /\{finalizePanel\}[\s\S]*\{choicesPanel\}/)
})

test('TinderView: separação entre bloco do card e finalizar/histórico', () => {
  assert.match(tinderViewSource, /gap-10/)
  assert.match(tinderViewSource, /border-t border-border-light/)
  assert.doesNotMatch(tinderViewSource, /-mt-2/)
})
