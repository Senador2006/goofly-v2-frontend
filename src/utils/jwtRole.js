/** Lê `role` do JWT no localStorage (fallback se o cache do user estiver desatualizado). */
export function getRoleFromStoredToken() {
  if (typeof window === 'undefined') return null
  const token = localStorage.getItem('token')
  if (!token) return null
  try {
    const segment = token.split('.')[1]
    if (!segment) return null
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/')))
    return payload.role === 'admin' ? 'admin' : payload.role === 'user' ? 'user' : null
  } catch {
    return null
  }
}

export function resolveIsAdmin(user) {
  if (user?.role === 'admin') return true
  return getRoleFromStoredToken() === 'admin'
}
