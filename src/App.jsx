import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Layout } from './components/layout/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { AdminRoute } from './components/AdminRoute'
import { LoadingSpinner } from './components/common/LoadingSpinner'
import { RouteErrorBoundary } from './components/common/ErrorBoundary'

const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.Dashboard }))
)
const Discover = lazy(() =>
  import('./pages/Discover').then((m) => ({ default: m.Discover }))
)
const TripList = lazy(() =>
  import('./pages/TripList').then((m) => ({ default: m.TripList }))
)
const Itinerary = lazy(() =>
  import('./pages/Itinerary').then((m) => ({ default: m.Itinerary }))
)
const Memories = lazy(() =>
  import('./pages/Memories').then((m) => ({ default: m.Memories }))
)
const Settings = lazy(() =>
  import('./pages/Settings').then((m) => ({ default: m.Settings }))
)
const NewTrip = lazy(() =>
  import('./pages/NewTrip').then((m) => ({ default: m.NewTrip }))
)
const Pagamento = lazy(() =>
  import('./pages/Pagamento').then((m) => ({ default: m.Pagamento }))
)
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard }))
)

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
      <LoadingSpinner />
    </div>
  )
}

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
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <LoadingSpinner />
      </div>
    )
  }
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
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={
          <RouteErrorBoundary name="auth">
            <LandingOrRedirect />
          </RouteErrorBoundary>
        } />
        <Route path="/login" element={
          <RouteErrorBoundary name="auth">
            <PublicRoute>
              <Login />
            </PublicRoute>
          </RouteErrorBoundary>
        } />
        <Route path="/register" element={
          <RouteErrorBoundary name="auth">
            <PublicRoute>
              <Register />
            </PublicRoute>
          </RouteErrorBoundary>
        } />
        <Route
          path="/admin"
          element={
            <RouteErrorBoundary name="app">
              <ProtectedRoute>
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              </ProtectedRoute>
            </RouteErrorBoundary>
          }
        />
        <Route element={
          <RouteErrorBoundary name="app">
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          </RouteErrorBoundary>
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
    </Suspense>
  )
}
