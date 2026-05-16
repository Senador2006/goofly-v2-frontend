import { useState } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { Icon } from '../common/Icon'

function formatLocaleDate() {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

export function DashboardHeader() {
  const { isDark, toggleTheme } = useTheme()
  const [search, setSearch] = useState('')

  return (
    <header className="flex items-center justify-between gap-4 mb-8">
      <p className="text-lg font-medium text-[#1c1c0d] dark:text-white">
        {formatLocaleDate()}
      </p>
      <div className="flex items-center gap-3">
        <div className="relative hidden sm:block">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary text-lg"
          />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
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
      </div>
    </header>
  )
}
