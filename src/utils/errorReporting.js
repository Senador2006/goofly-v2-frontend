import * as Sentry from '@sentry/react'
import { createLogger } from './logger'

const log = createLogger('ErrorReporting')
const USER_KEY = 'user'

let sentryEnabled = false

/** Lê só `user.id` do cache local — sem e-mail/nome/PII. */
export function getSafeUserId() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw)
    const id = parsed?.id
    return id != null && id !== '' ? String(id) : undefined
  } catch {
    return undefined
  }
}

/**
 * Inicializa Sentry quando `VITE_SENTRY_DSN` está definido.
 * Sem DSN, o reporter ainda emite log estruturado (prod deixa de ser silencioso).
 */
export function initErrorReporting() {
  if (sentryEnabled) return

  const dsn = String(import.meta.env.VITE_SENTRY_DSN || '').trim()
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: String(import.meta.env.VITE_ENV || import.meta.env.MODE || 'production'),
    tracesSampleRate: 0,
  })
  sentryEnabled = true
}

/**
 * Reporta erro de UI com contexto mínimo para correlação (boundary, rota, user.id).
 */
export function reportClientError(error, context = {}) {
  const routePath =
    context.routePath ??
    (typeof window !== 'undefined' ? window.location.pathname : undefined)
  const userId = context.userId ?? getSafeUserId()
  const boundary = context.boundary || 'unknown'
  const componentStack = context.componentStack || undefined

  log.error('Client error captured', {
    message: error?.message,
    name: error?.name,
    boundary,
    routePath,
    userId: userId || undefined,
    componentStack,
  }, error)

  if (!sentryEnabled) return

  Sentry.withScope((scope) => {
    if (userId) scope.setUser({ id: userId })
    else scope.setUser(null)
    scope.setTag('boundary', boundary)
    if (routePath) scope.setTag('route', routePath)
    if (componentStack) scope.setExtra('componentStack', componentStack)
    Sentry.captureException(error)
  })
}
