import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
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
 * httpOnly setados pelo gateway (resolve C2/XSS). O `localStorage` guarda apenas
 * o **cache do `user`** (dado não sensível) para UX de boot — a fonte da verdade
 * da sessão é sempre o cookie, validado via `GET /users/me` em todo carregamento.
 * `isAuthenticated` só fica true após o boot (`!loading`) e com user confirmado.
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

function isRateLimitedError(err) {
  return err?.response?.status === 429 || err?.response?.data?.error?.code === 'RATE_LIMIT_EXCEEDED'
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // true só após /users/me (ou login/register) bem-sucedido — não após hidratar cache.
  const [sessionVerified, setSessionVerified] = useState(false)

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.get('/users/me')
      const userData = res.body?.data || res.data?.data || res.data
      setUser(userData)
      setSessionVerified(true)
      return cacheUser(userData)
    } catch (err) {
      // 429 não invalida sessão — evita logout em rajada pós-pagamento/unlock.
      if (isRateLimitedError(err)) return null
      setSessionVerified(false)
      return null
    }
  }, [])

  const applyUserUpdate = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return
    // role não sobe via patch local — só /me, login ou register.
    const { role: _ignoredRole, ...safePatch } = patch
    setUser((prev) => {
      const next = { ...(prev || {}), ...safePatch }
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  useEffect(() => {
    // Cookie httpOnly é a fonte da verdade: sempre valida via /users/me.
    // Cache local só hidrata a UI durante o boot (UX); não decide autenticação nem admin.
    let cancelled = false
    const saved = localStorage.getItem(USER_KEY)
    if (saved) {
      try {
        setUser(JSON.parse(saved))
      } catch (_) {
        // cache corrompido — ignora e segue com /users/me
      }
    }

    api
      .get('/users/me')
      .then((res) => {
        if (cancelled) return
        const userData = res.body?.data || res.data?.data || res.data
        setUser(userData)
        setSessionVerified(true)
        cacheUser(userData)
      })
      .catch((err) => {
        if (cancelled) return
        // Rate limit não é sessão inválida — mantém cache local até nova tentativa.
        // sessionVerified permanece false → UI admin não libera com role forjada.
        if (isRateLimitedError(err)) return
        // Cookie ausente/expirado e refresh falhou → anônimo limpo.
        clearLocalAuthCache()
        setUser(null)
        setSessionVerified(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password, captchaToken) => {
    // O gateway seta os cookies httpOnly nesta resposta; o body traz só `user`.
    const res = await api.post('/auth/login', { email, password, captchaToken })
    const payload = res.body?.data || res.data?.data || res.data || {}
    // Preferir user do body — evita waterfall POST /auth/login → GET /users/me.
    const userData = payload.user || (await refreshUser())
    if (userData) {
      setUser(userData)
      setSessionVerified(true)
      cacheUser(userData)
    }
    return res.data
  }, [refreshUser])

  const register = useCallback(async (name, email, password, captchaToken) => {
    const res = await gatewayApi.post('/auth/register', { name, email, password, captchaToken })
    const payload = res.body?.data || res.data?.data || res.data || {}
    // Mesmo critério do login: body já traz user; /users/me só como fallback.
    const userData = payload.user || (await refreshUser())
    if (userData) {
      setUser(userData)
      setSessionVerified(true)
      cacheUser(userData)
    }
    return res.data
  }, [refreshUser])

  const logout = useCallback(async () => {
    // Limpa os cookies httpOnly no gateway (best-effort) e o estado local.
    try {
      await api.post('/auth/logout', {}, { _skipAuthRetry: true })
    } catch (_) {
      // Ignora — limpa o estado local de qualquer forma.
    }
    clearLocalAuthCache()
    setUser(null)
    setSessionVerified(false)
  }, [])

  // Admin UI só com sessão confirmada no servidor — não com role do localStorage.
  const isAdmin = useMemo(
    () => sessionVerified && resolveIsAdmin(user),
    [sessionVerified, user]
  )

  const value = useMemo(
    () => ({
      user,
      login,
      register,
      logout,
      refreshUser,
      applyUserUpdate,
      loading,
      sessionVerified,
      // Não confiar só no cache: autenticado só após boot e com user presente.
      isAuthenticated: !!user && !loading,
      isAdmin,
    }),
    [user, login, register, logout, refreshUser, applyUserUpdate, loading, sessionVerified, isAdmin]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
