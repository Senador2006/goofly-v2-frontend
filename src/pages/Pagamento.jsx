import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { useAuth } from '../context/AuthContext'
import { userService } from '../services/userService'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

/**
 * Página de pagamento (simulação) — RF04.5
 * Por enquanto não cobra nada: ao confirmar, ativa Planejamento Completo e libera roteiro + documentos.
 */
export function Pagamento() {
  useDocumentTitle('Planejamento Completo')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tripId = searchParams.get('tripId')
  const { refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const handleConfirmar = async () => {
    setLoading(true)
    setError(null)
    try {
      await userService.completeCheckout()
      await refreshUser()
      setSuccess(true)
      setTimeout(() => {
        if (tripId) {
          navigate(`/trips/${tripId}/itinerary`, { replace: true })
        } else {
          navigate('/', { replace: true })
        }
      }, 2000)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Erro ao processar.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
        <div className="rounded-full bg-primary/20 p-4 mb-6">
          <Icon name="check_circle" className="text-5xl text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-[#1c1c0d] dark:text-white mb-2">Tudo certo!</h1>
        <p className="text-text-secondary text-center max-w-sm mb-6">
          Roteiro integral, TDV em todos os dias, documentos e recomendações da viagem liberados. Redirecionando...
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl md:text-3xl font-black text-[#1c1c0d] dark:text-white mb-2">
        Desbloqueie seu roteiro
      </h1>
      <p className="text-text-secondary mb-8">
        No plano gratuito você vê cerca de 25% do roteiro e usa o TDV em até 25% dos dias da viagem. Ao adquirir o
        Planejamento Completo, tudo que é da sua viagem (roteiro, TDV, documentos e recomendações contextuais) fica
        liberado. A página Descobrir continua gratuita à parte, para explorar ideias antes de planejar.
      </p>

      <div className="bg-background-light dark:bg-[#23220f] border border-border-light dark:border-border-dark rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-primary/20 p-2">
            <Icon name="route" className="text-2xl text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-[#1c1c0d] dark:text-white">Planejamento Completo</h2>
            <p className="text-sm text-text-secondary">Sua viagem, sem limite</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-text-secondary mb-6">
          <li className="flex items-center gap-2">
            <Icon name="check" className="text-primary shrink-0" />
            Roteiro completo (100% das atividades)
          </li>
          <li className="flex items-center gap-2">
            <Icon name="check" className="text-primary shrink-0" />
            TDV em todos os dias do planejamento
          </li>
          <li className="flex items-center gap-2">
            <Icon name="check" className="text-primary shrink-0" />
            Assistente de documentos e recomendações de bagagem por IA (por viagem)
          </li>
          <li className="flex items-center gap-2">
            <Icon name="check" className="text-primary shrink-0" />
            Acesso por 1 ano
          </li>
        </ul>
        <p className="text-2xl font-black text-[#1c1c0d] dark:text-white">
          $12.00 <span className="text-sm font-normal text-text-secondary">preço único</span>
        </p>
      </div>

      <p className="text-xs text-text-secondary mb-4 text-center">
        Esta é uma simulação: ao confirmar, nenhum valor será cobrado. O Planejamento Completo será ativado na sua conta.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <Button
        className="w-full rounded-full py-4 font-bold"
        onClick={handleConfirmar}
        disabled={loading}
      >
        {loading ? 'Processando...' : 'Confirmar (simulação — não cobra)'}
      </Button>

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="w-full mt-4 py-3 text-sm text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white transition-colors"
      >
        Voltar
      </button>
    </div>
  )
}
