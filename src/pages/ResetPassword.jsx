import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { AuthPageLayout } from '../components/auth/AuthPageLayout'
import { PasswordInput } from '../components/auth/PasswordInput'
import { PasswordMatchHint, PasswordRequirements } from '../components/auth/PasswordRequirements'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_RULES_ATTR,
  passwordsMatch,
  validateNewPassword,
} from '../utils/authPasswordValidation'

export function ResetPassword() {
  useDocumentTitle('Redefinir senha')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmTouched, setConfirmTouched] = useState(false)
  const [error, setError] = useState(token ? '' : 'Link de redefinição inválido. Solicite um novo.')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const confirmMatches = passwordsMatch(password, confirmPassword)
  const showConfirmHint = confirmTouched && confirmPassword.length > 0
  const confirmMismatch = confirmTouched && !confirmMatches

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const passwordError = validateNewPassword(password, confirmPassword)
    if (passwordError) {
      setConfirmTouched(true)
      setError(passwordError)
      return
    }

    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      navigate('/login', { replace: true, state: { passwordReset: true } })
    } catch (err) {
      const errData = err.response?.data?.error
      setError(
        (typeof errData === 'object' && errData?.message) ||
          err.response?.data?.errors?.[0]?.msg ||
          'Não foi possível redefinir a senha. Tente novamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout
      title="Redefinir senha"
      error={error}
      footer={
        <p className="mt-6 text-center text-sm text-text-secondary">
          <Link to="/forgot-password" className="text-primary font-bold hover:underline">
            Solicitar novo link
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <PasswordInput
          id="reset-password"
          label="Nova senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          passwordrules={PASSWORD_RULES_ATTR}
          describedBy="reset-password-rules"
          required
          minLength={8}
          placeholder="********"
        >
          <PasswordRequirements id="reset-password-rules" password={password} />
        </PasswordInput>
        <PasswordInput
          id="reset-password-confirm"
          label="Confirmar nova senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setConfirmTouched(true)}
          onInvalid={() => setConfirmTouched(true)}
          autoComplete="new-password"
          describedBy="reset-password-confirm-hint"
          invalid={confirmMismatch}
          customValidity={confirmPassword && !confirmMatches ? PASSWORD_MISMATCH_MESSAGE : ''}
          required
          placeholder="********"
        >
          <PasswordMatchHint
            id="reset-password-confirm-hint"
            show={showConfirmHint}
            match={confirmMatches}
          />
        </PasswordInput>
        <Button type="submit" className="w-full justify-center" disabled={loading || !token}>
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}
