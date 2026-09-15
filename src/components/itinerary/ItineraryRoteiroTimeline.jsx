import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { ItineraryPremiumBanner } from './ItineraryPremiumBanner'
import { ItineraryPremiumNextPeek } from './ItineraryPremiumNextPeek'
import { ItineraryStayAnchor } from './ItineraryStayAnchor'
import { ItineraryMealSlotCard } from './ItineraryMealSlotCard'
import { ItineraryActivityCard } from './ItineraryActivityCard'
import { ItineraryDragInsertLine } from './ItineraryDragInsertLine'
import { RoteiroModifyActivityRow } from './RoteiroModifyActivityRow'
import { RoteiroModifyInsertZone } from './RoteiroModifyInsertZone'
import { RoteiroStopsSkeleton } from './RoteiroStopsSkeleton'
import { getActivityDayNumber } from '../../utils/itineraryDayHelpers'

export function ItineraryRoteiroTimeline({
  view,
  modes,
  edit,
  meals,
  stay,
  page,
}) {
  let activityCardIndex = 0
  const unitCount = view.dayEditUnits?.length ?? view.dayRouteActivities.length

  return (
    <div
      ref={edit.roteiroListScrollRef}
      className={
        'roteiro-list-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-6' +
        (edit.dragReorder.isOverlayActive
          ? ' relative z-50 roteiro-list-scroll--drag-active'
          : '')
      }
    >
      {modes.isPlanning ? (
        <div className="mb-5 rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/[0.08] to-transparent dark:from-primary/15 p-4 sm:p-5">
          <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">{page.t('tdv.conclude_title')}</p>
          <p className="text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed">{page.t('tdv.conclude_body')}</p>
          <Button className="mt-4 w-full sm:w-auto rounded-full font-bold" onClick={page.requestFinalizeTdv} disabled={page.finalizingTdv}>
            <Icon name="auto_awesome" />
            {page.finalizingTdv ? page.t('tdv.finalize_generating') : page.t('tdv.conclude_cta')}
          </Button>
          {!modes.hasFullAccess ? <p className="mt-2 text-[11px] leading-snug text-text-secondary sm:text-xs">{page.t('tdv.lock_warn_body')}</p> : null}
          {page.finalizeError ? <p className="mt-2 text-xs text-red-600 dark:text-red-400 leading-relaxed" role="alert">{page.finalizeError}</p> : null}
        </div>
      ) : null}
      {!modes.hasFullAccess && view.premiumRestriction ? (
        <ItineraryPremiumBanner tripId={page.tripId} restriction={view.premiumRestriction} showAdminUnlock={page.isAdmin} onAdminUnlock={page.handleAdminUnlock} />
      ) : null}
      {view.isSelectedDayPremiumLockedUi ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-500/40 bg-gradient-to-br from-amber-500/12 dark:from-amber-500/[0.12] via-background-light dark:via-[#23220f] to-primary/[0.08] px-5 py-10 text-center mb-4">
          <Icon name="lock" className="text-[2.85rem] sm:text-[3.25rem] mb-4 mx-auto opacity-95 text-amber-800 dark:text-amber-400" />
          <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">Dia bloqueado na prévia</p>
          <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-[18.5rem] mx-auto leading-relaxed">
            {view.selectedDayPremium?.totalOnDay === 1 ? (
              <>Há <span className="font-semibold">1 parada</span> planejada neste dia dentro do plano completo.</>
            ) : (
              <>Há <span className="font-semibold">{view.selectedDayPremium?.totalOnDay} paradas</span> neste dia no plano completo — a prévia gratuita inclui apenas o 1º dia do roteiro.</>
            )}
          </p>
          {!modes.isPlanning ? (
            <Link to={`/pagamento?tripId=${encodeURIComponent(page.tripId)}`}>
              <Button className="mt-5 rounded-full font-bold w-full max-w-[16rem]" size="sm">
                <Icon name="workspace_premium" />Desbloquear roteiro
              </Button>
            </Link>
          ) : null}
        </div>
      ) : null}
      {!view.isSelectedDayPremiumLockedUi &&
      (edit.roteiroEditOpen || edit.likeReplace.open || view.dayActivities.length > 0) ? (
        <div className="relative isolate pb-2">
          <div className="min-w-0">
            {edit.roteiroEditOpen && edit.draftActivities ? (
              <div className="mb-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="secondary" className="rounded-xl font-bold" onClick={edit.handleAddRoteiroStop} disabled={edit.blockNewRoteiroStop} aria-describedby={edit.blockNewRoteiroStop ? 'roteiro-new-stop-hint' : undefined} title={edit.blockNewRoteiroStop ? 'Termine ou remova a parada em edição antes de adicionar outra.' : undefined}>
                    <Icon name="add" aria-hidden />Nova parada (dia&nbsp;{view.effectiveSelectedDay})
                  </Button>
                </div>
                {edit.blockNewRoteiroStop ? (
                  <p id="roteiro-new-stop-hint" className="inline-flex items-start gap-1.5 max-w-md rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 leading-snug">
                    <Icon name="info" className="text-sm shrink-0 mt-0.5" aria-hidden />
                    Nomeie ou remova a parada em edição antes de adicionar outra.
                  </p>
                ) : null}
              </div>
            ) : null}
            {edit.roteiroEditOpen && view.dayActivities.length === 0 ? (
              <div className="mb-6 rounded-xl border border-dashed border-primary/35 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
                <p className="font-semibold text-[#1c1c0d] dark:text-white">Neste dia ainda não há paradas</p>
                <p className="text-xs mt-1">Clique em «Nova parada» ou mova outra para cá pelo seletor de dia em cada cartão.</p>
              </div>
            ) : null}
            {stay.stayToast ? <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-[#45340a] dark:text-primary" role="status">{stay.stayToast}</div> : null}
            {view.showStayAnchors ? (
              <ItineraryStayAnchor placement="start" stay={view.primaryStay} tripId={page.tripId} hasFullAccess={modes.hasFullAccess} canEdit={view.canEditStay} onManage={stay.openStayManager} />
            ) : null}
            <div ref={edit.roteiroCardsListRef} className="relative space-y-0">
              <ItineraryDragInsertLine top={edit.dragReorder.ghostStyle?.lineTop} visible={edit.dragReorder.phase === 'dragging' && edit.dragReorder.showInsertLine} />
              {view.dayTimelineItems.map((item, timelineIndex) => {
                const timelineIsLast = timelineIndex === view.dayTimelineItems.length - 1 && view.hiddenPremiumStopsSameDay === 0
                if (item.type === 'mealSlot') {
                  const slotId = String(item.slotId || item.slotKey)
                  const unitIndex = view.unitIndexByDragId?.get(slotId) ?? timelineIndex
                  const primaryOpt = item.options?.[0]
                  const endTime =
                    primaryOpt?.endTime ||
                    primaryOpt?.end_time ||
                    ''
                  return (
                    <ItineraryMealSlotCard
                      key={`meal-${slotId}`}
                      mealType={item.mealType}
                      startTime={item.startTime}
                      endTime={endTime}
                      options={item.options}
                      isLast={timelineIsLast}
                      readOnly={edit.likeReplace.open}
                      editing={edit.roteiroEditOpen}
                      selectedId={meals.mealSelections[slotId] ?? null}
                      onSelect={(activityId) => meals.handleMealSelect(slotId, activityId)}
                      highlighted={meals.highlightedMealSlotKey === slotId}
                      showMealsOnMap={page.mapUi.showMealsOnMap}
                      open={meals.expandedMealSlotKey === slotId}
                      onOpenChange={(next) => meals.setExpandedMealSlotKey(next ? slotId : null)}
                      onViewOnMap={() => meals.handleMealViewOnMap(slotId)}
                      headerRef={(element) => {
                        const key = String(slotId)
                        if (element) meals.mealSlotHeaderRefs.current.set(key, element)
                        else meals.mealSlotHeaderRefs.current.delete(key)
                      }}
                      cardRef={(element) => {
                        if (element) edit.stopCardRefs.current.set(slotId, element)
                        else edit.stopCardRefs.current.delete(slotId)
                      }}
                      onTimePatch={(patch) =>
                        edit.patchActivity({ id: slotId }, patch)
                      }
                      onMoveUp={() => edit.moveActivity(slotId, unitIndex, -1)}
                      onMoveDown={() => edit.moveActivity(slotId, unitIndex, 1)}
                      disableMoveUp={unitIndex === 0 || edit.dragReorder.isInteractionBlocked}
                      disableMoveDown={unitIndex === unitCount - 1 || edit.dragReorder.isInteractionBlocked}
                      canDragReorder={edit.dragReorder.canDrag && !edit.dragReorder.isInteractionBlocked}
                      onDragHandlePointerDown={(event) =>
                        edit.onActivityDragHandlePointerDown(slotId, event)
                      }
                      onRemoveOption={(optionId) =>
                        edit.removeMealOption(slotId, optionId)
                      }
                      onAddOption={(placeFields) =>
                        edit.addMealOption(slotId, placeFields)
                      }
                      compactMode={edit.dragReorder.isCardCompact(slotId)}
                      isDragSource={
                        edit.dragReorder.phase === 'dragging' &&
                        slotId === String(edit.dragReorder.draggingId)
                      }
                      isDragHidden={
                        (edit.dragReorder.phase === 'landing' ||
                          edit.dragReorder.phase === 'reverting') &&
                        slotId === String(edit.dragReorder.draggingId)
                      }
                      isDragPending={slotId === String(edit.dragReorder.pendingDragId)}
                    />
                  )
                }
                const activity = item.act
                const index = activityCardIndex++
                const activityIsLast = timelineIndex === view.dayTimelineItems.length - 1 && view.hiddenPremiumStopsSameDay === 0
                const frozen = edit.reorderFrozenLayoutRef.current
                const activityId = String(activity.id)
                const unitIndex = view.unitIndexByDragId?.get(activityId) ?? index
                const displayIndex = frozen?.indices && activityId in frozen.indices ? frozen.indices[activityId] : index
                const displayIsLast = frozen?.isLast && activityId in frozen.isLast ? frozen.isLast[activityId] : activityIsLast
                if (edit.likeReplace.open) {
                  const dropHighlight = edit.likeDrag.phase === 'dragging' && edit.likeDrag.overTarget?.type === 'swap' && String(edit.likeDrag.overTarget.activityId) === activityId
                  return (
                    <RoteiroModifyActivityRow
                      key={String(activity.id || `${view.effectiveSelectedDay}-${index}`)}
                      act={activity}
                      index={index}
                      isLast={activityIsLast}
                      swapArmed={Boolean(edit.likeReplace.selectedLike) && edit.likeDrag.phase !== 'dragging'}
                      dropHighlight={dropHighlight}
                      dragActive={edit.likeDrag.phase === 'dragging'}
                      motion={edit.likeReplace.rowMotion?.[activityId] || null}
                      cardRef={(element) => edit.likeReplace.registerRowCardRef(activityId, element)}
                      onSwap={() => edit.likeReplace.swapWithActivity(activity.id)}
                      onRemove={() => edit.removeLikeActivity(activity.id)}
                    />
                  )
                }
                return (
                  <ItineraryActivityCard
                    key={String(activity.id || `${view.effectiveSelectedDay}-${index}`)}
                    act={activity}
                    index={index}
                    isLast={activityIsLast}
                    displayIndex={displayIndex}
                    displayIsLast={displayIsLast}
                    editing={edit.roteiroEditOpen}
                    draft={activity}
                    hasFullAccess={modes.hasFullAccess}
                    isTracked={activityId === String(edit.trackedStopId)}
                    cardRef={(element) => {
                      if (element) edit.stopCardRefs.current.set(activityId, element)
                      else edit.stopCardRefs.current.delete(activityId)
                    }}
                    onDraftPatch={(patch) => edit.patchActivity(activity, patch)}
                    onRemove={() => edit.removeActivity(activity.id)}
                    onMoveUp={() => edit.moveActivity(activity, unitIndex, -1)}
                    onMoveDown={() => edit.moveActivity(activity, unitIndex, 1)}
                    disableMoveUp={unitIndex === 0 || edit.dragReorder.isInteractionBlocked}
                    disableMoveDown={unitIndex === unitCount - 1 || edit.dragReorder.isInteractionBlocked}
                    compactMode={edit.dragReorder.isCardCompact(activity.id)}
                    isDragSource={edit.dragReorder.phase === 'dragging' && activityId === String(edit.dragReorder.draggingId)}
                    isDragHidden={(edit.dragReorder.phase === 'landing' || edit.dragReorder.phase === 'reverting') && activityId === String(edit.dragReorder.draggingId)}
                    isExpandingCard={edit.dragReorder.phase === 'expanding' && edit.dragReorder.expandRevealed && activityId === String(edit.dragReorder.droppedId)}
                    isDragPending={activityId === String(edit.dragReorder.pendingDragId)}
                    canDragReorder={edit.dragReorder.canDrag && !edit.dragReorder.isInteractionBlocked}
                    onDragHandlePointerDown={(event) => edit.onActivityDragHandlePointerDown(activity.id, event)}
                    dayPickerValue={getActivityDayNumber(activity, page.dateToDayMap) ?? view.effectiveSelectedDay}
                    dayPickerOptions={view.days}
                    onDayChange={(day) => edit.changeActivityDay(activity, day)}
                  />
                )
              })}
              {edit.likeReplace.open ? (
                <RoteiroModifyInsertZone zoneRef={edit.likeInsertZoneRef} active={edit.likeDrag.phase === 'dragging'} highlighted={edit.likeDrag.phase === 'dragging' && edit.likeDrag.overTarget?.type === 'insert'} />
              ) : null}
              {view.hiddenPremiumStopsSameDay >= 1 ? <ItineraryPremiumNextPeek hiddenCount={view.hiddenPremiumStopsSameDay} /> : null}
            </div>
            {view.showStayAnchors && view.primaryStay ? <ItineraryStayAnchor placement="end" stay={view.primaryStay} tripId={page.tripId} hasFullAccess={modes.hasFullAccess} canEdit={false} /> : null}
            {view.hiddenPremiumStopsSameDay >= 1 ? (
              <>
                <div className="pointer-events-none absolute inset-x-[-0.5rem] bottom-0 z-[5] h-[min(13.5rem,40vh)] sm:h-[min(15rem,38vh)] bg-gradient-to-b from-transparent via-white/25 via-[28%] to-white dark:via-[#23220f]/20 dark:to-[#23220f]" />
                <div aria-hidden className="pointer-events-none absolute inset-x-[-0.5rem] bottom-0 z-[6] h-[min(11rem,34vh)] sm:h-[min(12rem,32vh)] rounded-b-[1.75rem] bg-gradient-to-b from-transparent via-white/75 via-[52%] to-white/98 dark:from-transparent dark:via-[#23220f]/80 dark:to-[#23220f]/99 [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_100%)]" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[10] flex justify-center px-4 pb-5 pt-10 sm:pt-14 bg-gradient-to-t from-white dark:from-[#23220f] from-[10%] to-transparent">
                  {!modes.isPlanning ? (
                    <div className="pointer-events-auto inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[999px] border border-border-light/90 dark:border-white/14 bg-white/95 dark:bg-card-dark/95 px-5 py-2.5 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                      <span className="inline-flex items-center gap-2 text-[12px] sm:text-sm font-bold text-[#3d3310] dark:text-amber-100/95">
                        <Icon name="lock" className="text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
                        {view.hiddenPremiumStopsSameDay === 1 ? 'Mais uma parada neste dia' : `Mais ${view.hiddenPremiumStopsSameDay} neste dia`}
                      </span>
                      <Link to={`/pagamento?tripId=${encodeURIComponent(page.tripId)}`} className="shrink-0 rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 bg-primary text-[#1c1c0d] shadow-primary-glow dark:shadow-primary-glow-dark hover:opacity-90 hover:shadow-primary-glow-hover dark:hover:shadow-primary-glow-hover-dark px-5 min-h-[2.25rem] text-sm">Ver roteiro completo</Link>
                    </div>
                  ) : (
                    <span className="text-[11px] font-semibold text-text-secondary/90 text-center rounded-full bg-background-light/92 dark:bg-white/[0.07] py-2 px-4 border border-border-light dark:border-white/12">
                      {view.hiddenPremiumStopsSameDay === 1 ? 'Mais uma parada no plano completo' : `Mais ${view.hiddenPremiumStopsSameDay} no plano completo`}
                    </span>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {!view.isSelectedDayPremiumLockedUi && view.dayActivities.length === 0 && view.activities.length > 0 && !edit.roteiroEditOpen && !edit.likeReplace.open ? (
        <div className="text-center py-10 px-4 text-text-secondary rounded-2xl border border-dashed border-border-light dark:border-border-dark mb-4">
          <Icon name="event_busy" className="text-4xl mb-3 opacity-40 mx-auto text-primary" />
          <p className="text-sm font-medium text-[#1c1c0d] dark:text-white">Nenhuma parada neste dia</p>
          <p className="text-xs sm:text-sm mt-2">Troque o dia acima {!modes.hasFullAccess && view.premiumRestriction ? 'ou desbloqueie o roteiro completo.' : '.'}</p>
        </div>
      ) : null}
      {page.itineraryLoading && view.dayActivities.length === 0 && !page.itineraryError ? <div className="mb-4"><RoteiroStopsSkeleton /></div> : null}
      {view.activities.length === 0 && !page.itineraryLoading && !page.itineraryError ? (
        <div className="text-center py-10 px-4 text-text-secondary rounded-2xl border border-dashed border-border-light dark:border-border-dark">
          <Icon name="route" className="text-4xl mb-3 opacity-40 mx-auto text-primary" />
          <p className="text-sm font-medium text-[#1c1c0d] dark:text-white">Nenhuma atividade ainda</p>
          <p className="text-xs sm:text-sm mt-2 max-w-xs mx-auto">{modes.isPlanning ? 'Use o botão acima para gerar o roteiro, ou abra a aba TDV se quiser escolher lugares antes.' : 'Abra o Tinder de Viagens na nav ou crie outro planejamento.'}</p>
        </div>
      ) : null}
    </div>
  )
}
