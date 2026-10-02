import { useCallback, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RoteiroModifyPanel } from '../components/itinerary/RoteiroModifyPanel'
import { ItineraryMobileMapDrawer } from '../components/itinerary/ItineraryMobileMapDrawer'
import { ItineraryPageStates } from '../components/itinerary/ItineraryPageStates'
import { ItineraryHeader } from '../components/itinerary/ItineraryHeader'
import { ItineraryStatusBanners } from '../components/itinerary/ItineraryStatusBanners'
import { ItineraryRoteiroTimeline } from '../components/itinerary/ItineraryRoteiroTimeline'
import { ItineraryRoteiroEditFooter } from '../components/itinerary/ItineraryRoteiroEditFooter'
import { ItineraryRoteiroMapColumn } from '../components/itinerary/ItineraryRoteiroMapColumn'
import { ItineraryTdvOverlayShell } from '../components/itinerary/ItineraryTdvOverlayShell'
import { ItineraryGlobalOverlays } from '../components/itinerary/ItineraryGlobalOverlays'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useItineraryData } from '../hooks/useItineraryData'
import { useFinalizeTdv } from '../hooks/useFinalizeTdv'
import {
  MODE_ROTEIRO,
  usePlanningModes,
} from '../hooks/usePlanningModes'
import { useItineraryMapUi } from '../hooks/useItineraryMapUi'
import { useItineraryMeals } from '../hooks/useItineraryMeals'
import { useItineraryStay } from '../hooks/useItineraryStay'
import { useItineraryPageActions } from '../hooks/useItineraryPageActions'
import { useItineraryDayView } from '../hooks/useItineraryDayView'
import { useRoteiroEditSession } from '../hooks/useRoteiroEditSession'
import { useT } from '../i18n'
import { hasItineraryFullAccess } from '../utils/planningAccess'

