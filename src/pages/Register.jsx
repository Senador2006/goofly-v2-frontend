import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
      navigate('/')
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
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-primary size-14 rounded-full flex items-center justify-center">
            <Icon name="flight_takeoff" className="text-black text-2xl font-bold" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold">Goofly v2</h1>
            <p className="text-xs text-text-secondary uppercase tracking-widest">Travel Planner</p>
          </div>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-2xl p-8 shadow-lg border border-border-light dark:border-border-dark">
          <h2 className="text-2xl font-black mb-6">Criar conta</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-text-secondary">Nome completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:outline-none"
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
                className="w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:outline-none"
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
                className="w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:outline-none"
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
          <p className="mt-6 text-center text-sm text-text-secondary">
            Ja tem conta?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
