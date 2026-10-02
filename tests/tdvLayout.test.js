import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8')

const tinderView = readSrc('src/components/itinerary/TinderView.jsx')
const useTdvDeck = readSrc('src/hooks/useTdvDeck.js')
const useTdvSwipe = readSrc('src/hooks/useTdvSwipe.js')
const tdvFreeCapPolicy = readSrc('src/utils/tdvFreeCapPolicy.js')
const TdvPaywall = readSrc('src/components/itinerary/TdvPaywall.jsx')
const tdvSource = [tinderView, useTdvDeck, useTdvSwipe, tdvFreeCapPolicy, TdvPaywall].join('\n')

test('TinderView: layout fixo sem scroll de página (card + barra de ações)', () => {
  assert.match(tinderView, /tdv-action-bar/)
  assert.match(tinderView, /overflow-hidden/)
  assert.match(tinderView, /belowFoldContent/)
  assert.doesNotMatch(tinderView, /historyScrollContent/)
  assert.doesNotMatch(tinderView, /overscroll-y-contain/)
  // Root do TDV ativo não usa scroll de página
  assert.match(
    tinderView,
    /flex h-full min-h-0 flex-1 flex-col overflow-hidden/
  )
})

test('TinderView: card relativo à área disponível e finalize antes do histórico', () => {
  assert.match(tinderView, /h-full w-full min-h-0 rounded-none lg:rounded-t-3xl/)
  assert.doesNotMatch(tinderView, /aspect-\[3\/4\]/)
  assert.doesNotMatch(tinderView, /min\(calc\(100dvh-12rem\),400px\)/)
  assert.match(tinderView, /finalizePanel/)
  assert.match(tinderView, /tdv-action-bar/)
  // Barra de ações fica na coluna do card (não atravessa a lateral)
  assert.match(
    tinderView,
    /tdv-action-bar[\s\S]*?\{actionButtons\}[\s\S]*?<\/aside>/
  )
  const belowFoldBlock = tinderView.slice(
    tinderView.indexOf('const belowFoldContent'),
    tinderView.indexOf('if (loading)')
  )
  assert.match(belowFoldBlock, /\{finalizePanel\}[\s\S]*\{choicesPanel\}/)
})

test('TinderView: lateral sem scroll de coluna', () => {
  assert.match(tinderView, /aside className="[^"]*overflow-hidden/)
  assert.doesNotMatch(
    tinderView,
    /aside className="[^"]*overflow-y-auto/
  )
})

test('TinderView: sem badge de dia nem botão próximo dia', () => {
  assert.doesNotMatch(tdvSource, /day_label/)
  assert.doesNotMatch(tdvSource, /handleNextDay/)
  assert.doesNotMatch(tdvSource, /Próximo dia/)
  assert.match(tdvSource, /deckUnavailable/)
  assert.match(tdvSource, /EMPTY_DECK_PREFETCH_MAX_ATTEMPTS = 3/)
  assert.match(tdvSource, /PREFETCH_WHEN_REMAINING_AT_MOST = 5/)
  assert.match(tdvSource, /DECK_MAX_PLACES = 15/)
})

test('TinderView: prefetch não aborta por swipe (só trip/unmount/finalize)', () => {
  assert.match(tdvSource, /prefetchInFlightRef\.current = false/)
  assert.match(tdvSource, /stillCurrent/)
  assert.match(
    tdvSource,
    /Sem cleanup abort\/cancelled: swipe re-render não descarta discover em voo/
  )
  assert.match(tdvSource, /Abort prefetch só ao trocar viagem ou desmontar/)
  assert.doesNotMatch(
    tdvSource,
    /if \(cancelled \|\| ac\.signal\.aborted\) return/
  )
  assert.match(tdvSource, /placesCount/)
  assert.match(tdvSource, /swiped >= FREE_CAP_MAX_PLACES/)
})

test('TinderView: prefetch retry condicionado a tdvLimit', () => {
  assert.match(tdvSource, /shouldRetryPrefetchOnEmpty/)
  assert.match(tdvSource, /refillEligible/)
  assert.match(tdvSource, /placesIssued > swiped/)
  assert.match(tdvSource, /if \(n > 0\) return/)
})

test('TinderView: paywall free_cap com Gerar roteiro e Desbloquear', () => {
  assert.match(tdvSource, /freeCapReached/)
  assert.match(tdvSource, /isHardFreeCap/)
  assert.match(tdvSource, /shouldLatchFreeCapPaywall/)
  assert.match(tdvSource, /FREE_CAP_SOFT_RETRY_MAX/)
  assert.match(tdvSource, /placesSource === 'free_cap'/)
  assert.match(tdvSource, /tdv\.free_cap_generate/)
  assert.match(tdvSource, /tdv\.free_cap_unlock/)
  assert.match(tdvSource, /from=tdv/)
  assert.match(tdvSource, /deckUnavailable \|\| freeCapReached \|\| paidBatchCapReached \|\| finalizingTdv/)
  // Reativa aba com baralho local sem novo discover; prefetch free_cap não latcheia com deck
  assert.match(tdvSource, /if \(placesRef\.current\.length > 0\) return/)
  assert.match(tdvSource, /if \(n > 0\) return/)
  assert.match(tdvSource, /keepalive: true/)
  assert.match(tdvSource, /pagehide/)
  assert.match(tdvSource, /getTdvSummary/)
})

test('C19: unlock auto-reload também quando deckUnavailable (não só freeCap)', () => {
  const blockStart = useTdvDeck.indexOf('Após unlock do planejamento')
  assert.ok(blockStart >= 0, 'efeito pós-unlock presente')
  const block = useTdvDeck.slice(blockStart, blockStart + 2000)
  assert.match(block, /planningUnlockedAt/)
  assert.match(block, /deckUnavailable/)
  assert.match(block, /setDeckUnavailable\(false\)/)
  assert.match(block, /setFreeCapReached\(false\)/)
  assert.match(block, /loadPlaces\(\)/)
  // C23: unlock limpa session antes do discover pago
  assert.match(block, /clearTdvDeckSession\(tripId\)/)
  // Não exige mais freeCapReached como único gatilho.
  assert.doesNotMatch(
    block,
    /if \(!isActive \|\| !tripId \|\| !planningUnlockedAt \|\| !freeCapReached\) return/
  )
  assert.match(
    block,
    /if \(!freeCapReached && !deckUnavailable && places\.length > 0\) return/
  )
})
