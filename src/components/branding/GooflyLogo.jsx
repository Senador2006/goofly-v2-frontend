/**
 * Wordmark em `/public/logo.jpeg` (basename respeita Vite `BASE_URL`).
 */
export function GooflyLogo({
  className = '',
  heightClass = 'h-11',
  width,
  loading = 'lazy',
}) {
  const base = String(import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
  return (
    <img
      src={`${base}logo.jpeg`}
      alt="Goofly"
      width={width ?? undefined}
      height={undefined}
      loading={loading}
      decoding="async"
      className={`w-auto max-w-[min(100%,18rem)] object-contain object-left ${heightClass} ${className}`.trim()}
    />
  )
}
