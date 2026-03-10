import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/users/me')
      const userData = data.data || data
      setUser(userData)
      localStorage.setItem('user', JSON.stringify(userData))
      return userData
    } catch (_) {
      return null
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')
    if (token) {
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch (_) {}
      }
      api.get('/users/me').then(({ data }) => {
        const userData = data.data || data
        setUser(userData)
        localStorage.setItem('user', JSON.stringify(userData))
      }).catch(() => {
        if (!savedUser) localStorage.removeItem('token')
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    const payload = data.data || data
    const token = payload.token
    const userData = payload.user || payload
    if (token) localStorage.setItem('token', token)
    setUser(userData)
    if (userData) localStorage.setItem('user', JSON.stringify(userData))
    return data
  }

  const register = async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password })
    const payload = data.data || data
    const token = payload.token
    const userData = payload.user || payload
    if (token) localStorage.setItem('token', token)
    setUser(userData)
    if (userData) localStorage.setItem('user', JSON.stringify(userData))
    return data
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
