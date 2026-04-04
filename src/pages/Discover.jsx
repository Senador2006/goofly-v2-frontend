import { Header } from '../components/layout/Header'
import { RecommendationsFree } from '../components/discover/RecommendationsFree'
import { useAuth } from '../context/AuthContext'

/**
 * Página Descobrir - RF09 Recomendador Gratuito
 *
 * Exibe apenas o formulário de preferências e 3 recomendações gratuitas.
 * Não requer login. Diferente do TDV (Tinder de Viagens), que fica na página
 * do Roteiro para usuários que estão criando o planejamento.
 *
 * @see docs/project/RECOMMENDATIONS_FREE.md
 * @see docs/project/README.md - "Recomendador de Locais" (gratuito)
 */
export function Discover() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="flex flex-col min-h-[calc(100vh-2rem)]">
      <Header
        title="Descobrir"
        subtitle="Gratuito: 3 ideias por interesse. Roteiro completo, TDV em todos os dias, documentos e recomendações da viagem estão no Planejamento Completo."
        showSearch={true}
      />
      <RecommendationsFree isAuthenticated={isAuthenticated} />
    </div>
  )
}
