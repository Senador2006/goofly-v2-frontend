import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { memoryService } from '../services/memoryService'
import { tripService } from '../services/tripService'
import { formatDate } from '../utils/formatters'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PLACEHOLDER_THUMB } from '../constants/placeholders'

export function Memories() {
  useDocumentTitle('Memórias')
  const [searchParams] = useSearchParams()
  const tripIdParam = searchParams.get('tripId')
  const [tripId, setTripId] = useState(tripIdParam)
  const [memories, setMemories] = useState([])
  const [memoryMap, setMemoryMap] = useState(null)
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setError(null)
        const [mapData, tripsData] = await Promise.all([
          memoryService.getMap(),
          tripService.getTrips(),
        ])
        setMemoryMap(mapData)
        setTrips(Array.isArray(tripsData) ? tripsData : [])
        if (tripIdParam) {
          const mems = await memoryService.getByTrip(tripIdParam)
          setMemories(Array.isArray(mems) ? mems : [])
          setTripId(tripIdParam)
        } else if (tripsData?.length > 0) {
          setTripId(tripsData[0].id)
          const mems = await memoryService.getByTrip(tripsData[0].id)
          setMemories(Array.isArray(mems) ? mems : [])
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Erro ao carregar memórias')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tripIdParam])

  const handleTripChange = async (tid) => {
    setTripId(tid)
    try {
      const mems = await memoryService.getByTrip(tid)
      setMemories(Array.isArray(mems) ? mems : [])
    } catch (_) {
      setMemories([])
    }
  }

  if (loading) return <LoadingSpinner />
  if (error) {
    return (
      <div>
        <Header title="Memórias" subtitle="" />
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl">{error}</div>
      </div>
    )
  }

  const stats = [
    { label: 'Total de Memórias', value: String(memoryMap?.total_memories || 0), change: '' },
    { label: 'Viagens com Memórias', value: String(memoryMap?.trips_with_memories?.length || 0), change: '' },
  ]

  return (
    <div className="flex flex-col min-h-[calc(100vh-2rem)]">
      <Header title="Memórias & Mapa" subtitle="Seu diário de viagens" />
      <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex gap-4 mb-4 overflow-x-auto no-scrollbar">
            {stats.map((s) => (
              <div
                key={s.label}
                className="min-w-[180px] flex-1 rounded-xl p-5 border border-border-light dark:border-border-dark bg-white/50 dark:bg-white/5"
              >
                <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mb-4 overflow-x-auto no-scrollbar">
            {trips.map((t) => {
              const firstDest = t.destinations?.[0]
              return (
                <button
                  key={t.id}
                  onClick={() => handleTripChange(t.id)}
                  className={`flex items-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap ${
                    tripId === t.id ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'
                  }`}
                >
                  {firstDest ? `${firstDest.city}` : `Viagem ${t.id}`}
                </button>
              )
            })}
          </div>
          <div className="flex-1 min-h-[300px] rounded-xl overflow-hidden shadow-2xl border-4 border-border-light dark:border-border-dark relative bg-[#2d2c14] dark:bg-[#1a190a]">
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-black text-white/10">Mapa Mundi</span>
            </div>
            {(memoryMap?.points || []).slice(0, 5).map((p, i) => (
              <div
                key={p.id || i}
                className="absolute size-3 bg-primary rounded-full shadow-primary"
                style={{
                  left: `${15 + i * 20}%`,
                  top: '40%',
                }}
              />
            ))}
          </div>
        </div>

        <aside className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 bg-white dark:bg-card-dark border-l border-border-light dark:border-border-dark flex flex-col overflow-hidden">
          <div className="p-6 border-b border-border-light dark:border-border-dark">
            <h3 className="text-xl font-bold">Memórias da Viagem</h3>
            <p className="text-sm text-text-secondary mt-1">
              {tripId ? `${memories.length} memórias` : 'Selecione uma viagem'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {memories.length > 0 ? (
              memories.map((mem) => (
                <div key={mem.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-primary" />
                    <span className="text-xs font-bold text-text-secondary uppercase tracking-tighter">
                      {formatDate(mem.created_at || mem.date_taken)}
                    </span>
                  </div>
                  <div className="rounded-xl overflow-hidden shadow-sm border border-border-light dark:border-border-dark">
                    <img
                      src={mem.photo_url || mem.image_url || PLACEHOLDER_THUMB}
                      alt={mem.caption || 'Memória'}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4 bg-background-light dark:bg-[#23220f]">
                      <p className="text-xs text-text-secondary leading-relaxed">{mem.caption || mem.location}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                icon="add_a_photo"
                title="Nenhuma memória ainda"
                description="Adicione fotos da sua viagem para criar memórias."
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
