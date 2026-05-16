import { NavLink } from 'react-router-dom'
import { Icon } from '../common/Icon'

const navItems = [
  { to: '/', icon: 'dashboard', label: 'Início' },
  { to: '/trips', icon: 'luggage', label: 'Viagens' },
  { to: '/discover', icon: 'explore', label: 'Descobrir' },
  { to: '/memories', icon: 'photo_library', label: 'Memórias' },
]

export function MobileNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-card-dark border-t border-border-light dark:border-border-dark p-2 flex justify-around safe-area-pb z-50">
      {navItems.map(({ to, icon, label }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 py-2 px-4 rounded-full transition-colors min-w-[64px] ${
              isActive ? 'bg-primary text-black' : 'text-text-secondary'
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
