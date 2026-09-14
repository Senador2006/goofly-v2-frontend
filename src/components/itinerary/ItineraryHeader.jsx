import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { ItineraryModeTabs } from './ItineraryModeTabs'
import { ItineraryDayChips } from './ItineraryDayChips'
import { ItineraryOptimizerInsightsPopover } from './ItineraryOptimizerInsights'
import { getPremiumDayTotals } from '../../utils/itineraryPremiumHelpers'

export function ItineraryHeader({ view, modes, edit, actions, page }) {
  const modeTabs = (
    <ItineraryModeTabs
      activeTab={modes.activeModeTab}
      onRoteiro={modes.handleModeTabRoteiro}
      onTdv={modes.openTdvTab}
      onDocumentos={modes.handleModeTabDocumentos}
      tdvLocked={modes.tdvTabLocked}
      tdvLockTitle={page.t('tdv.lock_tab_hint')}
      finalizing={page.finalizingTdv}
      hasFullAccess={modes.hasFullAccess}
      isPlanning={modes.isPlanning}
      onDeletePlanning={() => actions.setShowDeleteConfirm(true)}
    />
  )
  const showInsights =
    !modes.isPlanning &&
    !edit.roteiroEditOpen &&
    !edit.likeReplace.open &&
    Boolean(page.itinerary?.optimizer_meta)

  return (
    <header
      className={`relative flex-shrink-0 min-w-0 z-40 border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-card-dark/95 backdrop-blur-md px-4 sm:px-6 ${
        modes.tdvUiActive ? 'py-2 pb-1.5 lg:py-4 lg:pb-4' : 'py-3 sm:py-4'
      }`}
    >
      <div
        className={`flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-text-secondary overflow-x-auto no-scrollbar ${
          modes.tdvUiActive ? 'mb-1 lg:mb-3' : 'mb-2 sm:mb-3'
        }`}
      >
        <span>Início</span>
        <Icon name="chevron_right" className="text-[10px] shrink-0" />
        <span>Roteiros</span>
        <Icon name="chevron_right" className="text-[10px] shrink-0" />
        <span className="text-[#1c1c0d] dark:text-white truncate">{page.destLabel}</span>
      </div>
      <div className={`flex flex-col lg:flex-row lg:items-center lg:justify-between ${modes.tdvUiActive ? 'gap-1.5 lg:gap-3' : 'gap-3'}`}>
        <div className="min-w-0">
          <h1 className={`font-black tracking-tight text-[#1c1c0d] dark:text-white leading-tight ${modes.tdvUiActive ? 'text-xl lg:text-3xl' : 'text-xl sm:text-2xl lg:text-3xl'}`}>
            Criador de Roteiros
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
            Rota otimizada · {page.destLabel}
            {!modes.isPlanning && view.activities.length > 0 ? (
              <span className="text-text-secondary/80">
                {' '}· {view.activities.length} {view.activities.length === 1 ? 'parada' : 'paradas'}
                {view.premiumRestriction?.total ? ` (${view.premiumRestriction.visible}/${view.premiumRestriction.total} visíveis)` : ''}
              </span>
            ) : null}
          </p>
        </div>
        <div className="flex w-full min-w-0 flex-col gap-2 lg:justify-end">
          <div className="itinerary-header-mode-cluster">
            <div className="itinerary-header-tabs-row flex w-full min-w-0 items-center gap-2 lg:contents">
              <div className="itinerary-header-tabs min-w-0 flex-1 lg:flex-none">{modeTabs}</div>
              {showInsights ? (
                <ItineraryOptimizerInsightsPopover
                  optimizerMeta={page.itinerary.optimizer_meta}
                  optimizationScore={page.itinerary.optimization_score}
                  onReoptimize={actions.handleReoptimizeItinerary}
                  reoptimizing={page.reorganizingStay}
                  className="shrink-0 lg:hidden"
                  tabIndex={modes.tdvOverlayOpen && !modes.tdvOverlayExitTo ? -1 : undefined}
                />
              ) : null}
            </div>
            <div
              className={`itinerary-header-actions ${!modes.tdvOverlayOpen || modes.tdvOverlayExitTo ? 'itinerary-header-actions--open' : ''}`}
              aria-hidden={modes.tdvOverlayOpen && !modes.tdvOverlayExitTo ? true : undefined}
            >
              {modes.hasFullAccess && !modes.isPlanning ? (
                <span className="inline-flex items-center shrink-0 gap-1 px-2 py-0.5 text-green-700 dark:text-green-400 bg-green-500/15 rounded-full" title="Plano completo" aria-label="Plano completo">
                  <Icon name="verified" className="text-sm" aria-hidden />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Plano completo</span>
                </span>
              ) : null}
              {view.roteiroEditAllowed ? (
                !edit.roteiroEditOpen ? (
                  <Button variant="secondary" size="sm" className="rounded-xl shrink-0 font-bold max-lg:gap-1 max-lg:px-2.5 max-lg:py-1.5 max-lg:text-xs" onClick={edit.handleStartRoteiroEdit} type="button" tabIndex={modes.tdvOverlayOpen && !modes.tdvOverlayExitTo ? -1 : undefined} aria-label="Editar roteiro" title="Editar roteiro">
                    <Icon name="edit" className="text-base max-lg:text-sm" />
                    Editar roteiro
                  </Button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3 rounded-full text-[10px] font-black uppercase tracking-wide bg-primary/20 text-[#45340a] dark:text-primary border border-primary/40 leading-tight text-center shrink-0 whitespace-nowrap">
                    <Icon name="edit_note" aria-hidden />
                    <span className="lg:hidden">Editando</span>
                    <span className="hidden lg:inline">Editando — guarde ou cancele antes de mudar de aba</span>
                  </span>
                )
              ) : null}
              {!modes.isPlanning && !modes.hasFullAccess && view.activities.length > 0 ? (
                <Link to={`/pagamento?tripId=${encodeURIComponent(page.tripId)}`} tabIndex={modes.tdvOverlayOpen && !modes.tdvOverlayExitTo ? -1 : undefined} className="shrink-0">
                  <Button size="sm" className="rounded-xl shrink-0" aria-label="Roteiro completo" title="Roteiro completo">
                    <Icon name="workspace_premium" />
                    Roteiro completo
                  </Button>
                </Link>
              ) : null}
              {modes.isPlanning ? (
                <Button variant="secondary" size="sm" onClick={() => actions.setShowDeleteConfirm(true)} disabled={page.finalizingTdv} tabIndex={modes.tdvOverlayOpen && !modes.tdvOverlayExitTo ? -1 : undefined} aria-label="Apagar planejamento" title="Apagar planejamento" className="hidden shrink-0 rounded-xl border border-red-200 bg-red-50 font-bold text-red-700 shadow-none hover:bg-red-100 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15 lg:inline-flex">
                  <Icon name="delete" /><span>Apagar</span>
                </Button>
              ) : null}
              {view.canPrintItinerary ? (
                <Button variant="secondary" size="sm" className="rounded-xl shrink-0 font-bold size-8 min-w-8 min-h-8 p-0 px-0 max-lg:ml-auto lg:size-auto lg:min-w-10 lg:min-h-10 lg:px-2.5" onClick={page.openExport} type="button" tabIndex={modes.tdvOverlayOpen && !modes.tdvOverlayExitTo ? -1 : undefined} aria-label="Exportar" title="Exportar" aria-haspopup="dialog" aria-expanded={page.exportSheetOpen}>
                  <Icon name="ios_share" className="text-lg" />
                </Button>
              ) : null}
              {showInsights ? (
                <ItineraryOptimizerInsightsPopover optimizerMeta={page.itinerary.optimizer_meta} optimizationScore={page.itinerary.optimization_score} onReoptimize={actions.handleReoptimizeItinerary} reoptimizing={page.reorganizingStay} className="hidden shrink-0 lg:inline-flex" tabIndex={modes.tdvOverlayOpen && !modes.tdvOverlayExitTo ? -1 : undefined} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
      {view.showRoteiroSidebar ? (
        <div className={`itinerary-day-chips-slot ${!modes.tdvOverlayOpen || modes.tdvOverlayExitTo === 'roteiro' ? 'itinerary-day-chips-slot--open' : ''}`} aria-hidden={modes.tdvOverlayOpen && modes.tdvOverlayExitTo !== 'roteiro' ? true : undefined}>
          <div className="itinerary-day-chips-slot__inner">
            <div className="mt-2 min-w-0 overflow-hidden pt-1 pb-1 sm:mt-3 sm:pt-3 sm:pb-3.5 border-t border-border-light dark:border-white/10">
              <ItineraryDayChips
                days={view.days}
                selectedDay={view.effectiveSelectedDay}
                onSelectDay={edit.handleSelectDay}
                swapEnabled={edit.roteiroEditOpen && modes.hasFullAccess && !page.loading && !edit.likeReplace.open}
                daySwap={{ ...edit.daySwap, onChipPointerDown: edit.onDayChipPointerDown, chipRefs: edit.dayChipRefs, scrollRef: edit.dayChipsScrollRef }}
                getDayState={(day) => {
                  const peek = view.previewDayMapsReady && view.premiumRestriction && !modes.hasFullAccess && !modes.isPlanning ? getPremiumDayTotals(view.premiumRestriction, day) : null
                  return {
                    dayLockedPremium: view.previewDayMapsReady && peek?.totalOnDay > 0 && peek.visibleOnDay === 0,
                    dayPartialPremium: view.previewDayMapsReady && peek != null && peek.totalOnDay > 0 && peek.visibleOnDay > 0 && peek.totalOnDay > peek.visibleOnDay,
                    isActive: view.effectiveSelectedDay === day,
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
