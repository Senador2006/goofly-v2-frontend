import { Link } from 'react-router-dom'
import { Header } from '../layout/Header'
import { Icon } from './Icon'
import { Button } from './Button'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

/**
 * Bloqueio/fallback para áreas ainda em desenvolvimento.
 * Mantém a aba acessível na navegação, mas não carrega a funcionalidade real.
 */
export function FeatureComingSoon({
  title,
  description = 'Esta área ainda está em desenvolvimento. Em breve você poderá usá-la por aqui.',
  icon = 'construction',
  backTo = '/dashboard',
  backLabel = 'Voltar ao início',
}) {
  useDocumentTitle(title)

  return (
    <div className="flex flex-col min-h-[calc(100vh-2rem)]">
      <Header title={title} subtitle="Em desenvolvimento" />
      <div className="flex flex-1 flex-col items-center justify-center p-8 md:p-12">
        <div className="max-w-md w-full text-center">
          <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Icon name={icon} className="text-4xl text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-text-secondary mb-2 text-sm font-semibold uppercase tracking-wider">
            Em desenvolvimento
          </p>
          <p className="text-text-secondary mb-8">{description}</p>
          <Link to={backTo}>
            <Button className="w-full">
              <Icon name="arrow_back" />
              {backLabel}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
