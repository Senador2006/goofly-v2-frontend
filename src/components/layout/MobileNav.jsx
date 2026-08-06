import { useLayoutEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { MOBILE_NAV_ITEMS } from '../../config/navigation'

const MOBILE_NAV_HEIGHT_VAR = '--goofly-mobile-nav-height'

export function MobileNav({ className = '' }) {
  const navRef = useRef(null)

  useLayoutEffect(() => {
    const el = navRef.current
    if (!el) return undefined

    const publishHeight = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      if (height > 0) {
        document.documentElement.style.setProperty(MOBILE_NAV_HEIGHT_VAR, `${height}px`)
      }
    }

    publishHeight()
    const ro = new ResizeObserver(publishHeight)
    ro.observe(el)
    window.addEventListener('orientationchange', publishHeight)
    window.visualViewport?.addEventListener('resize', publishHeight)
    window.visualViewport?.addEventListener('scroll', publishHeight)
    return () => {
      ro.disconnect()
      window.removeEventListener('orientationchange', publishHeight)
      window.visualViewport?.removeEventListener('resize', publishHeight)
      window.visualViewport?.removeEventListener('scroll', publishHeight)
      document.documentElement.style.removeProperty(MOBILE_NAV_HEIGHT_VAR)
    }
  }, [])

  return (
    <nav
      ref={navRef}
      aria-label="Navegação principal"
      className={`lg:hidden fixed bottom-0 left-0 right-0 z-[1100] bg-white dark:bg-card-dark border-t border-border-light dark:border-border-dark px-1 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex justify-around ${className}`.trim()}
    >
      {MOBILE_NAV_ITEMS.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={to === '/settings' ? 'Perfil e configurações' : undefined}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 px-2 rounded-full transition-colors min-w-[56px] ${
              isActive ? 'bg-primary text-foreground' : 'text-text-secondary'
            }`
          }
        >
          <Icon name={icon} className="text-2xl" />
          <span className="text-[10px] font-bold leading-none">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
