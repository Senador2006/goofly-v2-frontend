import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import api, { gatewayApi } from '../services/api'
import { resolveIsAdmin } from '../utils/jwtRole'

const AuthContext = createContext()

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

/**
 * Auth via cookie httpOnly (padrão BFF — ver `services/api.js`).
 *
 * O access/refresh token NÃO ficam mais acessíveis ao JS: vivem em cookies
 * httpOnly setados pelo gateway (resolve C2/XSS). Logo, o `localStorage` guarda
 * apenas o **cache do `user`** (dado não sensível) como hint de "talvez logado"
 * — a fonte da verdade da sessão é o cookie, validado via `GET /users/me`.
 */
function cacheUser(userData) {
  if (typeof window === 'undefined') return userData || null
  if (userData) localStorage.setItem(USER_KEY, JSON.stringify(userData))
  return userData || null
}

function clearLocalAuthCache() {
  if (typeof window === 'undefined') return
  // USER_KEY é o cache atual; TOKEN/REFRESH limpam resquícios pré-cookie.
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = async () => {
    try {
      const res = await api.get('/users/me')
      const userData = res.body?.data || res.data?.data || res.data
      setUser(userData)
      return cacheUser(userData)
    } catch (_) {
      return null
    }
  }

  const applyUserUpdate = (patch) => {
    if (!patch || typeof patch !== 'object') return
    setUser((prev) => {
      const next = { ...(prev || {}), ...patch }
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return next
    })
  }

  useEffect(() => {
    // O token agora é cookie httpOnly (invisível ao JS). Usamos o cache do
    // `user` como hint: só validamos a sessão via /users/me se já houve login
    // nesta máquina — evita disparar 401/refresh em visitante anônimo.
    const savedUser = localStorage.getItem(USER_KEY)
    if (!savedUser) {
      setLoading(false)
      return
    }

    try {
      setUser(JSON.parse(savedUser))
    } catch (_) {
      // cache corrompido — segue validando via /users/me abaixo
    }

    api
      .get('/users/me')
      .then((res) => {
        const userData = res.body?.data || res.data?.data || res.data
        setUser(userData)
        cacheUser(userData)
      })
      .catch(() => {
        // Cookie ausente/expirado e refresh falhou → sessão inválida.
        clearLocalAuthCache()
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    // O gateway seta os cookies httpOnly nesta resposta; o body traz só `user`.
    const res = await api.post('/auth/login', { email, password })
    const payload = res.body?.data || res.data?.data || res.data || {}
    const userData = (await refreshUser()) || payload.user || payload
    if (userData) {
      setUser(userData)
      cacheUser(userData)
    }
    return res.data
  }

  const register = async (name, email, password, captchaToken) => {
    const res = await gatewayApi.post('/auth/register', { name, email, password, captchaToken })
    const payload = res.body?.data || res.data?.data || res.data || {}
    const userData = (await refreshUser()) || payload.user || payload
    if (userData) {
      setUser(userData)
      cacheUser(userData)
    }
    return res.data
  }

  const logout = async () => {
    // Limpa os cookies httpOnly no gateway (best-effort) e o estado local.
    try {
      await api.post('/auth/logout', {}, { _skipAuthRetry: true })
    } catch (_) {
      // Ignora — limpa o estado local de qualquer forma.
    }
    clearLocalAuthCache()
    setUser(null)
  }

  const isAdmin = useMemo(() => resolveIsAdmin(user), [user])

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        logout,
        refreshUser,
        applyUserUpdate,
        loading,
        isAuthenticated: !!user,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
