import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { useAuth } from '../context/AuthContext'
import { userService } from '../services/userService'
import { paymentService } from '../services/paymentService'
import { createLogger } from '../utils/logger'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const MERCADO_PAGO_SCRIPT_ID = 'mercado-pago-sdk'
let mercadoPagoScriptPromise = null
const logger = createLogger('pages.pagamento')

function loadMercadoPagoSdk() {
  if (window.MercadoPago) {
    return Promise.resolve(window.MercadoPago)
  }

  if (mercadoPagoScriptPromise) {
    return mercadoPagoScriptPromise
  }

  mercadoPagoScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(MERCADO_PAGO_SCRIPT_ID)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.MercadoPago), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Não foi possível carregar o checkout do Mercado Pago.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = MERCADO_PAGO_SCRIPT_ID
    script.src = 'https://sdk.mercadopago.com/js/v2'
    script.async = true
    script.onload = () => resolve(window.MercadoPago)
    script.onerror = () => reject(new Error('Não foi possível carregar o checkout do Mercado Pago.'))
    document.body.appendChild(script)
  }).catch((error) => {
    mercadoPagoScriptPromise = null
    throw error
  })

  return mercadoPagoScriptPromise
}

function isApprovedPayment(result) {
  const status = String(result?.data?.status || result?.status || '').toLowerCase()
  return ['approved', 'paid'].includes(status)
}

export function Pagamento() {
  useDocumentTitle('Planejamento Completo')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tripId = searchParams.get('tripId')
  const { user, refreshUser, applyUserUpdate } = useAuth()

  const syncPlanningAccess = async (activationPayload) => {
    const patch = activationPayload?.user || activationPayload
    if (patch?.subscription_type) {
      applyUserUpdate({
        subscription_type: patch.subscription_type,
        subscription_expires_at: patch.subscription_expires_at ?? null,
      })
    }
    const fresh = await refreshUser().catch(() => null)
    return fresh || patch
  }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showBrick, setShowBrick] = useState(false)
  const brickControllerRef = useRef(null)
  const isMountedRef = useRef(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!showBrick) return

    let cancelled = false

    const mountBrick = async () => {
      try {
        setError(null)

        if (!import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY) {
          throw new Error('A chave pública do Mercado Pago não está configurada.')
        }

        if (brickControllerRef.current?.unmount) {
          await brickControllerRef.current.unmount()
          brickControllerRef.current = null
        }

        const MercadoPago = await loadMercadoPagoSdk()
        if (cancelled) return

        const mp = new MercadoPago(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY)
        const bricksBuilder = mp.bricks()
        brickControllerRef.current = await bricksBuilder.create('payment', 'paymentBrick_container', {
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
                  tripId: tripId || undefined,
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

                const paymentResult = await paymentService.pay(payload)
                if (!isApprovedPayment(paymentResult)) {
                  throw new Error('O pagamento ainda não foi aprovado. Tente novamente em alguns instantes.')
                }

                // O backend já ativa o plano no pagamento aprovado; reforça com checkout-complete.
                if (!tripId) {
                  throw new Error('Volte ao roteiro e use o botão de desbloqueio para abrir o pagamento desta viagem.')
                }

                await userService.completeCheckout({
                  tripId,
                  paymentApproved: true,
                  paymentStatus: 'approved',
                })

                if (!isMountedRef.current) return
                setSuccess(true)
                setTimeout(() => {
                  const base = tripId ? `/trips/${tripId}/itinerary` : '/'
                  navigate(`${base}${tripId ? '?unlocked=1' : ''}`, { replace: true })
                }, 1200)
              } catch (err) {
                if (!isMountedRef.current) return
                setError(err.response?.data?.error?.message || err.message || 'Erro ao processar o pagamento.')
              } finally {
                if (isMountedRef.current) {
                  setLoading(false)
                }
              }
            },
            onError: (brickError) => {
              logger.error('Erro no Brick:', brickError)
              if (isMountedRef.current) {
                setError('O checkout apresentou um problema ao carregar. Recarregue a página e tente novamente.')
              }
            },
          },
        })
      } catch (sdkError) {
        if (!cancelled && isMountedRef.current) {
          setError(sdkError.message || 'Não foi possível iniciar o checkout.')
        }
      }
    }

    mountBrick()

    return () => {
      cancelled = true
      if (brickControllerRef.current?.unmount) {
        Promise.resolve(brickControllerRef.current.unmount()).catch(() => {})
      }
      brickControllerRef.current = null
    }
  }, [showBrick, navigate, refreshUser, tripId, user?.email])

  if (success) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
        <div className="rounded-full bg-primary/20 p-4 mb-6">
          <Icon name="check_circle" className="text-5xl text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white mb-2">Tudo certo!</h1>
        <p className="text-text-secondary text-center max-w-sm mb-6">
          Roteiro integral, TDV em todos os dias, documentos e recomendações da viagem liberados. Redirecionando...
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl md:text-3xl font-black text-foreground dark:text-white mb-2">
        Desbloqueie seu roteiro
      </h1>
      <p className="text-text-secondary mb-4">
        O TDV gratuito pode ser usado em 25% dos dias da sua viagem. Com o Planejamento Completo
        você usa o roteiro em todos os dias e libera documentos.
      </p>
      {import.meta.env.DEV && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 mb-6">
          Ambiente de demonstração: use o botão abaixo para simular a ativação sem cobrança real.
        </p>
      )}

      <div className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full bg-primary/20 p-2">
            <Icon name="route" className="text-2xl text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-foreground dark:text-white">Planejamento Completo</h2>
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
            Válido para este planejamento
          </li>
        </ul>
        <p className="text-2xl font-black text-foreground dark:text-white">
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

      {import.meta.env.DEV && (
        <Button
          variant="secondary"
          className="w-full mt-4"
          disabled={loading}
          onClick={async () => {
            setLoading(true)
            setError(null)
            try {
              if (!tripId) {
                throw new Error('Abra o pagamento a partir do roteiro da viagem que deseja desbloquear.')
              }
              await userService.activatePlanningDev(tripId)
              setSuccess(true)
              setTimeout(() => {
                const base = tripId ? `/trips/${tripId}/itinerary` : '/'
                navigate(`${base}${tripId ? '?unlocked=1' : ''}`, { replace: true })
              }, 1500)
            } catch (err) {
              setError(err.response?.data?.error?.message || 'Não foi possível ativar a demonstração.')
            } finally {
              setLoading(false)
            }
          }}
        >
          Ativar demonstração (sem cobrança)
        </Button>
      )}

      <button
        type="button"
        onClick={() => navigate(-1)}
        className="w-full mt-4 py-3 text-sm text-text-secondary hover:text-foreground dark:hover:text-white transition-colors"
      >
        Voltar
      </button>
    </div>
  )
}
