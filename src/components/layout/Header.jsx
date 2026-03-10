import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Icon } from '../common/Icon'

export function Header({ title, subtitle, showSearch = true }) {
  const { user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [search, setSearch] = useState('')

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
        {showSearch && (
          <div className="relative min-w-0 flex-1 md:min-w-80">
            <Icon
              name="search"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary"
            />
            <input
              type="text"
              placeholder="Buscar destinos, hotéis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-full pl-12 pr-6 py-3 focus:ring-2 focus:ring-primary focus:outline-none shadow-sm text-sm"
            />
          </div>
        )}
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
