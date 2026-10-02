import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { documentService } from '../../services/documentService'
import { userService } from '../../services/userService'
import { useAuth } from '../../context/AuthContext'
import {
  readDocsAssistSession,
  writeDocsAssistSession,
} from '../../utils/docsAssistSession'

/**
 * Assistente de Documentos na área de planejamento.
 * Checklist + bagagem sob CTA (C13) — não dispara agentes no mount.
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
  const [hydrated, setHydrated] = useState(false)
  const generateInFlightRef = useRef(false)
  const { isAdmin } = useAuth()

  useEffect(() => {
    setChecklist(null)
    setLuggage(null)
    setError(null)
    setHydrated(false)
    generateInFlightRef.current = false

    if (!tripId || !hasPlanejamentoCompleto) {
      setHydrated(true)
      return
    }

    const cached = readDocsAssistSession(tripId)
    if (cached) {
      setChecklist(cached.checklist)
      setLuggage(cached.luggage)
    }
    setHydrated(true)
  }, [tripId, hasPlanejamentoCompleto])

  const generateAssist = useCallback(
    async ({ force = false } = {}) => {
      if (!tripId || !hasPlanejamentoCompleto) return
      if (generateInFlightRef.current) return
      generateInFlightRef.current = true
      setLoading(true)
      setError(null)
      try {
        const [checklistData, luggageData] = await Promise.all([
          documentService.getChecklist(tripId, { force }),
          documentService.getLuggageRecommendations(tripId, { force }),
        ])
        setChecklist(checklistData)
        setLuggage(luggageData)
        writeDocsAssistSession(tripId, {
          checklist: checklistData,
          luggage: luggageData,
        })
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Erro ao carregar documentos')
      } finally {
        generateInFlightRef.current = false
        setLoading(false)
      }
    },
    [tripId, hasPlanejamentoCompleto]
  )

  const handleAdminUpgrade = async () => {
    if (!tripId) return
    try {
      await userService.activatePlanningAdmin(tripId)
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
            mesmo fluxo do Tinder de Viagens). Incluso no Planejamento Completo.
          </p>
          {tripId ? (
            <Link
              to={`/pagamento?tripId=${encodeURIComponent(tripId)}`}
              className="w-full rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 bg-primary text-foreground shadow-primary-glow dark:shadow-primary-glow-dark hover:opacity-90 hover:shadow-primary-glow-hover dark:hover:shadow-primary-glow-hover-dark px-8 py-4 text-base"
            >
              <Icon name="workspace_premium" />
              Adquirir Planejamento Completo
            </Link>
          ) : (
            <Link
              to="/pagamento"
              className="w-full rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 bg-primary text-foreground shadow-primary-glow dark:shadow-primary-glow-dark hover:opacity-90 hover:shadow-primary-glow-hover dark:hover:shadow-primary-glow-hover-dark px-8 py-4 text-base"
            >
              <Icon name="workspace_premium" />
              Adquirir Planejamento Completo
            </Link>
          )}
          {isAdmin && (
            <Button variant="secondary" className="w-full mt-2" size="sm" onClick={handleAdminUpgrade}>
              Liberar planejamento completo
            </Button>
          )}
          <p className="text-xs text-text-secondary mt-4">
            Documentos + Bagagem + Roteiro otimizado
          </p>
        </div>
      </div>
    )
  }

  if (!isActive) {
    return null
  }

  if (!hydrated) return <LoadingSpinner />

  if (loading) return <LoadingSpinner />

  if (error && !checklist && !luggage) {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm">{error}</div>
        <Button onClick={() => generateAssist({ force: true })}>Tentar novamente</Button>
      </div>
    )
  }

  const docs = checklist?.checklist || []
  const categories = luggage?.categories || []
  const hasGenerated = docs.length > 0 || categories.length > 0

  if (!hasGenerated) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 md:p-12">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Icon name="folder_shared" className="text-3xl text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Checklist e bagagem</h2>
          <p className="text-text-secondary text-sm">
            Gere uma vez o checklist de documentos e a lista de bagagem com IA para esta viagem. O resultado fica
            disponível ao voltar nesta aba.
          </p>
          {error ? (
            <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm text-left">
              {error}
            </div>
          ) : null}
          <Button onClick={() => generateAssist({ force: false })} disabled={loading}>
            <Icon name="auto_awesome" />
            Gerar com IA
          </Button>
          {trip?.destinations?.[0]?.city ? (
            <p className="text-xs text-text-secondary">Destino: {trip.destinations[0].city}</p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">
            Gerado para esta viagem. Atualize só se mudar destino ou datas.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => generateAssist({ force: true })}
            disabled={loading}
          >
            <Icon name="refresh" />
            Atualizar
          </Button>
        </div>

        {error ? (
          <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">{error}</div>
        ) : null}

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
