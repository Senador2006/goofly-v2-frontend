import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const deckSrc = readFileSync(join(root, 'src/hooks/useTdvDeck.js'), 'utf8')

test('C23: unlock reload limpa sessionStorage antes do loadPlaces (lote pago fresh)', () => {
  const unlockIdx = deckSrc.indexOf('Após unlock do planejamento')
  assert.ok(unlockIdx >= 0, 'efeito de unlock reload deve existir')
  const unlockBlock = deckSrc.slice(unlockIdx, unlockIdx + 1800)

  assert.match(unlockBlock, /clearTdvDeckSession\(tripId\)/)
  assert.match(unlockBlock, /setPlaces\(\[\]\)/)
  assert.match(unlockBlock, /loadPlaces\(\)/)

  const clearIdx = unlockBlock.indexOf('clearTdvDeckSession(tripId)')
  const loadIdx = unlockBlock.indexOf('loadPlaces()')
  assert.ok(clearIdx >= 0 && loadIdx > clearIdx, 'clear deve ocorrer antes do loadPlaces')
})

test('C23: retry pós-unlock freeCap também limpa session (alinhado ao unlock)', () => {
  const retryStart = deckSrc.indexOf('const handleRetryDeck = useCallback')
  const retryEnd = deckSrc.indexOf('}, [finalizingTdv, freeCapReached', retryStart)
  assert.ok(retryStart >= 0 && retryEnd > retryStart)
  const retryBlock = deckSrc.slice(retryStart, retryEnd + 80)
  assert.match(retryBlock, /clearTdvDeckSession\(tripId\)/)
})
