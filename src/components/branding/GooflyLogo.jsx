import { useTheme } from '../../context/ThemeContext'

/**
 * Wordmarks em canvas 774×244: `/public/logo.jpeg` (claro) e `/public/goofly_so_fly_branco.png` (escuro).
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
  const useDark = isDark && !forceLight
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
