import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const base = join(dirname(fileURLToPath(import.meta.url)), '..')
const itineraryPath = join(base, 'src/pages/Itinerary.jsx')
const drawerPath = join(base, 'src/components/itinerary/ItineraryMobileMapDrawer.jsx')
const dayMapPath = join(base, 'src/components/itinerary/ItineraryDayMap.jsx')

const itinerarySource = readFileSync(itineraryPath, 'utf8')
const drawerSource = existsSync(drawerPath) ? readFileSync(drawerPath, 'utf8') : ''
const dayMapSource = readFileSync(dayMapPath, 'utf8')

describe('Itinerary mobile map layout contracts', () => {
  it('importa ItineraryMobileMapDrawer', () => {
    assert.match(itinerarySource, /import\s*\{[^}]*ItineraryMobileMapDrawer/)
  })

  it('estado mobileMapOpen: fecha só ao trocar modo, não o dia', () => {
    assert.match(itinerarySource, /mobileMapOpen/)
    assert.match(itinerarySource, /setMobileMapOpen\(false\)/)
    assert.match(
      itinerarySource,
      /useEffect\(\(\) => \{[\s\S]*?setMobileMapOpen\(false\)[\s\S]*?\},\s*\[mode\]\)/
    )
  })

  it('mapa embutido oculto no mobile em modo roteiro (desktop lg+)', () => {
    assert.match(itinerarySource, /mode === MODE_ROTEIRO\s*\?\s*'hidden lg:flex flex-1 min-h-0/)
  })

  it('roteiro não encolhe com mapa aberto (overlay cobre tudo)', () => {
    assert.doesNotMatch(itinerarySource, /mobileMapOpen[\s\S]{0,120}max-lg:w-20/)
  })

  it('roteiro mobile sem max-h 48vh em modo roteiro', () => {
    assert.match(
      itinerarySource,
      /mode === MODE_ROTEIRO[\s\S]*?max-lg:flex-1[\s\S]*?max-lg:max-h-none/
    )
    const sidebarMatch = itinerarySource.match(
      /showRoteiroSidebar \? \([\s\S]*?<section[\s\S]*?aria-label="Paradas do dia"[\s\S]*?>/m
    )
    assert.ok(sidebarMatch, 'section Paradas do dia')
    const sectionChunk = itinerarySource.slice(sidebarMatch.index, sidebarMatch.index + 1200)
    const roteiroBranch = sectionChunk.match(
      /mode === MODE_ROTEIRO\s*\?\s*'([^']+)'/
    )
    assert.ok(roteiroBranch, 'branch MODE_ROTEIRO')
    assert.doesNotMatch(roteiroBranch[1], /max-h-\[48vh\]/)
  })

  it('renderiza drawer apenas em MODE_ROTEIRO', () => {
    assert.match(itinerarySource, /mode === MODE_ROTEIRO \? \([\s\S]*?<ItineraryMobileMapDrawer/)
  })
})

describe('ItineraryMobileMapDrawer contracts', () => {
  it('arquivo existe', () => {
    assert.ok(existsSync(drawerPath))
  })

  it('usa utils de snap e não framer-motion', () => {
    assert.match(drawerSource, /mobileMapDrawer\.js/)
    assert.doesNotMatch(drawerSource, /framer-motion|motion\.div/)
  })

  it('handle acessível', () => {
    assert.match(drawerSource, /aria-expanded=\{open\}/)
    assert.match(drawerSource, /aria-label=/)
    assert.match(drawerSource, /touch-none/)
  })

  it('drawer oculto em desktop (lg+)', () => {
    assert.match(drawerSource, /lg:hidden/)
  })

  it('painel full-screen ancorado à direita (entra da direita)', () => {
    assert.match(drawerSource, /right-0 z-20 w-full/)
    assert.match(drawerSource, /computeHandleInset/)
    assert.doesNotMatch(drawerSource, /mobileMapWidthExpr|MOBILE_MAP_ROSTER_PEEK|COMPACT_INSET/)
  })

  it('botão compacto encostado na borda (sem recuo)', () => {
    assert.match(drawerSource, /resolveHandleWidthPx/)
    assert.match(drawerSource, /handleCompact/)
    assert.doesNotMatch(drawerSource, /COMPACT_INSET|Math\.max\(MOBILE_MAP_HANDLE_COMPACT_INSET/)
  })
})

describe('ItineraryDayMap pin source contract', () => {
  it('prioriza localMarkers para pins quando há atividades locais', () => {
    assert.match(dayMapSource, /localMarkers\.length > 0 \? localMarkers : apiMarkers/)
  })

  it('suporta mapLayoutWatch para invalidateSize', () => {
    assert.match(dayMapSource, /mapLayoutWatch/)
  })

  it('suporta preferLocalRoute para rota ORS via preview do draft', () => {
    assert.match(dayMapSource, /preferLocalRoute/)
    assert.match(dayMapSource, /previewItineraryRoute/)
    assert.match(dayMapSource, /draftCacheKey/)
  })
})
