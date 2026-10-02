import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Gate de UX para /admin.
 * Autorização real: gateway + services (`requireAdmin` no banco).
 * Aqui só libera UI se a sessão foi confirmada via /me (ou login) — não via cache.
 */
export function AdminRoute({ children }) {
  const { user, loading, isAdmin, sessionVerified } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-pulse text-primary text-4xl">...</div>
      </div>
    )
  }

  if (!sessionVerified || !user || !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
