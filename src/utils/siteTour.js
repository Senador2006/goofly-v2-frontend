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
          'Em menos de um minuto você vai conhecer como o roteiro perfeito começa muito antes do embarque — e como começar grátis.',
        side: 'over',
        showButtons: ['next', 'close'],
        nextBtnText: 'Começar tour',
      },
    },
    {
      element: TOUR_SELECTORS.hero,
      popover: {
        title: 'O roteiro perfeito começa aqui',
        description:
          'Menos estresse, mais experiências. Use <strong>Começar agora — é grátis</strong> para criar sua conta ou <strong>Já tenho conta</strong> se você já é viajante.',
        side: 'right',
        align: 'start',
      },
    },
    {
      element: TOUR_SELECTORS.destinos,
      popover: {
        title: 'Inspirações para sua próxima viagem',
        description:
          'Maldivas, Paris e Bali são só o começo. Clique em um destino para começar a montar seu roteiro personalizado.',
        side: 'left',
        align: 'start',
      },
    },
    {
      element: TOUR_SELECTORS.beneficios,
      popover: {
        title: 'Tudo o que você precisa',
        description:
          'Roteiro com IA, dicas locais e flexibilidade total — o plano se adapta a você, não o contrário.',
        side: 'bottom',
        align: 'start',
      },
    },
    {
      element: TOUR_SELECTORS.comoFunciona,
      popover: {
        title: 'Deixe a parte difícil com a Goofly',
        description:
          '1) Conte destino e preferências → 2) Use o Tinder de viagem → 3) Receba um roteiro pensado para o seu perfil.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: TOUR_SELECTORS.planos,
      popover: {
        title: 'Por onde você quer começar?',
        description:
          '<strong>Explorar destinos</strong> se você ainda está escolhendo. <strong>Criar meu roteiro</strong> se já sabe para onde vai — a Goofly é gratuita para começar.',
        side: 'top',
        align: 'center',
      },
    },
    {
      element: TOUR_SELECTORS.depoimentos,
      popover: {
        title: 'Feito para você',
        description:
          'Veja como um roteiro personalizado transforma o planejamento. Junte-se a quem já começou a próxima viagem com a Goofly.',
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
