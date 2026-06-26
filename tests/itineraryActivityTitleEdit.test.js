import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  defaultActivityTitle,
  resolveActivityTitle,
  resolveActivityTitleForEdit,
} from '../src/utils/itineraryPrintFormat.js'

const cardSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/ItineraryActivityCard.jsx'),
  'utf8'
)

describe('resolveActivityTitleForEdit', () => {
  it('retorna string vazia quando não há título no draft', () => {
    assert.equal(resolveActivityTitleForEdit({}), '')
    assert.equal(resolveActivityTitleForEdit({ title: '', name: '', placeName: '' }), '')
  })

  it('não aplica fallback de exibição', () => {
    assert.equal(resolveActivityTitleForEdit(null), '')
    assert.equal(resolveActivityTitleForEdit({ title: 'Torre Eiffel' }), 'Torre Eiffel')
    assert.equal(resolveActivityTitleForEdit({ name: 'Louvre' }), 'Louvre')
    assert.equal(resolveActivityTitleForEdit({ placeName: 'Parque' }), 'Parque')
  })

  it('resolveActivityTitle aplica fallback apenas para exibição', () => {
    assert.equal(resolveActivityTitle({}, 2), 'Atividade 3')
    assert.equal(resolveActivityTitle({ title: 'Museu' }, 2), 'Museu')
  })

  it('defaultActivityTitle usa índice 1-based', () => {
    assert.equal(defaultActivityTitle(0), 'Atividade 1')
    assert.equal(defaultActivityTitle(4), 'Atividade 5')
  })
})

describe('ItineraryActivityCard title edit wiring', () => {
  it('campo de edição usa valor sem fallback e blur aplica default', () => {
    assert.match(cardSource, /resolveActivityTitleForEdit/)
    assert.match(cardSource, /value=\{titleEditValue\}/)
    assert.match(cardSource, /onBlur=\{handleTitleBlur\}/)
    assert.match(cardSource, /defaultActivityTitle\(index\)/)
    assert.doesNotMatch(
      cardSource.slice(cardSource.indexOf('function CardEditFields')),
      /value=\{title\}[\s\S]{0,120}onDraftChange/
    )
  })
})
