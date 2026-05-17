import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { TinderView } from '../components/itinerary/TinderView'
import { DocumentosView } from '../components/itinerary/DocumentosView'
import { ItineraryActivityCard } from '../components/itinerary/ItineraryActivityCard'
import { ItineraryPremiumNextPeek } from '../components/itinerary/ItineraryPremiumNextPeek'
import { ItineraryPremiumBanner } from '../components/itinerary/ItineraryPremiumBanner'
import { DeletePlanningOverlay } from '../components/itinerary/DeletePlanningOverlay'
import { ItineraryDayMap } from '../components/itinerary/ItineraryDayMap'
import { tripService } from '../services/tripService'
import { userService } from '../services/userService'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { hasTripPlanningUnlocked, getTripDayCount } from '../utils/planningAccess'

const MODE_ROTEIRO = 'roteiro'
const MODE_TDV = 'tdv'
const MODE_DOCUMENTOS = 'documentos'

/** Garante a qual dia (1-based) cada atividade pertence — `day`, `dayNumber` ou datas (`dayDate`, `canonicalDate`, etc.). */
function getActivityDayNumber(act, dateToDayMap) {
  if (!act || typeof act !== 'object') return null
  const raw = act.day ?? act.dayNumber ?? act.day_number
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 1) return Math.floor(n)
    if (typeof raw === 'string') {
      const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(raw)
      if (isoMatch && dateToDayMap.has(isoMatch[1])) return dateToDayMap.get(isoMatch[1])
    }
  }
  const candidates = [
    act.dayDate,
    act.day_date,
    act.date,
    act.canonicalDate,
    act.canonical_date,
    act.scheduledDate,
    act.scheduled_date,
    act.itineraryDate,
    act.itinerary_date,
  ]
  for (const d of candidates) {
    if (typeof d !== 'string') continue
    const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(d)
    if (isoMatch && dateToDayMap.has(isoMatch[1])) return dateToDayMap.get(isoMatch[1])
  }
  return null
}

