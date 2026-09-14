import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const base = join(dirname(fileURLToPath(import.meta.url)), '..')
const itinerarySource = readFileSync(join(base, 'src/pages/Itinerary.jsx'), 'utf8')
const headerSource = readFileSync(join(base, 'src/components/itinerary/ItineraryHeader.jsx'), 'utf8')
const overlaysSource = readFileSync(
  join(base, 'src/components/itinerary/ItineraryGlobalOverlays.jsx'),
  'utf8',
)
const dayViewSource = readFileSync(join(base, 'src/hooks/useItineraryDayView.js'), 'utf8')
const indexCssSource = readFileSync(join(base, 'src/index.css'), 'utf8')
const panelSource = readFileSync(
  join(base, 'src/components/itinerary/RoteiroModifyPanel.jsx'),
  'utf8',
)

describe('Itinerary mobile header', () => {
  it('empilha cluster abaixo de lg (abas numa faixa, ações na outra)', () => {
    const mobileBlock = indexCssSource.slice(
      indexCssSource.indexOf('@media (max-width: 1023.98px)'),
      indexCssSource.indexOf('.itinerary-day-chips-slot'),
    )
    assert.match(mobileBlock, /itinerary-header-mode-cluster/)
    assert.match(mobileBlock, /flex-direction:\s*column/)
    assert.match(mobileBlock, /\.itinerary-header-actions--open[\s\S]*?width:\s*100%/)
    assert.match(mobileBlock, /\.itinerary-header-actions \{[\s\S]*?width:\s*100%/)
    assert.match(mobileBlock, /\.itinerary-header-actions--open[\s\S]*?flex-wrap:\s*nowrap/)
    assert.match(mobileBlock, /\.itinerary-header-actions--open[\s\S]*?max-height:\s*2\.75rem/)
  })

  it('selo Plano completo mostra o texto', () => {
    assert.match(headerSource, /aria-label="Plano completo"/)
    assert.match(headerSource, /text-\[10px\] font-bold uppercase tracking-wide[\s\S]*?Plano completo/)
    assert.doesNotMatch(headerSource, /hidden lg:inline text-\[10px\][\s\S]*?Plano completo/)
  })

  it('Editar roteiro mostra o texto; exportar é ícone com folha PDF', () => {
    assert.match(headerSource, /aria-label="Editar roteiro"/)
    assert.match(headerSource, /<Icon name="edit" className="text-base max-lg:text-sm" \/>\s*Editar roteiro/)
    assert.match(headerSource, /aria-label="Exportar"/)
    assert.match(headerSource, /<Icon name="ios_share"/)
    assert.match(headerSource, /max-lg:ml-auto/)
    assert.match(overlaysSource, /<ItineraryExportSheet/)
    assert.match(dayViewSource, /canPrintItinerary:[\s\S]*?hasFullAccess/)
    assert.doesNotMatch(headerSource, /<span className="hidden lg:inline">Exportar PDF<\/span>/)
  })

  it('chip de edição é curto no mobile', () => {
    assert.match(headerSource, /<span className="lg:hidden">Editando<\/span>/)
    assert.match(
      headerSource,
      /<span className="hidden lg:inline">Editando — guarde ou cancele antes de mudar de aba<\/span>/,
    )
  })

  it('não mostra chip longo de modificar com curtidas no header', () => {
    const header = headerSource.slice(
      headerSource.indexOf('<header'),
      headerSource.indexOf('</header>') + '</header>'.length,
    )
    assert.doesNotMatch(header, /Modificando com curtidas/)
  })
})

describe('Itinerary mobile modify dock', () => {
  it('RoteiroModifyPanel aceita layout dock e sidebar', () => {
    assert.match(panelSource, /layout = 'sidebar'/)
    assert.match(panelSource, /layout === 'dock'/)
    assert.match(panelSource, /overflow-x-auto/)
    assert.match(panelSource, /min-w-\[11rem\]/)
  })

  it('Itinerary monta dock no mobile e sidebar no lg+', () => {
    assert.match(itinerarySource, /layout="dock"/)
    assert.match(
      readFileSync(join(base, 'src/components/itinerary/ItineraryRoteiroMapColumn.jsx'), 'utf8'),
      /layout="sidebar"/,
    )
    assert.match(itinerarySource, /likeReplace\.open &&\s*!mapUi\.isLgUp/)
    assert.match(
      readFileSync(join(base, 'src/components/itinerary/ItineraryRoteiroMapColumn.jsx'), 'utf8'),
      /likeReplace\.open && mapUi\.isLgUp/,
    )
  })

  it('modify no mobile não usa split 42vh', () => {
    assert.doesNotMatch(itinerarySource, /max-h-\[42vh\]/)
  })
})
