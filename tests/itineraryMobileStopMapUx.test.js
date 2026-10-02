import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const base = join(dirname(fileURLToPath(import.meta.url)), '..')
const dayMapPath = join(base, 'src/components/itinerary/ItineraryDayMap.jsx')
const sheetPath = join(base, 'src/components/itinerary/ItineraryStopMapSheet.jsx')
const stackPopupPath = join(base, 'src/components/itinerary/ItineraryMapStopStackPopup.jsx')

const dayMapSource = readFileSync(dayMapPath, 'utf8')
const sheetSource = existsSync(sheetPath) ? readFileSync(sheetPath, 'utf8') : ''
const stackPopupSource = readFileSync(stackPopupPath, 'utf8')

describe('Mobile stop map sheet', () => {
  it('ItineraryStopMapSheet existe como peek card arrastável', () => {
    assert.ok(existsSync(sheetPath))
    assert.match(sheetSource, /role="dialog"/)
    assert.match(sheetSource, /goofly-stop-map-sheet/)
    assert.match(sheetSource, /DISMISS_DISTANCE_PX/)
    assert.match(sheetSource, /onPointerDown/)
    assert.match(sheetSource, /bottom-8/)
  })

  it('sheet de stack fica compacto (não cobre zoom/Dia N no topo)', () => {
    assert.match(sheetSource, /goofly-stop-map-sheet__cover--stack/)
    assert.match(sheetSource, /data-stack=\{isStack \? 'true' : undefined\}/)
    const cssPath = join(base, 'src/index.css')
    const css = readFileSync(cssPath, 'utf8')
    assert.match(css, /goofly-stop-map-sheet__card\[data-stack='true'\]/)
    assert.match(css, /max-height:\s*min\(46dvh/)
    assert.match(css, /goofly-stop-map-sheet__cover--stack/)
  })

  it('sheet de stack reusa o seletor de ordem do desktop', () => {
    assert.match(sheetSource, /paradas neste ponto/)
    assert.match(sheetSource, /onSelectStackMember/)
    assert.match(sheetSource, /listbox/)
    assert.match(stackPopupSource, /paradas neste ponto/)
  })

  it('sheet mobile expõe carrossel com todas as fotos da parada', () => {
    assert.match(sheetSource, /imageUrls/)
    assert.match(sheetSource, /data-stop-sheet-carousel/)
    assert.match(sheetSource, /goNext/)
    assert.match(sheetSource, /SWIPE_THRESHOLD_PX/)
    assert.match(dayMapSource, /imageUrls=\{mobileStopSheetData\.selected\.imageUrls/)
  })

  it('mapa mobile usa bottom sheet em vez de balão Leaflet para paradas', () => {
    assert.match(dayMapSource, /ItineraryStopMapSheet/)
    assert.match(dayMapSource, /showStopSheet/)
    assert.match(dayMapSource, /openMobileStopSheet/)
    assert.match(dayMapSource, /FocusMobileStopSheetPin/)
    assert.match(dayMapSource, /!isMobileMap && popupProps/)
  })

  it('sheet de stack sobrevive animação via snapshot de memberIds/coords', () => {
    assert.match(dayMapSource, /memberIds:\s*stack\.memberIds/)
    assert.match(dayMapSource, /mobileStopFocus\.memberIds/)
    assert.match(dayMapSource, /mobileStopFocus\.coords/)
  })

  it('Focus de stack não re-pana ao trocar chip do sheet', () => {
    assert.doesNotMatch(
      dayMapSource,
      /focusKey=\{`\$\{mobileStopFrameNonce\}:\$\{mobileStopSheetData\.kind\}:\$\{mobileStopSheetData\.selectedPinId\}`\}/,
    )
    assert.match(dayMapSource, /mobileStopSheetData\.stackId/)
  })

  it('stats cedem espaço ao sheet de parada no mobile', () => {
    assert.match(dayMapSource, /!disabled && hasMapContent && !showMealSheet && !showStopSheet/)
  })
})
