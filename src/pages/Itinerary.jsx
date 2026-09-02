import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { TinderView } from '../components/itinerary/TinderView'
import { DocumentosView } from '../components/itinerary/DocumentosView'
import { ItineraryActivityCard } from '../components/itinerary/ItineraryActivityCard'
import { ItineraryMealSlotCard } from '../components/itinerary/ItineraryMealSlotCard'
import { ItineraryOptimizerInsightsPopover } from '../components/itinerary/ItineraryOptimizerInsights'
import { ItineraryPremiumNextPeek } from '../components/itinerary/ItineraryPremiumNextPeek'
import { ItineraryPremiumBanner } from '../components/itinerary/ItineraryPremiumBanner'
import { DeletePlanningOverlay } from '../components/itinerary/DeletePlanningOverlay'
import { ItineraryExportSheet } from '../components/itinerary/ItineraryExportSheet'
import { ItineraryStayAnchor } from '../components/itinerary/ItineraryStayAnchor'
import { AccommodationEditorSheet } from '../components/itinerary/AccommodationEditorSheet'
import { ReorganizeStayDialog } from '../components/itinerary/ReorganizeStayDialog'
import { FinalizeItineraryOverlay } from '../components/itinerary/FinalizeItineraryOverlay'
import { RoteiroModifyPanel } from '../components/itinerary/RoteiroModifyPanel'
import { RoteiroModifyActivityRow } from '../components/itinerary/RoteiroModifyActivityRow'
import { RoteiroModifyInsertZone } from '../components/itinerary/RoteiroModifyInsertZone'
import { RoteiroModifyDragGhost } from '../components/itinerary/RoteiroModifyDragGhost'
import { ItineraryModeTabs } from '../components/itinerary/ItineraryModeTabs'
import {
  ItineraryDayMap,
  clearItineraryRouteCache,
} from '../components/itinerary/ItineraryDayMap'
import { ItineraryMobileMapDrawer } from '../components/itinerary/ItineraryMobileMapDrawer'
import {
  readShowAccommodationRoutesPreference,
  writeShowAccommodationRoutesPreference,
} from '../utils/mapAccommodationRoutesPreference'
import {
  readShowMealsOnMapPreference,
  writeShowMealsOnMapPreference,
} from '../utils/mapMealsPreference'
import {
  readMealSelectionsPreference,
  writeMealSelectionsPreference,
} from '../utils/mealSelectionsPreference'
import { scrollElementToContainerTopAfterLayout } from '../utils/itineraryScrollHelpers'
import { ItineraryDayChips } from '../components/itinerary/ItineraryDayChips'
import { ItineraryPrintView } from '../components/itinerary/ItineraryPrintView'
import { ItineraryDragInsertLine } from '../components/itinerary/ItineraryDragInsertLine'
import { ItineraryDragGhost } from '../components/itinerary/ItineraryDragGhost'
import { RoteiroDragOverlay } from '../components/itinerary/RoteiroDragOverlay'
import { tripService } from '../services/tripService'
import { isRequestAbort } from '../services/api'
import { userService } from '../services/userService'
import { placeService } from '../services/placeService'
import { mergeTdvLikeListsById } from '../utils/tdvLikeEntry'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useRoteiroDragReorder } from '../hooks/useRoteiroDragReorder'
import { useRoteiroDaySwap } from '../hooks/useRoteiroDaySwap'
import { useRoteiroLikeReplace } from '../hooks/useRoteiroLikeReplace'
import { useRoteiroLikeDrag } from '../hooks/useRoteiroLikeDrag'
import { useT } from '../i18n'
import {
  assignActivityToDay,
  buildDateToDayMap,
  getActivityDayNumber,
  getIsoDateForDay,
  reorderActivityInSameDay,
  sortDayActivities,
  swapActivitiesBetweenDays,
} from '../utils/itineraryDayHelpers'
import {
  buildDayTimelineItems,
  filterRouteActivities,
  getMealPositionLabel,
  mergeMealSelections,
  resolveSelectedMealForSlot,
} from '../utils/itineraryMealHelpers'
import { resolveActivityTitle } from '../utils/itineraryPrintFormat'
import {
  applyRoteiroScheduleEdit,
  applyRoteiroScheduleReorder,
  isScheduleTimePatch,
  scheduleActivityInsertedAtEnd,
} from '../utils/roteiroScheduleContract'
import { resolveAccommodationsForDay, findDestinationCoveringIso } from '../utils/accommodationDayResolver'
import {
  accommodationNeedsReorganize,
} from '../utils/accommodationStayContract'
import { getTripDayCount, hasItineraryFullAccess } from '../utils/planningAccess'
import {
  captureReorderSnapshot,
  playReorderSwapAnimation,
  prefersReducedFlipMotion,
} from '../utils/flipListAnimation'
import {
  clearFinalizeTdvSession,
  finalizeTdvSessionDeadline,
  isFinalizeRequestAbort,
  markFinalizeTdvSession,
  readFinalizeTdvSession,
} from '../utils/finalizeTdvSession'
import {
  isOptimizerPending,
  pollItineraryUntilOptimizerReady,
} from '../utils/optimizerPollHelpers'

const MODE_ROTEIRO = 'roteiro'
const MODE_TDV = 'tdv'
const MODE_DOCUMENTOS = 'documentos'
/** Deve bater com `transition` em `.tdv-overlay-panel` (index.css). */
const TDV_OVERLAY_MS = 420

/** Congela índice e isLast dos cards durante animação de reorder. */
function captureDayFrozenLayout(dayActs, premiumHiddenCount) {
  /** @type {Record<string, number>} */
  const indices = {}
  /** @type {Record<string, boolean>} */
  const isLast = {}
  dayActs.forEach((a, i) => {
    const id = String(a.id)
    indices[id] = i
    isLast[id] = i === dayActs.length - 1 && premiumHiddenCount === 0
  })
  return { indices, isLast }
}

function itineraryActivitiesSignature(itineraryData) {
  return (itineraryData?.activities || [])
    .map((a) => `${a?.id ?? ''}:${a?.day ?? a?.dayNumber ?? ''}:${a?.title || a?.name || ''}`)
    .join('|')
}

function RoteiroStopsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando paradas">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-28 rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
        />
      ))}
    </div>
  )
}

function itineraryLoadErrorMessage(err) {
  const raw = String(err?.response?.data?.error?.message || '').trim()
  if (!raw) return 'Não foi possível carregar as paradas do roteiro'
  if (/assignment to constant|cannot read propert|is not a function|unexpected token/i.test(raw)) {
    return 'Não foi possível carregar as paradas do roteiro'
  }
  return raw
}

function activityStableId(act) {
  const id = act?.id ?? act?.placeId ?? act?.place_id
  return id != null && String(id).trim() !== '' ? String(id) : null
}

function ensureActivitiesHaveStableIds(activityList) {
  return activityList.map((a, idx) => {
    const sid = activityStableId(a)
    const nid =
      sid ||
      globalThis.crypto?.randomUUID?.() ||
      `act-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`
    return { ...a, id: nid }
  })
}

/** Normaliza flags de ingresso para o contrato persistido (camelCase + snake_case ou ausência). */
function normalizeActivityTicketForPersist(act) {
  const required =
    act.ticketRequired === true ||
    act.requiresTicket === true ||
    act.ticket_required === true ||
    act.needs_ticket === true
  const out = { ...act }
  delete out.requiresTicket
  delete out.needs_ticket
  if (required) {
    out.ticketRequired = true
    out.ticket_required = true
  } else {
    delete out.ticketRequired
    delete out.ticket_required
  }
  return out
}

/** Reagrupa todos os dias, ordena dentro de cada dia e normaliza day/dayNumber/order/datas para persistência. */
function normalizeActivitiesForPersist(activities, dateToDayMap, fallbackDay = 1) {
  const fb = Math.max(1, Math.floor(Number(fallbackDay) || 1))
  const withDay = activities.map((a) => {
    const fromMap = getActivityDayNumber(a, dateToDayMap)
    let dayNum = fromMap
    if (dayNum == null || !Number.isFinite(dayNum)) {
      const raw = Number(a.day ?? a.dayNumber ?? a.day_number)
      dayNum =
        Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : fb
    } else {
      dayNum = Math.floor(dayNum)
    }
    dayNum = Math.max(1, dayNum)
    const assigned = assignActivityToDay(
      { ...a, day: dayNum, dayNumber: dayNum, day_number: dayNum },
      dayNum,
      dateToDayMap,
    )
    const iso = getIsoDateForDay(dateToDayMap, dayNum)
    return iso ? assigned : { ...a, day: dayNum, dayNumber: dayNum, day_number: dayNum }
  })
  /** @type {Map<number, any[]>} */
  const map = new Map()
  for (const a of withDay) {
    const d = Math.floor(Number(a.day) || 1)
    if (!map.has(d)) map.set(d, [])
    map.get(d).push(a)
  }
  const sortedDays = [...map.keys()].sort((x, y) => x - y)
  const out = []
  for (const d of sortedDays) {
    const list = sortDayActivities(map.get(d))
    list.forEach((a, i) => out.push(normalizeActivityTicketForPersist({ ...a, order: i })))
  }
  return out
}

/** Parada recém-criada no draft que ainda não foi nomeada pelo usuário. */
function isPendingNewStop(act) {
  return act?.source === 'user_edit' && String(act?.title || '').trim() === 'Nova parada'
}

function computeDaysList(activities, dateToDayMap, trip) {
  const tripDayCount = getTripDayCount(trip)
  const chronologicalDays = Array.from({ length: tripDayCount }, (_, i) => i + 1)
  const numericDaysFromActs = [
    ...new Set(
      (activities || [])
        .map((a) => getActivityDayNumber(a, dateToDayMap))
        .filter((d) => d != null),
    ),
  ]
  return numericDaysFromActs.length > 0
    ? [...new Set([...chronologicalDays, ...numericDaysFromActs])].sort((a, b) => a - b)
    : chronologicalDays
}

function resolveEffectiveSelectedDay(selectedDay, days) {
  return days.includes(selectedDay) ? selectedDay : (days[0] ?? 1)
}

function focusStopTitleField(stopId, cardRoot) {
  const tryFocus = () => {
    const byId = document.getElementById(`activity-title-ac-${stopId}`)
    if (byId && typeof byId.focus === 'function') {
      byId.focus()
      return true
    }
    const scoped =
      cardRoot?.querySelector?.('input, textarea, gmp-place-autocomplete, [role="combobox"]') ??
      null
    if (scoped && typeof scoped.focus === 'function') {
      scoped.focus()
      return true
    }
    return false
  }
  requestAnimationFrame(() => {
    tryFocus()
    setTimeout(tryFocus, 80)
  })
}

/** Contagens por dia vindas da API ({ "1": 4 }); aceita também snake_case (`total_by_day`). */
function getPremiumDayTotals(restriction, dayNum) {
  if (
    restriction == null ||
    dayNum == null ||
    !Number.isFinite(Number(dayNum))
  ) {
    return null
  }
  const tb = restriction.totalByDay ?? restriction.total_by_day ?? null
  const vb = restriction.visibleByDay ?? restriction.visible_by_day ?? null

  if (tb == null || vb == null) return null
  if (typeof tb !== 'object' || typeof vb !== 'object') return null

  const dk = String(Math.floor(Number(dayNum)))
  const rawT =
    tb[dk] ?? tb[String(dk)] ?? tb[Number(dk)] ?? tb[`${Number(dk)}`]
  const rawV =
    vb[dk] ?? vb[String(dk)] ?? vb[Number(dk)] ?? vb[`${Number(dk)}`] ?? 0
  const totalOnDay =
    typeof rawT === 'number' && Number.isFinite(rawT) ? Math.floor(rawT) : Number(rawT) >= 1 ? Number(rawT) : 0
  const visibleOnDay =
    typeof rawV === 'number' && Number.isFinite(rawV)
      ? Math.floor(rawV)
      : typeof rawV === 'string'
        ? Number(rawV) || 0
        : 0
  return { totalOnDay, visibleOnDay }
}

/** Unifica camelCase/snake_case do `_premiumRestriction` da API */
function normalizedPremiumRestriction(r) {
  if (!r) return null
  return {
    ...r,
    totalByDay: r.totalByDay ?? r.total_by_day ?? null,
    visibleByDay: r.visibleByDay ?? r.visible_by_day ?? null,
  }
}

