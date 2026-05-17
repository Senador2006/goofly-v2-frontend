import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { documentService } from '../../services/documentService'
import { userService } from '../../services/userService'

/**
 * Assistente de Documentos na área de planejamento.
 * Exibe checklist e lista de bagagem gerados pelo agente de IA.
 * Disponível apenas para usuários com planejamento completo (pago).
 */
export function DocumentosView({
  tripId,
  trip,
  hasPlanejamentoCompleto,
  onUpgrade,
  isActive = true,
}) {
  const [checklist, setChecklist] = useState(null)
  const [luggage, setLuggage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const loadedForTripRef = useRef(null)

  useEffect(() => {
    if (loadedForTripRef.current === tripId) return
    loadedForTripRef.current = null
    setChecklist(null)
    setLuggage(null)
    setError(null)
  }, [tripId])

  useEffect(() => {
    if (!tripId || !hasPlanejamentoCompleto || !isActive) return
    if (loadedForTripRef.current === tripId) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const [checklistData, luggageData] = await Promise.all([
          documentService.getChecklist(tripId),
          documentService.getLuggageRecommendations(tripId),
        ])
        if (cancelled) return
        setChecklist(checklistData)
        setLuggage(luggageData)
        loadedForTripRef.current = tripId
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Erro ao carregar documentos')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [tripId, hasPlanejamentoCompleto, isActive])

  const handleDevUpgrade = async () => {
    if (!tripId) return
    try {
      await userService.activatePlanningDev(tripId)
      await onUpgrade?.()
    } catch (_) {}
  }

  if (!hasPlanejamentoCompleto) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 md:p-12">
        <div className="max-w-md w-full text-center">
          <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Icon name="lock" className="text-4xl text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Assistente de Documentos</h2>
          <p className="text-text-secondary mb-6">
            Checklist de viagem, recomendações de bagagem por IA e apoio documental — tudo alinhado ao seu roteiro (não é o
            mesmo fluxo da página Descobrir). Incluso no Planejamento Completo.
          </p>
          <Link
            to={`/pagamento?tripId=${encodeURIComponent(tripId || '')}`}
            className="w-full rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 bg-primary text-foreground hover:opacity-90 hover:shadow-primary px-8 py-4 text-base"
          >
            <Icon name="workspace_premium" />
            Adquirir Planejamento Completo
          </Link>
          {import.meta.env.DEV && (
            <Button variant="secondary" className="w-full mt-2" size="sm" onClick={handleDevUpgrade}>
              Testar plano (dev)
            </Button>
          )}
          <p className="text-xs text-text-secondary mt-4">
            Documentos + Bagagem + Roteiro otimizado
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <LoadingSpinner />

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm">{error}</div>
      </div>
    )
  }

  const docs = checklist?.checklist || []
  const categories = luggage?.categories || []

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <section>
          <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Icon name="folder_shared" className="text-primary" />
            Cofre de Documentos
          </h3>
          {docs.length > 0 ? (
            <div className="grid gap-3">
              {docs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex justify-between items-center p-4 rounded-xl bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark"
                >
                  <div className="flex gap-3 items-center">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Icon name="badge" />
                    </div>
                    <div>
                      <p className="font-bold">{doc.name}</p>
                      <p className="text-xs text-text-secondary">{doc.required ? 'Obrigatório' : 'Opcional'}</p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full ${
                      doc.status === 'valid' || doc.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}
                  >
                    {doc.status === 'valid' || doc.status === 'completed' ? 'Concluído' : 'Pendente'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-secondary text-sm">Checklist será gerado para sua viagem.</p>
          )}
        </section>

        <section>
          <h3 className="text-xl font-bold flex items-center gap-2 mb-4">
            <Icon name="luggage" className="text-primary" />
            Lista de Bagagem
          </h3>
          {categories.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {categories.map((cat) => (
                <div key={cat.id} className="flex flex-col gap-3">
                  <h5 className="font-bold flex items-center gap-2">
                    <Icon name="apparel" className="text-primary text-sm" />
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
                            className="size-4 rounded border-2 border-primary text-primary focus:ring-primary"
                          />
                          <span className="text-sm font-medium">{item.name}</span>
                          {item.essential && (
                            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-primary/20 text-foreground rounded-full uppercase">
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
            <p className="text-text-secondary text-sm">Recomendações de bagagem serão geradas para sua viagem.</p>
          )}
        </section>
      </div>
    </div>
  )
}
