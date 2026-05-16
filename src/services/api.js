import axios from 'axios'

// Em dev: VITE_USE_SERVICES_DIRECT=1 conecta direto ao services (3001), evitando 503 do gateway
const useDirect = import.meta.env.VITE_USE_SERVICES_DIRECT === '1' || import.meta.env.VITE_USE_SERVICES_DIRECT === 'true'
const baseURL = useDirect
  ? (import.meta.env.VITE_API_SERVICES_URL || 'http://localhost:3001')
  : (import.meta.env.VITE_API_GATEWAY_URL || '/api')

// Timeouts por classe de operação (ms).
// Sem timeout no axios o cliente espera infinitamente em conexões mortas
// (TCP RST nunca chega) — request fica pendurado e o usuário vê spinner eterno.
// Default = 30s cobre 99% dos requests; chamadas que envolvem agentes IA
// (gateway → services → n8n) precisam de mais — usar `api.aiClient` ou
// passar `timeout` no config do request específico.
const DEFAULT_TIMEOUT_MS = 30_000
export const AI_TIMEOUT_MS = 180_000

const api = axios.create({
  baseURL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
