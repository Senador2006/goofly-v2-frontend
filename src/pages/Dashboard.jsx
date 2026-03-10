import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardHeader } from '../components/layout/DashboardHeader'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { dashboardService } from '../services/dashboardService'
import { memoryService } from '../services/memoryService'
import { formatDate } from '../utils/formatters'

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80'
const MEMORY_IMAGES = [
  'https://images.unsplash.com/photo-1523482580670-f6bf7f562d61?w=400&q=80',
  'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80',
]

export function Dashboard() {
  const [overview, setOverview] = useState(null)
  const [recentMemories, setRecentMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setError(null)
        const [overviewData, memoryMapData] = await Promise.all([
          dashboardService.getOverview().catch(() => null),
          memoryService.getMap().catch(() => ({ points: [], total_memories: 0 })),
        ])
        setOverview(overviewData)
        const trips = overviewData?.recent_trips || []
        const memoriesByTrip = []
        for (const t of trips.slice(0, 2)) {
          try {
            const mems = await memoryService.getByTrip(t.id).catch(() => [])
            if (mems?.[0]) {
              const year = new Date().getFullYear().toString().slice(-2)
              memoriesByTrip.push({
                ...mems[0],
                tripLabel: `${t.first_destination || 'Viagem'} '${year}`,
              })
            }
          } catch (_) {}
        }
        const fallbackMemories = [
          { photo_url: MEMORY_IMAGES[0], tripLabel: "Sydney '23" },
          { photo_url: MEMORY_IMAGES[1], tripLabel: "London '23" },
        ]
        setRecentMemories(memoriesByTrip.length > 0 ? memoriesByTrip : fallbackMemories)
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Erro ao carregar dashboard')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <LoadingSpinner />
  if (error) {
    return (
      <div className="p-4">
        <DashboardHeader />
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl">{error}</div>
      </div>
    )
  }

  const nextTrip = overview?.next_trip
  const recentTrips = overview?.recent_trips || []
  const daysUntil = overview?.days_until_trip ?? nextTrip?.days_until
  const firstDest = nextTrip ? { city: nextTrip.first_destination, country: nextTrip.country } : null
  const dateRange = nextTrip?.arrival_date ? formatDate(nextTrip.arrival_date) : '24 Nov - 02 Dez'

  return (
    <div className="flex flex-col min-h-[calc(100vh-2rem)]">
      <DashboardHeader />

      {/* Hero - Call to Action */}
      <div className="bg-primary rounded-2xl p-8 md:p-10 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-[#1c1c0d] mb-3">
          Para onde agora?
        </h1>
        <p className="text-[#1c1c0d]/80 text-base md:text-lg max-w-xl mb-6">
          Sua próxima grande aventura está a poucos cliques. Deixe-nos ajudar a planejar a fuga perfeita.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link to="/trips/new">
            <Button
              variant="secondary"
              className="bg-[#1c1c0d] text-white hover:bg-[#1c1c0d]/90 hover:text-white"
            >
              <Icon name="add" />
              Começar a Planejar
            </Button>
          </Link>
          <Link to="/discover">
            <Button className="bg-white/90 text-[#1c1c0d] hover:bg-white border-2 border-[#1c1c0d]/20">
              Explorar Destinos
            </Button>
          </Link>
        </div>
      </div>

      {/* Two Column Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Upcoming Trip Card */}
        <div className="bg-white dark:bg-card-dark rounded-2xl p-6 border border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#1c1c0d] dark:text-white">Próxima Viagem</h2>
            <Link
              to="/trips"
              className="text-sm font-bold text-primary hover:underline"
            >
              VER TODAS
            </Link>
          </div>
          {nextTrip ? (
            <div className="flex gap-5">
              <div
                className="size-24 rounded-full flex-shrink-0 bg-center bg-cover border-2 border-primary"
                style={{ backgroundImage: `url(${PLACEHOLDER_IMAGE})` }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                  EM {daysUntil ?? 12} DIAS
                </p>
                <h3 className="text-xl font-bold text-[#1c1c0d] dark:text-white truncate">
                  {firstDest ? `${firstDest.city}, ${firstDest.country}` : 'Tokyo, Japan'}
                </h3>
                <p className="text-sm text-text-secondary mt-1">{dateRange}</p>
                <div className="flex items-center gap-2 mt-4">
                  <div className="flex -space-x-2">
                    <div className="size-8 rounded-full bg-surface-light dark:bg-surface-dark border-2 border-white dark:border-card-dark flex items-center justify-center text-xs font-bold">
                      +2
                    </div>
                  </div>
                  <Link
                    to={`/trips/${nextTrip.id}`}
                    className="ml-auto text-sm font-semibold text-[#1c1c0d] dark:text-white flex items-center gap-1 hover:text-primary"
                  >
                    Gerenciar
                    <Icon name="arrow_forward" className="text-sm" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <Icon name="luggage" className="text-4xl text-text-secondary mb-3 opacity-50" />
              <p className="text-text-secondary text-sm mb-4">Nenhuma viagem planejada</p>
              <Link to="/trips/new">
                <Button size="sm">Criar Viagem</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Recent Memories Card */}
        <div className="bg-white dark:bg-card-dark rounded-2xl p-6 border border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#1c1c0d] dark:text-white">Memórias Recentes</h2>
            <Link
              to="/memories"
              className="text-sm font-bold text-primary hover:underline"
            >
              EXPLORAR ÁREA
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {recentMemories.slice(0, 2).map((mem, i) => (
              <Link
                key={i}
                to="/memories"
                className="aspect-square rounded-xl bg-center bg-cover overflow-hidden group"
                style={{
                  backgroundImage: `url(${mem.photo_url || mem.image_url || MEMORY_IMAGES[i]})`,
                }}
              >
                <div className="w-full h-full bg-black/30 group-hover:bg-black/20 transition-all flex items-end p-3">
                  <span className="text-white text-xs font-bold drop-shadow">{mem.tripLabel}</span>
                </div>
              </Link>
            ))}
            <Link
              to="/memories"
              className="aspect-square rounded-xl border-2 border-dashed border-text-secondary flex flex-col items-center justify-center gap-2 text-text-secondary hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <Icon name="add_a_photo" className="text-2xl" />
              <span className="text-xs font-bold">Adicionar</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-8 border-t border-border-light dark:border-border-dark flex flex-col md:flex-row justify-between items-center gap-4 text-text-secondary text-sm">
        <p>© {new Date().getFullYear()} Goofly Travel Assistance v2.0</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-primary transition-colors">Suporte Rápido</a>
          <a href="#" className="hover:text-primary transition-colors">Privacidade</a>
        </div>
      </footer>
    </div>
  )
}
