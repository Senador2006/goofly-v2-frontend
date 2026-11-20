import { useCallback, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { AuthPageLayout, AUTH_INPUT_CLASS } from '../components/auth/AuthPageLayout'
import { PasswordInput } from '../components/auth/PasswordInput'
import { PasswordMatchHint, PasswordRequirements } from '../components/auth/PasswordRequirements'
import { TurnstileWidget } from '../components/auth/TurnstileWidget'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { safeReturnTo } from '../utils/accountWall'
import { trackMetaEvent } from '../utils/metaPixel'
import {
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_RULES_ATTR,
  passwordsMatch,
  validateNewPassword,
} from '../utils/authPasswordValidation'

export function Register() {
  useDocumentTitle('Criar conta')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaResetNonce, setCaptchaResetNonce] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnTo(searchParams.get('returnTo'))
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

  const confirmMatches = passwordsMatch(password, confirmPassword)
  // Feedback só após blur/tentativa de envio — não acusa erro enquanto o usuário digita.
  const showConfirmHint = confirmTouched && confirmPassword.length > 0
  const confirmMismatch = confirmTouched && !confirmMatches

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

    const passwordError = validateNewPassword(password, confirmPassword)
    if (passwordError) {
      setConfirmTouched(true)
      setError(passwordError)
      return
    }

    if (!captchaToken) {
      setError('Confirme a verificacao de seguranca antes de continuar.')
      return
    }

    setLoading(true)

    try {
      // confirmPassword é só checagem de digitação no cliente — não vai para a API.
      await register(name, email, password, captchaToken)
      trackMetaEvent('CompleteRegistration', { status: true, content_name: 'goofly_signup' })
      navigate(searchParams.get('returnTo') ? returnTo : '/dashboard')
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
          <Link to={`/login${searchParams.toString() ? `?${searchParams.toString()}` : ''}`} className="text-primary font-bold hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="register-name" className="block text-sm font-bold mb-2 text-text-secondary">Nome completo</label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={AUTH_INPUT_CLASS}
            placeholder="Seu nome"
          />
        </div>
        <div>
          <label htmlFor="register-email" className="block text-sm font-bold mb-2 text-text-secondary">Email</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={AUTH_INPUT_CLASS}
            placeholder="seu@email.com"
          />
        </div>
        <PasswordInput
          id="register-password"
          label="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          passwordrules={PASSWORD_RULES_ATTR}
          describedBy="register-password-rules"
          required
          minLength={8}
          placeholder="********"
        >
          <PasswordRequirements id="register-password-rules" password={password} />
        </PasswordInput>
        <PasswordInput
          id="register-password-confirm"
          label="Confirmar senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          onInvalid={() => setConfirmTouched(true)}
          autoComplete="new-password"
          describedBy="register-password-confirm-hint"
          invalid={confirmMismatch}
          customValidity={confirmPassword && !confirmMatches ? PASSWORD_MISMATCH_MESSAGE : ''}
          required
          placeholder="********"
        >
          <PasswordMatchHint
            id="register-password-confirm-hint"
            show={showConfirmHint}
            match={confirmMatches}
          />
        </PasswordInput>
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
