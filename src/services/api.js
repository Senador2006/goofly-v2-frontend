import axios from 'axios'

// Em dev: VITE_USE_SERVICES_DIRECT=1 conecta direto ao services (3001), evitando 503 do gateway
const useDirect = import.meta.env.VITE_USE_SERVICES_DIRECT === '1' || import.meta.env.VITE_USE_SERVICES_DIRECT === 'true'
const gatewayBaseURL = import.meta.env.VITE_API_GATEWAY_URL || '/api'
const baseURL = useDirect
  ? (import.meta.env.VITE_API_SERVICES_URL || 'http://localhost:3001')
  : gatewayBaseURL

const createApiClient = (clientBaseURL) => axios.create({
  baseURL: clientBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

const api = createApiClient(baseURL)
export const gatewayApi = createApiClient(gatewayBaseURL)

const attachInterceptors = (client) => {
  client.interceptors.request.use((config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  client.interceptors.response.use(
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
}

attachInterceptors(api)
attachInterceptors(gatewayApi)

export default api
