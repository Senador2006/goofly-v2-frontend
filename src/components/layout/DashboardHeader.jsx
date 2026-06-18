import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Icon } from '../common/Icon'
import { UserAvatar } from '../common/UserAvatar'

function formatLocaleDate() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function DashboardHeader() {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const profileLabel = user?.name?.trim()
    ? `Perfil de ${user.name.trim()}`
    : 'Perfil e configurações'

  return (
    <header className="flex items-center justify-between gap-4 mb-8">
      <p className="text-lg font-medium text-foreground dark:text-white">
        {formatLocaleDate()}
      </p>
      <div className="flex items-center gap-3">
        <button
          onClick={toggleTheme}
          className="size-10 rounded-xl bg-white dark:bg-card-dark flex items-center justify-center border border-border-light dark:border-border-dark hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
          title={isDark ? 'Modo claro' : 'Modo escuro'}
        >
          <Icon name={isDark ? 'light_mode' : 'dark_mode'} />
        </button>
        <button className="size-10 rounded-xl bg-white dark:bg-card-dark flex items-center justify-center border border-border-light dark:border-border-dark relative hover:bg-surface-light dark:hover:bg-surface-dark transition-colors">
          <Icon name="notifications" />
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full" />
        </button>
        <Link
          to="/settings"
          className="rounded-full hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          aria-label={profileLabel}
          title={profileLabel}
        >
          <UserAvatar user={user} size="sm" />
        </Link>
      </div>
    </header>
  )
}
