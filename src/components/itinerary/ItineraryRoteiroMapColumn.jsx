import { TinderView } from './TinderView'
import { DocumentosView } from './DocumentosView'
import { RoteiroModifyPanel } from './RoteiroModifyPanel'
import { ItineraryDayMap } from './ItineraryDayMap'
import { MODE_DOCUMENTOS, MODE_ROTEIRO, MODE_TDV } from '../../hooks/usePlanningModes'

export function ItineraryRoteiroMapColumn({
  tripId,
  trip,
  setTrip,
  view,
  modes,
  edit,
  meals,
  mapUi,
  finalizingTdv,
  handleFinalizeTdv,
  refetchItinerary,
  refetchItineraryImmediate,
}) {
  return (
    <section className={`min-w-0 flex flex-col relative overflow-hidden ${modes.mode === MODE_ROTEIRO ? edit.likeReplace.open ? 'hidden lg:flex flex-1 min-h-0 bg-background-light dark:bg-background-dark/40' : 'hidden lg:flex flex-1 min-h-0 bg-gray-200 dark:bg-gray-900/50' : 'flex-1 min-h-0'}`}>
      {modes.isPlanning ? (
        <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${modes.mode === MODE_TDV ? '' : 'hidden'}`} aria-hidden={modes.mode !== MODE_TDV}>
          <TinderView tripId={tripId} trip={trip} onItineraryUpdate={refetchItinerary} isActive={modes.mode === MODE_TDV} onTdvSatisfied={handleFinalizeTdv} finalizingTdv={finalizingTdv} tdvMode="planning" warnTdvLockOnGenerate={!modes.hasFullAccess} />
        </div>
      ) : null}
      <div className={`flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-card-dark ${modes.mode === MODE_DOCUMENTOS ? 'flex' : 'hidden'}`}>
        <DocumentosView
          tripId={tripId}
          trip={trip}
          hasPlanejamentoCompleto={modes.hasFullAccess}
          isActive={modes.mode === MODE_DOCUMENTOS}
          onUpgrade={async () => {
            const { tripService } = await import('../../services/tripService')
            setTrip(await tripService.getTrip(tripId))
            await refetchItineraryImmediate()
          }}
        />
      </div>
      {modes.mode === MODE_ROTEIRO && edit.likeReplace.open && mapUi.isLgUp ? (
        <div className="flex h-full min-h-0 flex-1 flex-col p-3 sm:p-4">
          <RoteiroModifyPanel layout="sidebar" {...edit.modifyPanelSharedProps} className="h-full min-h-0" />
        </div>
      ) : null}
      {/* Só monta no desktop: no mobile o mapa vive no drawer. Manter o mapa
          CSS-hidden (display:none) com tamanho 0 faz o Leaflet explodir ao
          adicionar pins de hospedagem (LatLng NaN no layout/offset). */}
      {modes.mode === MODE_ROTEIRO && !edit.likeReplace.open && mapUi.isLgUp ? (
        <div className="roteiro-map-surface relative flex-1 min-h-0 w-full h-full">
          <ItineraryDayMap
            tripId={tripId}
            day={view.effectiveSelectedDay}
            days={view.days}
            activities={view.dayRouteActivities}
            timelineActivities={view.dayActivities}
            accommodations={view.dayAccommodations}
            mealSlots={view.dayMealSlots}
            selectedMealIds={meals.mealSelections}
            disabled={view.isSelectedDayPremiumLockedUi}
            routeRestricted={view.isRouteRestricted}
            highlightedIndex={view.trackedMapHighlight}
            highlightedMealSlotKey={meals.highlightedMealSlotKey}
            preferLocalRoute={edit.roteiroEditOpen || edit.likeReplace.open}
            className="absolute inset-0 h-full w-full"
            ariaLabel={`Mapa do roteiro — dia ${view.effectiveSelectedDay}`}
            showAccommodationRoutes={mapUi.showAccommodationRoutes}
            onShowAccommodationRoutesChange={mapUi.handleShowAccommodationRoutesChange}
            showMealsOnMap={mapUi.showMealsOnMap}
            onShowMealsOnMapChange={mapUi.handleShowMealsOnMapChange}
            onMealViewOptions={meals.handleMealViewOptions}
            onMealSlotFocus={meals.handleMealGoToTimeline}
            onMealGoToTimeline={meals.handleMealGoToTimeline}
            onMealDismiss={meals.handleMealDismiss}
            onMealDismissIfSlot={meals.handleMealDismissIfSlot}
          />
        </div>
      ) : null}
    </section>
  )
}
