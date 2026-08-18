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
    likes_one: '{{count}} curtida',
    likes_other: '{{count}} curtidas',
    history_section: 'Histórico',
    video_links_heading: 'Vídeos',
    video_link_label: 'Vídeo {{n}} · {{source}}',
    video_link_aria: 'Abrir vídeo {{n}} em nova aba',
    undo_action: 'Desfazer última ação',
    undo_loading: 'Desfazendo...',
    finalize_action: 'Finalizar e gerar roteiro',
    finalize_cta: 'Estou satisfeito — gerar roteiro',
    finalize_generating: 'Gerando roteiro...',
    finalize_preparing_title: 'Seu roteiro está sendo preparado',
    finalize_preparing_subtitle: 'Isso pode levar alguns instantes',
    finalize_error: 'Não foi possível finalizar o TDV',
    finalize_hint: 'Sem curtidas, o roteiro será gerado apenas com os dados do formulário.',
    conclude_title: 'Concluir planejamento',
    conclude_body:
      'Gere o roteiro com a IA a partir do formulário da viagem. O TDV é opcional para indicar lugares que você prefere.',
    conclude_body_tdv:
      'A IA usa o formulário da viagem e, se houver, suas curtidas no TDV.',
    conclude_cta: 'Gerar roteiro e ativar viagem',
    mock_banner: 'Modo demonstração — recomendações de exemplo (não são sugestões reais da IA).',
    empty_title: 'Sem mais lugares',
    fetching: 'Buscando lugares...',
    retry: 'Tentar de novo',
    agent_unavailable:
      'Não foi possível carregar recomendações. Verifique sua conexão ou tente novamente em instantes.',
    free_cap_title: 'Limite do modo gratuito',
    free_cap_body:
      'Você explorou até 10 lugares no TDV gratuito. Gere o roteiro com o que curtiu ou desbloqueie o plano completo para continuar descobrindo.',
    free_cap_generate: 'Gerar roteiro',
    free_cap_unlock: 'Desbloquear plano completo',
    already_liked: 'Este lugar já recebeu seu like',
    skip: 'Pular',
    like: 'Adicionar ao roteiro',
    dislike: 'Não me interessa',
    intro_body:
      'Tinder de Viagem: Descubra seu estilo! Dê like nas experiências que você curte e deslike nas que não fazem seu estilo. Quando estiver satisfeito, dê um check ✓ e deixe a Goofly completar seu roteiro.',
    intro_understood: 'Entendido',
    lock_warn_title: 'TDV ficará bloqueado',
    lock_warn_body:
      'Ao gerar o roteiro no modo gratuito, você perde o acesso à aba TDV até desbloquear o planejamento completo desta viagem. Deseja continuar?',
    lock_warn_confirm: 'Gerar mesmo assim',
    lock_warn_cancel: 'Voltar',
    lock_tab_hint: 'Desbloqueie o planejamento para voltar a usar o TDV',
    lock_banner_title: 'TDV bloqueado',
    lock_banner_body:
      'A aba TDV fica bloqueada no modo gratuito após gerar o roteiro. Desbloqueie o planejamento completo para voltar a explorar e modificar paradas.',
    unlock_tdv_ready_title: 'TDV liberado',
    unlock_tdv_ready_body:
      'Toque na aba TDV para abrir o Tinder de Viagens sobre o roteiro e usar Modificar Roteiro com suas curtidas.',
    unlock_tdv_ready_cta: 'Abrir TDV',
    modify_intro_body:
      'Agora suas curtidas entram no roteiro pelo Modificar Roteiro. Continue explorando no TDV e, quando quiser, troque, inclua ou remova paradas com as picks que curtir.',
    modify_intro_understood: 'Entendi',
    modify_cta: 'Modificar Roteiro',
    modify_confirm_body:
      'Vamos abrir suas curtidas ao lado do roteiro para você inserir, remover ou trocar paradas. Nada é gerado pela IA — só você edita e conclui.',
    modify_panel_title: 'Curtidas para o roteiro',
    modify_panel_empty: 'Nenhuma curtida disponível para incluir. Explore no TDV e volte aqui.',
    modify_panel_hint:
      'Selecione uma curtida e troque por uma parada, ou insira no dia atual. Remova paradas pelo ícone da lixeira.',
    modify_insert: 'Inserir no dia atual',
    modify_swap_hint: 'Toque numa parada do roteiro para trocar com a curtida selecionada',
    modify_conclude: 'Concluir',
    modify_cancel: 'Cancelar',
    modify_saving: 'Salvando…',
    overlay_close: 'Fechar TDV',
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
