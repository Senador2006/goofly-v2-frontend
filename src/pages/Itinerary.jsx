import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { TinderView } from '../components/itinerary/TinderView'
import { DocumentosView } from '../components/itinerary/DocumentosView'
import { tripService } from '../services/tripService'
import { useAuth } from '../context/AuthContext'

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const isPlanning = trip?.status === 'planejando'
  const hasPlanejamentoCompleto = ['planejamento_completo', 'premium'].includes(user?.subscription_type) &&
    (!user?.subscription_expires_at || new Date(user.subscription_expires_at) > new Date())

  const handleDeletePlanning = async () => {
    try {
      setDeleting(true)
      await tripService.deleteTrip(tripId)
      navigate('/trips')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erro ao apagar planejamento')
    } finally {
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
  const activities = itinerary?.activities || []
  const rawDays = [...new Set(activities.map((a) => a.day).filter((d) => d != null && d !== ''))]
  const numericDays = rawDays.every((d) => typeof d === 'number' || /^\d+$/.test(String(d)))
    ? rawDays.map((d) => (typeof d === 'number' ? d : parseInt(d, 10))).sort((a, b) => a - b)
    : rawDays.sort()
  const days = numericDays.length > 0 ? numericDays : [1]
  const effectiveSelectedDay = days.includes(selectedDay) ? selectedDay : (days[0] ?? 1)

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-4rem)] lg:h-[calc(100vh-2rem)] -m-4 lg:-m-8">
      <section
        className={`w-full lg:w-[450px] xl:w-[500px] flex-shrink-0 flex flex-col border-r border-border-light dark:border-border-dark bg-white dark:bg-card-dark overflow-hidden ${
          isPlanning && (mode === MODE_TDV || mode === MODE_DOCUMENTOS) ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-6 pb-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-text-secondary mb-4">
            <span>Início</span>
            <Icon name="chevron_right" className="text-xs" />
            <span>Roteiros</span>
            <Icon name="chevron_right" className="text-xs" />
            <span className="text-[#1c1c0d] dark:text-white">
              {firstDest ? `${firstDest.city}, ${firstDest.country}` : 'Viagem'}
            </span>
          </div>
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-none mb-2">
                Criador de Roteiros
              </h1>
              <p className="text-sm text-text-secondary">Rota otimizada por IA</p>
            </div>
            {isPlanning && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-600 dark:text-red-400 hover:bg-red-500/10 shrink-0"
              >
                <Icon name="delete" />
                Apagar planejamento
              </Button>
            )}
          </div>
          {showDeleteConfirm && (
            <div className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-text-secondary mb-3">
                Tem certeza que deseja apagar este planejamento? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeletePlanning}
                  disabled={deleting}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deleting ? 'Apagando...' : 'Sim, apagar'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
          {isPlanning && (
            <div className="flex gap-2 mb-4 flex-wrap">
              <button
                onClick={() => { setMode(MODE_ROTEIRO); refetchItineraryImmediate(); }}
                className={`px-4 py-2 rounded-full text-sm font-bold ${
                  mode === MODE_ROTEIRO ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'
                }`}
              >
                Roteiro
              </button>
              <button
                onClick={() => setMode(MODE_TDV)}
                className={`px-4 py-2 rounded-full text-sm font-bold ${
                  mode === MODE_TDV ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'
                }`}
              >
                Tinder de Viagens
              </button>
              <button
                onClick={() => setMode(MODE_DOCUMENTOS)}
                className={`px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 ${
                  mode === MODE_DOCUMENTOS ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'
                }`}
              >
                <Icon name="folder_shared" className="text-sm" />
                Documentos
                {!hasPlanejamentoCompleto && <Icon name="lock" className="text-xs opacity-70" />}
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 border-b border-border-light dark:border-border-dark">
            {days.map((day, dayIndex) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-5 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
                  effectiveSelectedDay === day ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'
                }`}
              >
                Dia {dayIndex + 1}
              </button>
            ))}
            {days.length === 0 && (
              <button
                onClick={() => setSelectedDay(1)}
                className="px-5 py-2 rounded-full text-sm font-bold bg-primary text-black"
              >
                Dia 1
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {activities
            .filter((a) => !effectiveSelectedDay || a.day === effectiveSelectedDay)
            .map((act, idx) => (
              <div key={act.id || idx} className="relative pl-8">
                <div className="absolute left-0 top-0 bottom-[-32px] w-px border-l-2 border-dashed border-primary" />
                <div className="absolute left-[-5px] top-1 size-3 rounded-full bg-primary border-4 border-white dark:border-card-dark ring-2 ring-primary" />
                <div className="bg-background-light dark:bg-[#23220f] p-4 rounded-xl shadow-sm border border-border-light dark:border-border-dark">
                  <div className="flex justify-between items-start mb-2">
                    {act.image_url && (
                      <div
                        className="w-full h-32 rounded-xl bg-cover bg-center mb-3"
                        style={{ backgroundImage: `url(${act.image_url})` }}
                      />
                    )}
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      {act.startTime || act.start_time || act.time || '09:00'}
                      {' · '}
                      {act.duration
                        ? act.duration
                        : act.duration_minutes
                          ? `${Math.round(act.duration_minutes / 60 * 10) / 10}h`
                          : '2h'}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg mb-1">{act.name}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{act.description || act.notes}</p>
                </div>
              </div>
            ))}
          {activities.length === 0 && (
            <div className="text-center py-12 text-text-secondary">
              <Icon name="route" className="text-4xl mb-4 opacity-50" />
              <p>Nenhuma atividade no roteiro ainda.</p>
              <p className="text-sm mt-2">
                {isPlanning
                  ? 'Use o Tinder de Viagens para descobrir lugares e adicionar ao roteiro.'
                  : 'Adicione lugares em Descobrir para gerar o roteiro.'}
              </p>
            </div>
          )}
        </div>
      </section>

      <section
        className={`flex-1 relative bg-gray-200 dark:bg-gray-800 overflow-hidden ${
          isPlanning && (mode === MODE_TDV || mode === MODE_DOCUMENTOS) ? 'flex' : 'hidden lg:flex'
        }`}
      >
        {isPlanning && (
          <div
            className="flex-1 flex flex-col overflow-hidden"
            style={{ display: mode === MODE_TDV ? 'flex' : 'none' }}
          >
            <TinderView
              tripId={tripId}
              trip={trip}
              onItineraryUpdate={refetchItinerary}
              isActive={mode === MODE_TDV}
            />
          </div>
        )}
        {isPlanning && mode === MODE_DOCUMENTOS ? (
          <div className="flex-1 flex flex-col bg-white dark:bg-card-dark overflow-hidden">
            <DocumentosView tripId={tripId} trip={trip} hasPlanejamentoCompleto={hasPlanejamentoCompleto} onUpgrade={refreshUser} />
          </div>
        ) : null}
        {(!isPlanning || (mode !== MODE_TDV && mode !== MODE_DOCUMENTOS)) ? (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-slate-100 dark:from-gray-800 dark:to-gray-900" />
            <div className="absolute top-6 right-6 flex flex-col gap-2">
              <button className="bg-white dark:bg-card-dark size-10 rounded-full flex items-center justify-center shadow-lg">
                <Icon name="add" />
              </button>
              <button className="bg-white dark:bg-card-dark size-10 rounded-full flex items-center justify-center shadow-lg">
                <Icon name="remove" />
              </button>
              <button className="bg-white dark:bg-card-dark size-10 rounded-full flex items-center justify-center shadow-lg mt-4">
                <Icon name="my_location" />
              </button>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-text-secondary text-sm">Mapa (integração futura)</span>
            </div>
          </>
        ) : null}
      </section>

      <div className="lg:hidden fixed bottom-20 left-0 right-0 p-4 bg-white dark:bg-card-dark border-t border-border-light dark:border-border-dark flex gap-2 z-40 overflow-x-auto no-scrollbar">
        {isPlanning && (
          <>
            <button
              onClick={() => { setMode(MODE_ROTEIRO); refetchItineraryImmediate(); }}
              className={`flex-1 min-w-[80px] py-3 rounded-full font-bold text-sm ${mode === MODE_ROTEIRO ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              Roteiro
            </button>
            <button
              onClick={() => setMode(MODE_TDV)}
              className={`flex-1 min-w-[80px] py-3 rounded-full font-bold text-sm ${mode === MODE_TDV ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              Tinder
            </button>
            <button
              onClick={() => setMode(MODE_DOCUMENTOS)}
              className={`flex-1 min-w-[80px] py-3 rounded-full font-bold text-sm flex items-center justify-center gap-1 ${mode === MODE_DOCUMENTOS ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'}`}
            >
              <Icon name="folder_shared" className="text-sm" />
              Docs
            </button>
          </>
        )}
        <Button className="flex-1 min-w-[80px] justify-center text-sm">Timeline</Button>
        <Button variant="secondary" className="flex-1 min-w-[80px] justify-center gap-2 text-sm">
          <Icon name="map" />
          Mapa
        </Button>
      </div>
    </div>
  )
}
