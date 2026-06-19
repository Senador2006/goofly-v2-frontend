import { useAuth } from '../context/AuthContext'
import { AdminSettingsSection } from '../components/admin/AdminSettingsSection'
import { useTheme } from '../context/ThemeContext'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useState } from 'react'
import { userService } from '../services/userService'

export function Settings() {
  useDocumentTitle('Configurações')
  const { user, logout, refreshUser, isAdmin } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const startEdit = () => {
    setName(user?.name || '')
    setEmail(user?.email || '')
    setError(null)
    setEditing(true)
  }

  const cancelEdit = () => {
    setEditing(false)
    setError(null)
  }

  const saveProfile = async (e) => {
    e.preventDefault()
    if (!user?.id) return
    const trimmedName = (name || '').trim()
    const trimmedEmail = (email || '').trim()
    if (!trimmedName) {
      setError('Informe seu nome.')
      return
    }
    if (!trimmedEmail) {
      setError('Informe seu e-mail.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await userService.updateProfile(user.id, { name: trimmedName, email: trimmedEmail })
      await refreshUser()
      setEditing(false)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          'Não foi possível salvar. Tente novamente.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <Header
        title="Configurações"
        subtitle="Gerencie sua conta e preferências"
      />
      <div className="max-w-2xl space-y-8">
        {isAdmin ? <AdminSettingsSection /> : null}
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-lg font-bold mb-4">Perfil</h3>
          {!editing ? (
            <div className="mb-6 space-y-1">
              <p className="font-bold text-lg">{user?.name || 'Usuário'}</p>
              <p className="text-text-secondary text-sm">{user?.email || 'email@exemplo.com'}</p>
            </div>
          ) : null}
          {editing ? (
            <form onSubmit={saveProfile} className="space-y-4">
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <div>
                <label htmlFor="settings-name" className="block text-sm font-medium mb-1">
                  Nome
                </label>
                <input
                  id="settings-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="settings-email" className="block text-sm font-medium mb-1">
                  E-mail
                </label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </Button>
                <Button type="button" variant="secondary" onClick={cancelEdit} disabled={saving}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <Button variant="secondary" onClick={startEdit}>
              Editar Perfil
            </Button>
          )}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl p-6 border border-border-light dark:border-border-dark">
          <h3 className="text-lg font-bold mb-4">Aparência</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon name={isDark ? 'dark_mode' : 'light_mode'} />
              <span>Modo escuro</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isDark}
              aria-label="Alternar modo escuro"
              onClick={toggleTheme}
              className={`relative w-14 h-8 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                isDark
                  ? 'border-primary bg-primary'
                  : 'border-border-light bg-border-light dark:border-border-dark dark:bg-surface-dark'
              }`}
            >
              <span
                className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-white shadow-md ring-1 transition-all duration-200 ${
                  isDark
                    ? 'right-1 ring-white/30'
                    : 'left-1 ring-foreground/15'
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
