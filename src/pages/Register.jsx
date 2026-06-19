import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthPageLayout, AUTH_INPUT_CLASS } from '../components/auth/AuthPageLayout'
import { TurnstileWidget } from '../components/auth/TurnstileWidget'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function Register() {
  useDocumentTitle('Criar conta')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

  const handleCaptchaTokenChange = useCallback((token) => {
    setCaptchaToken(token)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (!turnstileSiteKey) {
      setError('Captcha nao configurado neste ambiente. Defina VITE_TURNSTILE_SITE_KEY.')
      return
    }

    if (password.length < 8) {
      setError('A senha deve ter no minimo 8 caracteres.')
      return
    }

    if (!captchaToken) {
      setError('Confirme a verificacao de seguranca antes de continuar.')
      return
    }

    setLoading(true)

    try {
      await register(name, email, password, captchaToken)
      navigate('/dashboard')
    } catch (err) {
      setCaptchaToken('')
      setCaptchaResetNonce((value) => value + 1)

      const errData = err.response?.data?.error
      const message = typeof errData === 'object' && errData?.message
        ? errData.message
        : err.response?.data?.errors?.[0]?.msg || 'Erro ao criar conta. Tente novamente.'

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout
      title="Criar conta"
      error={error}
      footer={
        <p className="mt-6 text-center text-sm text-text-secondary">
          Ja tem conta?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold mb-2 text-text-secondary">Nome completo</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={AUTH_INPUT_CLASS}
            placeholder="Seu nome"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-text-secondary">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={AUTH_INPUT_CLASS}
            placeholder="seu@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-text-secondary">Senha (min. 8 caracteres)</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={AUTH_INPUT_CLASS}
            placeholder="********"
          />
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-text-secondary">Verificacao de seguranca</label>
          <TurnstileWidget
            siteKey={turnstileSiteKey}
            onTokenChange={handleCaptchaTokenChange}
            resetNonce={captchaResetNonce}
          />
        </div>
        <Button type="submit" className="w-full justify-center" disabled={loading || !captchaToken}>
          {loading ? 'Criando conta...' : 'Cadastrar'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}
