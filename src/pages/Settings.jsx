import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'

export function Settings() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()

  return (
    <div>
      <Header
        title="Configurações"
        subtitle="Gerencie sua conta e preferências"
      />
      <div className="max-w-2xl space-y-8">
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-lg font-bold mb-4">Perfil</h3>
          <div className="flex items-center gap-4 mb-6">
            <div className="size-20 rounded-full bg-primary flex items-center justify-center text-2xl font-black">
              {user?.name?.[0] || 'U'}
            </div>
            <div>
              <p className="font-bold text-lg">{user?.name || 'Usuário'}</p>
              <p className="text-text-secondary text-sm">{user?.email || 'email@exemplo.com'}</p>
            </div>
          </div>
          <Button variant="secondary">Editar Perfil</Button>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-lg font-bold mb-4">Aparência</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name={isDark ? 'dark_mode' : 'light_mode'} />
              <span>Modo escuro</span>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                isDark ? 'bg-primary' : 'bg-surface-light dark:bg-surface-dark'
              }`}
            >
              <span
                className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                  isDark ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-lg font-bold mb-4">Conta</h3>
          <Button variant="secondary" onClick={logout} className="text-red-600 hover:bg-red-500/10">
            Sair da conta
          </Button>
        </div>
      </div>
    </div>
  )
}
