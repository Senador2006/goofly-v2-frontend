import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const itinerarySource = readFileSync(join(root, 'src/pages/Itinerary.jsx'), 'utf8')
const headerSource = readFileSync(join(root, 'src/components/itinerary/ItineraryHeader.jsx'), 'utf8')
const overlaysSource = readFileSync(
  join(root, 'src/components/itinerary/ItineraryGlobalOverlays.jsx'),
  'utf8',
)
const overlaySource = readFileSync(
  join(root, 'src/components/itinerary/DeletePlanningOverlay.jsx'),
  'utf8',
)

test('confirm de apagar não expande o header', () => {
  const headerBlock = headerSource.slice(
    headerSource.indexOf('<header'),
    headerSource.indexOf('</header>') + '</header>'.length,
  )
  assert.doesNotMatch(headerBlock, /showDeleteConfirm/)
  assert.match(overlaysSource, /DeletePlanningOverlay/)
})

test('sem barra mobile duplicada Roteiro/TDV/Docs', () => {
  assert.doesNotMatch(itinerarySource, /lg:hidden flex-shrink-0 sticky bottom-0/)
})

test('overlay de apagar: fixed, alerta vermelho e transição', () => {
  assert.match(overlaySource, /fixed inset-0/)
  assert.match(overlaySource, /z-\[1200\]/)
  assert.match(overlaySource, /createPortal/)
  assert.match(overlaySource, /role="alertdialog"/)
  assert.match(overlaySource, /border-red-500/)
  assert.match(overlaySource, /transition-all duration-300/)
  assert.match(overlaySource, /bg-red-600/)
})
