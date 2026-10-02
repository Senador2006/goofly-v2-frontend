import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'

const plans = [
  {
    title: 'Ainda escolhendo seu destino?',
    desc: 'Explore ideias, descubra lugares incríveis e encontre o destino que combina com você.',
    icon: 'public',
    cta: 'Explorar destinos',
    href: '/register',
    features: [
      { icon: 'explore', text: 'Explore diferentes destinos' },
      { icon: 'lightbulb', text: 'Descubra lugares e experiências' },
      { icon: 'star', text: 'Encontre ideias para sua próxima viagem' },
      { icon: 'favorite', text: 'Comece seu planejamento gratuitamente' },
    ],
    featured: false,
  },
  {
    title: 'Já escolheu seu destino?',
    desc: 'Conte como você quer viajar e receba um roteiro personalizado feito sob medida para você.',
    icon: 'map',
    cta: 'Criar meu roteiro',
    href: '/register',
    features: [
      { icon: 'calendar_today', text: 'Informe destino e datas' },
      { icon: 'person', text: 'Conte suas preferências de viagem' },
      { icon: 'auto_awesome', text: 'Gere um roteiro personalizado' },
      { icon: 'checklist', text: 'Organize sua viagem dia a dia' },
    ],
    featured: true,
  },
]

export function LandingPlans() {
  return (
    <section id="planos" data-tour="planos" className="bg-white py-20 lg:py-24 scroll-mt-20">
      <div className="max-w-[980px] mx-auto px-6 lg:px-8 text-center">
        <header className="fade-up">
          <h2 className="font-black text-3xl sm:text-4xl text-foreground leading-[1.4] mb-3">
            Por onde você quer <span className="text-primary">começar?</span>
          </h2>
          <p className="text-text-secondary">
            A Goofly é <span className="text-primary font-semibold">gratuita</span> para começar.
            Escolha o que você precisa agora.
          </p>
        </header>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          {plans.map((p) => (
            <div
              key={p.title}
              className={`fade-up p-8 lg:p-9 rounded-[1.5rem] transition-all hover:-translate-y-1 ${
                p.featured
                  ? 'bg-[#FFF9EF] shadow-[0_10px_32px_rgba(18,16,14,0.08)]'
                  : 'bg-white border border-black/10 shadow-[0_8px_28px_rgba(18,16,14,0.06)]'
              }`}
            >
              <div className="size-14 rounded-full bg-[#FFF3D0] flex items-center justify-center text-foreground mb-5">
                <Icon name={p.icon} className="text-3xl" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{p.title}</h3>
              <p className="text-sm text-text-secondary mb-6 leading-relaxed">{p.desc}</p>

              <ul className="mb-8">
                {p.features.map((f) => (
                  <li
                    key={f.text}
                    className="flex items-center gap-3 py-3 text-sm text-foreground border-t border-black/10 last:border-b"
                  >
                    <Icon name={f.icon} className="text-primary text-xl shrink-0" />
                    {f.text}
                  </li>
                ))}
              </ul>

              <Link
                to={p.href}
                className={`landing-btn w-full ${
                  p.featured ? 'landing-btn-card-primary' : 'landing-btn-card-outline'
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
