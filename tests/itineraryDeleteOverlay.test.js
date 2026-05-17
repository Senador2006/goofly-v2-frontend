import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const itinerarySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/Itinerary.jsx'),
  'utf8'
)
const overlaySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/DeletePlanningOverlay.jsx'),
  'utf8'
)

test('confirm de apagar não expande o header', () => {
  const headerBlock = itinerarySource.slice(
    itinerarySource.indexOf('<header'),
    itinerarySource.indexOf('</header>') + '</header>'.length
  )
  assert.doesNotMatch(headerBlock, /showDeleteConfirm/)
  assert.match(itinerarySource, /DeletePlanningOverlay/)
})

test('sem barra mobile duplicada Roteiro/TDV/Docs', () => {
  assert.doesNotMatch(itinerarySource, /lg:hidden flex-shrink-0 sticky bottom-0/)
})

test('overlay de apagar: fixed, alerta vermelho e transição', () => {
  assert.match(overlaySource, /fixed inset-0 z-\[100\]/)
  assert.match(overlaySource, /role="alertdialog"/)
  assert.match(overlaySource, /border-red-500/)
  assert.match(overlaySource, /transition-all duration-300/)
  assert.match(overlaySource, /bg-red-600/)
})
