import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminService } from '../services/adminService'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../context/AuthContext'

function MetricCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-card-dark p-5">
      <p className="text-xs uppercase tracking-wide text-text-secondary mb-1">{label}</p>
      <p className="text-2xl font-black text-foreground dark:text-white">{value}</p>
      {sub ? <p className="text-xs text-text-secondary mt-1">{sub}</p> : null}
    </div>
  )
}

export function AdminDashboard() {
  useDocumentTitle('Admin')
  const { user } = useAuth()
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setError(null)
        const data = await adminService.getMetricsOverview()
        if (!cancelled) setMetrics(data)
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Erro ao carregar métricas')
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

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground dark:text-white">
              Administração
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              Logado como {user?.email}
            </p>
          </div>
          <Link
            to="/dashboard"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Voltar ao app
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {metrics?._note && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">{metrics._note}</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <MetricCard label="Usuários" value={metrics?.users?.total ?? '—'} sub={`+${metrics?.users?.new_last_7d ?? 0} (7d) · +${metrics?.users?.new_last_30d ?? 0} (30d)`} />
          <MetricCard label="Viagens" value={metrics?.trips?.total ?? '—'} />
          <MetricCard
            label="Pagamentos aprovados"
            value={metrics?.payments?.approved_count ?? '—'}
            sub={
              metrics?.payments?.revenue_total != null
                ? `Receita: R$ ${Number(metrics.payments.revenue_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                : null
            }
          />
          <MetricCard label="Likes (TDV)" value={metrics?.engagement?.likes_total ?? '—'} />
          <MetricCard label="Dislikes (TDV)" value={metrics?.engagement?.dislikes_total ?? '—'} />
        </div>

        {metrics?.trips?.by_status && Object.keys(metrics.trips.by_status).length > 0 && (
          <div className="rounded-2xl border border-border-light dark:border-border-dark p-5">
            <h2 className="text-sm font-bold text-foreground dark:text-white mb-3">Viagens por status</h2>
            <ul className="space-y-2 text-sm">
              {Object.entries(metrics.trips.by_status).map(([status, count]) => (
                <li key={status} className="flex justify-between text-text-secondary">
                  <span>{status}</span>
                  <span className="font-semibold text-foreground dark:text-white">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