export function Itinerary() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { refreshUser, isAdmin } = useAuth()
  const t = useT()
  const [selectedDay, setSelectedDay] = useState(1)
  const [exportSheetOpen, setExportSheetOpen] = useState(false)
  const setModeRef = useRef(() => {})
  const closeTdvOverlayRef = useRef(() => {})
  const discardRoteiroEditRef = useRef(() => {})

  const data = useItineraryData(tripId)
  const {
    trip,
    setTrip,
    itinerary,
    setItinerary,
    loading,
    itineraryLoading,
    error,
    setError,
    itineraryError,
    dateToDayMap,
    refetchItinerary,
    refetchItineraryImmediate,
    retryItineraryLoad,
    reorganizingStay,
    handleReorganizeStay: runReorganizeStay,
    handleRebuildFromTdvLikes: runRebuildFromTdvLikes,
    handleAdminUnlock: runAdminUnlock,
  } = data

  useDocumentTitle(
    trip?.destinations?.[0]?.city
      ? `Roteiro · ${trip.destinations[0].city}`
      : 'Roteiro',
  )

  const actions = useItineraryPageActions({
    tripId,
    navigate,
    setError,
    setSelectedDay,
    runRebuildFromTdvLikes,
    runAdminUnlock,
  })
  const onFinalizeSuccess = useCallback(() => {
    setModeRef.current(MODE_ROTEIRO)
  }, [])
  const finalize = useFinalizeTdv({
    tripId,
    trip,
    loading,
    itinerary,
    hasFullAccess: hasItineraryFullAccess(itinerary, trip),
    setTrip,
    setItinerary,
    setSelectedDay,
    onSuccess: onFinalizeSuccess,
    lockWarnBody: t('tdv.lock_warn_body'),
    onBeforeFinalize: () => actions.setShowDeleteConfirm(false),
  })

  const edit = useRoteiroEditSession({
    tripId,
    trip,
    itinerary,
    dateToDayMap,
    selectedDay,
    setSelectedDay,
    loading,
    hasFullAccess: hasItineraryFullAccess(itinerary, trip),
    setError,
    setItinerary,
    closeTdvOverlay: (...args) => closeTdvOverlayRef.current(...args),
    setMode: (...args) => setModeRef.current(...args),
    modeRoteiro: MODE_ROTEIRO,
    discardRoteiroEditRef,
    onStartEdit: () => setExportSheetOpen(false),
  })

  const modes = usePlanningModes({
    tripId,
    trip,
    itinerary,
    setTrip,
    finalizingTdv: finalize.finalizingTdv,
    refetchItineraryImmediate,
    refreshUser,
    searchParams,
    setSearchParams,
    roteiroEditOpen: edit.roteiroEditOpen,
    likeReplaceOpen: edit.likeReplace.open,
    onDiscardRoteiroEdit: () => discardRoteiroEditRef.current(),
    tdvLockTabHint: t('tdv.lock_tab_hint'),
  })
  setModeRef.current = modes.setMode
  closeTdvOverlayRef.current = modes.closeTdvOverlay

  const view = useItineraryDayView({
    trip,
    itinerary,
    dateToDayMap,
    selectedDay,
    setSelectedDay,
    roteiroEditOpen: edit.roteiroEditOpen,
    draftActivities: edit.draftActivities,
    likeReplace: edit.likeReplace,
    trackedStopId: edit.trackedStopId,
    mode: modes.mode,
    isPlanning: modes.isPlanning,
    hasFullAccess: modes.hasFullAccess,
    modeRoteiro: MODE_ROTEIRO,
  })
  const mapUi = useItineraryMapUi(modes.mode)
  const meals = useItineraryMeals({
    tripId,
    activities:
      edit.roteiroEditOpen && Array.isArray(edit.draftActivities)
        ? edit.draftActivities
        : itinerary?.activities,
    dateToDayMap,
    selectedDay,
    isLgUp: mapUi.isLgUp,
    setMobileMapOpen: mapUi.setMobileMapOpen,
    roteiroListScrollRef: edit.roteiroListScrollRef,
  })
  const stay = useItineraryStay({
    tripId,
    setTrip,
    primaryStay: view.primaryStay,
    runReorganizeStay,
    handleShowAccommodationRoutesChange:
      mapUi.handleShowAccommodationRoutesChange,
  })

  const firstDestination = trip?.destinations?.[0]
  const destLabel = firstDestination
    ? `${firstDestination.city}, ${firstDestination.country}`
    : 'Viagem'
  const pageState = (
    <ItineraryPageStates
      loading={loading}
      trip={trip}
      error={error}
      finalizingTdv={finalize.finalizingTdv}
    />
  )
  if ((loading && !trip) || error || !trip) return pageState

  const handlePrintItinerary = () => {
    if (
      !modes.hasFullAccess ||
      edit.roteiroEditOpen ||
      edit.likeReplace.open
    ) return
    setExportSheetOpen(false)
    globalThis.print?.()
  }
  const page = {
    tripId,
    itinerary,
    dateToDayMap,
    loading,
    itineraryLoading,
    itineraryError,
    finalizingTdv: finalize.finalizingTdv,
    finalizeError: finalize.finalizeError,
    reorganizingStay,
    isAdmin,
    t,
    destLabel,
    requestFinalizeTdv: finalize.requestFinalizeTdv,
    handleAdminUnlock: actions.handleAdminUnlock,
    exportSheetOpen,
    openExport: () => setExportSheetOpen(true),
    closeExport: () => setExportSheetOpen(false),
    handlePrintItinerary,
    mapUi,
  }

  return (
    <>
      <div
        className={`print:hidden flex flex-col min-h-0 bg-background-light/50 dark:bg-background-dark/30 ${
          modes.tdvUiActive
            ? 'flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:h-[100dvh] lg:-mx-12 lg:-my-8'
            : // Mobile: h-full até a MobileNav (padding do Layout = altura real da nav).
              // Só cancela p-4 laterais/topo — sem -mb, senão abre faixa sob o mapa.
              'flex h-full min-h-0 flex-1 flex-col overflow-hidden max-lg:-mx-4 max-lg:-mt-4 lg:h-[100dvh] lg:-mx-12 lg:-my-8'
        }`}
      >
        <ItineraryHeader
          view={view}
          modes={modes}
          edit={edit}
          actions={actions}
          page={page}
        />
        <ItineraryStatusBanners
          tdvLockHint={modes.tdvLockHint}
          setTdvLockHint={modes.setTdvLockHint}
          itineraryError={itineraryError}
          retryItineraryLoad={retryItineraryLoad}
          itineraryLoading={itineraryLoading}
          finalizeError={finalize.finalizeError}
          setFinalizeError={finalize.setFinalizeError}
        />
        <div
          className={`flex-1 flex min-w-0 min-h-0 overflow-hidden relative ${
            modes.mode === MODE_ROTEIRO ? 'flex-col lg:flex-row' : ''
          }`}
        >
          {view.showRoteiroSidebar ? (
            <section
              className={
                'roteiro-mobile-map-stage relative flex flex-col min-h-0 border-r border-border-light dark:border-border-dark bg-white dark:bg-card-dark ' +
                (edit.dragReorder.isOverlayActive
                  ? 'roteiro-list-drag-active z-40 '
                  : '') +
                (mapUi.mobileMapOpen ? 'roteiro-mobile-map-open ' : '') +
                (modes.mode === MODE_ROTEIRO
                  ? edit.likeReplace.open
                    ? 'w-full max-lg:flex-1 max-lg:max-h-none max-lg:min-h-0 lg:max-h-none lg:flex-none lg:w-1/2 xl:w-2/5'
                    : 'w-full max-lg:flex-1 max-lg:max-h-none max-lg:min-h-0 max-lg:pr-10 lg:max-h-none lg:flex-none lg:w-1/2 xl:w-2/5'
                  : 'w-full max-h-[48vh] lg:max-h-none lg:flex-none lg:w-1/2 xl:w-2/5')
              }
              aria-label="Paradas do dia"
            >
              <ItineraryRoteiroTimeline
                view={view}
                modes={modes}
                edit={edit}
                meals={meals}
                stay={stay}
                page={page}
              />
              <ItineraryRoteiroEditFooter
                edit={edit}
                tripId={tripId}
                locked={view.isSelectedDayPremiumLockedUi}
              />
              {modes.mode === MODE_ROTEIRO &&
              edit.likeReplace.open &&
              !mapUi.isLgUp ? (
                <RoteiroModifyPanel
                  layout="dock"
                  {...edit.modifyPanelSharedProps}
                />
              ) : null}
              {modes.mode === MODE_ROTEIRO && !edit.likeReplace.open ? (
                <ItineraryMobileMapDrawer
                  open={mapUi.mobileMapOpen}
                  onOpenChange={mapUi.setMobileMapOpen}
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
                  mealMapFrameNonce={meals.mealMapFrameNonce}
                  preferLocalRoute={
                    edit.roteiroEditOpen || edit.likeReplace.open
                  }
                  hideDuringRoteiroDrag={edit.dragReorder.isOverlayActive}
                  showAccommodationRoutes={mapUi.showAccommodationRoutes}
                  onShowAccommodationRoutesChange={
                    mapUi.handleShowAccommodationRoutesChange
                  }
                  showMealsOnMap={mapUi.showMealsOnMap}
                  onShowMealsOnMapChange={
                    mapUi.handleShowMealsOnMapChange
                  }
                  onMealViewOptions={meals.handleMealViewOptions}
                  onMealSlotFocus={meals.handleMealMapPinClick}
                  onMealGoToTimeline={meals.handleMealGoToTimeline}
                  onMealDismiss={meals.handleMealDismiss}
                  onMealDismissIfSlot={meals.handleMealDismissIfSlot}
                />
              ) : null}
            </section>
          ) : null}
          <ItineraryRoteiroMapColumn
            tripId={tripId}
            trip={trip}
            setTrip={setTrip}
            view={view}
            modes={modes}
            edit={edit}
            meals={meals}
            mapUi={mapUi}
            finalizingTdv={finalize.finalizingTdv}
            handleFinalizeTdv={finalize.handleFinalizeTdv}
            refetchItinerary={refetchItinerary}
            refetchItineraryImmediate={refetchItineraryImmediate}
          />
          <ItineraryTdvOverlayShell
            modes={modes}
            tripId={tripId}
            trip={trip}
            edit={edit}
            t={t}
          />
        </div>
      </div>
      <ItineraryGlobalOverlays
        trip={trip}
        destLabel={destLabel}
        dateToDayMap={dateToDayMap}
        view={view}
        modes={modes}
        edit={edit}
        stay={stay}
        actions={actions}
        page={page}
      />
    </>
  )
}
