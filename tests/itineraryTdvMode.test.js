import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const itinerarySource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/pages/Itinerary.jsx'),
  'utf8'
)
const indexCssSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../src/index.css'),
  'utf8'
)

test('Itinerary: TDV permanece montado na planning (hidden fora da aba)', () => {
  assert.match(itinerarySource, /\{isPlanning \? \(/)
  assert.match(itinerarySource, /mode === MODE_TDV \? '' : 'hidden'/)
  assert.match(itinerarySource, /aria-hidden=\{mode !== MODE_TDV\}/)
  assert.doesNotMatch(itinerarySource, /isPlanning && mode === MODE_TDV \?/)
})

test('Itinerary: planejamento com TDV e confirmação de apagar fora do header', () => {
  assert.match(itinerarySource, /MODE_TDV/)
  assert.match(itinerarySource, /<DeletePlanningOverlay/)
  assert.doesNotMatch(
    itinerarySource.slice(itinerarySource.indexOf('<header'), itinerarySource.indexOf('</header>') + '</header>'.length),
    /\{showDeleteConfirm &&/
  )
})

test('Itinerary: TDV mobile trava scroll do Layout e reserva MobileNav', () => {
  assert.match(itinerarySource, /tdv-mobile-lock/)
  // Altura real da MobileNav (ResizeObserver) — encosta sem folga morta nem corte
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
