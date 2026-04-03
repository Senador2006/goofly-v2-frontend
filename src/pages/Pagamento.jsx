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
  const { refreshUser } = useAuth()
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
        callbacks: {
          onSubmit: async (formData) => {
            setLoading(true)
            setError(null)
            try {
              await paymentService.pay(formData)
              await userService.completeCheckout()
              await refreshUser()
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
  }, [showBrick])
}