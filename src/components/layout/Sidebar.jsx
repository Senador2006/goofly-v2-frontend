import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Icon } from '../common/Icon'
import { UserAvatar } from '../common/UserAvatar'
import { GooflyLogo } from '../branding/GooflyLogo'
import { PRIMARY_NAV_ITEMS } from '../../config/navigation'
import { accountWallPath } from '../../utils/accountWall'
import { useT } from '../../i18n'

export function Sidebar({ className = '' }) {
  const { user, isGuest } = useAuth()
  const t = useT()

  return (
    <aside className={`w-64 flex flex-col bg-white dark:bg-card-dark border-r border-border-light dark:border-border-dark p-6 h-full hidden lg:flex ${className}`.trim()}>
      <Link to="/dashboard" className="flex items-center justify-start self-start mb-10 shrink-0 -ml-3 overflow-visible">
        <GooflyLogo heightClass="h-14 md:h-16" className="max-w-[min(100%,17rem)]" />
      </Link>
      <nav className="flex flex-col gap-1 flex-grow" aria-label="Navegação principal">
        {PRIMARY_NAV_ITEMS.map(({ to, icon, label }) => {
          const guestWall = isGuest && to === '/memories'
          return (
            <NavLink
              key={to}
              to={guestWall ? accountWallPath(to) : to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive && !guestWall
                    ? 'bg-primary/20 text-foreground dark:text-white font-semibold'
                    : 'text-foreground/70 dark:text-white/70 hover:bg-surface-light dark:hover:bg-surface-dark'
                }`
              }
            >
              <Icon name={icon} />
              <span>{label}</span>
            </NavLink>
          )
        })}
      </nav>
      <div className="pt-6 border-t border-border-light dark:border-border-dark space-y-4">
        <NavLink
          to={isGuest ? accountWallPath('/settings') : '/settings'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 rounded-xl transition-colors ${
              isActive && !isGuest
                ? 'bg-primary/20 text-foreground dark:text-white font-semibold'
                : 'text-foreground/70 dark:text-white/70 hover:bg-surface-light dark:hover:bg-surface-dark'
            }`
          }
        >
          <Icon name="settings" />
          <span className="text-sm font-medium">Configurações</span>
        </NavLink>
        <div className="flex items-center gap-3 px-2">
          <UserAvatar user={user} size="sm" />
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{isGuest ? t('guest.visitor') : (user?.name || 'Viajante')}</p>
            <p className="text-xs text-text-secondary font-medium">{isGuest ? '7 dias neste navegador' : 'Explorer'}</p>
          </div>
        </div>
        {isGuest ? (
          <div className="flex flex-col gap-2 px-2">
            <Link to={accountWallPath('/dashboard')} className="text-sm font-bold underline">{t('guest.login')}</Link>
            <Link to="/register" className="text-sm font-bold underline">{t('guest.register')}</Link>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
