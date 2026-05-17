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
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
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
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="trips" element={<TripList />} />
        <Route path="trips/new" element={<NewTrip />} />
        <Route path="trips/:tripId/itinerary" element={<Itinerary />} />
        <Route path="pagamento" element={<Pagamento />} />
        <Route path="discover" element={<Discover />} />
        <Route path="memories" element={<Memories />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
