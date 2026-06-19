import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'

const plans = [
  {
    title: 'Procurar destino',
    desc: 'Explore destinos, compare preços e descubra o lugar ideal para a sua próxima aventura.',
    cta: 'Explorar destinos',
    href: '/register',
    features: [
      'Busca por destino e datas',
      'Comparativo de preços em tempo real',
      'Guias de destino curados',
      'Dicas de experiências locais',
    ],
    featured: false,
    badge: 'Gratuito',
  },
  {
    title: 'Monte seu roteiro',
    desc: 'Roteiro completo e personalizado com IA, do voo ao hotel, em menos de 5 minutos.',
    cta: 'Montar meu roteiro',
    href: '/register',
    features: [
      'Roteiro dia a dia personalizado',
      'Melhores passagens e hospedagens',
      'Atividades e restaurantes selecionados',
      'Suporte 24/7 durante a viagem',
    ],
    featured: true,
  },
]

export function LandingPlans() {
  return (
    <section id="planos" data-tour="planos" className="bg-white py-20 scroll-mt-20">
      <div className="max-w-[900px] mx-auto px-6 lg:px-8 text-center">
        <header className="fade-up">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
            Teste grátis hoje
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground leading-tight mb-3">
            Escolha seu caminho
          </h2>
          <p className="text-text-secondary">Comece sem cartão de crédito. Cancele quando quiser.</p>
        </header>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
          {plans.map((p) => (
            <div
              key={p.title}
              className={`fade-up p-9 rounded-2xl border-2 transition-all hover:-translate-y-1 hover:shadow-lg ${
                p.featured
                  ? 'bg-foreground border-primary'
                  : 'bg-white border-border-light'
              }`}
            >
              {p.featured ? (
                <span className="inline-flex items-center gap-1 mb-4 px-3 py-1 text-[0.72rem] font-bold uppercase tracking-wider rounded-full bg-primary text-foreground">
                  <Icon name="star" filled className="text-sm" />
                  Mais popular
                </span>
              ) : (
                p.badge && (
                  <span className="inline-flex items-center gap-1 mb-4 px-3 py-1 text-[0.72rem] font-bold uppercase tracking-wider rounded-full bg-primary text-foreground">
                    <Icon name="auto_awesome" className="text-sm" />
                    {p.badge}
                  </span>
                )
              )}
              <h3 className={`font-display text-2xl font-black mb-2 ${p.featured ? 'text-white' : 'text-foreground'}`}>
                {p.title}
              </h3>
              <p className={`text-sm mb-6 ${p.featured ? 'text-white/60' : 'text-text-secondary'}`}>
                {p.desc}
              </p>

              <ul className="mb-7 space-y-0">
                {p.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-center gap-2.5 py-2 text-sm border-b ${
                      p.featured
                        ? 'text-white/65 border-white/10'
                        : 'text-text-secondary border-border-light'
                    }`}
                  >
                    <Icon name="check" className={`text-sm shrink-0 ${p.featured ? 'text-primary' : 'text-primary'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={p.href}
                className={`landing-btn ${p.featured ? 'landing-btn-card-primary' : ''} ${
                  p.featured
                    ? ''
                    : 'px-6 py-3 rounded-xl font-bold text-sm border-2 border-foreground text-foreground bg-transparent hover:bg-foreground hover:text-white'
                }`}
              >
                {p.cta}
                <Icon name="arrow_forward" className="text-base" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
