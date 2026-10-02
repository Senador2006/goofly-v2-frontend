import { FeatureComingSoon } from '../components/common/FeatureComingSoon'

/**
 * Página Memórias — temporariamente bloqueada (em desenvolvimento).
 * A navegação permanece visível; o conteúdo real não é carregado.
 */
export function Memories() {
  return (
    <FeatureComingSoon
      title="Memórias"
      icon="photo_library"
      description="O diário e o mapa de memórias ainda estão em desenvolvimento. Em breve você poderá revisitar suas viagens por aqui."
    />
  )
}
