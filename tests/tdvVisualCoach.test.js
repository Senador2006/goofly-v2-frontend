import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  TDV_HINT_CHOICES_TO_HIDE,
  readTdvCoachSeen,
  readTdvHintCount,
  writeTdvCoachSeen,
  writeTdvHintCount,
} from '../src/utils/tdvCoachSession.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const readSrc = (rel) => readFileSync(join(root, rel), 'utf8')

test('intro do TDV é título, pílulas e uma linha', () => {
  const messages = readSrc('src/i18n/messages/pt-BR.js')
  const intro = readSrc('src/components/itinerary/TdvIntroScreen.jsx')
  assert.match(messages, /É um Tinder de lugares/)
  assert.match(messages, /Um toque em cada lugar\. O check monta o roteiro\./)
  assert.match(messages, /intro_start: 'Começar'/)
  assert.match(messages, /Curtidas no roteiro/)
  assert.match(messages, /O check abre o Modificar Roteiro\./)
  assert.match(messages, /modify_intro_continue: 'Continuar'/)
  assert.match(intro, /intro_pill_no/)
  assert.match(intro, /intro_pill_want/)
  assert.match(intro, /intro_pill_generate/)
  assert.match(intro, /modify_intro_pill/)
  assert.match(intro, /disabled=\{loading \|\| !ready\}/)
})

test('holofote do TDV roda uma vez por viagem e respeita reduced motion', () => {
  const coach = readSrc('src/components/itinerary/TdvActionCoach.jsx')
  const guide = readSrc('src/hooks/useTdvActionGuide.js')
  const view = readSrc('src/components/itinerary/TinderView.jsx')
  const session = readSrc('src/utils/tdvCoachSession.js')
  assert.match(coach, /STEP_MS = 1600/)
  assert.match(coach, /Escape/)
  assert.match(coach, /coach_skip/)
  assert.match(guide, /prefers-reduced-motion: reduce/)
  assert.match(view, /!coachSeen/)
  assert.match(view, /!reducedMotion/)
  assert.match(session, /goofly:tdv-coach:/)
  assert.doesNotMatch(session, /tdv-modify-coach/)
})

test('rótulos somem após duas escolhas e o undo fica sem legenda', () => {
  const view = readSrc('src/components/itinerary/TinderView.jsx')
  const swipe = readSrc('src/hooks/useTdvSwipe.js')
  assert.equal(TDV_HINT_CHOICES_TO_HIDE, 2)
  assert.match(view, /showActionLabels/)
  assert.match(view, /undo_action/)
  assert.match(swipe, /onChoiceRef\.current\?\.\(\)/)
  const actions = view.slice(view.indexOf('const actionButtons'), view.indexOf('const placeCard'))
  const undoToDislike = actions.slice(0, actions.indexOf('dislikeBtnRef'))
  assert.doesNotMatch(undoToDislike, /ActionHint/)
})

test('coach e contador de rótulos ficam no sessionStorage da viagem', () => {
  const previous = globalThis.sessionStorage
  const store = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, value),
  }

  try {
    assert.equal(readTdvCoachSeen('viagem-a'), false)
    writeTdvCoachSeen('viagem-a')
    assert.equal(readTdvCoachSeen('viagem-a'), true)
    assert.equal(readTdvCoachSeen('viagem-b'), false)
    assert.equal(store.get('goofly:tdv-coach:viagem-a'), '1')

    assert.equal(readTdvHintCount('viagem-a'), 0)
    writeTdvHintCount('viagem-a', 1)
    assert.equal(readTdvHintCount('viagem-a'), 1)
    assert.equal(readTdvHintCount('viagem-b'), 0)
    assert.equal(store.get('goofly:tdv-hints:viagem-a'), '1')
  } finally {
    if (previous === undefined) delete globalThis.sessionStorage
    else globalThis.sessionStorage = previous
  }
})
