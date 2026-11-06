import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthPageLayout, AUTH_INPUT_CLASS } from '../components/auth/AuthPageLayout'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton'
import { TurnstileWidget } from '../components/auth/TurnstileWidget'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { safeReturnTo } from '../utils/accountWall'
import { useT } from '../i18n'

export function Login() {
  useDocumentTitle('Entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, loginWithGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const t = useT()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''
  const passwordReset = location.state?.passwordReset === true

  const handleCaptchaTokenChange = useCallback((token) => {
    setCaptchaToken(token)
  }, [])

  const handleGoogleCredential = async (credential) => {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle(credential)
      navigate(searchParams.get('returnTo') ? returnTo : '/dashboard')
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Não foi possível entrar com o Google. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

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
      navigate(searchParams.get('returnTo') ? returnTo : '/dashboard')
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
          <Link to={`/register${searchParams.toString() ? `?${searchParams.toString()}` : ''}`} className="text-primary font-bold hover:underline">
            Cadastre-se
          </Link>
        </p>
      }
    >
      {passwordReset && !error ? (
        <div className="mb-4 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl text-sm">
          Senha redefinida com sucesso. Entre com a nova senha.
        </div>
      ) : null}
      {searchParams.get('returnTo') ? (
        <p className="mb-4 text-sm text-text-secondary">{t('guest.wall')}</p>
      ) : null}
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
          <div className="mt-2 text-right">
            <Link to="/forgot-password" className="text-sm text-primary font-bold hover:underline">
              Esqueci minha senha
            </Link>
          </div>
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
      {import.meta.env.VITE_GOOGLE_CLIENT_ID ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs text-text-secondary uppercase tracking-widest">
            <span className="h-px flex-1 bg-border-light dark:bg-border-dark" />
            ou
            <span className="h-px flex-1 bg-border-light dark:bg-border-dark" />
          </div>
          <GoogleSignInButton onCredential={handleGoogleCredential} onError={setError} />
        </>
      ) : null}
    </AuthPageLayout>
  )
}
