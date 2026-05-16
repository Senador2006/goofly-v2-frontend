import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { TinderView } from '../components/itinerary/TinderView'
import { DocumentosView } from '../components/itinerary/DocumentosView'
import { ItineraryActivityCard } from '../components/itinerary/ItineraryActivityCard'
import { ItineraryPremiumBanner } from '../components/itinerary/ItineraryPremiumBanner'
import { tripService } from '../services/tripService'
import { userService } from '../services/userService'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { hasTripPlanningUnlocked, getTripDayCount } from '../utils/planningAccess'

const MODE_ROTEIRO = 'roteiro'
const MODE_TDV = 'tdv'
const MODE_DOCUMENTOS = 'documentos'

function activityMatchesDay(act, selectedDay) {
  if (selectedDay == null || selectedDay === '') return true
  const raw = act.day
  if (raw == null || raw === '') return true
  if (String(raw) === String(selectedDay)) return true
  const dayNum = Number(raw)
  const selNum = Number(selectedDay)
  if (Number.isFinite(dayNum) && Number.isFinite(selNum) && dayNum === selNum) return true
  return false
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

  useEffect(() => {
    const acts = itinerary?.activities || []
    if (!acts.length) return
    const matches = acts.filter((a) => activityMatchesDay(a, selectedDay))
    if (matches.length > 0) return
    const first = acts.find((a) => a.day != null && a.day !== '')
    if (!first) return
    const d = Number(first.day)
    setSelectedDay(Number.isFinite(d) && d >= 1 ? d : first.day)
  }, [itinerary, selectedDay])

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
  const hasFullAccess = itinerary?._access?.fullAccess === true
  const tripDayCount = getTripDayCount(trip)
  const rawDays = [...new Set(activities.map((a) => a.day).filter((d) => d != null && d !== ''))]
  const numericDays = rawDays.every((d) => typeof d === 'number' || /^\d+$/.test(String(d)))
    ? rawDays.map((d) => (typeof d === 'number' ? d : parseInt(d, 10))).sort((a, b) => a - b)
    : rawDays.sort()
  const days = numericDays.length > 0 ? numericDays : Array.from({ length: tripDayCount }, (_, i) => i + 1)
  const effectiveSelectedDay = days.includes(selectedDay) ? selectedDay : (days[0] ?? 1)
  const dayActivities = activities.filter((a) => activityMatchesDay(a, effectiveSelectedDay))

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
              Rota otimizada por IA · {destLabel}
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
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mt-3 pt-3 border-t border-border-light dark:border-white/10">
            {days.map((day, dayIndex) => (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDay(day)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  effectiveSelectedDay === day
                    ? 'bg-primary text-black shadow-sm'
                    : 'bg-surface-light dark:bg-white/[0.08] text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white'
                }`}
              >
                Dia {dayIndex + 1}
              </button>
            ))}
          </div>
        )}
        {showDeleteConfirm && (
          <div className="mt-3 p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-text-secondary mb-3">
              Tem certeza que deseja apagar este planejamento? Esta ação não pode ser desfeita.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={handleDeletePlanning}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
              >
                {deleting ? 'Apagando...' : 'Sim, apagar'}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="rounded-xl">
                Cancelar
              </Button>
            </div>
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
              {dayActivities.length > 0 ? (
                <div className="space-y-0">
                  {dayActivities.map((act, idx) => (
                    <ItineraryActivityCard
                      key={act.id || `${effectiveSelectedDay}-${idx}`}
                      act={act}
                      index={idx}
                      isLast={idx === dayActivities.length - 1}
                    />
                  ))}
                </div>
              ) : null}
              {dayActivities.length === 0 && activities.length > 0 ? (
                <div className="text-center py-10 px-4 text-text-secondary rounded-2xl border border-dashed border-border-light dark:border-border-dark mb-4">
                  <Icon name="event_busy" className="text-4xl mb-3 opacity-40 mx-auto text-primary" />
                  <p className="text-sm font-medium text-[#1c1c0d] dark:text-white">Nenhuma parada neste dia</p>
                  <p className="text-xs sm:text-sm mt-2">Troque o dia acima ou desbloqueie o roteiro completo.</p>
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
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-100/90 to-slate-100/90 dark:from-gray-900 dark:to-gray-950" />
              <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-60">
                <button
                  type="button"
                  className="bg-white dark:bg-card-dark size-10 rounded-full flex items-center justify-center shadow-md border border-border-light dark:border-border-dark"
                  aria-hidden
                >
                  <Icon name="add" />
                </button>
                <button
                  type="button"
                  className="bg-white dark:bg-card-dark size-10 rounded-full flex items-center justify-center shadow-md border border-border-light dark:border-border-dark"
                  aria-hidden
                >
                  <Icon name="remove" />
                </button>
              </div>
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="text-center max-w-sm rounded-2xl bg-white/80 dark:bg-card-dark/80 backdrop-blur px-6 py-8 border border-border-light dark:border-border-dark shadow-lg">
                  <Icon name="map" className="text-4xl text-primary mb-3 mx-auto opacity-80" />
                  <p className="text-sm font-bold text-[#1c1c0d] dark:text-white">Mapa</p>
                  <p className="text-xs text-text-secondary mt-1">Integração em breve — use a lista ao lado para o roteiro.</p>
                </div>
              </div>
            </>
          ) : null}
        </section>
      </div>

      <div className="lg:hidden flex-shrink-0 sticky bottom-0 left-0 right-0 p-3 bg-white/95 dark:bg-card-dark/95 backdrop-blur-lg border-t border-border-light dark:border-border-dark flex gap-1.5 z-40 overflow-x-auto no-scrollbar">
        {isPlanning ? (
          <>
            <button
              type="button"
              disabled
              className={`flex-1 min-w-[72px] py-2.5 rounded-xl font-bold text-xs opacity-45 ${mode === MODE_ROTEIRO ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              Roteiro
            </button>
            <button
              type="button"
              onClick={() => setMode(MODE_TDV)}
              className={`flex-1 min-w-[72px] py-2.5 rounded-xl font-bold text-xs ${mode === MODE_TDV ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              TDV
            </button>
            <button
              type="button"
              onClick={() => setMode(MODE_DOCUMENTOS)}
              className={`flex-1 min-w-[72px] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 ${mode === MODE_DOCUMENTOS ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              <Icon name="folder_shared" className="text-sm" />
              Docs
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
              className={`flex-1 min-w-[72px] py-2.5 rounded-xl font-bold text-xs ${mode === MODE_ROTEIRO ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              Roteiro
            </button>
            <button
              type="button"
              onClick={() => setMode(MODE_DOCUMENTOS)}
              className={`flex-1 min-w-[72px] py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 ${mode === MODE_DOCUMENTOS ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              <Icon name="folder_shared" className="text-sm" />
              Docs
            </button>
          </>
        )}
      </div>
    </div>
  )
}
