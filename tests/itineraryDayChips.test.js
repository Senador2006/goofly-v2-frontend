import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const chipsSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/ItineraryDayChips.jsx'),
  'utf8'
)

describe('ItineraryDayChips', () => {
  it('desliza o indicador só em transform, com rAF e sem animar largura', () => {
    assert.match(chipsSource, /translate3d\(/)
    assert.match(chipsSource, /requestAnimationFrame/)
    assert.match(chipsSource, /isSlidingRef/)
    assert.doesNotMatch(chipsSource, /transition-\[transform,width,height\]/)
  })

  it('empilha cinza (z-1), elipse (z-2) e rótulo (z-3)', () => {
    assert.match(chipsSource, /inactiveShellClass/)
    assert.match(chipsSource, /z-\[1\]/)
    assert.match(chipsSource, /z-\[2\]/)
    assert.match(chipsSource, /z-\[3\]/)
    assert.match(chipsSource, /bg-transparent/)
  })

  it('dia ativo um pouco maior (padding e tipo)', () => {
    assert.match(chipsSource, /py-2 sm:py-2\.5 text-\[13px\] sm:text-sm/)
    assert.match(chipsSource, /font-extrabold/)
  })
})
