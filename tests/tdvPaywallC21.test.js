import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const tinderSrc = readFileSync(join(root, 'src/components/itinerary/TinderView.jsx'), 'utf8')
const deckSrc = readFileSync(join(root, 'src/hooks/useTdvDeck.js'), 'utf8')
const overlaySrc = readFileSync(
  join(root, 'src/components/itinerary/ItineraryTdvOverlayShell.jsx'),
  'utf8',
)

test('C21: TdvPaywall só no planning; postUnlock + freeCap → EmptyState reload', () => {
  assert.match(tinderSrc, /freeCapReached && !isPostUnlock \? \(/)
  assert.match(tinderSrc, /freeCapReached && isPostUnlock \? \(/)
  assert.match(tinderSrc, /tdv\.unlock_reload_title/)
  assert.match(tinderSrc, /onClick=\{handleRetryDeck\}/)

  // Não pode restar o branch antigo que renderiza paywall em qualquer freeCap
  assert.doesNotMatch(tinderSrc, /\} : freeCapReached \? \(\s*<TdvPaywall/)
})

test('C21: overlay postUnlock sem onTdvSatisfied (CTAs de gerar/pagar não se aplicam)', () => {
  const overlayIdx = overlaySrc.indexOf('tdvMode="postUnlock"')
  assert.ok(overlayIdx > 0)
  const before = overlaySrc.lastIndexOf('<TinderView', overlayIdx)
  const after = overlaySrc.indexOf('/>', overlayIdx)
  const overlayBlock = overlaySrc.slice(before, after + 2)
  assert.doesNotMatch(overlayBlock, /onTdvSatisfied/)
  assert.match(overlayBlock, /warnTdvLockOnGenerate=\{false\}/)
})

test('C21: handleRetryDeck limpa freeCap quando unlocked', () => {
  assert.match(deckSrc, /if \(freeCapReached\) \{/)
  assert.match(deckSrc, /planning_unlocked_at/)
  assert.match(deckSrc, /setFreeCapReached\(false\)/)
  assert.doesNotMatch(
    deckSrc,
    /if \(finalizingTdv \|\| freeCapReached \|\| paidBatchCapReached\) return/,
  )
})
