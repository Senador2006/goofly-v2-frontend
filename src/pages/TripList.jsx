import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { tripService } from '../services/tripService'
import { formatDateRange } from '../utils/formatters'

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80'
const STATUS_LABELS = { planejando: 'Planejando', ativa: 'Em andamento', concluida: 'Concluída' }

export function TripList() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const filterParam = searchParams.get('status') || 'all'
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const deleteInFlightRef = useRef(null)

  const loadTrips = async () => {
    try {
      setError(null)
      const data = await tripService.getTrips(filterParam !== 'all' ? { status: filterParam } : {})
      setTrips(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erro ao carregar viagens')
      setTrips([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    loadTrips()
  }, [filterParam])

  const handleDelete = async (tripId) => {
    if (deleteInFlightRef.current === tripId) return

    try {
      deleteInFlightRef.current = tripId
      setDeletingId(tripId)
      await tripService.deleteTrip(tripId)
      setConfirmDeleteId(null)
      await loadTrips()
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erro ao apagar viagem')
    } finally {
      deleteInFlightRef.current = null
      setDeletingId(null)
    }
  }

  const filteredTrips = trips

  if (loading) return <LoadingSpinner />
  if (error) {
    return (
      <div>
        <Header title="Minhas Viagens" subtitle="" />
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl">{error}</div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Minhas Viagens" subtitle="Gerencie e planeje suas aventuras" />
      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        {['all', 'planejando', 'ativa', 'concluida'].map((f) => (
          <Link
            key={f}
            to={f === 'all' ? '/trips' : `/trips?status=${f}`}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
              filterParam === f ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'
            }`}
          >
            {f === 'all' ? 'Todas' : STATUS_LABELS[f]}
          </Link>
        ))}
      </div>
      {filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map((trip) => {
            const firstDest = trip.destinations?.[0]
            const lastDest = trip.destinations?.[trip.destinations?.length - 1]
            const dateRange =
              firstDest && lastDest
                ? formatDateRange(firstDest.arrivalDate || firstDest.arrival_date, lastDest.departureDate || lastDest.departure_date)
                : ''
            return (
              <div
                key={trip.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/trips/${trip.id}`)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/trips/${trip.id}`) } }}
                className="group bg-white dark:bg-card-dark rounded-xl overflow-hidden shadow-sm border border-border-light dark:border-border-dark hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div
                  className="h-40 bg-center bg-cover group-hover:scale-105 transition-transform duration-500"
                  style={{ backgroundImage: `url(${PLACEHOLDER_IMAGE})` }}
                />
                <div className="p-6">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">
                    {STATUS_LABELS[trip.status] || trip.status}
                  </span>
                  <h3 className="text-xl font-black mt-1">
                    {firstDest ? `${firstDest.city}, ${firstDest.country}` : 'Viagem'}
                  </h3>
                  <p className="text-sm text-text-secondary flex items-center gap-2 mt-2">
                    <Icon name="calendar_month" className="text-sm" />
                    {dateRange}
                  </p>
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <Link to={`/trips/${trip.id}/itinerary`} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="primary" size="sm" className="w-full justify-center">
                        Roteiro
                      </Button>
                    </Link>
                    <Link to="/discover" onClick={(e) => e.stopPropagation()}>
                      <Button variant="secondary" size="sm">
                        Descobrir
                      </Button>
                    </Link>
                    {confirmDeleteId === trip.id ? (
                      <div className="flex gap-2 w-full mt-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                        <span className="text-xs text-text-secondary self-center flex-1">Apagar?</span>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDelete(trip.id) }}
                          disabled={deletingId === trip.id}
                          className="bg-red-600 hover:bg-red-700 text-white text-xs px-3 py-1"
                        >
                          {deletingId === trip.id ? '...' : 'Sim'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(null) }}
                          disabled={deletingId === trip.id}
                          className="text-xs px-3 py-1"
                        >
                          Não
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setConfirmDeleteId(trip.id) }}
                        className="p-2 rounded-full text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Apagar planejamento"
                      >
                        <Icon name="delete" className="text-lg" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon="luggage"
          title="Nenhuma viagem encontrada"
          description="Crie sua primeira viagem para começar a planejar."
          action={
            <Link to="/trips/new">
              <Button>
                <Icon name="add" />
                Nova Viagem
              </Button>
            </Link>
          }
        />
      )}
      <Link to="/trips/new" className="mt-8 block">
        <Button className="w-full md:w-auto" size="lg">
          <Icon name="add" />
          Nova Viagem
        </Button>
      </Link>
    </div>
  )
}