export function Itinerary() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { refreshUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const t = useT()
  const [trip, setTrip] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [mode, setMode] = useState(MODE_ROTEIRO)
  const [loading, setLoading] = useState(true)
  const [itineraryLoading, setItineraryLoading] = useState(true)
  const [error, setError] = useState(null)
  const [itineraryError, setItineraryError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const tripDestCity = trip?.destinations?.[0]?.city
  useDocumentTitle(tripDestCity ? `Roteiro · ${tripDestCity}` : 'Roteiro')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [finalizingTdv, setFinalizingTdv] = useState(() => Boolean(readFinalizeTdvSession(tripId)))
  const [finalizeError, setFinalizeError] = useState(null)
  /** Incrementado para (re)disparar o poll quando o POST cai por rede sem response. */
  const [finalizeResumeKey, setFinalizeResumeKey] = useState(0)
  const [roteiroEditOpen, setRoteiroEditOpen] = useState(false)
  const [draftActivities, setDraftActivities] = useState(null)
  const [savingRoteiro, setSavingRoteiro] = useState(false)
  const [mobileMapOpen, setMobileMapOpen] = useState(false)
  const [exportSheetOpen, setExportSheetOpen] = useState(false)
  const [showAccommodationRoutes, setShowAccommodationRoutes] = useState(
    () => readShowAccommodationRoutesPreference(),
  )
  const [showMealsOnMap, setShowMealsOnMap] = useState(() => readShowMealsOnMapPreference())
  /** @type {[Record<string, string>, Function]} slotKey → activityId selecionado */
  const [mealSelections, setMealSelections] = useState({})
  const [highlightedMealSlotKey, setHighlightedMealSlotKey] = useState(null)
  const [expandedMealSlotKey, setExpandedMealSlotKey] = useState(null)
  const [stayEditor, setStayEditor] = useState(null)
  const [staySaving, setStaySaving] = useState(false)
  const [stayEditorError, setStayEditorError] = useState(null)
  const [stayToast, setStayToast] = useState(null)
  const [reorganizePrompt, setReorganizePrompt] = useState(null)
  const [reorganizingStay, setReorganizingStay] = useState(false)
  const [trackedStopId, setTrackedStopId] = useState(null)
  const [tdvOverlayOpen, setTdvOverlayOpen] = useState(false)
  const [tdvOverlayAnimIn, setTdvOverlayAnimIn] = useState(false)
  /** Monta o TinderView depois do 1º frame do slide — evita engasgo no arranque. */
  const [tdvOverlayContentReady, setTdvOverlayContentReady] = useState(false)
  /** Destino da aba ao fechar o overlay (pill muda na hora; mode/conteúdo após a animação). */
  const [tdvOverlayExitTo, setTdvOverlayExitTo] = useState(null)
  const [tdvLockHint, setTdvLockHint] = useState(null)
  const [isLgUp, setIsLgUp] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  )
  const deleteInFlightRef = useRef(false)
  const finalizeInFlightRef = useRef(false)
  const tdvOverlayCloseTimerRef = useRef(null)
  const tdvOverlayContentTimerRef = useRef(null)
  const tdvOverlayPanelRef = useRef(null)
  const tdvOverlayOpenRef = useRef(false)
  const stopCardRefs = useRef(new Map())
  const dayChipRefs = useRef(new Map())
  const dayChipsScrollRef = useRef(null)
  const roteiroListScrollRef = useRef(null)
  const roteiroCardsListRef = useRef(null)
  const likeInsertZoneRef = useRef(null)
  const flipBeforeReorderRef = useRef(null)
  const reorderFrozenLayoutRef = useRef(null)
  const [, setReorderLayoutEpoch] = useState(0)
  const trackedFollowRef = useRef({ id: null, reason: null })
  const mealSlotHeaderRefs = useRef(new Map())

  const scrollMealSlotHeaderIntoView = useCallback((slotKey) => {
    const key = String(slotKey)
    const headerEl = mealSlotHeaderRefs.current.get(key)
    const container = roteiroListScrollRef.current
    scrollElementToContainerTopAfterLayout(headerEl, container, 10)
  }, [])

  const handleShowAccommodationRoutesChange = useCallback((next) => {
    setShowAccommodationRoutes(next)
    writeShowAccommodationRoutesPreference(next)
  }, [])

  const handleShowMealsOnMapChange = useCallback((next) => {
    setShowMealsOnMap(next)
    writeShowMealsOnMapPreference(next)
  }, [])

  useEffect(() => {
    if (tripId) writeMealSelectionsPreference(tripId, mealSelections)
  }, [tripId, mealSelections])

  useEffect(() => {
    setHighlightedMealSlotKey(null)
    setExpandedMealSlotKey(null)
  }, [selectedDay])

  const handleMealHighlight = useCallback((slotKey) => {
    setHighlightedMealSlotKey(String(slotKey))
  }, [])

  const handleMealGoToTimeline = useCallback(
    (slotKey) => {
      const key = String(slotKey)
      setHighlightedMealSlotKey(key)
      setExpandedMealSlotKey(key)

      const scrollToSlot = () => {
        scrollMealSlotHeaderIntoView(key)
      }

      if (!isLgUp) {
        setMobileMapOpen(false)
        window.setTimeout(scrollToSlot, 520)
      } else {
        scrollToSlot()
      }
    },
    [isLgUp, scrollMealSlotHeaderIntoView],
  )

  const handleMealMapPinClick = useCallback(
    (slotKey) => {
      handleMealHighlight(slotKey)
      if (isLgUp) {
        scrollMealSlotHeaderIntoView(slotKey)
      }
    },
    [handleMealHighlight, isLgUp, scrollMealSlotHeaderIntoView],
  )

  const handleMealViewOnMap = useCallback((slotKey) => {
    handleMealHighlight(slotKey)
    setMobileMapOpen(true)
  }, [handleMealHighlight])

  const handleMealDismiss = useCallback(() => {
    setHighlightedMealSlotKey(null)
  }, [])

  const handleMealSelect = useCallback((slotKey, activityId) => {
    setMealSelections((prev) => {
      const next = { ...prev }
      if (!activityId || next[slotKey] === activityId) {
        delete next[slotKey]
      } else {
        next[slotKey] = activityId
      }
      return next
    })
    setHighlightedMealSlotKey(String(slotKey))
  }, [])

  const handleMealViewOptions = useCallback(
    (slotKey) => {
      handleMealGoToTimeline(slotKey)
    },
    [handleMealGoToTimeline],
  )

  useEffect(() => {
    if (!stayToast) return undefined
    const timer = setTimeout(() => setStayToast(null), 4200)
    return () => clearTimeout(timer)
  }, [stayToast])

  const isPlanning = trip?.status === 'planejando'
  const hasFullAccess = hasItineraryFullAccess(itinerary, trip)
  const tdvTabLocked = Boolean(trip) && !isPlanning && !hasFullAccess
  const tdvAsOverlay = Boolean(trip) && !isPlanning && hasFullAccess
  const tdvUiActive = (isPlanning && mode === MODE_TDV) || tdvOverlayOpen

  const persistAccommodations = useCallback(
    async (nextAccs, { promptReorganize = false, stayName = '', toast } = {}) => {
      setStaySaving(true)
      setStayEditorError(null)
      try {
        const updated = await tripService.updateTrip(tripId, { accommodations: nextAccs })
        setTrip(updated)
        clearItineraryRouteCache(tripId)
        if ((nextAccs || []).length > 0) {
          handleShowAccommodationRoutesChange(true)
        }
        setStayEditor(null)
        setStayToast(toast || 'Hospedagens atualizadas.')
        if (promptReorganize) {
          setReorganizePrompt({ name: stayName || '' })
        }
      } catch (err) {
        setStayEditorError(
          err.response?.data?.error?.message || 'Não foi possível salvar a hospedagem',
        )
      } finally {
        setStaySaving(false)
      }
    },
    [tripId, handleShowAccommodationRoutesChange],
  )

  const handleReorganizeStay = useCallback(async () => {
    setReorganizePrompt(null)
    setReorganizingStay(true)
    try {
      let data = await tripService.optimizeItinerary(tripId)
      if (isOptimizerPending(data)) {
        data = await pollItineraryUntilOptimizerReady(
          tripId,
          (id, opts) => tripService.getItinerary(id, opts),
          { retryOptimize: (id) => tripService.optimizeItinerary(id) },
        )
      }
      if (data) setItinerary(data)
      clearItineraryRouteCache(tripId)
      const tripData = await tripService.getTrip(tripId)
      if (tripData) setTrip(tripData)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Não foi possível reorganizar o roteiro')
    } finally {
      setReorganizingStay(false)
    }
  }, [tripId])

  const handleReoptimizeItinerary = handleReorganizeStay

  const handleDeletePlanning = async () => {
    if (deleteInFlightRef.current) return
    deleteInFlightRef.current = true
    try {
      setDeleting(true)
      await tripService.deleteTrip(tripId)
      navigate('/trips', { replace: true })
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erro ao apagar planejamento')
    } finally {
      deleteInFlightRef.current = false
      setDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const refetchTimeoutRef = useRef(null)
  const itineraryActsSigRef = useRef('')
  const refetchItineraryImmediate = useCallback(async (options = {}) => {
    if (!tripId) return null
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current)
      refetchTimeoutRef.current = null
    }
    try {
      const itineraryData = await tripService.getItinerary(tripId, {
        refresh: true,
        signal: options.signal,
      })
      const nextSig = itineraryActivitiesSignature(itineraryData)
      if (nextSig !== itineraryActsSigRef.current) {
        clearItineraryRouteCache(tripId)
        itineraryActsSigRef.current = nextSig
      }
      setItinerary(itineraryData)
      setItineraryError(null)
      return itineraryData
    } catch (err) {
      if (isRequestAbort(err)) return null
      setItineraryError(itineraryLoadErrorMessage(err))
      return null
    }
  }, [tripId])
  const refetchItinerary = useCallback(() => {
    if (!tripId) return
    if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current)
    refetchTimeoutRef.current = setTimeout(refetchItineraryImmediate, 400)
  }, [tripId, refetchItineraryImmediate])

  const retryItineraryLoad = useCallback(async () => {
    setItineraryError(null)
    setItineraryLoading(true)
    try {
      await refetchItineraryImmediate()
    } finally {
      setItineraryLoading(false)
    }
  }, [refetchItineraryImmediate])

  useEffect(() => {
    if (!tripId) return
    const ac = new AbortController()
    ;(async () => {
      setError(null)
      setItineraryError(null)
      setLoading(true)
      setItineraryLoading(true)

      const tripPromise = tripService.getTrip(tripId, { signal: ac.signal })
      const itineraryPromise = tripService.getItinerary(tripId, {
        refresh: true,
        signal: ac.signal,
      })

      try {
        const tripData = await tripPromise
        if (ac.signal.aborted) return
        setTrip(tripData)
      } catch (err) {
        if (ac.signal.aborted || isRequestAbort(err)) return
        setError(err.response?.data?.error?.message || 'Erro ao carregar roteiro')
        setTrip(null)
      } finally {
        if (!ac.signal.aborted) setLoading(false)
      }

      try {
        const itineraryData = await itineraryPromise
        if (ac.signal.aborted) return
        itineraryActsSigRef.current = itineraryActivitiesSignature(itineraryData)
        setItinerary(itineraryData)
        setItineraryError(null)
      } catch (err) {
        if (ac.signal.aborted || isRequestAbort(err)) return
        setItineraryError(itineraryLoadErrorMessage(err))
      } finally {
        if (!ac.signal.aborted) setItineraryLoading(false)
      }
    })()
    return () => {
      ac.abort()
    }
  }, [tripId])

  useEffect(() => {
    // Em planejamento, TDV é aba irmã. Pós-gerar sem unlock, força sair do mode TDV.
    // Pós-unlock usa overlay (`tdvOverlayOpen`), não MODE_TDV.
    if (!isPlanning && mode === MODE_TDV) {
      setMode(MODE_ROTEIRO)
    }
  }, [isPlanning, mode])

  useLayoutEffect(() => {
    tdvOverlayOpenRef.current = tdvOverlayOpen
    if (tdvOverlayContentTimerRef.current) {
      clearTimeout(tdvOverlayContentTimerRef.current)
      tdvOverlayContentTimerRef.current = null
    }
    if (!tdvOverlayOpen) {
      setTdvOverlayAnimIn(false)
      setTdvOverlayContentReady(false)
      return undefined
    }
    // Shell leve primeiro; conteúdo pesado depois do slide começar.
    setTdvOverlayAnimIn(false)
    setTdvOverlayContentReady(false)
    const panel = tdvOverlayPanelRef.current
    if (panel) {
      panel.style.willChange = 'transform'
      void panel.offsetHeight
    }
    const id = requestAnimationFrame(() => {
      setTdvOverlayAnimIn(true)
      tdvOverlayContentTimerRef.current = setTimeout(() => {
        setTdvOverlayContentReady(true)
        tdvOverlayContentTimerRef.current = null
      }, 64)
    })
    return () => {
      cancelAnimationFrame(id)
      if (tdvOverlayContentTimerRef.current) {
        clearTimeout(tdvOverlayContentTimerRef.current)
        tdvOverlayContentTimerRef.current = null
      }
    }
  }, [tdvOverlayOpen])

  useEffect(() => {
    return () => {
      if (tdvOverlayCloseTimerRef.current) clearTimeout(tdvOverlayCloseTimerRef.current)
      if (tdvOverlayContentTimerRef.current) clearTimeout(tdvOverlayContentTimerRef.current)
    }
  }, [])

  // Mobile TDV: trava scroll do Layout e remove padding — card fica entre abas e MobileNav
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return undefined

    const mq = window.matchMedia('(max-width: 1023px)')
    const sync = () => {
      if (tdvUiActive && mq.matches) main.classList.add('tdv-mobile-lock')
      else main.classList.remove('tdv-mobile-lock')
    }
    sync()
    mq.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      main.classList.remove('tdv-mobile-lock')
    }
  }, [tdvUiActive])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsLgUp(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const unlockedFlag = searchParams.get('unlocked')
  const tdvTabFlag = searchParams.get('tab')

  useEffect(() => {
    if (unlockedFlag !== '1' || !tripId) return
    let cancelled = false
    ;(async () => {
      await refreshUser().catch(() => null)
      const tripData = await tripService.getTrip(tripId).catch(() => null)
      if (cancelled) return
      if (tripData) setTrip(tripData)
      await refetchItineraryImmediate()
      if (cancelled) return
      // Remove só `unlocked` via updater — evita loop se searchParams oscilar.
      setSearchParams(
        (prev) => {
          if (prev.get('unlocked') !== '1') return prev
          const next = new URLSearchParams(prev)
          next.delete('unlocked')
          return next
        },
        { replace: true }
      )
    })()
    return () => {
      cancelled = true
    }
  }, [tripId, unlockedFlag, refetchItineraryImmediate, refreshUser, setSearchParams])

  /** Deep link: abrir TDV em planejamento (aba) ou pós-unlock (overlay). */
  useEffect(() => {
    if (tdvTabFlag !== 'tdv' || !trip) return

    const clearTabParam = () => {
      setSearchParams(
        (prev) => {
          if (prev.get('tab') !== 'tdv') return prev
          const next = new URLSearchParams(prev)
          next.delete('tab')
          return next
        },
        { replace: true },
      )
    }

    if (trip.status === 'planejando') {
      setMode(MODE_TDV)
      clearTabParam()
      return
    }

    // Pós-gerar: só abre overlay quando o unlock já refletiu no trip/itinerary
    // (evita apagar ?tab=tdv na corrida com ?unlocked=1).
    const unlocked =
      unlockedFlag === '1' ||
      hasItineraryFullAccess(itinerary, trip) ||
      Boolean(trip.planning_unlocked_at || trip.planningUnlockedAt)

    if (!unlocked) return

    setMode(MODE_ROTEIRO)
    setTdvOverlayOpen(true)
    clearTabParam()
  }, [
    trip?.id,
    trip?.status,
    trip?.planning_unlocked_at,
    trip?.planningUnlockedAt,
    tdvTabFlag,
    unlockedFlag,
    setSearchParams,
    trip,
    itinerary,
  ])

  const handleAdminUnlock = async () => {
    if (!tripId) return
    try {
      const activated = await userService.activatePlanningAdmin(tripId)
      if (activated?.trip) {
        setTrip((prev) => (prev ? { ...prev, ...activated.trip } : activated.trip))
      }
      const data = await refetchItineraryImmediate()
      if (data?.activities?.[0]?.day != null) {
        const d = Number(data.activities[0].day)
        setSelectedDay(Number.isFinite(d) && d >= 1 ? d : data.activities[0].day)
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Não foi possível ativar o planejamento.')
    }
  }

  const applyFinalizeSuccess = useCallback(
    (tripData, itineraryData) => {
      clearFinalizeTdvSession(tripId)
      if (tripData) setTrip(tripData)
      if (itineraryData) {
        clearItineraryRouteCache(tripId)
        setItinerary(itineraryData)
        const firstDay = itineraryData?.activities?.[0]?.day
        if (firstDay != null && firstDay !== '') {
          const asNum = Number(firstDay)
          setSelectedDay(Number.isFinite(asNum) && asNum >= 1 ? asNum : firstDay)
        }
      }
      setMode(MODE_ROTEIRO)
      setFinalizeError(null)
      finalizeInFlightRef.current = false
      setFinalizingTdv(false)
    },
    [tripId],
  )

  const handleFinalizeTdv = useCallback(async () => {
    if (!tripId || finalizeInFlightRef.current) return
    finalizeInFlightRef.current = true
    setShowDeleteConfirm(false)
    markFinalizeTdvSession(tripId)
    setFinalizingTdv(true)
    setFinalizeError(null)
    try {
      const result = await tripService.finalizeTdvPlanning(tripId)
      let itineraryData = result?.itinerary || (await tripService.getItinerary(tripId))
      if (isOptimizerPending(itineraryData) || result?.optimizerPending) {
        itineraryData = await pollItineraryUntilOptimizerReady(
          tripId,
          (id, opts) => tripService.getItinerary(id, opts),
          {
            retryOptimize: (id) => tripService.optimizeItinerary(id),
            intervalMs: 4000,
            expectOptimization: true,
          },
        )
      }
      applyFinalizeSuccess(result?.trip, itineraryData)
    } catch (err) {
      // Abort/rede sem response (ex.: refresh): mantém session para retomar overlay + poll.
      if (isFinalizeRequestAbort(err) || !err.response) {
        finalizeInFlightRef.current = false
        setFinalizeResumeKey((k) => k + 1)
        return
      }
      clearFinalizeTdvSession(tripId)
      setFinalizeError(
        err.response?.data?.error?.message || 'Não foi possível finalizar o TDV',
      )
      finalizeInFlightRef.current = false
      setFinalizingTdv(false)
    }
  }, [tripId, applyFinalizeSuccess])

  const requestFinalizeTdv = useCallback(() => {
    if (!hasFullAccess) {
      const ok = globalThis.confirm?.(t('tdv.lock_warn_body'))
      if (!ok) return
    }
    handleFinalizeTdv()
  }, [hasFullAccess, handleFinalizeTdv, t])

  const closeTdvOverlay = useCallback((exitTo = 'roteiro', options = {}) => {
    if (!tdvOverlayOpenRef.current) return
    const target = exitTo === 'documentos' ? 'documentos' : 'roteiro'
    const skipFollowUp = Boolean(options?.skipFollowUp)
    // 1º: começa o slide (CSS). 2º frame: chrome/pill — evita pico de layout no arranque.
    setTdvOverlayAnimIn(false)
    setTdvOverlayContentReady(false)
    const panel = tdvOverlayPanelRef.current
    if (panel) panel.style.willChange = 'transform'
    requestAnimationFrame(() => {
      setTdvOverlayExitTo(skipFollowUp ? null : target)
    })
    if (tdvOverlayCloseTimerRef.current) clearTimeout(tdvOverlayCloseTimerRef.current)
    tdvOverlayCloseTimerRef.current = setTimeout(() => {
      setTdvOverlayOpen(false)
      setTdvOverlayExitTo(null)
      tdvOverlayCloseTimerRef.current = null
      if (panel) panel.style.willChange = ''
      if (skipFollowUp) return
      if (target === 'documentos') {
        setMode(MODE_DOCUMENTOS)
      } else {
        setMode(MODE_ROTEIRO)
        if (!isPlanning) refetchItineraryImmediate()
      }
    }, TDV_OVERLAY_MS)
  }, [isPlanning, refetchItineraryImmediate])

  const openTdvOverlay = useCallback(() => {
    if (tdvOverlayCloseTimerRef.current) {
      clearTimeout(tdvOverlayCloseTimerRef.current)
      tdvOverlayCloseTimerRef.current = null
    }
    if (tdvOverlayContentTimerRef.current) {
      clearTimeout(tdvOverlayContentTimerRef.current)
      tdvOverlayContentTimerRef.current = null
    }
    setTdvOverlayExitTo(null)
    setTdvOverlayContentReady(false)
    setTdvOverlayAnimIn(false)
    setTdvOverlayOpen(true)
  }, [])

  /**
   * Pós-refresh: o POST original não existe mais no browser, mas o backend pode
   * ainda estar gerando. Observa até status `ativa` ou deadline da session.
   */
  useEffect(() => {
    if (!tripId || loading || !trip) return
    const session = readFinalizeTdvSession(tripId)
    if (!session) return

    if (trip.status === 'ativa') {
      let cancelled = false
      ;(async () => {
        try {
          let itineraryData =
            itinerary || (await tripService.getItinerary(tripId, { refresh: true }))
          if (isOptimizerPending(itineraryData)) {
            itineraryData = await pollItineraryUntilOptimizerReady(
              tripId,
              (id, opts) => tripService.getItinerary(id, opts),
              {
                retryOptimize: (id) => tripService.optimizeItinerary(id),
                intervalMs: 4000,
                expectOptimization: true,
              },
            )
          }
          if (cancelled) return
          applyFinalizeSuccess(trip, itineraryData)
        } catch {
          if (!cancelled) {
            clearFinalizeTdvSession(tripId)
            setFinalizingTdv(false)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    }

    // POST ainda em voo nesta montagem — não duplicar com poll.
    if (finalizeInFlightRef.current) return

    let cancelled = false
    setFinalizingTdv(true)

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    ;(async () => {
      while (!cancelled) {
        const deadline = finalizeTdvSessionDeadline(session)
        const remaining = deadline - Date.now()
        if (remaining <= 0) {
          clearFinalizeTdvSession(tripId)
          setFinalizingTdv(false)
          setFinalizeError(
            'A geração está demorando mais do que o esperado. Atualize a página ou tente gerar novamente.',
          )
          return
        }
        try {
          const tripData = await tripService.getTrip(tripId)
          if (cancelled) return
          if (tripData?.status === 'ativa') {
            let itineraryData = await tripService.getItinerary(tripId, { refresh: true })
            if (isOptimizerPending(itineraryData)) {
              itineraryData = await pollItineraryUntilOptimizerReady(
                tripId,
                (id, opts) => tripService.getItinerary(id, opts),
                {
                  retryOptimize: (id) => tripService.optimizeItinerary(id),
                  intervalMs: 4000,
                  expectOptimization: true,
                },
              )
            }
            if (cancelled) return
            applyFinalizeSuccess(tripData, itineraryData)
            return
          }
        } catch {
          /* mantém poll */
        }
        await sleep(Math.min(2500, Math.max(500, remaining)))
      }
    })()

    return () => {
      cancelled = true
    }
    // itinerary só como cache no atalho `ativa`; poll é guiado por session + status.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, trip, loading, applyFinalizeSuccess, finalizeResumeKey])

  const dateToDayMap = useMemo(() => buildDateToDayMap(trip), [trip])

  useEffect(() => {
    if (!tripId) {
      setMealSelections({})
      return
    }
    const acts = itinerary?.activities
    if (!Array.isArray(acts) || acts.length === 0) {
      setMealSelections(readMealSelectionsPreference(tripId))
      return
    }
    const stored = readMealSelectionsPreference(tripId)
    setMealSelections(mergeMealSelections(stored, acts, dateToDayMap))
  }, [tripId, itinerary?.activities, dateToDayMap])

  const likeReplace = useRoteiroLikeReplace({
    dateToDayMap,
    selectedDay,
  })

  const dragListContext = useMemo(() => {
    const acts =
      roteiroEditOpen && Array.isArray(draftActivities)
        ? draftActivities
        : likeReplace.open && Array.isArray(likeReplace.draftActivities)
          ? likeReplace.draftActivities
          : itinerary?.activities || []
    const tripDayCount = getTripDayCount(trip)
    const chronologicalDays = Array.from({ length: tripDayCount }, (_, i) => i + 1)
    const numericDaysFromActs = [
      ...new Set(
        acts.map((a) => getActivityDayNumber(a, dateToDayMap)).filter((d) => d != null),
      ),
    ]
    const days =
      numericDaysFromActs.length > 0
        ? [...new Set([...chronologicalDays, ...numericDaysFromActs])].sort((a, b) => a - b)
        : chronologicalDays
    const effectiveDay = days.includes(selectedDay) ? selectedDay : (days[0] ?? 1)
    const dayActs = sortDayActivities(
      acts.filter((a) => getActivityDayNumber(a, dateToDayMap) === effectiveDay),
    )
    return { dayNum: effectiveDay, dayActivities: dayActs }
  }, [
    roteiroEditOpen,
    draftActivities,
    likeReplace.open,
    likeReplace.draftActivities,
    itinerary,
    trip,
    selectedDay,
    dateToDayMap,
  ])

  const likeDragDayActivityIds = useMemo(
    () => filterRouteActivities(dragListContext.dayActivities).map((a) => String(a.id)),
    [dragListContext.dayActivities],
  )

  const handleLikeDropSwap = useCallback(
    (like, activityId) => {
      likeReplace.swapLikeWithActivity(like, activityId)
    },
    [likeReplace.swapLikeWithActivity],
  )

  const handleLikeDropInsert = useCallback(
    (like) => {
      likeReplace.insertLike(like)
    },
    [likeReplace.insertLike],
  )

  const likeDrag = useRoteiroLikeDrag({
    enabled: likeReplace.open && !loading && !likeReplace.saving,
    availableLikes: likeReplace.availableLikes,
    dayActivityIds: likeDragDayActivityIds,
    rowCardRefs: likeReplace.rowCardRefs,
    insertZoneRef: likeInsertZoneRef,
    scrollRef: roteiroListScrollRef,
    onDropSwap: handleLikeDropSwap,
    onDropInsert: handleLikeDropInsert,
    onTapLike: likeReplace.selectLike,
  })

  const dragReorder = useRoteiroDragReorder({
    enabled: roteiroEditOpen && !loading && Boolean(trip),
    dayActivities: filterRouteActivities(dragListContext.dayActivities),
    dateToDayMap,
    dayNum: dragListContext.dayNum,
    setDraftActivities,
    scrollRef: roteiroListScrollRef,
    listRef: roteiroCardsListRef,
    itemRefs: stopCardRefs,
  })

  const dragReorderCancelRef = useRef(dragReorder.cancelDrag)
  dragReorderCancelRef.current = dragReorder.cancelDrag
  const dragInteractionBlockedRef = useRef(dragReorder.isInteractionBlocked)
  dragInteractionBlockedRef.current = dragReorder.isInteractionBlocked
  const daySwapCancelRef = useRef(null)

  const handleSelectDay = useCallback((day) => {
    dragReorderCancelRef.current?.()
    daySwapCancelRef.current?.()
    trackedFollowRef.current = { id: null, reason: null }
    setSelectedDay(day)
  }, [])

  const handleDaySwap = useCallback(
    (fromDay, toDay) => {
      setDraftActivities((prev) => {
        if (!prev) return prev
        return swapActivitiesBetweenDays(prev, dateToDayMap, fromDay, toDay)
      })
      setSelectedDay(toDay)
    },
    [dateToDayMap],
  )

  const daysForSwap = useMemo(() => {
    const acts =
      roteiroEditOpen && Array.isArray(draftActivities)
        ? draftActivities
        : likeReplace.open && Array.isArray(likeReplace.draftActivities)
          ? likeReplace.draftActivities
          : itinerary?.activities || []
    return computeDaysList(acts, dateToDayMap, trip)
  }, [
    roteiroEditOpen,
    draftActivities,
    likeReplace.open,
    likeReplace.draftActivities,
    itinerary,
    trip,
    dateToDayMap,
  ])

  const daySwap = useRoteiroDaySwap({
    enabled: roteiroEditOpen && !loading && Boolean(trip) && hasFullAccess,
    days: daysForSwap,
    selectedDay,
    chipRefs: dayChipRefs,
    scrollRef: dayChipsScrollRef,
    onSwap: handleDaySwap,
    onSelectDay: handleSelectDay,
    onFocusSwapDay: (day) => {
      trackedFollowRef.current = { id: null, reason: null }
      setSelectedDay(day)
    },
    onSwapGestureStart: () => {
      dragReorderCancelRef.current?.()
    },
  })
  daySwapCancelRef.current = daySwap.cancelSwap

  const onActivityDragHandlePointerDown = useCallback(
    (activityId, event) => {
      daySwapCancelRef.current?.()
      dragReorder.onDragHandlePointerDown(activityId, event)
    },
    [dragReorder],
  )

  const onDayChipPointerDown = useCallback(
    (day, event) => {
      if (dragReorder.phase !== 'idle') {
        dragReorderCancelRef.current?.()
      }
      daySwap.onChipPointerDown(day, event)
    },
    [dragReorder.phase, daySwap],
  )

  useEffect(() => {
    setRoteiroEditOpen(false)
    setDraftActivities(null)
    setTrackedStopId(null)
    stopCardRefs.current.clear()
    dayChipRefs.current.clear()
    trackedFollowRef.current = { id: null, reason: null }
  }, [tripId])

  const blockNewRoteiroStop = useMemo(() => {
    if (!trackedStopId || !Array.isArray(draftActivities)) return false
    const act = draftActivities.find((a) => String(a.id) === String(trackedStopId))
    return act != null && isPendingNewStop(act)
  }, [trackedStopId, draftActivities])

  useLayoutEffect(() => {
    if (loading || !trip || !roteiroEditOpen || !trackedStopId || !Array.isArray(draftActivities)) return
    if (dragInteractionBlockedRef.current) return
    if (dragReorder.phase !== 'idle') return

    const act = draftActivities.find((a) => String(a.id) === String(trackedStopId))
    if (!act) {
      setTrackedStopId(null)
      trackedFollowRef.current = { id: null, reason: null }
      return
    }

    const follow = trackedFollowRef.current
    const followActive = String(follow.id) === String(trackedStopId)
    if (!followActive) return

    const stopDay = getActivityDayNumber(act, dateToDayMap) ?? selectedDay
    const days = computeDaysList(draftActivities, dateToDayMap, trip)
    const effectiveDay = resolveEffectiveSelectedDay(selectedDay, days)

    if (stopDay !== effectiveDay) {
      setSelectedDay(stopDay)
      return
    }

    const cardEl = stopCardRefs.current.get(String(trackedStopId))
    cardEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })

    if (follow.reason === 'create') {
      focusStopTitleField(trackedStopId, cardEl)
    }

    trackedFollowRef.current = { id: null, reason: null }
  }, [
    loading,
    trip,
    roteiroEditOpen,
    trackedStopId,
    draftActivities,
    selectedDay,
    dateToDayMap,
    dragReorder.phase,
  ])

  useLayoutEffect(() => {
    const payload = flipBeforeReorderRef.current
    if (!payload) return
    flipBeforeReorderRef.current = null

    playReorderSwapAnimation(
      stopCardRefs.current,
      payload.snapshot,
      {
        movedId: payload.movedId,
        neighborId: payload.neighborId,
        direction: payload.direction,
      },
      {
        scrollContainer: roteiroListScrollRef.current,
        moveMs: roteiroEditOpen ? 380 : 320,
        onComplete: () => {
          reorderFrozenLayoutRef.current = null
          setReorderLayoutEpoch((n) => n + 1)
        },
      },
    )
  }, [draftActivities, roteiroEditOpen])

  useEffect(() => {
    if (!trip) return
    const acts =
      roteiroEditOpen && Array.isArray(draftActivities)
        ? draftActivities
        : likeReplace.open && Array.isArray(likeReplace.draftActivities)
          ? likeReplace.draftActivities
          : itinerary?.activities || []
    const days = computeDaysList(acts, dateToDayMap, trip)
    if (!days.length) return
    setSelectedDay((prev) => (days.includes(prev) ? prev : days[0]))
  }, [
    trip,
    itinerary,
    dateToDayMap,
    roteiroEditOpen,
    draftActivities,
    likeReplace.open,
    likeReplace.draftActivities,
  ])

  useEffect(() => {
    setMobileMapOpen(false)
  }, [mode])

  if (loading && !trip) {
    return (
      <>
        {finalizingTdv ? null : <LoadingSpinner />}
        <FinalizeItineraryOverlay open={finalizingTdv} />
      </>
    )
  }
  if (error || !trip) {
    return (
      <>
        <div className="p-4">
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl">
            {error || 'Viagem não encontrada'}
          </div>
          <Link to="/trips">
            <Button variant="secondary" className="mt-4">
              Voltar
            </Button>
          </Link>
        </div>
        <FinalizeItineraryOverlay open={finalizingTdv} />
      </>
    )
  }

  const firstDest = trip.destinations?.[0]
  const destLabel = firstDest ? `${firstDest.city}, ${firstDest.country}` : 'Viagem'
  const persistedActivities = itinerary?.activities || []
  const activities =
    roteiroEditOpen && Array.isArray(draftActivities)
      ? draftActivities
      : likeReplace.open && Array.isArray(likeReplace.draftActivities)
        ? likeReplace.draftActivities
        : persistedActivities
  const premiumRestriction = itinerary?._premiumRestriction
    ? normalizedPremiumRestriction(itinerary._premiumRestriction)
    : null
  const tripDayCount = getTripDayCount(trip)
  const chronologicalDays = Array.from({ length: tripDayCount }, (_, i) => i + 1)
  const numericDaysFromActs = [
    ...new Set(
      activities
        .map((a) => getActivityDayNumber(a, dateToDayMap))
        .filter((d) => d != null)
    )
  ]
  const days =
    numericDaysFromActs.length > 0
      ? [...new Set([...chronologicalDays, ...numericDaysFromActs])].sort((a, b) => a - b)
      : chronologicalDays
  const effectiveSelectedDay = days.includes(selectedDay) ? selectedDay : (days[0] ?? 1)
  const dayActivities = sortDayActivities(
    activities.filter((a) => getActivityDayNumber(a, dateToDayMap) === effectiveSelectedDay)
  )
  const dayTimelineItems = buildDayTimelineItems(dayActivities)
  const dayRouteActivities = filterRouteActivities(dayActivities)
  const dayMealSlots = dayTimelineItems.filter((item) => item.type === 'mealSlot')
  const dayAccommodations = resolveAccommodationsForDay(trip, effectiveSelectedDay, dateToDayMap)
  const dayStays = resolveAccommodationsForDay(trip, effectiveSelectedDay, dateToDayMap, {
    plottableOnly: false,
  })
  const primaryStay = dayStays[0] ?? null
  const selectedDayIso = getIsoDateForDay(dateToDayMap, effectiveSelectedDay)
  const selectedDayDest = findDestinationCoveringIso(trip, selectedDayIso)
  const trackedMapIndex = trackedStopId
    ? dayRouteActivities.findIndex((a) => String(a.id) === String(trackedStopId))
    : -1
  const trackedMapHighlight = trackedMapIndex >= 0 ? trackedMapIndex : null

  const previewDayMapsReady = (() => {
    if (!premiumRestriction) return false
    const tb = premiumRestriction.totalByDay
    const vb = premiumRestriction.visibleByDay
    if (tb == null || vb == null) return false
    if (typeof tb !== 'object' || typeof vb !== 'object') return false
    return Object.keys(tb).length > 0 || Object.keys(vb).length > 0
  })()

  const selectedDayPremium =
    previewDayMapsReady && premiumRestriction ? getPremiumDayTotals(premiumRestriction, effectiveSelectedDay) : null

  const isSelectedDayPremiumLockedUi =
    !hasFullAccess &&
    Boolean(premiumRestriction) &&
    selectedDayPremium != null &&
    selectedDayPremium.totalOnDay > 0 &&
    selectedDayPremium.visibleOnDay === 0 &&
    !isPlanning

  const hiddenPremiumStopsSameDay =
    selectedDayPremium &&
    selectedDayPremium.visibleOnDay > 0 &&
    selectedDayPremium.totalOnDay > selectedDayPremium.visibleOnDay
      ? selectedDayPremium.totalOnDay - selectedDayPremium.visibleOnDay
      : 0

  const isRouteRestricted =
    !hasFullAccess && Boolean(premiumRestriction) && !isPlanning

  const showRoteiroSidebar = mode === MODE_ROTEIRO

  const roteiroEditAllowed =
    showRoteiroSidebar &&
    !isPlanning &&
    hasFullAccess &&
    persistedActivities.length > 0 &&
    !likeReplace.open

  const canEditStay = roteiroEditAllowed && !roteiroEditOpen
  const showStayAnchors =
    showRoteiroSidebar && !isPlanning && activities.length > 0 && !isSelectedDayPremiumLockedUi

  const openStayManager = (opts = {}) => {
    setStayEditorError(null)
    const intent = opts.intent || 'manage'
    setStayEditor({
      intent,
      focusStayId: opts.focusStayId || (intent === 'manage' ? primaryStay?.id : null),
    })
  }
  const canPrintItinerary =
    showRoteiroSidebar &&
    !isPlanning &&
    hasFullAccess &&
    !roteiroEditOpen &&
    !likeReplace.open &&
    persistedActivities.length > 0

  const handlePrintItinerary = () => {
    if (!hasFullAccess || roteiroEditOpen || likeReplace.open) return
    setExportSheetOpen(false)
    globalThis.print?.()
  }

  const handleCancelRoteiroEdit = () => {
    dragReorderCancelRef.current?.()
    daySwapCancelRef.current?.()
    setRoteiroEditOpen(false)
    setDraftActivities(null)
    setSavingRoteiro(false)
    setTrackedStopId(null)
    stopCardRefs.current.clear()
    reorderFrozenLayoutRef.current = null
    trackedFollowRef.current = { id: null, reason: null }
  }

  const handleStartRoteiroEdit = () => {
    setExportSheetOpen(false)
    if (likeReplace.open) likeReplace.cancel()
    closeTdvOverlay('roteiro', { skipFollowUp: true })
    setDraftActivities(ensureActivitiesHaveStableIds([...persistedActivities]))
    setRoteiroEditOpen(true)
    setError(null)
  }

  const handleSaveRoteiroDraft = async () => {
    if (!tripId || !draftActivities) return
    setSavingRoteiro(true)
    setError(null)
    try {
      const normalized = normalizeActivitiesForPersist(
        draftActivities,
        dateToDayMap,
        effectiveSelectedDay
      )
      const nextIt = await tripService.updateItinerary(tripId, { activities: normalized })
      clearItineraryRouteCache(tripId)
      setItinerary(nextIt)
      handleCancelRoteiroEdit()
    } catch (err) {
      setError(err.response?.body?.error?.message || err.response?.data?.error?.message || 'Não foi possível salvar o roteiro.')
    } finally {
      setSavingRoteiro(false)
    }
  }

  const handleStartModifyRoteiro = async (likesFromTdv) => {
    if (roteiroEditOpen) handleCancelRoteiroEdit()
    closeTdvOverlay('roteiro', { skipFollowUp: true })
    setMode(MODE_ROTEIRO)
    let likes = Array.isArray(likesFromTdv) ? likesFromTdv : []
    if (tripId) {
      try {
        const summary = await placeService.getTdvSummary(tripId)
        likes = mergeTdvLikeListsById(summary.likedPlaces || [], likes)
      } catch {
        /* mantém likes locais do TDV */
      }
    }
    likeReplace.start(ensureActivitiesHaveStableIds([...persistedActivities]), likes)
    setError(null)
  }

  const handleConcludeModifyRoteiro = async () => {
    if (!tripId || !likeReplace.draftActivities) return
    likeReplace.setSaving(true)
    setError(null)
    try {
      const normalized = normalizeActivitiesForPersist(
        likeReplace.draftActivities,
        dateToDayMap,
        effectiveSelectedDay,
      )
      const nextIt = await tripService.updateItinerary(tripId, { activities: normalized })
      clearItineraryRouteCache(tripId)
      setItinerary(nextIt)
      likeReplace.cancel()
    } catch (err) {
      setError(
        err.response?.body?.error?.message ||
          err.response?.data?.error?.message ||
          'Não foi possível salvar o roteiro.',
      )
    } finally {
      likeReplace.setSaving(false)
    }
  }

  const handleAddRoteiroStop = () => {
    if (blockNewRoteiroStop) return
    const nid = globalThis.crypto?.randomUUID?.() || `nv-${Date.now()}`
    const nextDay = Math.max(1, Math.floor(Number(effectiveSelectedDay) || 1))
    setDraftActivities((prev) => {
      const base = prev ?? ensureActivitiesHaveStableIds([...persistedActivities])
      return scheduleActivityInsertedAtEnd(base, dateToDayMap, nextDay, {
        id: nid,
        title: 'Nova parada',
        description: '',
        day: nextDay,
        dayNumber: nextDay,
        order: 999,
        ticketRequired: false,
        source: 'user_edit',
      })
    })
    setTrackedStopId(nid)
    trackedFollowRef.current = { id: nid, reason: 'create' }
    setRoteiroEditOpen(true)
    setError(null)
  }

  const guardedSwitchModeFromRoteiro = (nextMode) => {
    if (finalizingTdv) return
    if (likeReplace.open) {
      setTdvLockHint('Conclua ou cancele a modificação do roteiro antes de mudar de aba.')
      return
    }
    if (!roteiroEditOpen) {
      setMode(nextMode)
      return
    }
    if (
      typeof globalThis.confirm === 'function' &&
      globalThis.confirm('Tem alterações não salvas neste roteiro. Mudar mesmo assim e descartá-las?')
    ) {
      handleCancelRoteiroEdit()
      setMode(nextMode)
    }
  }

  const openTdvTab = () => {
    setTdvLockHint(null)
    if (finalizingTdv) return
    if (tdvTabLocked) {
      setTdvLockHint(t('tdv.lock_tab_hint'))
      return
    }
    if (likeReplace.open) {
      setTdvLockHint('Conclua ou cancele a modificação do roteiro antes de abrir o TDV.')
      return
    }
    if (tdvAsOverlay) {
      if (roteiroEditOpen) {
        if (
          !globalThis.confirm(
            'Tem alterações não salvas neste roteiro. Mudar mesmo assim e descartá-las?',
          )
        ) {
          return
        }
        handleCancelRoteiroEdit()
      }
      openTdvOverlay()
      return
    }
    guardedSwitchModeFromRoteiro(MODE_TDV)
  }

  const tdvTabActive = (isPlanning && mode === MODE_TDV) || (tdvAsOverlay && tdvOverlayOpen && !tdvOverlayExitTo)

  const activeModeTab =
    tdvOverlayExitTo === 'documentos'
      ? 'documentos'
      : tdvOverlayExitTo === 'roteiro'
        ? 'roteiro'
        : tdvTabActive
          ? 'tdv'
          : mode === MODE_DOCUMENTOS
            ? 'documentos'
            : mode === MODE_TDV
              ? 'tdv'
              : 'roteiro'

  const handleModeTabRoteiro = () => {
    if (finalizingTdv) return
    if (tdvAsOverlay && tdvOverlayOpen) {
      closeTdvOverlay('roteiro')
      return
    }
    setMode(MODE_ROTEIRO)
    if (!isPlanning) refetchItineraryImmediate()
  }

  const handleModeTabDocumentos = () => {
    if (finalizingTdv) return
    if (tdvAsOverlay && tdvOverlayOpen) {
      if (likeReplace.open) {
        setTdvLockHint('Conclua ou cancele a modificação do roteiro antes de mudar de aba.')
        return
      }
      if (roteiroEditOpen) {
        if (
          !globalThis.confirm(
            'Tem alterações não salvas neste roteiro. Mudar mesmo assim e descartá-las?',
          )
        ) {
          return
        }
        handleCancelRoteiroEdit()
      }
      closeTdvOverlay('documentos')
      return
    }
    guardedSwitchModeFromRoteiro(MODE_DOCUMENTOS)
  }

  const modeTabs = (
    <ItineraryModeTabs
      activeTab={activeModeTab}
      onRoteiro={handleModeTabRoteiro}
      onTdv={openTdvTab}
      onDocumentos={handleModeTabDocumentos}
      tdvLocked={tdvTabLocked}
      tdvLockTitle={t('tdv.lock_tab_hint')}
      finalizing={finalizingTdv}
      hasFullAccess={hasFullAccess}
      isPlanning={isPlanning}
      onDeletePlanning={() => setShowDeleteConfirm(true)}
    />
  )

  const planCompleteBadge = hasFullAccess && !isPlanning ? (
    <span
      className="inline-flex items-center shrink-0 gap-1 px-2 py-0.5 text-green-700 dark:text-green-400 bg-green-500/15 rounded-full"
      title="Plano completo"
      aria-label="Plano completo"
    >
      <Icon name="verified" className="text-sm" aria-hidden />
      <span className="text-[10px] font-bold uppercase tracking-wide">
        Plano completo
      </span>
    </span>
  ) : null

  const showOptimizerInsightsPopover =
    !isPlanning && !roteiroEditOpen && !likeReplace.open && Boolean(itinerary?.optimizer_meta)

  const modifyPanelSharedProps = {
    availableLikes: likeReplace.availableLikes,
    selectedLikeId: likeReplace.selectedLikeId,
    onSelectLike: likeReplace.selectLike,
    onInsert: likeReplace.insertSelectedLike,
    onConclude: handleConcludeModifyRoteiro,
    onCancel: likeReplace.cancel,
    saving: likeReplace.saving,
    likeMotion: likeReplace.likeMotion,
    registerLikeCardRef: likeReplace.registerLikeCardRef,
    draggingLikeId: likeDrag.draggingLikeId,
    pendingLikeId: likeDrag.pendingLikeId,
    onLikePointerDown: likeDrag.onLikePointerDown,
    shouldSuppressClick: likeDrag.shouldSuppressClick,
  }

  return (
    <>
    <div
      className={`print:hidden flex flex-col min-h-0 bg-background-light/50 dark:bg-background-dark/30 ${
        tdvUiActive
          ? // Mobile: preenche o main travado; pb reserva a MobileNav. Desktop: full-bleed.
            'flex h-full min-h-0 flex-1 flex-col overflow-hidden max-lg:pb-[var(--goofly-mobile-nav-height,0px)] lg:h-[100dvh] lg:-mx-12 lg:-my-8'
          : // Mesmo bleed do TDV (cancela lg:px-12 / lg:p-8) — sem coluna lateral nem barra inferior.
            'flex h-[calc(100vh-4rem)] min-h-0 flex-1 flex-col overflow-hidden -m-4 lg:h-[100dvh] lg:-mx-12 lg:-my-8'
      }`}
    >
      {/* Cabeçalho único — evita três colunas competindo por atenção */}
      <header
        className={`relative flex-shrink-0 min-w-0 z-40 border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-card-dark/95 backdrop-blur-md px-4 sm:px-6 ${
          tdvUiActive ? 'py-2 pb-1.5 lg:py-4 lg:pb-4' : 'py-3 sm:py-4'
        }`}
      >
        <div
          className={`flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-text-secondary overflow-x-auto no-scrollbar ${
            tdvUiActive ? 'mb-1 lg:mb-3' : 'mb-2 sm:mb-3'
          }`}
        >
          <span>Início</span>
          <Icon name="chevron_right" className="text-[10px] shrink-0" />
          <span>Roteiros</span>
          <Icon name="chevron_right" className="text-[10px] shrink-0" />
          <span className="text-[#1c1c0d] dark:text-white truncate">{destLabel}</span>
        </div>
        <div
          className={`flex flex-col lg:flex-row lg:items-center lg:justify-between ${
            tdvUiActive ? 'gap-1.5 lg:gap-3' : 'gap-3'
          }`}
        >
          <div className="min-w-0">
            <h1
              className={`font-black tracking-tight text-[#1c1c0d] dark:text-white leading-tight ${
                tdvUiActive ? 'text-xl lg:text-3xl' : 'text-xl sm:text-2xl lg:text-3xl'
              }`}
            >
              Criador de Roteiros
            </h1>
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">
              Rota otimizada · {destLabel}
              {!isPlanning && activities.length > 0 ? (
                <span className="text-text-secondary/80">
                  {' '}
                  · {activities.length} {activities.length === 1 ? 'parada' : 'paradas'}
                  {premiumRestriction?.total ? ` (${premiumRestriction.visible}/${premiumRestriction.total} visíveis)` : ''}
                </span>
              ) : null}
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-2 lg:justify-end">
            <div className="itinerary-header-mode-cluster">
              <div className="itinerary-header-tabs-row flex w-full min-w-0 items-center gap-2 lg:contents">
                <div className="itinerary-header-tabs min-w-0 flex-1 lg:flex-none">
                  {modeTabs}
                </div>
                {showOptimizerInsightsPopover ? (
                  <ItineraryOptimizerInsightsPopover
                    optimizerMeta={itinerary.optimizer_meta}
                    optimizationScore={itinerary.optimization_score}
                    onReoptimize={handleReoptimizeItinerary}
                    reoptimizing={reorganizingStay}
                    className="shrink-0 lg:hidden"
                    tabIndex={tdvOverlayOpen && !tdvOverlayExitTo ? -1 : undefined}
                  />
                ) : null}
              </div>
              <div
                className={`itinerary-header-actions ${
                  !tdvOverlayOpen || tdvOverlayExitTo ? 'itinerary-header-actions--open' : ''
                }`}
                aria-hidden={tdvOverlayOpen && !tdvOverlayExitTo ? true : undefined}
              >
                {planCompleteBadge}
                {roteiroEditAllowed ? (
                  !roteiroEditOpen ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-xl shrink-0 font-bold max-lg:gap-1 max-lg:px-2.5 max-lg:py-1.5 max-lg:text-xs"
                      onClick={handleStartRoteiroEdit}
                      type="button"
                      tabIndex={tdvOverlayOpen && !tdvOverlayExitTo ? -1 : undefined}
                      aria-label="Editar roteiro"
                      title="Editar roteiro"
                    >
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
                {!isPlanning && !hasFullAccess && activities.length > 0 ? (
                  <Link
                    to={`/pagamento?tripId=${encodeURIComponent(tripId)}`}
                    tabIndex={tdvOverlayOpen && !tdvOverlayExitTo ? -1 : undefined}
                    className="shrink-0"
                  >
                    <Button
                      size="sm"
                      className="rounded-xl shrink-0"
                      aria-label="Roteiro completo"
                      title="Roteiro completo"
                    >
                      <Icon name="workspace_premium" />
                      Roteiro completo
                    </Button>
                  </Link>
                ) : null}
                {isPlanning ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={finalizingTdv}
                    tabIndex={tdvOverlayOpen && !tdvOverlayExitTo ? -1 : undefined}
                    aria-label="Apagar planejamento"
                    title="Apagar planejamento"
                    className="hidden shrink-0 rounded-xl border border-red-200 bg-red-50 font-bold text-red-700 shadow-none hover:bg-red-100 dark:border-red-400/25 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15 lg:inline-flex"
                  >
                    <Icon name="delete" />
                    <span>Apagar</span>
                  </Button>
                ) : null}
                {canPrintItinerary ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl shrink-0 font-bold size-8 min-w-8 min-h-8 p-0 px-0 max-lg:ml-auto lg:size-auto lg:min-w-10 lg:min-h-10 lg:px-2.5"
                    onClick={() => setExportSheetOpen(true)}
                    type="button"
                    tabIndex={tdvOverlayOpen && !tdvOverlayExitTo ? -1 : undefined}
                    aria-label="Exportar"
                    title="Exportar"
                    aria-haspopup="dialog"
                    aria-expanded={exportSheetOpen}
                  >
                    <Icon name="ios_share" className="text-lg" />
                  </Button>
                ) : null}
                {showOptimizerInsightsPopover ? (
                  <ItineraryOptimizerInsightsPopover
                    optimizerMeta={itinerary.optimizer_meta}
                    optimizationScore={itinerary.optimization_score}
                    onReoptimize={handleReoptimizeItinerary}
                    reoptimizing={reorganizingStay}
                    className="hidden shrink-0 lg:inline-flex"
                    tabIndex={tdvOverlayOpen && !tdvOverlayExitTo ? -1 : undefined}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
        {showRoteiroSidebar ? (
          <div
            className={`itinerary-day-chips-slot ${
              !tdvOverlayOpen || tdvOverlayExitTo === 'roteiro'
                ? 'itinerary-day-chips-slot--open'
                : ''
            }`}
            aria-hidden={tdvOverlayOpen && tdvOverlayExitTo !== 'roteiro' ? true : undefined}
          >
            <div className="itinerary-day-chips-slot__inner">
              <div className="mt-2 min-w-0 overflow-hidden pt-1 pb-1 sm:mt-3 sm:pt-3 sm:pb-3.5 border-t border-border-light dark:border-white/10">
                <ItineraryDayChips
                  days={days}
                  selectedDay={effectiveSelectedDay}
                  onSelectDay={handleSelectDay}
                  swapEnabled={roteiroEditOpen && hasFullAccess && !loading && !likeReplace.open}
                  daySwap={{
                    phase: daySwap.phase,
                    isSwapMode: daySwap.isSwapMode,
                    isDragging: daySwap.isDragging,
                    draggingDay: daySwap.draggingDay,
                    pendingDay: daySwap.pendingDay,
                    targetDay: daySwap.targetDay,
                    ghostStyle: daySwap.ghostStyle,
                    focusReady: daySwap.focusReady,
                    onChipPointerDown: onDayChipPointerDown,
                    chipRefs: dayChipRefs,
                    scrollRef: dayChipsScrollRef,
                  }}
                  getDayState={(day) => {
                    const peek =
                      previewDayMapsReady && premiumRestriction && !hasFullAccess && !isPlanning
                        ? getPremiumDayTotals(premiumRestriction, day)
                        : null
                    const dayLockedPremium =
                      previewDayMapsReady && peek?.totalOnDay > 0 && peek.visibleOnDay === 0
                    const dayPartialPremium =
                      previewDayMapsReady &&
                      peek != null &&
                      peek.totalOnDay > 0 &&
                      peek.visibleOnDay > 0 &&
                      peek.totalOnDay > peek.visibleOnDay
                    return {
                      dayLockedPremium,
                      dayPartialPremium,
                      isActive: effectiveSelectedDay === day,
                    }
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </header>

      {tdvLockHint ? (
        <div
          className="flex-shrink-0 px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/25 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2"
          role="status"
        >
          <Icon name="lock" className="text-base shrink-0 mt-0.5" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{tdvLockHint}</p>
          <button
            type="button"
            onClick={() => setTdvLockHint(null)}
            className="shrink-0 p-0.5 rounded-md hover:bg-amber-500/15"
            aria-label="Fechar aviso"
          >
            <Icon name="close" className="text-base" />
          </button>
        </div>
      ) : null}

      {itineraryError ? (
        <div
          className="flex-shrink-0 px-4 sm:px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/25 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2"
          role="alert"
        >
          <Icon name="wifi_off" className="text-base shrink-0 mt-0.5" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{itineraryError}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="shrink-0 rounded-lg font-bold"
            onClick={retryItineraryLoad}
            disabled={itineraryLoading}
          >
            Tentar de novo
          </Button>
        </div>
      ) : null}

      {finalizeError ? (
        <div
          className="flex-shrink-0 px-4 sm:px-6 py-2.5 bg-red-500/10 border-b border-red-500/25 text-red-700 dark:text-red-400 text-sm flex items-start gap-2"
          role="alert"
        >
          <Icon name="error" className="text-base shrink-0 mt-0.5" aria-hidden />
          <p className="min-w-0 flex-1 leading-snug">{finalizeError}</p>
          <button
            type="button"
            onClick={() => setFinalizeError(null)}
            className="shrink-0 p-0.5 rounded-md hover:bg-red-500/15 text-red-600 dark:text-red-400"
            aria-label="Fechar aviso"
          >
            <Icon name="close" className="text-base" />
          </button>
        </div>
      ) : null}

      <div
        className={`flex-1 flex min-w-0 min-h-0 overflow-hidden relative ${
          mode === MODE_ROTEIRO ? 'flex-col lg:flex-row' : ''
        }`}
      >
        {showRoteiroSidebar ? (
          <section
            className={
              'roteiro-mobile-map-stage relative flex flex-col min-h-0 border-r border-border-light dark:border-border-dark bg-white dark:bg-card-dark ' +
              (dragReorder.isOverlayActive ? 'roteiro-list-drag-active z-40 ' : '') +
              (mobileMapOpen ? 'roteiro-mobile-map-open ' : '') +
              (mode === MODE_ROTEIRO
                ? likeReplace.open
                  ? 'w-full max-lg:flex-1 max-lg:max-h-none max-lg:min-h-0 lg:max-h-none lg:flex-none lg:w-1/2 xl:w-2/5'
                  : 'w-full max-lg:flex-1 max-lg:max-h-none max-lg:min-h-0 max-lg:pr-10 lg:max-h-none lg:flex-none lg:w-1/2 xl:w-2/5'
                : 'w-full max-h-[48vh] lg:max-h-none lg:flex-none lg:w-1/2 xl:w-2/5')
            }
            aria-label="Paradas do dia"
          >
            <div
              ref={roteiroListScrollRef}
              className={
                'roteiro-list-scroll flex-1 min-h-0 overflow-y-auto p-4 sm:p-6' +
                (dragReorder.isOverlayActive ? ' relative z-50 roteiro-list-scroll--drag-active' : '')
              }
            >
              {isPlanning ? (
                <div className="mb-5 rounded-2xl border border-primary/35 bg-gradient-to-br from-primary/[0.08] to-transparent dark:from-primary/15 p-4 sm:p-5">
                  <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">{t('tdv.conclude_title')}</p>
                  <p className="text-xs sm:text-sm text-text-secondary mt-1.5 leading-relaxed">
                    {t('tdv.conclude_body')}
                  </p>
                  <Button
                    className="mt-4 w-full sm:w-auto rounded-full font-bold"
                    onClick={requestFinalizeTdv}
                    disabled={finalizingTdv}
                  >
                    <Icon name="auto_awesome" />
                    {finalizingTdv ? t('tdv.finalize_generating') : t('tdv.conclude_cta')}
                  </Button>
                  {!hasFullAccess ? (
                    <p className="mt-2 text-[11px] leading-snug text-text-secondary sm:text-xs">
                      {t('tdv.lock_warn_body')}
                    </p>
                  ) : null}
                  {finalizeError ? (
                    <p className="mt-2 text-xs text-red-600 dark:text-red-400 leading-relaxed" role="alert">
                      {finalizeError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!hasFullAccess && premiumRestriction ? (
                <ItineraryPremiumBanner
                  tripId={tripId}
                  restriction={premiumRestriction}
                  showAdminUnlock={isAdmin}
                  onAdminUnlock={handleAdminUnlock}
                />
              ) : null}
              {isSelectedDayPremiumLockedUi ? (
                <div className="rounded-2xl border-2 border-dashed border-amber-500/40 bg-gradient-to-br from-amber-500/12 dark:from-amber-500/[0.12] via-background-light dark:via-[#23220f] to-primary/[0.08] px-5 py-10 text-center mb-4">
                  <Icon
                    name="lock"
                    className="text-[2.85rem] sm:text-[3.25rem] mb-4 mx-auto opacity-95 text-amber-800 dark:text-amber-400"
                  />
                  <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">Dia bloqueado na prévia</p>
                  <p className="text-xs sm:text-sm text-text-secondary mt-2 max-w-[18.5rem] mx-auto leading-relaxed">
                    {selectedDayPremium?.totalOnDay === 1 ? (
                      <>Há <span className="font-semibold">1 parada</span> planejada neste dia dentro do plano completo.</>
                    ) : (
                      <>
                        Há <span className="font-semibold">{selectedDayPremium?.totalOnDay} paradas</span> neste dia no plano completo —
                        a prévia gratuita inclui apenas o 1º dia do roteiro.
                      </>
                    )}
                  </p>
                  {!isPlanning ? (
                    <Link to={`/pagamento?tripId=${encodeURIComponent(tripId)}`}>
                      <Button className="mt-5 rounded-full font-bold w-full max-w-[16rem]" size="sm">
                        <Icon name="workspace_premium" />
                        Desbloquear roteiro
                      </Button>
                    </Link>
                  ) : null}
                </div>
              ) : null}
              {!isSelectedDayPremiumLockedUi &&
              (roteiroEditOpen || likeReplace.open || dayActivities.length > 0) ? (
                <div className="relative isolate pb-2">
                  <div className="min-w-0">
                  {roteiroEditOpen && draftActivities ? (
                    <div className="mb-4 flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="rounded-xl font-bold"
                          onClick={handleAddRoteiroStop}
                          disabled={blockNewRoteiroStop}
                          aria-describedby={blockNewRoteiroStop ? 'roteiro-new-stop-hint' : undefined}
                          title={
                            blockNewRoteiroStop
                              ? 'Termine ou remova a parada em edição antes de adicionar outra.'
                              : undefined
                          }
                        >
                          <Icon name="add" aria-hidden />
                          Nova parada (dia&nbsp;{effectiveSelectedDay})
                        </Button>
                      </div>
                      {blockNewRoteiroStop ? (
                        <p
                          id="roteiro-new-stop-hint"
                          className="inline-flex items-start gap-1.5 max-w-md rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 leading-snug"
                        >
                          <Icon name="info" className="text-sm shrink-0 mt-0.5" aria-hidden />
                          Nomeie ou remova a parada em edição antes de adicionar outra.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {roteiroEditOpen && dayActivities.length === 0 ? (
                    <div className="mb-6 rounded-xl border border-dashed border-primary/35 bg-primary/5 px-4 py-3 text-sm text-text-secondary">
                      <p className="font-semibold text-[#1c1c0d] dark:text-white">Neste dia ainda não há paradas</p>
                      <p className="text-xs mt-1">
                        Clique em «Nova parada» ou mova outra para cá pelo seletor de dia em cada cartão.
                      </p>
                    </div>
                  ) : null}
                  {stayToast ? (
                    <div
                      className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-[#45340a] dark:text-primary"
                      role="status"
                    >
                      {stayToast}
                    </div>
                  ) : null}
                  {showStayAnchors ? (
                    <ItineraryStayAnchor
                      placement="start"
                      stay={primaryStay}
                      tripId={tripId}
                      hasFullAccess={hasFullAccess}
                      canEdit={canEditStay}
                      onManage={(opts) => openStayManager(opts)}
                    />
                  ) : null}
                  <div ref={roteiroCardsListRef} className="relative space-y-0">
                    <ItineraryDragInsertLine
                      top={dragReorder.ghostStyle?.lineTop}
                      visible={dragReorder.phase === 'dragging' && dragReorder.showInsertLine}
                    />
                    {(() => {
                      let activityCardIndex = 0
                      const regularActivityCount = dayRouteActivities.length

                      return dayTimelineItems.map((item, timelineIdx) => {
                        const timelineIsLast =
                          timelineIdx === dayTimelineItems.length - 1 &&
                          hiddenPremiumStopsSameDay === 0

                        if (item.type === 'mealSlot') {
                          return (
                            <ItineraryMealSlotCard
                              key={`meal-${item.slotKey}`}
                              mealType={item.mealType}
                              startTime={item.startTime}
                              options={item.options}
                              isLast={timelineIsLast}
                              readOnly={roteiroEditOpen || likeReplace.open}
                              selectedId={mealSelections[item.slotKey] ?? null}
                              onSelect={(activityId) => handleMealSelect(item.slotKey, activityId)}
                              highlighted={highlightedMealSlotKey === item.slotKey}
                              showMealsOnMap={showMealsOnMap}
                              open={expandedMealSlotKey === item.slotKey}
                              onOpenChange={(next) => {
                                setExpandedMealSlotKey(next ? item.slotKey : null)
                              }}
                              onViewOnMap={() => handleMealViewOnMap(item.slotKey)}
                              headerRef={(el) => {
                                const key = String(item.slotKey)
                                if (el) mealSlotHeaderRefs.current.set(key, el)
                                else mealSlotHeaderRefs.current.delete(key)
                              }}
                            />
                          )
                        }

                        const act = item.act
                        const idx = activityCardIndex
                        activityCardIndex += 1
                        const activityIsLast =
                          timelineIdx === dayTimelineItems.length - 1 &&
                          hiddenPremiumStopsSameDay === 0
                        const frozen = reorderFrozenLayoutRef.current
                        const actId = String(act.id)
                        const displayIndex =
                          frozen?.indices && actId in frozen.indices
                            ? frozen.indices[actId]
                            : idx
                        const displayIsLast =
                          frozen?.isLast && actId in frozen.isLast
                            ? frozen.isLast[actId]
                            : activityIsLast

                        if (likeReplace.open) {
                          const dropHighlight =
                            likeDrag.phase === 'dragging' &&
                            likeDrag.overTarget?.type === 'swap' &&
                            String(likeDrag.overTarget.activityId) === String(act.id)
                          return (
                            <RoteiroModifyActivityRow
                              key={String(act.id || `${effectiveSelectedDay}-${idx}`)}
                              act={act}
                              index={idx}
                              isLast={activityIsLast}
                              swapArmed={Boolean(likeReplace.selectedLike) && likeDrag.phase !== 'dragging'}
                              dropHighlight={dropHighlight}
                              dragActive={likeDrag.phase === 'dragging'}
                              motion={likeReplace.rowMotion?.[String(act.id)] || null}
                              cardRef={(el) => likeReplace.registerRowCardRef(String(act.id), el)}
                              onSwap={() => likeReplace.swapWithActivity(act.id)}
                              onRemove={() => {
                                if (String(act.id) === String(trackedStopId)) {
                                  setTrackedStopId(null)
                                  trackedFollowRef.current = { id: null, reason: null }
                                }
                                likeReplace.removeActivity(act.id)
                              }}
                            />
                          )
                        }

                        return (
                          <ItineraryActivityCard
                            key={String(act.id || `${effectiveSelectedDay}-${idx}`)}
                            act={act}
                            index={idx}
                            isLast={activityIsLast}
                            displayIndex={displayIndex}
                            displayIsLast={displayIsLast}
                            editing={roteiroEditOpen}
                            draft={act}
                            hasFullAccess={hasFullAccess}
                            isTracked={String(act.id) === String(trackedStopId)}
                            cardRef={(el) => {
                              const key = String(act.id)
                              if (el) stopCardRefs.current.set(key, el)
                              else stopCardRefs.current.delete(key)
                            }}
                            onDraftPatch={(patch) => {
                              setDraftActivities((prev) => {
                                const list = prev ?? []
                                if (isScheduleTimePatch(patch)) {
                                  const current =
                                    list.find((item) => String(item.id) === String(act.id)) ?? act
                                  const dayNum =
                                    getActivityDayNumber(current, dateToDayMap) ??
                                    effectiveSelectedDay
                                  return applyRoteiroScheduleEdit(
                                    list,
                                    dateToDayMap,
                                    dayNum,
                                    act.id,
                                    patch,
                                  )
                                }
                                return list.map((item) =>
                                  String(item.id) === String(act.id)
                                    ? { ...item, ...patch }
                                    : item,
                                )
                              })
                            }}
                            onRemove={() => {
                              if (String(act.id) === String(trackedStopId)) {
                                setTrackedStopId(null)
                                trackedFollowRef.current = { id: null, reason: null }
                              }
                              setDraftActivities((prev) =>
                                (prev ?? []).filter((item) => String(item.id) !== String(act.id)),
                              )
                            }}
                            onMoveUp={() => {
                              if (dragReorder.isInteractionBlocked) return
                              if (!prefersReducedFlipMotion()) {
                                reorderFrozenLayoutRef.current = captureDayFrozenLayout(
                                  dayRouteActivities,
                                  hiddenPremiumStopsSameDay,
                                )
                                flipBeforeReorderRef.current = {
                                  snapshot: captureReorderSnapshot(
                                    stopCardRefs.current,
                                    roteiroListScrollRef.current,
                                  ),
                                  movedId: String(act.id),
                                  neighborId:
                                    idx > 0 ? String(dayRouteActivities[idx - 1].id) : null,
                                  direction: -1,
                                }
                              }
                              setDraftActivities((prev) =>
                                prev
                                  ? applyRoteiroScheduleReorder(
                                      prev,
                                      dateToDayMap,
                                      effectiveSelectedDay,
                                      (list) =>
                                        reorderActivityInSameDay(
                                          list,
                                          dateToDayMap,
                                          effectiveSelectedDay,
                                          act.id,
                                          -1,
                                        ),
                                    )
                                  : prev,
                              )
                            }}
                            onMoveDown={() => {
                              if (dragReorder.isInteractionBlocked) return
                              if (!prefersReducedFlipMotion()) {
                                reorderFrozenLayoutRef.current = captureDayFrozenLayout(
                                  dayRouteActivities,
                                  hiddenPremiumStopsSameDay,
                                )
                                flipBeforeReorderRef.current = {
                                  snapshot: captureReorderSnapshot(
                                    stopCardRefs.current,
                                    roteiroListScrollRef.current,
                                  ),
                                  movedId: String(act.id),
                                  neighborId:
                                    idx < regularActivityCount - 1
                                      ? String(dayRouteActivities[idx + 1].id)
                                      : null,
                                  direction: 1,
                                }
                              }
                              setDraftActivities((prev) =>
                                prev
                                  ? applyRoteiroScheduleReorder(
                                      prev,
                                      dateToDayMap,
                                      effectiveSelectedDay,
                                      (list) =>
                                        reorderActivityInSameDay(
                                          list,
                                          dateToDayMap,
                                          effectiveSelectedDay,
                                          act.id,
                                          1,
                                        ),
                                    )
                                  : prev,
                              )
                            }}
                            disableMoveUp={idx === 0 || dragReorder.isInteractionBlocked}
                            disableMoveDown={
                              idx === regularActivityCount - 1 || dragReorder.isInteractionBlocked
                            }
                            compactMode={dragReorder.isCardCompact(act.id)}
                            isDragSource={
                              dragReorder.phase === 'dragging' &&
                              String(act.id) === String(dragReorder.draggingId)
                            }
                            isDragHidden={
                              (dragReorder.phase === 'landing' ||
                                dragReorder.phase === 'reverting') &&
                              String(act.id) === String(dragReorder.draggingId)
                            }
                            isExpandingCard={
                              dragReorder.phase === 'expanding' &&
                              dragReorder.expandRevealed &&
                              String(act.id) === String(dragReorder.droppedId)
                            }
                            isDragPending={String(act.id) === String(dragReorder.pendingDragId)}
                            canDragReorder={
                              dragReorder.canDrag && !dragReorder.isInteractionBlocked
                            }
                            onDragHandlePointerDown={(event) =>
                              onActivityDragHandlePointerDown(act.id, event)
                            }
                            dayPickerValue={getActivityDayNumber(act, dateToDayMap) ?? effectiveSelectedDay}
                            dayPickerOptions={days}
                            onDayChange={(dn) => {
                              setDraftActivities((prev) =>
                                (prev ?? []).map((item) =>
                                  String(item.id) === String(act.id)
                                    ? assignActivityToDay(item, dn, dateToDayMap)
                                    : item,
                                ),
                              )
                              if (String(act.id) === String(trackedStopId)) {
                                trackedFollowRef.current = { id: act.id, reason: 'day-change' }
                                setSelectedDay(dn)
                              }
                            }}
                          />
                        )
                      })
                    })()}
                    {likeReplace.open ? (
                      <RoteiroModifyInsertZone
                        zoneRef={likeInsertZoneRef}
                        active={likeDrag.phase === 'dragging'}
                        highlighted={
                          likeDrag.phase === 'dragging' && likeDrag.overTarget?.type === 'insert'
                        }
                      />
                    ) : null}
                    {hiddenPremiumStopsSameDay >= 1 ? (
                      <ItineraryPremiumNextPeek hiddenCount={hiddenPremiumStopsSameDay} />
                    ) : null}
                  </div>
                  {showStayAnchors && primaryStay ? (
                    <ItineraryStayAnchor
                      placement="end"
                      stay={primaryStay}
                      tripId={tripId}
                      hasFullAccess={hasFullAccess}
                      canEdit={false}
                    />
                  ) : null}
                  {hiddenPremiumStopsSameDay >= 1 ? (
                    <>
                      <div className="pointer-events-none absolute inset-x-[-0.5rem] bottom-0 z-[5] h-[min(13.5rem,40vh)] sm:h-[min(15rem,38vh)] bg-gradient-to-b from-transparent via-white/25 via-[28%] to-white dark:via-[#23220f]/20 dark:to-[#23220f]" />
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-x-[-0.5rem] bottom-0 z-[6] h-[min(11rem,34vh)] sm:h-[min(12rem,32vh)] rounded-b-[1.75rem] bg-gradient-to-b from-transparent via-white/75 via-[52%] to-white/98 dark:from-transparent dark:via-[#23220f]/80 dark:to-[#23220f]/99 [mask-image:linear-gradient(to_bottom,transparent_0%,black_18%,black_100%)]"
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[10] flex justify-center px-4 pb-5 pt-10 sm:pt-14 bg-gradient-to-t from-white dark:from-[#23220f] from-[10%] to-transparent">
                        {!isPlanning ? (
                          <div className="pointer-events-auto inline-flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-[999px] border border-border-light/90 dark:border-white/14 bg-white/95 dark:bg-card-dark/95 px-5 py-2.5 shadow-[0_10px_40px_-24px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                            <span className="inline-flex items-center gap-2 text-[12px] sm:text-sm font-bold text-[#3d3310] dark:text-amber-100/95">
                              <Icon name="lock" className="text-amber-700 dark:text-amber-300 shrink-0" aria-hidden />
                              {hiddenPremiumStopsSameDay === 1
                                ? 'Mais uma parada neste dia'
                                : `Mais ${hiddenPremiumStopsSameDay} neste dia`}
                            </span>
                            <Link
                              to={`/pagamento?tripId=${encodeURIComponent(tripId)}`}
                              className="shrink-0 rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 bg-primary text-[#1c1c0d] shadow-primary-glow dark:shadow-primary-glow-dark hover:opacity-90 hover:shadow-primary-glow-hover dark:hover:shadow-primary-glow-hover-dark px-5 min-h-[2.25rem] text-sm"
                            >
                              Ver roteiro completo
                            </Link>
                          </div>
                        ) : (
                          <span className="text-[11px] font-semibold text-text-secondary/90 text-center rounded-full bg-background-light/92 dark:bg-white/[0.07] py-2 px-4 border border-border-light dark:border-white/12">
                            {hiddenPremiumStopsSameDay === 1 ? 'Mais uma parada no plano completo' : `Mais ${hiddenPremiumStopsSameDay} no plano completo`}
                          </span>
                        )}
                      </div>
                    </>
                  ) : null}
                  </div>
                </div>
              ) : null}
              {!isSelectedDayPremiumLockedUi &&
              dayActivities.length === 0 &&
              activities.length > 0 &&
              !roteiroEditOpen &&
              !likeReplace.open ? (
                <div className="text-center py-10 px-4 text-text-secondary rounded-2xl border border-dashed border-border-light dark:border-border-dark mb-4">
                  <Icon name="event_busy" className="text-4xl mb-3 opacity-40 mx-auto text-primary" />
                  <p className="text-sm font-medium text-[#1c1c0d] dark:text-white">Nenhuma parada neste dia</p>
                  <p className="text-xs sm:text-sm mt-2">
                    Troque o dia acima {!hasFullAccess && premiumRestriction ? 'ou desbloqueie o roteiro completo.' : '.'}
                  </p>
                </div>
              ) : null}
              {itineraryLoading && dayActivities.length === 0 && !itineraryError ? (
                <div className="mb-4">
                  <RoteiroStopsSkeleton />
                </div>
              ) : null}
              {activities.length === 0 &&
              !itineraryLoading &&
              !itineraryError && (
                <div className="text-center py-10 px-4 text-text-secondary rounded-2xl border border-dashed border-border-light dark:border-border-dark">
                  <Icon name="route" className="text-4xl mb-3 opacity-40 mx-auto text-primary" />
                  <p className="text-sm font-medium text-[#1c1c0d] dark:text-white">Nenhuma atividade ainda</p>
                  <p className="text-xs sm:text-sm mt-2 max-w-xs mx-auto">
                    {isPlanning
                      ? 'Use o botão acima para gerar o roteiro, ou abra a aba TDV se quiser escolher lugares antes.'
                      : 'Explore Descobrir ou crie outro planejamento.'}
                  </p>
                </div>
              )}
            </div>
            {roteiroEditOpen && draftActivities && !isSelectedDayPremiumLockedUi ? (
              <div className="flex-shrink-0 z-20 px-3 sm:px-6 pt-2 sm:pt-4 pb-2 sm:pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border-light dark:border-border-dark bg-white dark:bg-card-dark flex flex-row gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-xl font-bold flex-1 sm:flex-none sm:min-h-[2.65rem] text-xs sm:text-sm"
                  onClick={handleSaveRoteiroDraft}
                  disabled={savingRoteiro || !tripId}
                >
                  <Icon name="save" className="text-base" aria-hidden />
                  <span className="sm:hidden">{savingRoteiro ? 'Salvando…' : 'Salvar'}</span>
                  <span className="hidden sm:inline">{savingRoteiro ? 'Salvando…' : 'Salvar alterações'}</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-xl font-bold flex-1 sm:flex-none sm:min-h-[2.65rem] text-xs sm:text-sm"
                  onClick={() => {
                    if (
                      typeof globalThis.confirm === 'function' &&
                      globalThis.confirm('Descartar todas as edições não salvas neste roteiro?')
                    ) {
                      handleCancelRoteiroEdit()
                    }
                  }}
                  disabled={savingRoteiro}
                >
                  <span className="sm:hidden">Cancelar</span>
                  <span className="hidden sm:inline">Cancelar edição</span>
                </Button>
              </div>
            ) : null}
            {mode === MODE_ROTEIRO && likeReplace.open && !isLgUp ? (
              <RoteiroModifyPanel
                layout="dock"
                {...modifyPanelSharedProps}
              />
            ) : null}
            {mode === MODE_ROTEIRO && !likeReplace.open ? (
              <ItineraryMobileMapDrawer
                open={mobileMapOpen}
                onOpenChange={setMobileMapOpen}
                tripId={tripId}
                day={effectiveSelectedDay}
                activities={dayRouteActivities}
                timelineActivities={dayActivities}
                accommodations={dayAccommodations}
                mealSlots={dayMealSlots}
                selectedMealIds={mealSelections}
                disabled={isSelectedDayPremiumLockedUi}
                routeRestricted={isRouteRestricted}
                highlightedIndex={trackedMapHighlight}
                highlightedMealSlotKey={highlightedMealSlotKey}
                preferLocalRoute={roteiroEditOpen || likeReplace.open}
                hideDuringRoteiroDrag={dragReorder.isOverlayActive}
                showAccommodationRoutes={showAccommodationRoutes}
                onShowAccommodationRoutesChange={handleShowAccommodationRoutesChange}
                showMealsOnMap={showMealsOnMap}
                onShowMealsOnMapChange={handleShowMealsOnMapChange}
                onMealViewOptions={handleMealViewOptions}
                onMealSlotFocus={handleMealMapPinClick}
                onMealGoToTimeline={handleMealGoToTimeline}
                onMealDismiss={handleMealDismiss}
              />
            ) : null}
          </section>
        ) : null}

        <section
          className={`min-w-0 flex flex-col relative overflow-hidden ${
            mode === MODE_ROTEIRO
              ? likeReplace.open
                ? 'hidden lg:flex flex-1 min-h-0 bg-background-light dark:bg-background-dark/40'
                : 'hidden lg:flex flex-1 min-h-0 bg-gray-200 dark:bg-gray-900/50'
              : 'flex-1 min-h-0'
          }`}
        >
          {isPlanning ? (
            <div
              className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
                mode === MODE_TDV ? '' : 'hidden'
              }`}
              aria-hidden={mode !== MODE_TDV}
            >
              <TinderView
                tripId={tripId}
                trip={trip}
                onItineraryUpdate={refetchItinerary}
                isActive={mode === MODE_TDV}
                onTdvSatisfied={handleFinalizeTdv}
                finalizingTdv={finalizingTdv}
                tdvMode="planning"
                warnTdvLockOnGenerate={!hasFullAccess}
              />
            </div>
          ) : null}
          <div
            className={`flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-card-dark ${
              mode === MODE_DOCUMENTOS ? 'flex' : 'hidden'
            }`}
          >
            <DocumentosView
              tripId={tripId}
              trip={trip}
              hasPlanejamentoCompleto={hasFullAccess}
              isActive={mode === MODE_DOCUMENTOS}
              onUpgrade={async () => {
                const tripData = await tripService.getTrip(tripId)
                setTrip(tripData)
                await refetchItineraryImmediate()
              }}
            />
          </div>
          {mode === MODE_ROTEIRO && likeReplace.open && isLgUp ? (
            <div className="flex h-full min-h-0 flex-1 flex-col p-3 sm:p-4">
              <RoteiroModifyPanel
                layout="sidebar"
                {...modifyPanelSharedProps}
                className="h-full min-h-0"
              />
            </div>
          ) : null}
          {mode === MODE_ROTEIRO && !likeReplace.open ? (
            <div className="roteiro-map-surface relative flex-1 min-h-0 w-full h-full">
              <ItineraryDayMap
                tripId={tripId}
                day={effectiveSelectedDay}
                activities={dayRouteActivities}
                timelineActivities={dayActivities}
                accommodations={dayAccommodations}
                mealSlots={dayMealSlots}
                selectedMealIds={mealSelections}
                disabled={isSelectedDayPremiumLockedUi}
                routeRestricted={isRouteRestricted}
                highlightedIndex={trackedMapHighlight}
                highlightedMealSlotKey={highlightedMealSlotKey}
                preferLocalRoute={roteiroEditOpen || likeReplace.open}
                className="absolute inset-0 h-full w-full"
                ariaLabel={`Mapa do roteiro — dia ${effectiveSelectedDay}`}
                showAccommodationRoutes={showAccommodationRoutes}
                onShowAccommodationRoutesChange={handleShowAccommodationRoutesChange}
                showMealsOnMap={showMealsOnMap}
                onShowMealsOnMapChange={handleShowMealsOnMapChange}
                onMealViewOptions={handleMealViewOptions}
                onMealSlotFocus={handleMealGoToTimeline}
                onMealGoToTimeline={handleMealGoToTimeline}
              />
            </div>
          ) : null}
        </section>

        {tdvOverlayOpen ? (
          <div className="tdv-overlay-shell" aria-hidden={!tdvOverlayAnimIn}>
            <div
              ref={tdvOverlayPanelRef}
              className={`tdv-overlay-panel ${tdvOverlayAnimIn ? 'tdv-overlay-panel--open' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-label={t('tdv.title')}
            >
              {tdvOverlayContentReady ? (
                <TinderView
                  tripId={tripId}
                  trip={trip}
                  onItineraryUpdate={refetchItinerary}
                  isActive={tdvOverlayAnimIn}
                  onModifyRoteiro={handleStartModifyRoteiro}
                  onRequestClose={() => closeTdvOverlay('roteiro')}
                  finalizingTdv={false}
                  tdvMode="postUnlock"
                  warnTdvLockOnGenerate={false}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <ItineraryExportSheet
        open={exportSheetOpen}
        onClose={() => setExportSheetOpen(false)}
        onExportPdf={handlePrintItinerary}
      />
      <AccommodationEditorSheet
        open={Boolean(stayEditor)}
        onClose={() => {
          if (staySaving) return
          setStayEditor(null)
          setStayEditorError(null)
        }}
        trip={trip}
        intent={stayEditor?.intent || 'manage'}
        focusStayId={stayEditor?.focusStayId || null}
        defaultDestinationId={selectedDayDest?.id}
        defaultCheckIn={selectedDayIso}
        saving={staySaving}
        error={stayEditorError}
        onSave={(nextAccs, changedStay) => {
          const previous = trip?.accommodations || []
          const shouldReorganize = accommodationNeedsReorganize(previous, changedStay)
          persistAccommodations(nextAccs, {
            promptReorganize: shouldReorganize,
            stayName: changedStay?.name || changedStay?.address || '',
            toast: 'Hospedagens atualizadas.',
          })
        }}
      />
      <ReorganizeStayDialog
        open={Boolean(reorganizePrompt)}
        stayName={reorganizePrompt?.name}
        onKeep={() => setReorganizePrompt(null)}
        onReorganize={handleReorganizeStay}
      />
      <DeletePlanningOverlay
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePlanning}
        deleting={deleting}
        tripLabel={destLabel}
      />
      <FinalizeItineraryOverlay
        open={finalizingTdv || reorganizingStay}
        title={
          reorganizingStay && !finalizingTdv
            ? 'Reorganizando o roteiro'
            : undefined
        }
        description={
          reorganizingStay && !finalizingTdv
            ? 'O otimizador está ajustando as paradas em torno da hospedagem.'
            : undefined
        }
      />
      <RoteiroDragOverlay active={dragReorder.isOverlayActive}>
        <ItineraryDragGhost
          activity={dragReorder.ghostActivity}
          index={
            dragReorder.ghostActivity
              ? dayRouteActivities.findIndex(
                  (a) => String(a.id) === String(dragReorder.ghostActivity.id),
                )
              : 0
          }
          style={
            dragReorder.ghostStyle &&
            (dragReorder.phase === 'dragging' ||
              dragReorder.phase === 'landing' ||
              dragReorder.phase === 'reverting')
              ? {
                  left: dragReorder.ghostStyle.left,
                  top: dragReorder.ghostStyle.top,
                  width: dragReorder.ghostStyle.width,
                  animate: dragReorder.ghostStyle.animate,
                  visible: dragReorder.ghostStyle.visible !== false,
                  outOfList: Boolean(dragReorder.ghostStyle.outOfList),
                }
              : null
          }
        />
      </RoteiroDragOverlay>
      {likeReplace.open && likeDrag.phase === 'dragging' ? (
        <RoteiroModifyDragGhost like={likeDrag.draggingLike} style={likeDrag.ghostStyle} />
      ) : null}
    </div>
    <ItineraryPrintView
      trip={trip}
      activities={persistedActivities}
      days={days}
      dateToDayMap={dateToDayMap}
      destLabel={destLabel}
      hasFullAccess={hasFullAccess}
      premiumRestriction={premiumRestriction}
    />
    </>
  )
}
