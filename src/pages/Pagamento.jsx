import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { EmptyState } from '../components/common/EmptyState'
import { LoadingSpinner } from '../components/common/LoadingSpinner'
import { TripSelector } from '../components/trips/TripSelector'
import { useAuth } from '../context/AuthContext'
import { userService } from '../services/userService'
import { paymentService } from '../services/paymentService'
import { tripService } from '../services/tripService'
import { hasTripPlanningUnlocked } from '../utils/planningAccess'
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

function formatBRL(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value))
}

function normalizeTripId(raw) {
  const trimmed = raw?.trim()
  return trimmed || null
}

export function Pagamento() {
  useDocumentTitle('Planejamento Completo')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const tripId = normalizeTripId(searchParams.get('tripId'))
  const { user, isAdmin } = useAuth()

  const [trips, setTrips] = useState([])
  const [tripsLoading, setTripsLoading] = useState(true)
  const [tripsError, setTripsError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [showBrick, setShowBrick] = useState(false)
  const [priceLoading, setPriceLoading] = useState(Boolean(tripId))
  const [priceQuote, setPriceQuote] = useState(null)
  const brickControllerRef = useRef(null)
  const isMountedRef = useRef(false)

  const selectedTrip = useMemo(
    () => trips.find((t) => String(t.id) === String(tripId)) ?? null,
    [trips, tripId]
  )
  const isSelectedUnlocked = hasTripPlanningUnlocked(selectedTrip)

  const unlockedTripIds = useMemo(() => {
    const ids = new Set()
    for (const trip of trips) {
      if (hasTripPlanningUnlocked(trip)) ids.add(String(trip.id))
    }
    return ids
  }, [trips])

  const planningAmount =
    priceQuote?.amountBrl != null ? Number(priceQuote.amountBrl) : null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setTripsLoading(true)
      setTripsError(null)
      try {
        const data = await tripService.getTrips()
        if (!cancelled && isMountedRef.current) {
          setTrips(Array.isArray(data) ? data : [])
        }
      } catch (err) {
        logger.error('Carregar viagens:', err)
        if (!cancelled && isMountedRef.current) {
          setTripsError(err.response?.data?.error?.message || 'Erro ao carregar suas viagens')
        }
      } finally {
        if (!cancelled && isMountedRef.current) setTripsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setShowBrick(false)
    setError(null)
    setPriceQuote(null)
  }, [tripId])

  useEffect(() => {
    if (!tripId) {
      setPriceLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      setPriceLoading(true)
      try {
        const quote = await tripService.getPlanningPrice(tripId)
        if (!cancelled && isMountedRef.current) {
          setPriceQuote(quote)
        }
      } catch (err) {
        logger.error('Cotação de preço:', err)
        if (!cancelled && isMountedRef.current) {
          setError(
            err.response?.data?.error?.message ||
              'Não foi possível calcular o preço desta viagem. Selecione outra viagem ou confira se ela pertence à sua conta.'
          )
        }
      } finally {
        if (!cancelled && isMountedRef.current) setPriceLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [tripId])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const handleTripSelect = (id) => {
    setSearchParams({ tripId: id }, { replace: true })
  }

  useEffect(() => {
    if (!showBrick) return

    let cancelled = false

    const mountBrick = async () => {
      try {
        setError(null)

        if (!import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY) {
          throw new Error('A chave pública do Mercado Pago não está configurada.')
        }

        if (planningAmount == null || Number.isNaN(planningAmount)) {
          throw new Error('Preço não disponível. Recarregue a página.')
        }

        if (brickControllerRef.current?.unmount) {
          await brickControllerRef.current.unmount()
          brickControllerRef.current = null
        }

        const MercadoPago = await loadMercadoPagoSdk()
        if (cancelled) return

        const mp = new MercadoPago(import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY)
        const bricksBuilder = mp.bricks()
        const amountForBrick = Number(planningAmount.toFixed(2))
        brickControllerRef.current = await bricksBuilder.create('payment', 'paymentBrick_container', {
          initialization: {
            amount: amountForBrick,
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
                  transaction_amount:
                    data.transaction_amount != null ? data.transaction_amount : amountForBrick,
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

                if (!tripId) {
                  throw new Error('Selecione a viagem que deseja desbloquear antes de concluir o pagamento.')
                }

                await userService.completeCheckout({ tripId })

                if (!isMountedRef.current) return
                setSuccess(true)
                setTimeout(() => {
                  navigate(`/trips/${tripId}/itinerary?unlocked=1`, { replace: true })
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
  }, [showBrick, navigate, tripId, user?.email, planningAmount])

  if (success) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
        <div className="rounded-full bg-primary/20 p-4 mb-6">
          <Icon name="check_circle" className="text-5xl text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground dark:text-white mb-2">Tudo certo!</h1>
        <p className="text-text-secondary text-center max-w-sm mb-6">
          Roteiro integral, documentos inteligentes e recomendações da viagem liberados. Redirecionando...
        </p>
      </div>
    )
  }

  if (tripsLoading) {
    return <LoadingSpinner />
  }

  if (tripsError) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-4 rounded-xl">{tripsError}</div>
      </div>
    )
  }

  if (trips.length === 0) {
    return (
      <div className="max-w-lg mx-auto p-6">
        <EmptyState
          icon="luggage"
          title="Nenhuma viagem cadastrada"
          description="Crie uma viagem para desbloquear o planejamento completo com roteiro integral e assistente de documentos."
          action={
            <Link to="/trips/new">
              <Button className="rounded-full font-bold">Criar viagem</Button>
            </Link>
          }
        />
      </div>
    )
  }

  const canPay = Boolean(tripId) && !isSelectedUnlocked && planningAmount != null && !priceLoading

  return (
    <div className="max-w-lg mx-auto p-6">
      <h1 className="text-2xl md:text-3xl font-black text-foreground dark:text-white mb-2">
        Desbloqueie seu roteiro
      </h1>
      <p className="text-text-secondary mb-4">
        O Planejamento Completo desbloqueia 100% do roteiro otimizado, checklist de documentos com IA e
        recomendações por viagem. O Tinder de Viagens permanece disponível para todos na fase de
        planejamento.
      </p>
      {isAdmin && (
        <p className="text-xs text-text-secondary bg-background-light dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2 mb-6">
          Como administrador, você pode liberar o planejamento desta viagem sem processar pagamento.
        </p>
      )}

      <div className="mb-6">
        <p className="text-sm font-medium text-foreground dark:text-white mb-2">
          Selecione a viagem que deseja desbloquear
        </p>
        {!tripId && (
          <p className="text-xs text-text-secondary mb-3">
            O valor depende do destino (nacional ou internacional). Escolha a viagem abaixo para ver o preço correto.
          </p>
        )}
        <TripSelector
          trips={trips}
          selectedId={tripId}
          onChange={handleTripSelect}
          disabledIds={unlockedTripIds}
        />
      </div>

      {tripId && isSelectedUnlocked && (
        <div className="mb-6 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-sm text-emerald-800 dark:text-emerald-200">
          Esta viagem já possui planejamento completo desbloqueado.{' '}
          <Link to={`/trips/${tripId}/itinerary`} className="font-semibold underline">
            Ver roteiro
          </Link>
        </div>
      )}

      {tripId && !selectedTrip && !priceLoading && (
        <div className="mb-6 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-800 dark:text-amber-200">
          A viagem informada na URL não foi encontrada. Selecione uma viagem válida abaixo.
        </div>
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
            Roteiro otimizado completo — todas as paradas e dias
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
        {!tripId ? (
          <p className="text-sm text-text-secondary">Selecione uma viagem acima para ver o valor.</p>
        ) : isSelectedUnlocked ? (
          <p className="text-sm text-text-secondary">Planejamento já desbloqueado para esta viagem.</p>
        ) : priceLoading ? (
          <p className="text-sm text-text-secondary">Calculando valor da viagem...</p>
        ) : planningAmount != null ? (
          <>
            <p className="text-2xl font-black text-foreground dark:text-white">
              {formatBRL(planningAmount)}{' '}
              <span className="text-sm font-normal text-text-secondary">
                {priceQuote?.tier === 'domestic'
                  ? 'viagem nacional'
                  : priceQuote?.tier === 'international'
                    ? 'viagem internacional'
                    : 'preço vigente'}
              </span>
            </p>
            <p className="text-xs text-text-secondary mt-2">
              Nacional: apenas destinos no Brasil · Internacional: destino em outro país ou país não informado
            </p>
          </>
        ) : (
          <p className="text-sm text-text-secondary">
            Valor indisponível — selecione outra viagem ou tente novamente.
          </p>
        )}
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
          disabled={loading || !canPay}
        >
          Pagar agora
        </Button>
      ) : (
        <div id="paymentBrick_container" />
      )}

      {isAdmin && (
        <Button
          variant="secondary"
          className="w-full mt-4"
          disabled={loading || !tripId || isSelectedUnlocked}
          onClick={async () => {
            setLoading(true)
            setError(null)
            try {
              if (!tripId) {
                throw new Error('Selecione a viagem que deseja desbloquear.')
              }
              await userService.activatePlanningAdmin(tripId)
              setSuccess(true)
              setTimeout(() => {
                navigate(`/trips/${tripId}/itinerary?unlocked=1`, { replace: true })
              }, 1500)
            } catch (err) {
              setError(err.response?.data?.error?.message || 'Não foi possível ativar o planejamento.')
            } finally {
              setLoading(false)
            }
          }}
        >
          Liberar planejamento completo
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
