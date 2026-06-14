import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { Discover } from './pages/Discover'
import { TripList } from './pages/TripList'
import { Itinerary } from './pages/Itinerary'
import { Memories } from './pages/Memories'
import { Settings } from './pages/Settings'
import { NewTrip } from './pages/NewTrip'
import { Pagamento } from './pages/Pagamento'
import { AdminDashboard } from './pages/AdminDashboard'
import { AdminRoute } from './components/AdminRoute'
import { LoadingSpinner } from './components/common/LoadingSpinner'

const Landing = lazy(() => import('./pages/Landing'))

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="animate-pulse text-primary text-4xl">...</div>
      </div>
    )
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}

export function LandingOrRedirect() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    )
  }
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    }>
      <Landing />
    </Suspense>
  )
}

export function CatchAllRedirect() {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingOrRedirect />} />
      <Route path="/login" element={
        <PublicRoute>
          <Login />
        </PublicRoute>
      } />
      <Route path="/register" element={
        <PublicRoute>
          <Register />
        </PublicRoute>
      } />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          </ProtectedRoute>
        }
      />
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/trips" element={<TripList />} />
        <Route path="/trips/new" element={<NewTrip />} />
        <Route path="/trips/:tripId/itinerary" element={<Itinerary />} />
        <Route path="/pagamento" element={<Pagamento />} />
        <Route path="/discover" element={<Discover />} />
        <Route path="/memories" element={<Memories />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<CatchAllRedirect />} />
    </Routes>
  )
}
