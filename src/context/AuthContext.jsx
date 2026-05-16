import { createContext, useContext, useState, useEffect } from 'react'
import api, { gatewayApi } from '../services/api'

const AuthContext = createContext()

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

/**
 * Pluga `token`, `refreshToken` e `user` no `localStorage` seguindo o
 * contrato documentado em `API.md`:
 *   - login/register/refresh → `{ data: { user, token, refreshToken } }`
 * Audit nota C2: a persistência em `localStorage` deve migrar para cookie
 * `httpOnly`. Mantemos aqui durante a Fase 0/1; o refresh-token já foi
 * canalizado pelo interceptor de `services/api.js` para refazer requests
 * 401 sem deslogar o usuário.
 */
function persistAuthPayload(payload) {
  if (!payload || typeof window === 'undefined') return null
  if (payload.token) localStorage.setItem(TOKEN_KEY, payload.token)
  if (payload.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken)
  return payload.user || payload
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const res = await api.get('/users/me')
      const userData = res.body?.data || res.data?.data || res.data
      setUser(userData)
      if (userData) localStorage.setItem(USER_KEY, JSON.stringify(userData))
      return userData
    } catch (_) {
      return null
    }
  }

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)
    if (token) {
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser))
        } catch (_) {
          // localStorage corrompido — segue tentando o /users/me abaixo
        }
      }
      api
        .get('/users/me')
        .then((res) => {
          const userData = res.body?.data || res.data?.data || res.data
          setUser(userData)
          if (userData) localStorage.setItem(USER_KEY, JSON.stringify(userData))
        })
        .catch(() => {
          // Refresh interceptor já cobriu o 401; se ainda assim falhou,
          // limpamos apenas se não havia cache local.
          if (!savedUser) {
            localStorage.removeItem(TOKEN_KEY)
            localStorage.removeItem(REFRESH_TOKEN_KEY)
          }
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const payload = res.body?.data || res.data?.data || res.data || {}
    const userData = persistAuthPayload(payload)
    setUser(userData)
    if (userData) localStorage.setItem(USER_KEY, JSON.stringify(userData))
    return res.data
  }

  const register = async (name, email, password, captchaToken) => {
    const res = await gatewayApi.post('/auth/register', { name, email, password, captchaToken })
    const payload = res.body?.data || res.data?.data || res.data || {}
    const userData = persistAuthPayload(payload)
    setUser(userData)
    if (userData) localStorage.setItem(USER_KEY, JSON.stringify(userData))
    return res.data
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
