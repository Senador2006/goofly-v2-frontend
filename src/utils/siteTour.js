export const TOUR_SELECTORS = {
  hero: '[data-tour="hero"]',
  destinos: '[data-tour="destinos"]',
  beneficios: '[data-tour="beneficios"]',
  comoFunciona: '[data-tour="como-funciona"]',
  planos: '[data-tour="planos"]',
  depoimentos: '[data-tour="depoimentos"]',
  heroCta: '[data-tour="hero-cta"]',
}

export function buildTourSteps(registerHref = '/register') {
  return [
    {
      popover: {
        title: 'Bem-vindo à Goofly',
        description:
          'Em menos de um minuto você vai conhecer como planejar viagens personalizadas, economizar até 30% e começar grátis.',
        side: 'over',
        showButtons: ['next', 'close'],
        nextBtnText: 'Começar tour',
      },
    },
    {
      element: TOUR_SELECTORS.hero,
      popover: {
        title: 'Viagens incríveis pelo menor preço',
        description:
          'A Goofly monta roteiros sob medida em minutos. Use <strong>Começar agora — é grátis</strong> para criar sua conta ou <strong>Já tenho conta</strong> se você já é viajante.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: TOUR_SELECTORS.destinos,
      popover: {
        title: 'Inspirações para sua próxima viagem',
        description:
          'Explore destinos com preços de referência e badges como “Mais pedido”. Quando estiver pronto, <strong>Montar meu roteiro</strong> leva você ao planejamento personalizado.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: TOUR_SELECTORS.beneficios,
      popover: {
        title: 'Tudo em um só lugar',
        description:
          'Roteiro com IA, dicas locais, suporte 24/7 e flexibilidade total — você ajusta datas, destino e orçamento quando quiser.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: TOUR_SELECTORS.comoFunciona,
      popover: {
        title: 'Planeje em 3 passos',
        description:
          '1) Conte seus sonhos → 2) Receba o roteiro em minutos → 3) Viaje economizando. Simples assim.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: TOUR_SELECTORS.planos,
      popover: {
        title: 'Escolha seu caminho',
        description:
          '<strong>Procurar destino</strong> é gratuito para explorar e comparar. <strong>Monte seu roteiro</strong> é o caminho completo com IA — roteiro dia a dia, passagens, hospedagem e suporte na viagem.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: TOUR_SELECTORS.depoimentos,
      popover: {
        title: 'Viajantes felizes',
        description:
          'Mais de 10.000 viajantes já usaram a Goofly. Veja relatos reais de economia e experiências que só locais conhecem.',
        side: 'top',
        align: 'start',
      },
    },
    {
      element: TOUR_SELECTORS.heroCta,
      popover: {
        title: 'Pronto para viajar?',
        description:
          'Crie sua conta grátis em segundos — sem cartão de crédito. Dúvidas? Fale com a gente em <strong>goofly.team@gmail.com</strong> ou <strong>(11) 99993-7400</strong>.',
        side: 'top',
        align: 'start',
        doneBtnText: 'Criar conta grátis',
        onNextClick: (_element, _step, { driver: tourDriver }) => {
          tourDriver.destroy()
          window.location.href = registerHref
        },
      },
    },
  ]
}

export function createTourConfig(registerHref = '/register') {
  return {
    steps: buildTourSteps(registerHref),
    animate: true,
    smoothScroll: true,
    allowClose: true,
    overlayOpacity: 0.65,
    stagePadding: 8,
    stageRadius: 12,
    showProgress: true,
    progressText: '{{current}} de {{total}}',
    nextBtnText: 'Próximo',
    prevBtnText: 'Anterior',
    doneBtnText: 'Concluir',
    popoverClass: 'goofly-tour-popover',
    showButtons: ['previous', 'next', 'close'],
    onHighlightStarted: () => {
      document.body.classList.add('site-tour-active')
    },
    onDestroyed: () => {
      document.body.classList.remove('site-tour-active')
    },
  }
}
