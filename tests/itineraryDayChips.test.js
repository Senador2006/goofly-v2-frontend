import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const chipsSource = readFileSync(join(root, 'src/components/itinerary/ItineraryDayChips.jsx'), 'utf8')
const itinerarySource = readFileSync(join(root, 'src/pages/Itinerary.jsx'), 'utf8')
const hookSource = readFileSync(join(root, 'src/hooks/useRoteiroDaySwap.js'), 'utf8')

describe('ItineraryDayChips — swap de dias', () => {
  it('desliza o indicador só em transform, com rAF e sem animar largura', () => {
    assert.match(chipsSource, /translate3d\(/)
    assert.match(chipsSource, /requestAnimationFrame/)
    assert.match(chipsSource, /isSlidingRef/)
    assert.match(chipsSource, /SLIDE_MS = 360/)
    assert.doesNotMatch(chipsSource, /transition-\[transform,width,height\]/)
    assert.match(chipsSource, /antes do focusReady|focusReady/)
    assert.match(chipsSource, /só atualiza tamanho/)
  })

  it('empilha cinza (z-1), elipse (z-2) e rótulo (z-3)', () => {
    assert.match(chipsSource, /inactiveShellClass/)
    assert.match(chipsSource, /z-\[1\]/)
    assert.match(chipsSource, /z-\[2\]/)
    assert.match(chipsSource, /z-\[3\]/)
    assert.match(chipsSource, /bg-transparent/)
  })

  it('aceita hold/drag só com swapEnabled (modo edição)', () => {
    assert.match(chipsSource, /swapEnabled/)
    assert.match(chipsSource, /onChipPointerDown/)
    assert.match(chipsSource, /if \(!swapEnabled \|\| !daySwap\?\.onChipPointerDown\) return/)
    assert.match(chipsSource, /if \(swapEnabled\) return/)
  })

  it('expõe estados de troca na fileira e ghost', () => {
    assert.match(chipsSource, /roteiro-day-chips--swap-mode/)
    assert.match(chipsSource, /roteiro-day-chip--swap-target/)
    assert.match(chipsSource, /roteiro-day-chip--swap-pending/)
    assert.match(chipsSource, /roteiro-day-chip--dragging/)
    assert.match(chipsSource, /border-dashed border-primary/)
    assert.match(chipsSource, /DaySwapGhost/)
    assert.match(chipsSource, /swap_horiz/)
    assert.match(chipsSource, /py-1 px-1\.5/)
    assert.match(chipsSource, /sm:py-2\.5/)
  })
})

describe('Itinerary — wiring swap de dias', () => {
  it('liga swap só em modo edição com acesso completo', () => {
    assert.match(itinerarySource, /useRoteiroDaySwap/)
    assert.match(
      itinerarySource,
      /enabled:\s*roteiroEditOpen\s*&&\s*!loading\s*&&\s*Boolean\(trip\)\s*&&\s*hasFullAccess/,
    )
    assert.match(itinerarySource, /swapEnabled=\{roteiroEditOpen && hasFullAccess && !loading\}/)
  })

  it('foca o dia do swap com ghost na mão (delay curto)', () => {
    assert.match(itinerarySource, /onFocusSwapDay/)
    assert.match(itinerarySource, /selectedDay,/)
    assert.match(hookSource, /onFocusSwapDayRef\.current\?\.\(day\)/)
    assert.match(hookSource, /resolveGhostSize/)
    assert.match(hookSource, /ROTEIRO_DAY_SWAP_FOCUS_DELAY_MS/)
    assert.match(chipsSource, /showSwapChrome|focusReady/)
  })

  it('mutua exclusão com drag de atividades e cancela ao sair da edição', () => {
    assert.match(itinerarySource, /onActivityDragHandlePointerDown/)
    assert.match(itinerarySource, /onDayChipPointerDown/)
    assert.match(itinerarySource, /daySwapCancelRef\.current\?\.\(\)/)
    assert.match(itinerarySource, /dragReorderCancelRef\.current\?\.\(\)/)
    assert.match(itinerarySource, /handleCancelRoteiroEdit[\s\S]*daySwapCancelRef/)
  })

  it('aplica swapActivitiesBetweenDays no draft e seleciona o dia alvo', () => {
    assert.match(itinerarySource, /swapActivitiesBetweenDays\(prev, dateToDayMap, fromDay, toDay\)/)
    assert.match(itinerarySource, /setSelectedDay\(toDay\)/)
  })
})

describe('useRoteiroDaySwap', () => {
  it('centraliza ghost na mão, escala leve e foca com delay curto', () => {
    assert.match(hookSource, /ROTEIRO_DAY_SWAP_HOLD_MS/)
    assert.match(hookSource, /ROTEIRO_DAY_SWAP_MOVE_START_PX/)
    assert.match(hookSource, /ROTEIRO_DAY_SWAP_FOCUS_DELAY_MS/)
    assert.match(hookSource, /ROTEIRO_DAY_SWAP_GHOST_MIN_WIDTH_PX/)
    assert.match(hookSource, /ROTEIRO_DAY_SWAP_GHOST_SIZE_SCALE/)
    assert.match(hookSource, /resolveGhostSize/)
    assert.match(hookSource, /Ghost centrado na mão primeiro/)
  })
})
