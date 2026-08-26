import { FeatureComingSoon } from '../components/common/FeatureComingSoon'

/**
 * Página Descobrir — temporariamente bloqueada (em desenvolvimento).
 * A navegação permanece visível; o conteúdo real não é carregado.
 */
export function Discover() {
  return (
    <FeatureComingSoon
      title="Descobrir"
      icon="explore"
      description="O recomendador de destinos ainda está em desenvolvimento. Em breve você poderá explorar ideias por aqui."
    />
  )
}
