import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { AuthPageLayout, AUTH_INPUT_CLASS } from '../components/auth/AuthPageLayout'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function ResetPassword() {
  useDocumentTitle('Redefinir senha')
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(token ? '' : 'Link de redefinição inválido. Solicite um novo.')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
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
        <div>
          <label className="block text-sm font-bold mb-2 text-text-secondary">Nova senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={AUTH_INPUT_CLASS}
            placeholder="********"
          />
          <p className="mt-2 text-xs text-text-secondary">
            Mínimo de 8 caracteres, com 1 letra maiúscula, 1 número e 1 símbolo.
          </p>
        </div>
        <div>
          <label className="block text-sm font-bold mb-2 text-text-secondary">Confirmar nova senha</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            className={AUTH_INPUT_CLASS}
            placeholder="********"
          />
        </div>
        <Button type="submit" className="w-full justify-center" disabled={loading || !token}>
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}
