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

test('TinderView: sem badge de dia nem botão próximo dia', () => {
  assert.doesNotMatch(tinderViewSource, /day_label/)
  assert.doesNotMatch(tinderViewSource, /handleNextDay/)
  assert.doesNotMatch(tinderViewSource, /Próximo dia/)
  assert.match(tinderViewSource, /deckUnavailable/)
  assert.match(tinderViewSource, /EMPTY_DECK_PREFETCH_MAX_ATTEMPTS = 3/)
  assert.match(tinderViewSource, /PREFETCH_WHEN_REMAINING_AT_MOST = 5/)
  assert.match(tinderViewSource, /DECK_MAX_PLACES = 15/)
})

test('TinderView: prefetch libera inFlight ao cancelar (evita spinner preso)', () => {
  assert.match(tinderViewSource, /prefetchInFlightRef\.current = false/)
  assert.match(tinderViewSource, /if \(cancelled \|\| ac\.signal\.aborted\) return/)
})
