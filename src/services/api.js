import axios from 'axios'

/**
 * Cliente HTTP central do frontend.
 *
 * Decisões alinhadas com a auditoria (AUDITORIA_TECNICA.md, M5/A15/A20) e com
 * o roadmap §3 de `ANALISE_ARQUITETURA_OTIMIZACAO.md`:
 *
 * 1. **Versionamento**: o canon do gateway é `/api/v1` (audit A5). Mantemos
 *    `/api` apenas como fallback histórico em produção: o próprio gateway
 *    devolve 308 e o axios refaz a request preservando método e body.
 * 2. **VITE_USE_SERVICES_DIRECT**: pular o gateway é exclusivo de
 *    desenvolvimento. Em produção (`import.meta.env.PROD`) a flag é
 *    ignorada — preserva rate limit, CORS e circuit breaker do gateway.
 * 3. **Contrato {data, meta, error, message}**: a backend ainda devolve
 *    shapes mistos (`{ data, currentDay }`, `{ data, count }`, etc.). Em vez
 *    de um refactor destrutivo na backend (M5), normalizamos no cliente e
 *    expomos `response.body` com o contrato único; `response.data` continua
 *    intacto para callers antigos durante a migração.
 * 4. **Auth via cookie httpOnly (BFF)**: o access/refresh token vivem em
 *    cookies httpOnly setados pelo gateway (resolve C2 — XSS não lê mais o
 *    token). Todas as chamadas usam `withCredentials` para enviar o cookie.
 *    O interceptor tenta refresh **uma vez** (com dedup) chamando
 *    `POST /auth/refresh` sem body — o refresh-token vai no cookie — e refaz
 *    o request original (que carrega o novo cookie automaticamente).
 * 5. **Timeouts** (A15): default 30s; chamadas de IA usam `AI_TIMEOUT_MS`
 *    via override por request.
 */

const DEFAULT_TIMEOUT_MS = 30_000
export const AI_TIMEOUT_MS = 180_000

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'
const USER_KEY = 'user'

const isProd = import.meta.env.PROD
const directFlag =
  import.meta.env.VITE_USE_SERVICES_DIRECT === '1' ||
  import.meta.env.VITE_USE_SERVICES_DIRECT === 'true'
const useDirect = directFlag && !isProd

if (directFlag && isProd && typeof console !== 'undefined') {
  // Aviso silenciosamente em produção — não derruba a UI.
  console.warn(
    '[api] VITE_USE_SERVICES_DIRECT ignorado em produção: requests passam pelo gateway.'
  )
}

const DEFAULT_PRODUCTION_GATEWAY =
  'https://goofly-v2-api-gateway.onrender.com/api/v1'

function normalizeGatewayURL(url) {
  const base = String(url || '').trim().replace(/\/$/, '')
  if (!base) return base
  if (base.endsWith('/api/v1')) return base
  if (base.endsWith('/api')) return `${base}/v1`
  return `${base}/api/v1`
}

function resolveGatewayBaseURL() {
  const configured = String(import.meta.env.VITE_API_GATEWAY_URL || '').trim()

  if (/^https?:\/\//i.test(configured)) {
    return normalizeGatewayURL(configured)
  }

  if (isProd) {
    if (configured && typeof console !== 'undefined') {
      console.warn(
        '[api] VITE_API_GATEWAY_URL relativa ou ausente em produção; usando gateway Render:',
        DEFAULT_PRODUCTION_GATEWAY
      )
    }
    return DEFAULT_PRODUCTION_GATEWAY
  }

  return configured || '/api/v1'
}

const gatewayBaseURL = resolveGatewayBaseURL()
const baseURL = useDirect
  ? import.meta.env.VITE_API_SERVICES_URL || 'http://localhost:3001'
  : gatewayBaseURL

/**
 * Normaliza o corpo de resposta para `{ data, meta, error, message }`.
 *
 * Regras:
 * - Body nulo/primitivo → vira `data`.
 * - Body objeto com chave `data` → `meta` é o resto (menos `error`/`message`).
 * - Body objeto sem `data` → o objeto inteiro vira `data` (legacy
 *   endpoints como `/users/me/checkout-complete` e `/payment/pay`).
 */
function normalizeBody(body) {
  if (body == null) return { data: null, meta: {}, error: null, message: null }
  if (Array.isArray(body) || typeof body !== 'object') {
    return { data: body, meta: {}, error: null, message: null }
  }
  const { error = null, message = null } = body
  const hasDataField = Object.prototype.hasOwnProperty.call(body, 'data')
  if (hasDataField) {
    const { data, error: _e, message: _m, ...rest } = body
    return { data: data ?? null, meta: rest, error, message }
  }
  const { error: _e, message: _m, ...rest } = body
  return { data: rest, meta: {}, error, message }
}

/** Helper público — útil quando o caller já tem `res.data` cru. */
export const normalizeResponseBody = normalizeBody

function createApiClient(clientBaseURL) {
  const client = axios.create({
    baseURL: clientBaseURL,
    timeout: DEFAULT_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json' },
    // Envia/recebe os cookies httpOnly de auth (padrão BFF).
    withCredentials: true,
  })

  // Normalização do body — não substitui `response.data` para não quebrar
  // callers antigos.
  client.interceptors.response.use((response) => {
    response.body = normalizeBody(response.data)
    return response
  })

  return client
}

const api = createApiClient(baseURL)
export const gatewayApi = createApiClient(gatewayBaseURL)

/**
 * Refresh-token plumbing.
 *
 * Estado:
 * - `inFlightRefresh`: dedup de refresh concorrente — múltiplos 401
 *   simultâneos esperam a mesma promise.
 * - `_retry`: marca a request original para evitar loop infinito.
 */
let inFlightRefresh = null

async function hardLogout() {
  if (typeof window === 'undefined') return
  // Best-effort: pede ao gateway para limpar os cookies httpOnly.
  try {
    await api.post('/auth/logout', null, { _skipAuthRetry: true })
  } catch (_) {
    // Ignora — segue limpando o estado local de qualquer forma.
  }
  // Limpa resquícios de sessões antigas (pré-cookie) e o cache do user.
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login'
  }
}

async function performRefresh(client) {
  if (typeof window === 'undefined') {
    throw new Error('Refresh indisponível fora do browser')
  }
  // O refresh-token vai no cookie httpOnly — sem body. Dedup de chamadas
  // concorrentes via `inFlightRefresh`.
  if (!inFlightRefresh) {
    inFlightRefresh = client
      .post('/auth/refresh', null, { _skipAuthRetry: true })
      .finally(() => {
        inFlightRefresh = null
      })
  }
  await inFlightRefresh
  return true
}

function attachAuthRetry(client) {
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config || {}
      const status = error.response?.status
      const isAuthCall = typeof original.url === 'string' && original.url.includes('/auth/')
      const shouldTryRefresh =
        status === 401 &&
        !original._retry &&
        !original._skipAuthRetry &&
        !isAuthCall &&
        typeof window !== 'undefined' &&
        !window.location.pathname.includes('/login')

      if (!shouldTryRefresh) {
        if (status === 401 && typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          hardLogout()
        }
        return Promise.reject(error)
      }

      original._retry = true
      try {
        await performRefresh(client)
        // O novo access token já está no cookie httpOnly; o retry o carrega.
        return client.request(original)
      } catch (refreshErr) {
        if (refreshErr.response?.status !== 429) {
          hardLogout()
        }
        return Promise.reject(refreshErr)
      }
    }
  )
}

attachAuthRetry(api)
attachAuthRetry(gatewayApi)

export default api
