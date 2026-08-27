import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const tinderViewSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/TinderView.jsx'),
  'utf8'
)

test('TinderView: layout fixo sem scroll de página (card + barra de ações)', () => {
  assert.match(tinderViewSource, /tdv-action-bar/)
  assert.match(tinderViewSource, /overflow-hidden/)
  assert.match(tinderViewSource, /belowFoldContent/)
  assert.doesNotMatch(tinderViewSource, /historyScrollContent/)
  assert.doesNotMatch(tinderViewSource, /overscroll-y-contain/)
  // Root do TDV ativo não usa scroll de página
  assert.match(
    tinderViewSource,
    /flex h-full min-h-0 flex-1 flex-col overflow-hidden/
  )
})

test('TinderView: card relativo à área disponível e finalize antes do histórico', () => {
  assert.match(tinderViewSource, /h-full w-full min-h-0 rounded-none lg:rounded-t-3xl/)
  assert.doesNotMatch(tinderViewSource, /aspect-\[3\/4\]/)
  assert.doesNotMatch(tinderViewSource, /min\(calc\(100dvh-12rem\),400px\)/)
  assert.match(tinderViewSource, /finalizePanel/)
  assert.match(tinderViewSource, /tdv-action-bar/)
  // Barra de ações fica na coluna do card (não atravessa a lateral)
  assert.match(
    tinderViewSource,
    /tdv-action-bar[\s\S]*?\{actionButtons\}[\s\S]*?<\/aside>/
  )
  const belowFoldBlock = tinderViewSource.slice(
    tinderViewSource.indexOf('const belowFoldContent'),
    tinderViewSource.indexOf('if (loading)')
  )
  assert.match(belowFoldBlock, /\{finalizePanel\}[\s\S]*\{choicesPanel\}/)
})

test('TinderView: lateral sem scroll de coluna', () => {
  assert.match(tinderViewSource, /aside className="[^"]*overflow-hidden/)
  assert.doesNotMatch(
    tinderViewSource,
    /aside className="[^"]*overflow-y-auto/
  )
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

test('TinderView: prefetch não aborta por swipe (só trip/unmount/finalize)', () => {
  assert.match(tinderViewSource, /prefetchInFlightRef\.current = false/)
  assert.match(tinderViewSource, /stillCurrent/)
  assert.match(
    tinderViewSource,
    /Sem cleanup abort\/cancelled: swipe re-render não descarta discover em voo/
  )
  assert.match(tinderViewSource, /Abort prefetch só ao trocar viagem ou desmontar/)
  assert.doesNotMatch(
    tinderViewSource,
    /if \(cancelled \|\| ac\.signal\.aborted\) return/
  )
  assert.match(tinderViewSource, /placesCount/)
  assert.match(tinderViewSource, /swiped >= FREE_CAP_MAX_PLACES/)
})

test('TinderView: paywall free_cap com Gerar roteiro e Desbloquear', () => {
  assert.match(tinderViewSource, /freeCapReached/)
  assert.match(tinderViewSource, /isHardFreeCap/)
  assert.match(tinderViewSource, /FREE_CAP_SOFT_RETRY_MAX/)
  assert.match(tinderViewSource, /placesSource === 'free_cap'/)
  assert.match(tinderViewSource, /tdv\.free_cap_generate/)
  assert.match(tinderViewSource, /tdv\.free_cap_unlock/)
  assert.match(tinderViewSource, /from=tdv/)
  assert.match(tinderViewSource, /deckUnavailable \|\| freeCapReached \|\| finalizingTdv/)
  // Reativa aba com baralho local sem novo discover; prefetch free_cap não latcheia com deck
  assert.match(tinderViewSource, /if \(placesRef\.current\.length > 0\) return/)
  assert.match(tinderViewSource, /if \(n > 0\) return/)
  assert.match(tinderViewSource, /keepalive: true/)
  assert.match(tinderViewSource, /pagehide/)
  assert.match(tinderViewSource, /getTdvSummary/)
})
