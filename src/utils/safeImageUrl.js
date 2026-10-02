/**
 * Aceita apenas URLs http(s) absolutas/relativas resolvíveis.
 * Bloqueia javascript:, data:, e valores que quebrariam CSS `url(...)`.
 *
 * @param {unknown} raw
 * @param {string} [base]
 * @returns {string | null}
 */
export function safeImageUrl(raw, base) {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const origin =
    base ||
    (typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost')

  try {
    const u = new URL(trimmed, origin)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.href
  } catch {
    return null
  }
}
