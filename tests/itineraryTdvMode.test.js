import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const itinerarySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/Itinerary.jsx'),
  'utf8'
)
const planningModesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/hooks/usePlanningModes.js'),
  'utf8'
)
const indexCssSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/index.css'),
  'utf8'
)
const mapColumnSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/ItineraryRoteiroMapColumn.jsx'),
  'utf8'
)
const overlaysSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/ItineraryGlobalOverlays.jsx'),
  'utf8'
)

test('Itinerary: TDV permanece montado na planning (hidden fora da aba)', () => {
  assert.match(mapColumnSource, /\{modes\.isPlanning \? \(/)
  assert.match(mapColumnSource, /modes\.mode === MODE_TDV \? '' : 'hidden'/)
  assert.match(mapColumnSource, /aria-hidden=\{modes\.mode !== MODE_TDV\}/)
  assert.doesNotMatch(mapColumnSource, /modes\.isPlanning && modes\.mode === MODE_TDV \?/)
})

test('Itinerary: planejamento com TDV e confirmação de apagar fora do header', () => {
  const headerSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/ItineraryHeader.jsx'),
    'utf8',
  )
  assert.match(mapColumnSource, /MODE_TDV/)
  assert.match(overlaysSource, /<DeletePlanningOverlay/)
  assert.doesNotMatch(
    headerSource.slice(
      headerSource.indexOf('<header'),
      headerSource.indexOf('</header>') + '</header>'.length,
    ),
    /\{showDeleteConfirm &&/,
  )
})

test('Itinerary: TDV mobile trava scroll do Layout e reserva MobileNav', () => {
  // C12: lock vive em usePlanningModes; shell ainda reserva altura da MobileNav
  assert.match(planningModesSource, /tdv-mobile-lock/)
  assert.match(itinerarySource, /max-lg:pb-\[var\(--goofly-mobile-nav-height,0px\)\]/)
  assert.match(indexCssSource, /main\.tdv-mobile-lock/)
})

const mobileNavSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/layout/MobileNav.jsx'),
  'utf8'
)
const layoutSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/layout/Layout.jsx'),
  'utf8'
)
const tinderSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/TinderView.jsx'),
  'utf8'
)

test('MobileNav: publica altura real em --goofly-mobile-nav-height', () => {
  assert.match(mobileNavSource, /--goofly-mobile-nav-height/)
  assert.match(mobileNavSource, /ResizeObserver/)
  assert.match(mobileNavSource, /orientationchange/)
})

test('TDV mobile: padrão de proporção até lg (não muda em sm)', () => {
  assert.match(layoutSource, /h-dvh/)
  // Botões de ação só crescem no desktop
  assert.match(tinderSource, /size-12[\s\S]*?lg:size-16/)
  assert.doesNotMatch(tinderSource, /size-12[\s\S]*?sm:size-16/)
  assert.match(tinderSource, /rounded-none lg:rounded-t-3xl/)
})
