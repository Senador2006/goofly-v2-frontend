import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'

/** Seção de configurações visível apenas para administradores. */
export function AdminSettingsSection() {
  return (
    <div className="rounded-2xl border border-primary/40 bg-primary/10 p-5 mb-4">
      <p className="text-sm font-bold text-foreground dark:text-white flex items-center gap-2 mb-2">
        <Icon name="verified_user" className="text-primary" />
        Administração
      </p>
      <p className="text-xs text-text-secondary mb-4">
        Acesso ao painel de métricas e ferramentas internas da plataforma.
      </p>
      <Link
        to="/admin"
        className="inline-flex items-center justify-center gap-2 rounded-full bg-primary text-foreground font-bold text-sm px-5 py-2.5 hover:opacity-90 transition-opacity"
      >
        <Icon name="analytics" />
        Abrir painel de métricas
      </Link>
    </div>
  )
}
