import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { useAuth } from '../context/AuthContext'
import { userService } from '../services/userService'
import { paymentService } from '../services/paymentService'

export function Pagamento() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tripId = searchParams.get('tripId')
  const { user, refreshUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showBrick, setShowBrick] = useState(false)
  const brickInitialized = useRef(false)

  useEffect(() => {
    if (!showBrick || brickInitialized.current) return
    brickInitialized.current = true

    const script = document.createElement('script')
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.onload = () => {
      const mp = new window.MercadoPago(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY)

      mp.bricks().create('payment', 'paymentBrick_container', {
        initialization: {
          amount: 12.00,
        },
        customization: {
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all',
            ticket: 'all',
            bankTransfer: 'all',
          },
        },
        callbacks: {
          onReady: () => {},
          onSubmit: async (formData) => {
            setLoading(true)
            setError(null)
            try {
              const data = formData.formData ?? formData
              const payload = {
                token: data.token,
                payment_method_id: data.payment_method_id,
                transaction_amount: data.transaction_amount ?? 12.00,
                payer: {
                  email: data.payer?.email || user?.email,
                  identification: {
                    type: data.payer?.identification?.type,
                    number: data.payer?.identification?.number,
                  }
                }
              }
              await paymentService.pay(payload)
              await userService.completeCheckout().catch(() => {})
              await refreshUser().catch(() => {})
              setSuccess(true)
              setTimeout(() => {
                navigate(tripId ? `/trips/${tripId}/itinerary` : '/', { replace: true })
              }, 2000)
            } catch (err) {
              setError(err.response?.data?.error?.message || err.message || 'Erro ao processar.')
            } finally {
              setLoading(false)
            }
          },
          onError: (error) => {
            console.error('Erro no Brick:', error)
          },
        },
      })
    }
    document.body.appendChild(script)

    return () => {
      brickInitialized.current = false
    }
  }, [showBrick])

  if (success) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
        <div className="rounded-full bg-primary/20 p-4 mb-6">
          <Icon name="check_circle" className="text-5xl text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-[#1c1c0d] dark:text-white mb-2">Tudo certo!</h1>
        <p className="text-text-secondary text-center max-w-sm mb-6">
          Planejamento Completo ativado. Roteiro completo e documentos liberados. Redirecionando...
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
        O TDV gratuito pode ser usado em 25% dos dias da sua viagem. Com o Planejamento Completo
        você usa o roteiro em todos os dias e libera documentos.
      </p>

      <div className="bg-background-light dark:bg-[#23220f] border border-border-light dark:border-border-dark rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-primary/20 p-2">
            <Icon name="route" className="text-2xl text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-[#1c1c0d] dark:text-white">Planejamento Completo</h2>
            <p className="text-sm text-text-secondary">Roteiro completo + Documentos</p>
          </div>
        </div>
        <ul className="space-y-2 text-sm text-text-secondary mb-6">
          <li className="flex items-center gap-2">
            <Icon name="check" className="text-primary shrink-0" />
            Usar o TDV em todos os dias da viagem (sem limite de 25%)
          </li>
          <li className="flex items-center gap-2">
            <Icon name="check" className="text-primary shrink-0" />
            Checklist de documentos da viagem
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

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {!showBrick ? (
        <Button
          className="w-full rounded-full py-4 font-bold"
          onClick={() => setShowBrick(true)}
          disabled={loading}
        >
          Pagar agora
        </Button>
      ) : (
        <div id="paymentBrick_container" />
      )}

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