import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Button } from '../components/common/Button'
import { EmptyState } from '../components/common/EmptyState'
import { Icon } from '../components/common/Icon'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { tripService } from '../services/tripService'
import { discoverTdvPath, pickDiscoverTrip } from '../utils/discoverTripTarget'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/**
 * Entrada de nav “Descobrir” → deep-link para o TDV da viagem mais relevante (B13).
 * Sem viagem: empty state com CTA para criar (não mais FeatureComingSoon).
 */
export function Discover() {
  useDocumentTitle('Descobrir')
  const navigate = useNavigate()
  const [phase, setPhase] = useState('loading') // loading | empty | error

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const trips = await tripService.getTrips()
        if (cancelled) return
        const trip = pickDiscoverTrip(trips)
        if (trip?.id != null) {
          navigate(discoverTdvPath(trip.id), { replace: true })
          return
        }
        setPhase('empty')
      } catch {
        if (!cancelled) setPhase('error')
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [navigate])

  if (phase === 'loading') return <LoadingSpinner />

  if (phase === 'error') {
    return (
      <div>
        <Header title="Descobrir" subtitle="Tinder de Viagens" />
        <div className="p-4">
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl mb-4">
            Não foi possível carregar suas viagens.
          </div>
          <Button type="button" onClick={() => window.location.reload()}>
            Tentar de novo
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Descobrir" subtitle="Tinder de Viagens" />
      <EmptyState
        icon="explore"
        title="Crie uma viagem para descobrir lugares"
        description="O Tinder de Viagens (TDV) fica dentro do planejamento. Depois de criar uma viagem, você curte e descarta lugares por aqui."
        action={
          <Link to="/trips/new">
            <Button>
              <Icon name="add" />
              Nova viagem
            </Button>
          </Link>
        }
      />
    </div>
  )
}