/** Mapa `YYYY-MM-DD` → número do dia (1-based) na ordem das datas da trip. */
function buildDateToDayMap(trip) {
  const map = new Map()
  if (!trip) return map
  let dayNum = 1
  for (const dest of trip?.destinations || []) {
    const start = new Date(dest.arrivalDate)
    const end = new Date(dest.departureDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue
    const d = new Date(start)
    while (d <= end) {
      map.set(d.toISOString().split('T')[0], dayNum)
      dayNum += 1
      d.setDate(d.getDate() + 1)
    }
  }
  return map
}

function startTimeKey(act) {
  const raw = act?.startTime || act?.start_time || act?.time || ''
  const m = /^(\d{1,2}):(\d{2})/.exec(String(raw))
  if (!m) return 99 * 60
  return Number(m[1]) * 60 + Number(m[2])
}

function activityOrderKey(act) {
  const o = Number(act?.order)
  if (Number.isFinite(o) && o >= 0) return o
  return Number.MAX_SAFE_INTEGER
}

/** Ordena atividades de UM dia por `order` (do agente) e desempata por `startTime`. */
function sortDayActivities(list) {
  return [...list].sort((a, b) => {
    const oa = activityOrderKey(a)
    const ob = activityOrderKey(b)
    if (oa !== ob) return oa - ob
    return startTimeKey(a) - startTimeKey(b)
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [trip, setTrip] = useState(null)
  const [itinerary, setItinerary] = useState(null)
  const [selectedDay, setSelectedDay] = useState(1)
  const [mode, setMode] = useState(MODE_ROTEIRO)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const tripDestCity = trip?.destinations?.[0]?.city
  useDocumentTitle(tripDestCity ? `Roteiro · ${tripDestCity}` : 'Roteiro')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [finalizingTdv, setFinalizingTdv] = useState(false)
  const deleteInFlightRef = useRef(false)

  const isPlanning = trip?.status === 'planejando'
  const hasPlanejamentoCompleto = hasTripPlanningUnlocked(trip)

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
  const refetchItineraryImmediate = useCallback(async () => {
    if (!tripId) return null
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current)
      refetchTimeoutRef.current = null
    }
    try {
      const itineraryData = await tripService.getItinerary(tripId, { refresh: true })
      setItinerary(itineraryData)
      return itineraryData
    } catch {
      return null
    }
  }, [tripId])
  const refetchItinerary = useCallback(() => {
    if (!tripId) return
    if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current)
    refetchTimeoutRef.current = setTimeout(refetchItineraryImmediate, 400)
  }, [tripId, refetchItineraryImmediate])

  useEffect(() => {
    if (!tripId) return
    let cancelled = false
    ;(async () => {
      try {
        setError(null)
        setLoading(true)
        const tripData = await tripService.getTrip(tripId)
        if (cancelled) return
        setTrip(tripData)
        await refetchItineraryImmediate()
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Erro ao carregar roteiro')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tripId, refetchItineraryImmediate])

  useEffect(() => {
    if (isPlanning) {
      setMode(MODE_TDV)
    }
  }, [isPlanning])

  useEffect(() => {
    if (!isPlanning && mode === MODE_TDV) {
      setMode(MODE_ROTEIRO)
    }
  }, [isPlanning, mode])

  useEffect(() => {
    if (searchParams.get('unlocked') !== '1' || !tripId) return
    let cancelled = false
    ;(async () => {
      const tripData = await tripService.getTrip(tripId).catch(() => null)
      if (cancelled) return
      if (tripData) setTrip(tripData)
      await refetchItineraryImmediate()
      if (cancelled) return
      const next = new URLSearchParams(searchParams)
      next.delete('unlocked')
      setSearchParams(next, { replace: true })
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams, setSearchParams, tripId, refetchItineraryImmediate])

  const handleDevUnlock = async () => {
    if (!tripId) return
    try {
      const activated = await userService.activatePlanningDev(tripId)
      if (activated?.trip) {
        setTrip((prev) => (prev ? { ...prev, ...activated.trip } : activated.trip))
      }
      const data = await refetchItineraryImmediate()
      if (data?.activities?.[0]?.day != null) {
        const d = Number(data.activities[0].day)
        setSelectedDay(Number.isFinite(d) && d >= 1 ? d : data.activities[0].day)
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Não foi possível ativar o plano de demonstração.')
    }
  }

  const handleFinalizeTdv = useCallback(async () => {
    if (!tripId) return
    setFinalizingTdv(true)
    setError(null)
    try {
      const result = await tripService.finalizeTdvPlanning(tripId)
      if (result?.trip) setTrip(result.trip)
      const itineraryData = result?.itinerary || (await tripService.getItinerary(tripId))
      setItinerary(itineraryData)
      const firstDay = itineraryData?.activities?.[0]?.day
      if (firstDay != null && firstDay !== '') {
        const asNum = Number(firstDay)
        setSelectedDay(Number.isFinite(asNum) && asNum >= 1 ? asNum : firstDay)
      }
      setMode(MODE_ROTEIRO)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Não foi possível finalizar o TDV')
    } finally {
      setFinalizingTdv(false)
    }
  }, [tripId])

  const dateToDayMap = useMemo(() => buildDateToDayMap(trip), [trip])

  useEffect(() => {
    const acts = itinerary?.activities || []
    if (!acts.length) return

    const prem = itinerary?._premiumRestriction
      ? normalizedPremiumRestriction(itinerary._premiumRestriction)
      : null
    if (
      prem?.totalByDay &&
      prem?.visibleByDay &&
      typeof selectedDay !== 'undefined' &&
      Number.isFinite(Number(selectedDay))
    ) {
      const d = getPremiumDayTotals(prem, selectedDay)
      if (d && d.totalOnDay > 0 && d.visibleOnDay === 0) return
    }

    const matches = acts.filter((a) => getActivityDayNumber(a, dateToDayMap) === selectedDay)
    if (matches.length > 0) return
    const first = acts
      .map((a) => getActivityDayNumber(a, dateToDayMap))
      .find((d2) => d2 != null)
    if (first == null) return
    setSelectedDay(first)
  }, [itinerary, selectedDay, dateToDayMap])

  if (loading) return <LoadingSpinner />
  if (error || !trip) {
    return (
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
    )
  }

  const firstDest = trip.destinations?.[0]
  const destLabel = firstDest ? `${firstDest.city}, ${firstDest.country}` : 'Viagem'
  const activities = itinerary?.activities || []
  const premiumRestriction = itinerary?._premiumRestriction
    ? normalizedPremiumRestriction(itinerary._premiumRestriction)
    : null
  const hasFullAccess = itinerary?._access?.fullAccess === true
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

  const showRoteiroSidebar = mode === MODE_ROTEIRO

  const modeTabs = (
    <div className="flex gap-1.5 sm:gap-2 flex-wrap p-1 rounded-2xl bg-surface-light dark:bg-white/[0.06] w-fit max-w-full">
      {isPlanning ? (
        <>
          <button
            type="button"
            disabled
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold opacity-45 cursor-not-allowed ${
              mode === MODE_ROTEIRO ? 'bg-primary text-black shadow-sm' : 'text-text-secondary'
            }`}
          >
            Roteiro
          </button>
          <button
            type="button"
            onClick={() => setMode(MODE_TDV)}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === MODE_TDV
                ? 'bg-primary text-black shadow-md'
                : 'text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white'
            }`}
          >
            TDV
          </button>
          <button
            type="button"
            onClick={() => setMode(MODE_DOCUMENTOS)}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              mode === MODE_DOCUMENTOS
                ? 'bg-primary text-black shadow-md'
                : 'text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white'
            }`}
          >
            <Icon name="folder_shared" className="text-sm" />
            <span className="hidden sm:inline">Documentos</span>
            <span className="sm:hidden">Docs</span>
            {!hasPlanejamentoCompleto && <Icon name="lock" className="text-xs opacity-70" />}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setMode(MODE_ROTEIRO)
              refetchItineraryImmediate()
            }}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              mode === MODE_ROTEIRO
                ? 'bg-primary text-black shadow-md'
                : 'text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white'
            }`}
          >
            Roteiro
          </button>
          <button
            type="button"
            onClick={() => setMode(MODE_DOCUMENTOS)}
            className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all ${
              mode === MODE_DOCUMENTOS
                ? 'bg-primary text-black shadow-md'
                : 'text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white'
            }`}
          >
            <Icon name="folder_shared" className="text-sm" />
            Docs
            {!hasPlanejamentoCompleto && <Icon name="lock" className="text-xs opacity-70" />}
          </button>
        </>
      )}
    </div>
  )

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] -m-4 lg:-m-8 min-h-0 bg-background-light/50 dark:bg-background-dark/30">
      {/* Cabeçalho único — evita três colunas competindo por atenção */}
      <header className="flex-shrink-0 z-30 border-b border-border-light dark:border-border-dark bg-white/90 dark:bg-card-dark/95 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-text-secondary mb-2 sm:mb-3 overflow-x-auto no-scrollbar">
          <span>Início</span>
          <Icon name="chevron_right" className="text-[10px] shrink-0" />
          <span>Roteiros</span>
          <Icon name="chevron_right" className="text-[10px] shrink-0" />
          <span className="text-[#1c1c0d] dark:text-white truncate">{destLabel}</span>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-[#1c1c0d] dark:text-white leading-tight">
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
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {modeTabs}
            {hasFullAccess && !isPlanning ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:text-green-400 bg-green-500/15 px-2 py-0.5 rounded-full shrink-0">
                <Icon name="verified" className="text-sm" />
                Plano completo
              </span>
            ) : null}
            {!isPlanning && !hasFullAccess && activities.length > 0 ? (
              <Link to={`/pagamento?tripId=${encodeURIComponent(tripId)}`}>
                <Button size="sm" className="rounded-xl shrink-0">
                  <Icon name="workspace_premium" />
                  <span className="hidden sm:inline">Roteiro completo</span>
                </Button>
              </Link>
            ) : null}
            {isPlanning && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 dark:text-red-400 hover:bg-red-500/10 shrink-0 rounded-xl"
              >
                <Icon name="delete" />
                <span className="hidden sm:inline">Apagar</span>
              </Button>
            )}
          </div>
        </div>
        {showRoteiroSidebar && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-3 pt-3 pb-2 sm:pb-2.5 border-t border-border-light dark:border-white/10 [-webkit-overflow-scrolling:touch]">
            {days.map((day) => {
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
              const isActiveChin = effectiveSelectedDay === day

              let chipClass =
                'relative shrink-0 inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-[0.4375rem] sm:py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all '

              if (isActiveChin && dayLockedPremium) {
                chipClass +=
                  'bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-950/80 dark:to-amber-900/55 text-[#45340a] dark:text-amber-100 ring-[3px] ring-amber-400/95 dark:ring-amber-500/60 shadow-[inset_0_-3px_0_0_rgba(251,191,36,0.45)] '
              } else if (isActiveChin && dayPartialPremium) {
                chipClass +=
                  'bg-primary text-black shadow-[0_10px_24px_-6px_rgba(234,179,8,0.55)] ring-2 ring-amber-800/35 dark:ring-amber-200/25 '
              } else if (isActiveChin) {
                chipClass += 'bg-primary text-black shadow-sm '
              } else if (dayLockedPremium) {
                chipClass +=
                  'overflow-hidden ' +
                  'bg-neutral-100 dark:bg-neutral-800/92 text-neutral-400 dark:text-neutral-500 grayscale-[35%] ' +
                  'ring-2 ring-neutral-300/95 dark:ring-neutral-600 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] ' +
                  "before:pointer-events-none before:absolute before:inset-0 before:rounded-full before:z-[1] before:bg-[repeating-linear-gradient(-35deg,rgba(0,0,0,.055)_0px,rgba(0,0,0,.055)_4px,transparent_4px,transparent_8px)] " +
                  "dark:before:bg-[repeating-linear-gradient(-35deg,rgba(255,255,255,.05)_0px,rgba(255,255,255,.05)_4px,transparent_4px,transparent_8px)] hover:brightness-[1.03] hover:ring-neutral-400/90 "
              } else if (dayPartialPremium) {
                chipClass +=
                  'bg-amber-50/95 dark:bg-amber-500/10 text-amber-900/92 dark:text-amber-200 ring-2 ring-dashed ring-amber-500/65 dark:ring-amber-400/40 ' +
                  'hover:bg-amber-100/98 dark:hover:bg-amber-500/15 hover:ring-amber-600/80 '
              } else {
                chipClass +=
                  'bg-surface-light dark:bg-white/[0.08] text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white '
              }

              return (
                <button key={day} type="button" onClick={() => setSelectedDay(day)} className={chipClass}>
                  <span className="relative z-[2] inline-flex items-center gap-1.5">
                    {dayLockedPremium ? (
                      <Icon
                        name="lock"
                        className={`text-[15px] shrink-0 ${isActiveChin ? 'text-amber-900/90 dark:text-amber-100' : ''}`}
                        aria-hidden
                      />
                    ) : null}
                    {dayPartialPremium && !dayLockedPremium ? (
                      <Icon
                        name="more_horiz"
                        className={`text-[16px] shrink-0 opacity-90 ${isActiveChin ? 'text-black/70' : 'text-amber-800/80 dark:text-amber-300/90'}`}
                        title="Prévia parcial — há mais paradas neste dia"
                        aria-hidden
                      />
                    ) : null}
                    <span>Dia {day}</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </header>

      <div className="flex-1 flex min-w-0 min-h-0 overflow-hidden">
        {showRoteiroSidebar ? (
          <section className="w-full lg:w-1/2 xl:w-2/5 flex flex-col min-h-0 border-r border-border-light dark:border-border-dark bg-white dark:bg-card-dark">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {!hasFullAccess && premiumRestriction ? (
                <ItineraryPremiumBanner
                  tripId={tripId}
                  restriction={premiumRestriction}
                  showDevUnlock={import.meta.env.DEV}
                  onDevUnlock={handleDevUnlock}
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
                        todas estão fora da prévia gratuita de 25&nbsp;%.
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
              {!isSelectedDayPremiumLockedUi && dayActivities.length > 0 ? (
                <div className="relative isolate pb-2">
                  <div className="space-y-0">
                    {dayActivities.map((act, idx) => (
                      <ItineraryActivityCard
                        key={act.id || `${effectiveSelectedDay}-${idx}`}
                        act={act}
                        index={idx}
                        isLast={idx === dayActivities.length - 1 && hiddenPremiumStopsSameDay === 0}
                      />
                    ))}
                    {hiddenPremiumStopsSameDay >= 1 ? (
                      <ItineraryPremiumNextPeek hiddenCount={hiddenPremiumStopsSameDay} />
                    ) : null}
                  </div>
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
                              className="shrink-0 rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 bg-primary text-[#1c1c0d] hover:opacity-90 hover:shadow-primary px-5 min-h-[2.25rem] text-sm"
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
              ) : null}
              {!isSelectedDayPremiumLockedUi && dayActivities.length === 0 && activities.length > 0 ? (
                <div className="text-center py-10 px-4 text-text-secondary rounded-2xl border border-dashed border-border-light dark:border-border-dark mb-4">
                  <Icon name="event_busy" className="text-4xl mb-3 opacity-40 mx-auto text-primary" />
                  <p className="text-sm font-medium text-[#1c1c0d] dark:text-white">Nenhuma parada neste dia</p>
                  <p className="text-xs sm:text-sm mt-2">
                    Troque o dia acima {!hasFullAccess && premiumRestriction ? 'ou desbloqueie o roteiro completo.' : '.'}
                  </p>
                </div>
              ) : null}
              {activities.length === 0 && (
                <div className="text-center py-10 px-4 text-text-secondary rounded-2xl border border-dashed border-border-light dark:border-border-dark">
                  <Icon name="route" className="text-4xl mb-3 opacity-40 mx-auto text-primary" />
                  <p className="text-sm font-medium text-[#1c1c0d] dark:text-white">Nenhuma atividade ainda</p>
                  <p className="text-xs sm:text-sm mt-2 max-w-xs mx-auto">
                    {isPlanning
                      ? 'No TDV, curta lugares e finalize para montar o roteiro com a IA.'
                      : 'Explore Descobrir ou crie outro planejamento.'}
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section
          className={`flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden ${
            mode === MODE_ROTEIRO ? 'hidden lg:flex' : 'flex'
          } ${mode === MODE_ROTEIRO ? 'bg-gray-200 dark:bg-gray-900/50' : ''}`}
        >
          {isPlanning && mode === MODE_TDV ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <TinderView
                tripId={tripId}
                trip={trip}
                onItineraryUpdate={refetchItinerary}
                isActive={mode === MODE_TDV}
                onTdvSatisfied={handleFinalizeTdv}
                finalizingTdv={finalizingTdv}
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
              hasPlanejamentoCompleto={hasPlanejamentoCompleto}
              isActive={mode === MODE_DOCUMENTOS}
              onUpgrade={async () => {
                const tripData = await tripService.getTrip(tripId)
                setTrip(tripData)
                await refetchItineraryImmediate()
              }}
            />
          </div>
          {mode === MODE_ROTEIRO ? (
            <ItineraryDayMap
              tripId={tripId}
              day={effectiveSelectedDay}
              activities={dayActivities}
              className="absolute inset-0"
              ariaLabel={`Mapa do roteiro — dia ${effectiveSelectedDay}`}
            />
          ) : null}
        </section>
      </div>

      <DeletePlanningOverlay
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeletePlanning}
        deleting={deleting}
        tripLabel={destLabel}
      />
    </div>
  )
}
