import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Icon } from '../common/Icon'

export function Header({ title, subtitle, showSearch = false }) {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  return (
    <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6 md:mb-10">
      <div>
        {title && (
          <h2 className="text-2xl md:text-4xl font-black tracking-tight mb-1">{title}</h2>
        )}
        {subtitle && (
          <p className="text-text-secondary">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={toggleTheme}
          className="size-12 rounded-full bg-white dark:bg-card-dark flex items-center justify-center shadow-sm hover:bg-surface-light dark:hover:bg-surface-dark transition-colors"
          title={isDark ? 'Modo claro' : 'Modo escuro'}
        >
          <Icon name={isDark ? 'light_mode' : 'dark_mode'} />
        </button>
        <button className="size-12 rounded-full bg-white dark:bg-card-dark flex items-center justify-center shadow-sm relative hover:bg-surface-light dark:hover:bg-surface-dark transition-colors">
          <Icon name="notifications" />
          <span className="absolute top-3 right-3 size-2 bg-red-500 rounded-full border-2 border-white dark:border-card-dark" />
        </button>
        <div
          className="size-12 rounded-full bg-center bg-cover border-2 border-primary bg-gray-200"
          style={user?.avatar ? { backgroundImage: `url(${user.avatar})` } : {}}
          title={user?.name}
        />
      </div>
    </header>
  )
}
