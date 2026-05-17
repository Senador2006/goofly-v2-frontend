import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../common/Icon'

const navItems = [
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { to: '/discover', icon: 'explore', label: 'Descobrir' },
  { to: '/trips', icon: 'luggage', label: 'Minhas Viagens' },
  { to: '/memories', icon: 'photo_library', label: 'Memórias' },
]

export function Sidebar() {
  const { user } = useAuth()

  return (
    <aside className="w-64 flex flex-col bg-white dark:bg-card-dark border-r border-border-light dark:border-border-dark p-6 h-full hidden lg:flex">
      <div className="flex items-center gap-3 mb-10">
        <div className="bg-primary size-10 rounded-full flex items-center justify-center">
          <Icon name="flight_takeoff" className="text-foreground font-bold" />
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">Goofly</h1>
      </div>
      <nav className="flex flex-col gap-1 flex-grow">
        {navItems.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-primary/20 text-foreground dark:text-white font-semibold'
                  : 'text-foreground/70 dark:text-white/70 hover:bg-surface-light dark:hover:bg-surface-dark'
              }`
            }
          >
            <Icon name={icon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="pt-6 border-t border-border-light dark:border-border-dark space-y-4">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-4 py-2 rounded-xl text-foreground/70 dark:text-white/70 hover:bg-surface-light dark:hover:bg-surface-dark"
        >
          <Icon name="settings" />
          <span className="text-sm font-medium">Configurações</span>
        </NavLink>
        <div className="flex items-center gap-3 px-2">
          <div className="size-10 rounded-full bg-primary flex items-center justify-center overflow-hidden border-2 border-primary shrink-0">
            {user?.avatar ? (
              <img src={user.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-foreground font-bold text-sm">
                {(user?.name || 'U')[0]}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user?.name || 'Viajante'}</p>
            <p className="text-xs text-text-secondary font-medium">Explorer</p>
          </div>
        </div>
      </div>
    </aside>
  )
}
