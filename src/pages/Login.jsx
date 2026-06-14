import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/common/Button'
import { GooflyLogo } from '../components/branding/GooflyLogo'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function Login() {
  useDocumentTitle('Entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch (err) {
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
    <div className="min-h-screen bg-white text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-start gap-3 mb-10 w-full -ml-3">
          <GooflyLogo heightClass="h-16 sm:h-20" className="max-w-[min(100%,22rem)] -translate-x-2" />
          <p className="text-xs text-text-secondary uppercase tracking-widest text-left">
            Travel Planner
          </p>
        </div>
        <div className="bg-white rounded-2xl p-8 shadow-lg border border-border-light">
          <h2 className="text-2xl font-black mb-6">Entrar</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold mb-2 text-text-secondary">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-light border border-border-light rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:outline-none"
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
                className="w-full bg-surface-light border border-border-light rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="********"
              />
            </div>
            <Button type="submit" className="w-full justify-center" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-text-secondary">
            Não tem conta?{' '}
            <Link to="/register" className="text-primary font-bold hover:underline">
              Cadastre-se
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
