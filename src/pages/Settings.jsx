import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Header } from '../components/layout/Header'
import { Icon } from '../components/common/Icon'
import { Button } from '../components/common/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useState } from 'react'
import { userService } from '../services/userService'

export function Settings() {
  useDocumentTitle('Configurações')
  const { user, logout, refreshUser } = useAuth()
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
