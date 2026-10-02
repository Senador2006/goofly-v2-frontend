import { useTheme } from '../../context/ThemeContext'

/**
 * Wordmarks em canvas 774×244: `/public/logo.jpeg` (claro) e `/public/goofly_so_fly_branco.png` (escuro).
 * `forceLight` / `forceDark` ignoram o tema — a landing usa `forceDark` no header preto.
 */
export function GooflyLogo({
  className = '',
  heightClass = 'h-11',
  width,
  loading = 'lazy',
  forceLight = false,
  forceDark = false,
}) {
  const { isDark } = useTheme()
  const base = String(import.meta.env.BASE_URL ?? '/').replace(/\/?$/, '/')
  const useDark = forceDark || (isDark && !forceLight)
  const file = useDark ? 'goofly_so_fly_branco.png' : 'logo.jpeg'
  return (
    <span
      className={`inline-flex shrink-0 items-center overflow-visible ${heightClass} ${className}`.trim()}
      style={{ aspectRatio: '774 / 244' }}
    >
      <img
        src={`${base}${file}`}
        alt="Goofly"
        width={width ?? 774}
        height={244}
        loading={loading}
        decoding="async"
        className="h-full w-full object-contain object-left"
      />
    </span>
  )
}
