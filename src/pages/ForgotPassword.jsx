import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { AuthPageLayout, AUTH_INPUT_CLASS } from '../components/auth/AuthPageLayout'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function ForgotPassword() {
  useDocumentTitle('Recuperar senha')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { email })
      setSuccess(res.data?.message || 'Se existir uma conta com este e-mail, enviaremos um link para redefinir a senha.')
    } catch (err) {
      const errData = err.response?.data?.error
      setError(
        (typeof errData === 'object' && errData?.message) ||
          err.response?.data?.errors?.[0]?.msg ||
          'Não foi possível enviar o e-mail. Tente novamente.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageLayout
      title="Recuperar senha"
      error={error}
      footer={
        <p className="mt-6 text-center text-sm text-text-secondary">
          Lembrou a senha?{' '}
          <Link to="/login" className="text-primary font-bold hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
      {success ? (
        <div className="mb-4 p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-xl text-sm">
          {success}
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-text-secondary">
          Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.
        </p>
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
        <Button type="submit" className="w-full justify-center" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar link'}
        </Button>
      </form>
    </AuthPageLayout>
  )
}
