import { useTheme } from '../../context/ThemeContext'

/**
 * Wordmark em `/public/logo.jpeg` (claro) e `/public/gooflyBranco.png` (escuro).
 * `forceLight` mantém a logo padrão — útil na landing, que é sempre clara.
 */
export function GooflyLogo({
  className = '',
  heightClass = 'h-11',
  width,
  loading = 'lazy',
  forceLight = false,
}) {
  const { isDark } = useTheme()
  const base = String(import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
  const file = isDark && !forceLight ? 'gooflyBranco.png' : 'logo.jpeg'
  return (
    <img
      src={`${base}${file}`}
      alt="Goofly"
      width={width ?? 774}
      height={244}
      loading={loading}
      decoding="async"
      className={`w-auto max-w-[min(100%,18rem)] object-contain object-left ${heightClass} ${className}`.trim()}
    />
  )
}
