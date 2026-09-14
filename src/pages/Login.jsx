import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthPageLayout, AUTH_INPUT_CLASS } from '../components/auth/AuthPageLayout'
import { TurnstileWidget } from '../components/auth/TurnstileWidget'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function Login() {
  useDocumentTitle('Entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
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

    if (!captchaToken) {
      setError('Confirme a verificacao de seguranca antes de continuar.')
      return
    }

    setLoading(true)
    try {
      await login(email, password, captchaToken)
      navigate('/dashboard')
    } catch (err) {
      setCaptchaToken('')
      setCaptchaResetNonce((value) => value + 1)

      const errData = err.response?.data?.error
      const message = typeof errData === 'object' && errData?.message
        ? errData.message
        : err.response?.data?.errors?.[0]?.msg || 'Não foi possível entrar. Verifique seu e-mail e senha e tente novamente.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout
      title="Entrar"
      error={error}
      footer={
        <p className="mt-6 text-center text-sm text-text-secondary">
          Não tem conta?{' '}
          <Link to="/register" className="text-primary font-bold hover:underline">
            Cadastre-se
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <label className="block text-sm font-bold mb-2 text-text-secondary">Senha</label>
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
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}
