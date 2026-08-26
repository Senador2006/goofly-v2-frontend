import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

const base = join(dirname(fileURLToPath(import.meta.url)), '..')
const itineraryPath = join(base, 'src/pages/Itinerary.jsx')
const printViewPath = join(base, 'src/components/itinerary/ItineraryPrintView.jsx')

const itinerarySource = readFileSync(itineraryPath, 'utf8')
const printViewSource = readFileSync(printViewPath, 'utf8')

describe('Itinerary PDF print export', () => {
  it('importa ItineraryPrintView e chama window.print via folha de exportar', () => {
    assert.match(itinerarySource, /import\s*\{[^}]*ItineraryPrintView/)
    assert.match(itinerarySource, /import\s*\{[^}]*ItineraryExportSheet/)
    assert.match(itinerarySource, /globalThis\.print\?\.\(\)/)
    assert.match(itinerarySource, /<ItineraryExportSheet/)
    assert.match(itinerarySource, /ios_share/)
  })

  it('folha de exportar oferece só Exportar para PDF', () => {
    const sheetSource = readFileSync(
      join(base, 'src/components/itinerary/ItineraryExportSheet.jsx'),
      'utf8',
    )
    assert.match(sheetSource, /Exportar para PDF/)
    assert.match(sheetSource, /onExportPdf/)
    assert.match(sheetSource, /createPortal/)
    assert.match(sheetSource, /z-\[1200\]/)
    assert.match(sheetSource, /print:hidden/)
    assert.match(sheetSource, /goofly-mobile-nav-height/)
    assert.match(sheetSource, /Arraste para fechar/)
    assert.doesNotMatch(sheetSource, /Exportar para PNG|CSV|Excel/)
  })

  it('oculta UI na impressão e renderiza layout dedicado', () => {
    assert.match(itinerarySource, /print:hidden/)
    assert.match(itinerarySource, /<ItineraryPrintView/)
    assert.match(printViewSource, /id="itinerary-print"/)
    assert.match(printViewSource, /hidden print:block/)
  })
})
