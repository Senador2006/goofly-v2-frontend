/**
 * Mensagens em pt-BR.
 *
 * Estrutura: dot-notation por feature (ex.: `auth.login.title`).
 * Suporta interpolação: "Olá, {{name}}".
 *
 * Quando crescer (ou quando entrar EN/ES como prometido na doc do produto),
 * trocar este stub por `i18next` + `react-i18next`. As keys já estão no
 * formato compatível.
 */
export default {
  app: {
    base_title: 'Goofly v2 — Travel Planner',
    description:
      'Planejador inteligente de viagens com Tinder de Viagens, roteiro com IA, recomendações por interesse e checklist de documentos.'
  },

  nav: {
    dashboard: 'Dashboard',
    trips: 'Minhas viagens',
    discover: 'Descobrir',
    memories: 'Memórias',
    settings: 'Configurações'
  },

  auth: {
    login: {
      title: 'Entrar',
      submit: 'Entrar',
      switch_to_register: 'Não tem conta? Crie agora'
    },
    register: {
      title: 'Criar conta',
      submit: 'Cadastrar',
      switch_to_login: 'Já tem conta? Entrar'
    },
    errors: {
      invalid_credentials: 'E-mail ou senha incorretos',
      generic: 'Não foi possível autenticar. Tente novamente.'
    }
  },

  trips: {
    title: 'Minhas viagens',
    new: 'Nova viagem',
    empty: {
      title: 'Você ainda não tem viagens',
      description: 'Crie sua primeira viagem para começar.'
    },
    status: {
      planejando: 'Planejando',
      ativa: 'Em andamento',
      concluida: 'Concluída'
    }
  },

  itinerary: {
    title: 'Roteiro',
    optimization_score: 'Score de otimização',
    free_locked: 'Faça upgrade para ver o roteiro completo'
  },

  tdv: {
    title: 'Tinder de Viagens',
    day_label: 'Dia {{day}}',
    likes_one: '{{count}} curtida',
    likes_other: '{{count}} curtidas',
    free_badge: 'Grátis: {{maxDays}}/{{tripDays}} dias',
    history_section: 'Histórico e finalizar',
    photo_hint: 'Fotos: toque nas laterais · Teclado: ← descartar · → curtir',
    finalize_cta: 'Estou satisfeito — gerar roteiro',
    finalize_generating: 'Gerando roteiro...',
    finalize_hint: 'Curta pelo menos um lugar antes de concluir.',
    free_limit:
      'No plano gratuito o TDV cobre {{maxDays}} de {{tripDays}} dia(s) desta viagem.',
    already_liked: 'Este lugar já recebeu seu like',
    skip: 'Pular',
    like: 'Adicionar ao roteiro',
    dislike: 'Não me interessa'
  },

  documents: {
    title: 'Documentos',
    obrigatorio: 'Obrigatório',
    opcional: 'Opcional',
    luggage: 'Lista de bagagem'
  },

  memories: {
    title: 'Memórias',
    empty: 'Nenhuma memória ainda. Faça upload de fotos da sua viagem.'
  },

  payment: {
    title: 'Planejamento Completo',
    cta: 'Ativar Planejamento Completo',
    success: 'Plano ativado com sucesso',
    failure: 'Falha ao processar — tente novamente'
  },

  common: {
    loading: 'Carregando…',
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    confirm: 'Confirmar',
    back: 'Voltar',
    next: 'Próximo',
    error: {
      generic: 'Algo deu errado. Tente novamente.',
      network: 'Sem conexão. Verifique sua internet.'
    }
  }
}
