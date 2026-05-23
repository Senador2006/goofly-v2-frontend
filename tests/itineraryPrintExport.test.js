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
  it('importa ItineraryPrintView e chama window.print', () => {
    assert.match(itinerarySource, /import\s*\{[^}]*ItineraryPrintView/)
    assert.match(itinerarySource, /globalThis\.print\?\.\(\)/)
    assert.match(itinerarySource, /Exportar PDF/)
  })

  it('oculta UI na impressão e renderiza layout dedicado', () => {
    assert.match(itinerarySource, /print:hidden/)
    assert.match(itinerarySource, /<ItineraryPrintView/)
    assert.match(printViewSource, /id="itinerary-print"/)
    assert.match(printViewSource, /hidden print:block/)
  })
})
