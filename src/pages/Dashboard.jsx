import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DashboardHeader } from '../components/layout/DashboardHeader'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { dashboardService } from '../services/dashboardService'
import { formatDate } from '../utils/formatters'
import { safeImageUrl } from '../utils/safeImageUrl'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { PLACEHOLDER_COVER } from '../constants/placeholders'

export function Dashboard() {
  useDocumentTitle('Dashboard')
  const [overview, setOverview] = useState(null)
  const [recentMemories, setRecentMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setError(null)
        // Uma chamada: overview já traz recent_memories (sem N+1 no client).
        const overviewData = await dashboardService.getOverview().catch(() => null)
        if (cancelled) return
        setOverview(overviewData)
        setRecentMemories(
          Array.isArray(overviewData?.recent_memories) ? overviewData.recent_memories : []
        )
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Erro ao carregar dashboard')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
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
  const daysUntil = overview?.days_until_trip ?? nextTrip?.days_until
  const destCity = String(nextTrip?.first_destination || '').trim() || null
  const destCountry = String(nextTrip?.country || '').trim() || null
  const destinationLabel =
    destCity && destCountry
      ? `${destCity}, ${destCountry}`
      : destCity || destCountry || 'Destino a definir'
  const dateRange =
    nextTrip?.arrival_date && nextTrip?.departure_date
      ? `${formatDate(nextTrip.arrival_date)} – ${formatDate(nextTrip.departure_date)}`
      : nextTrip?.arrival_date
        ? formatDate(nextTrip.arrival_date)
        : null

  return (
    <div className="flex flex-col min-h-[calc(100vh-2rem)]">
      <DashboardHeader />

      <div className="bg-primary rounded-2xl p-8 md:p-10 mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-foreground mb-3">
          Para onde agora?
        </h1>
        <p className="text-foreground/80 text-base md:text-lg max-w-xl mb-6">
          Sua próxima grande aventura está a poucos cliques. Deixe-nos ajudar a planejar a fuga perfeita.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link to="/trips/new">
            <Button variant="inverse">
              <Icon name="add" />
              Começar a Planejar
            </Button>
          </Link>
          <Link to="/discover">
            <Button variant="hero-light">
              Abrir Tinder de Viagens
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        <div className="bg-white dark:bg-card-dark rounded-2xl p-6 border border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground dark:text-white">Próxima Viagem</h2>
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
                style={{ backgroundImage: `url(${PLACEHOLDER_COVER})` }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
                  {daysUntil != null ? `EM ${daysUntil} DIAS` : 'DATAS A DEFINIR'}
                </p>
                <h3 className="text-xl font-bold text-foreground dark:text-white truncate">
                  {destinationLabel}
                </h3>
                {dateRange ? (
                  <p className="text-sm text-text-secondary mt-1">{dateRange}</p>
                ) : null}
                <div className="flex items-center justify-end gap-3 mt-4 flex-wrap">
                  <Link to={`/trips/${nextTrip.id}/itinerary`} className="shrink-0">
                    <Button variant="primary" size="sm">
                      Ver viagem
                    </Button>
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

        <div className="bg-white dark:bg-card-dark rounded-2xl p-6 border border-border-light dark:border-border-dark">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-foreground dark:text-white">Memórias Recentes</h2>
            <Link
              to="/memories"
              className="text-sm font-bold text-primary hover:underline"
            >
              EXPLORAR ÁREA
            </Link>
          </div>
          {recentMemories.length > 0 ? (
            <div
              className={`grid gap-4 ${
                recentMemories.length > 0 ? 'grid-cols-3' : 'grid-cols-1 max-w-[140px]'
              }`}
            >
              {recentMemories.slice(0, 2).map((mem, i) => {
                const src = safeImageUrl(mem.photo_url || mem.image_url)
                return (
                  <Link
                    key={mem.id ?? i}
                    to="/memories"
                    className="aspect-square rounded-xl bg-center bg-cover overflow-hidden group"
                    style={
                      src
                        ? { backgroundImage: `url("${src.replace(/"/g, '')}")` }
                        : undefined
                    }
                  >
                    <Icon name="add_a_photo" className="text-2xl" />
                    <span className="text-xs font-bold">Adicionar</span>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center">
              <Icon name="add_a_photo" className="text-4xl text-text-secondary mb-3 opacity-50" />
              <p className="text-text-secondary text-sm mb-4">
                Suas memórias de viagem aparecerão aqui
              </p>
              <Link to="/memories">
                <Button size="sm" variant="secondary">
                  Ver memórias
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

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
