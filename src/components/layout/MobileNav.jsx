import { NavLink } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { MOBILE_NAV_ITEMS } from '../../config/navigation'

export function MobileNav({ className = '' }) {
  return (
    <nav
      aria-label="Navegação principal"
      className={`lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-border-light dark:border-border-dark px-1 py-2 flex justify-around safe-area-pb z-50 ${className}`.trim()}
    >
      {MOBILE_NAV_ITEMS.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          aria-label={to === '/settings' ? 'Perfil e configurações' : undefined}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 px-2 sm:px-4 rounded-full transition-colors min-w-[56px] sm:min-w-[64px] ${
              isActive ? 'bg-primary text-foreground' : 'text-text-secondary'
            }`
          }
        >
          <Icon name={icon} className="text-2xl" />
          <span className="text-[10px] font-bold">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
