import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { resolveIsAdmin } from '../utils/jwtRole'

export function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  const isAdmin = resolveIsAdmin(user)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-pulse text-primary text-4xl">...</div>
      </div>
    )
  }

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
