import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { TinderView } from '../components/itinerary/TinderView'
import { DocumentosView } from '../components/itinerary/DocumentosView'
import { tripService } from '../services/tripService'
import { useAuth } from '../context/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const MODE_ROTEIRO = 'roteiro'
const MODE_TDV = 'tdv'
const MODE_DOCUMENTOS = 'documentos'

export function Itinerary() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
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
  const hasPlanejamentoCompleto =
    (user?.subscription_type === 'planejamento_completo' || user?.subscription_type === 'premium') &&
    (!user?.subscription_expires_at || new Date(user.subscription_expires_at) > new Date())

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

  useEffect(() => {
    const load = async () => {
      try {
        setError(null)
        const [tripData, itineraryData] = await Promise.all([
          tripService.getTrip(tripId),
          tripService.getItinerary(tripId),
        ])
        setTrip(tripData)
        setItinerary(itineraryData)
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Erro ao carregar roteiro')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tripId])

  const refetchTimeoutRef = useRef(null)
  const refetchItineraryImmediate = useCallback(async () => {
    if (!tripId) return
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current)
      refetchTimeoutRef.current = null
    }
    try {
      const itineraryData = await tripService.getItinerary(tripId)
      setItinerary(itineraryData)
    } catch {
      // silencioso
    }
  }, [tripId])
  const refetchItinerary = useCallback(() => {
    if (!tripId) return
    if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current)
    refetchTimeoutRef.current = setTimeout(refetchItineraryImmediate, 400)
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

  const handleFinalizeTdv = useCallback(async () => {
    if (!tripId) return
    setFinalizingTdv(true)
    setError(null)
    try {
      const result = await tripService.finalizeTdvPlanning(tripId)
      if (result?.trip) setTrip(result.trip)
      if (result?.itinerary) setItinerary(result.itinerary)
      setMode(MODE_ROTEIRO)
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Não foi possível finalizar o TDV')
    } finally {
      setFinalizingTdv(false)
    }
  }, [tripId])

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
  const rawDays = [...new Set(activities.map((a) => a.day).filter((d) => d != null && d !== ''))]
  const numericDays = rawDays.every((d) => typeof d === 'number' || /^\d+$/.test(String(d)))
    ? rawDays.map((d) => (typeof d === 'number' ? d : parseInt(d, 10))).sort((a, b) => a - b)
    : rawDays.sort()
  const days = numericDays.length > 0 ? numericDays : [1]
  const effectiveSelectedDay = days.includes(selectedDay) ? selectedDay : (days[0] ?? 1)

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
            <p className="text-xs sm:text-sm text-text-secondary mt-0.5">Rota otimizada por IA · {destLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {modeTabs}
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

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {showRoteiroSidebar ? (
          <section className="w-full lg:w-[min(100%,420px)] xl:w-[460px] flex-shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-border-light dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden min-h-0">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {isPlanning && (
                <div className="p-4 rounded-2xl bg-primary/[0.12] dark:bg-primary/[0.08] border border-primary/25 text-sm leading-relaxed text-[#1c1c0d] dark:text-white/90">
                  <span className="font-bold text-primary dark:text-primary block mb-1">Tinder de Viagens</span>
                  Use o modo <strong>TDV</strong> nas abas acima para escolher lugares; quando estiver satisfeito, finalize para gerar o roteiro.
                </div>
              )}
              {itinerary?._premiumRestriction && (
                <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/25 text-sm">
                  <p className="font-bold text-[#1c1c0d] dark:text-white mb-1">Prévia do roteiro</p>
                  <p className="text-text-secondary mb-3">
                    {itinerary._premiumRestriction.message} ({itinerary._premiumRestriction.visible} de{' '}
                    {itinerary._premiumRestriction.total} atividades).
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    onClick={() => navigate(`/pagamento?tripId=${encodeURIComponent(tripId)}`)}
                  >
                    Desbloquear completo
                  </Button>
                </div>
              )}
              {activities
                .filter((a) => !effectiveSelectedDay || a.day === effectiveSelectedDay)
                .map((act, idx) => (
                  <div key={act.id || idx} className="relative pl-7">
                    <div className="absolute left-0 top-0 bottom-[-24px] w-px border-l-2 border-dashed border-primary/80" />
                    <div className="absolute left-[-4px] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-white dark:ring-card-dark" />
                    <div className="bg-background-light dark:bg-[#23220f] p-4 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        {act.startTime || act.start_time || '09:00'} · {act.duration || '1h'}
                      </span>
                      <h3 className="font-bold text-base mt-1 text-[#1c1c0d] dark:text-white">{act.name}</h3>
                      <p className="text-sm text-text-secondary leading-relaxed mt-2">{act.description || act.notes}</p>
                    </div>
                  </div>
                ))}
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
          {mode === MODE_DOCUMENTOS ? (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white dark:bg-card-dark">
              <DocumentosView tripId={tripId} trip={trip} hasPlanejamentoCompleto={hasPlanejamentoCompleto} onUpgrade={refreshUser} />
            </div>
          ) : null}
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
