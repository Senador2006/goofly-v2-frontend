import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { EmptyState } from '../components/common/EmptyState'
import { documentService } from '../services/documentService'
import { tripService } from '../services/tripService'

function getPreferredTrip(trips = []) {
  if (!Array.isArray(trips) || trips.length === 0) return null
  return trips.find((trip) => trip.status === 'planejando') || trips[0]
}

function getDocumentsErrorMessage(err) {
  const code = err.response?.data?.error?.code
  const message = err.response?.data?.error?.message

  if (code === 'USER_NOT_FOUND' || message === 'User not found') {
    return 'O servidor não encontrou seu usuário para gerar documentos. Como o projeto está rodando sem banco persistente, isso pode acontecer no modo em memória. A viagem ainda aparece na lista, mas o checklist não pode ser gerado até a sessão/usuário ser recriado.'
  }

  return message || 'Erro ao carregar documentos'
}

export function Documents() {
  const [searchParams] = useSearchParams()
  const tripIdParam = searchParams.get('tripId')
  const [tripId, setTripId] = useState(tripIdParam)
  const [trips, setTrips] = useState([])
  const [checklist, setChecklist] = useState(null)
  const [luggage, setLuggage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadTrips = async () => {
      setLoading(true)
      try {
        const data = await tripService.getTrips()
        const tripList = Array.isArray(data) ? data : []
        setTrips(tripList)
        if (!tripIdParam && tripList.length > 0) {
          setTripId(getPreferredTrip(tripList)?.id || null)
        }
        if (tripList.length === 0) setLoading(false)
      } catch (_) {
        setTrips([])
        setLoading(false)
      }
    }
    loadTrips()
  }, [tripIdParam])

  useEffect(() => {
    const load = async () => {
      if (!tripId) {
        setLoading(false)
        setChecklist(null)
        setLuggage(null)
        return
      }
      setLoading(true)
      try {
        setError(null)
        const [checklistData, luggageData] = await Promise.all([
          documentService.getChecklist(tripId),
          documentService.getLuggageRecommendations(tripId),
        ])
        setChecklist(checklistData)
        setLuggage(luggageData)
      } catch (err) {
        setError(getDocumentsErrorMessage(err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [tripId])

  if (loading) return <LoadingSpinner />
  if (trips.length === 0) {
    return (
      <div>
        <Header title="Assistente de Documentos" subtitle="" />
        <EmptyState
          icon="folder_shared"
          title="Nenhuma viagem encontrada"
          description="Crie uma viagem para gerar checklist e lista de bagagem."
          action={
            <a href="/trips/new">
              <Button>Nova Viagem</Button>
            </a>
          }
        />
      </div>
    )
  }

  const selectedTrip = trips.find((t) => t.id === tripId) || getPreferredTrip(trips)
  const firstDest = selectedTrip?.destinations?.[0]
  const docs = checklist?.checklist || []
  const categories = luggage?.categories || []

  return (
    <div>
      <Header
        title="Assistente de Documentos"
        subtitle={
          firstDest
            ? `Viagem para ${firstDest.city}, ${firstDest.country}`
            : 'Selecione uma viagem'
        }
      />
      {tripId && (
        <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
          {trips.map((t) => {
            const d = t.destinations?.[0]
            return (
              <button
                key={t.id}
                onClick={() => setTripId(t.id)}
                className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap ${
                  tripId === t.id ? 'bg-primary text-black' : 'bg-surface-light dark:bg-surface-dark'
                }`}
              >
                {d ? `${d.city}` : `Viagem ${t.id}`}
              </button>
            )
          })}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-5 flex flex-col gap-6">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Icon name="folder_shared" className="text-primary" />
            Cofre de Documentos
          </h3>
          {docs.length > 0 ? (
            <div className="grid gap-4">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="group bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark p-5 rounded-xl shadow-sm"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-4 items-center">
                      <div className="size-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        <Icon name="badge" />
                      </div>
                      <div>
                        <p className="font-bold text-lg">{doc.name}</p>
                        <p className="text-sm text-text-secondary">{doc.reminder || doc.required ? 'Obrigatório' : 'Opcional'}</p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${
                        doc.status === 'valid' || doc.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {doc.status === 'valid' || doc.status === 'completed' ? 'Concluído' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary">Checklist será gerado ao selecionar uma viagem.</p>
          )}
        </section>

        <section className="lg:col-span-7 flex flex-col gap-6">
          <h3 className="text-2xl font-bold flex items-center gap-2">
            <Icon name="luggage" className="text-primary" />
            Lista de Bagagem
          </h3>
          {categories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-4">
                  <h5 className="font-bold flex items-center gap-2">
                    <Icon name="apparel" className="text-primary" />
                    {cat.name}
                  </h5>
                  <div className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-2">
                    <div className="space-y-1">
                      {(cat.items || []).map((item) => (
                        <label
                          key={item.id}
                          className="flex items-center gap-3 p-3 hover:bg-background-light dark:hover:bg-background-dark rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            defaultChecked={item.checked}
                            className="size-5 rounded-full border-2 border-primary text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">{item.name}</span>
                          {item.essential && (
                            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-primary/20 text-black rounded-full uppercase">
                              IA
                            </span>
                          )}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary">Recomendações de bagagem serão geradas para a viagem selecionada.</p>
          )}
        </section>
      </div>
    </div>
  )
}
