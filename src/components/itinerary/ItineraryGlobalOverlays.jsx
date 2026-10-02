import { ItineraryExportSheet } from './ItineraryExportSheet'
import { AccommodationEditorSheet } from './AccommodationEditorSheet'
import { ReorganizeStayDialog } from './ReorganizeStayDialog'
import { DeletePlanningOverlay } from './DeletePlanningOverlay'
import { FinalizeItineraryOverlay } from './FinalizeItineraryOverlay'
import { RoteiroDragOverlay } from './RoteiroDragOverlay'
import { ItineraryDragGhost } from './ItineraryDragGhost'
import { RoteiroModifyDragGhost } from './RoteiroModifyDragGhost'
import { ItineraryPrintView } from './ItineraryPrintView'
import { accommodationNeedsReorganize } from '../../utils/accommodationStayContract'

export function ItineraryGlobalOverlays({
  trip,
  destLabel,
  dateToDayMap,
  view,
  modes,
  edit,
  stay,
  actions,
  page,
}) {
  return (
    <>
      <ItineraryExportSheet open={page.exportSheetOpen} onClose={page.closeExport} onExportPdf={page.handlePrintItinerary} />
      <AccommodationEditorSheet
        open={Boolean(stay.stayEditor)}
        onClose={stay.closeStayEditor}
        trip={trip}
        intent={stay.stayEditor?.intent || 'manage'}
        focusStayId={stay.stayEditor?.focusStayId || null}
        defaultDestinationId={view.selectedDayDest?.id}
        defaultCheckIn={view.selectedDayIso}
        saving={stay.staySaving}
        error={stay.stayEditorError}
        onSave={(nextAccommodations, changedStay) => {
          stay.persistAccommodations(nextAccommodations, {
            promptReorganize: accommodationNeedsReorganize(
              trip?.accommodations || [],
              changedStay,
            ),
            stayName: changedStay?.name || changedStay?.address || '',
            toast: 'Hospedagens atualizadas.',
          })
        }}
      />
      <ReorganizeStayDialog open={Boolean(stay.reorganizePrompt)} stayName={stay.reorganizePrompt?.name} onKeep={() => stay.setReorganizePrompt(null)} onReorganize={stay.handleReorganizeStay} />
      <DeletePlanningOverlay open={actions.showDeleteConfirm} onClose={() => actions.setShowDeleteConfirm(false)} onConfirm={actions.handleDeletePlanning} deleting={actions.deleting} tripLabel={destLabel} />
      <FinalizeItineraryOverlay
        open={page.finalizingTdv || page.reorganizingStay}
        title={page.reorganizingStay && !page.finalizingTdv ? 'Reorganizando o roteiro' : undefined}
        description={page.reorganizingStay && !page.finalizingTdv ? 'O otimizador está ajustando as paradas em torno da hospedagem.' : undefined}
      />
      <RoteiroDragOverlay active={edit.dragReorder.isOverlayActive}>
        <ItineraryDragGhost
          activity={edit.dragReorder.ghostActivity}
          index={
            edit.dragReorder.ghostActivity
              ? Math.max(
                  0,
                  view.dayEditUnits?.findIndex(
                    (unit) =>
                      String(unit.type === 'mealSlot' ? unit.slotId : unit.id) ===
                      String(edit.dragReorder.ghostActivity.id),
                  ) ??
                    view.dayRouteActivities.findIndex(
                      (activity) =>
                        String(activity.id) === String(edit.dragReorder.ghostActivity.id),
                    ),
                )
              : 0
          }
          style={edit.dragReorder.ghostStyle && (edit.dragReorder.phase === 'dragging' || edit.dragReorder.phase === 'landing' || edit.dragReorder.phase === 'reverting') ? {
            left: edit.dragReorder.ghostStyle.left,
            top: edit.dragReorder.ghostStyle.top,
            width: edit.dragReorder.ghostStyle.width,
            animate: edit.dragReorder.ghostStyle.animate,
            visible: edit.dragReorder.ghostStyle.visible !== false,
            outOfList: Boolean(edit.dragReorder.ghostStyle.outOfList),
          } : null}
        />
      </RoteiroDragOverlay>
      {edit.likeReplace.open && edit.likeDrag.phase === 'dragging' ? <RoteiroModifyDragGhost like={edit.likeDrag.draggingLike} style={edit.likeDrag.ghostStyle} /> : null}
      <ItineraryPrintView trip={trip} activities={view.persistedActivities} days={view.days} dateToDayMap={dateToDayMap} destLabel={destLabel} hasFullAccess={modes.hasFullAccess} premiumRestriction={view.premiumRestriction} />
    </>
  )
}
