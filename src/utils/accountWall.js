export function safeReturnTo(value, fallback = '/dashboard') {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('://')) {
    return fallback
  }
  return value
}

export function accountWallPath(returnTo) {
  const target = safeReturnTo(returnTo, '/dashboard')
  return `/login?returnTo=${encodeURIComponent(target)}`
}
