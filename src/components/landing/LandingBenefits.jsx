import { Icon } from '../common/Icon'

const items = [
  {
    icon: 'auto_awesome',
    title: 'Roteiro Personalizado',
    desc: 'Monte seu itinerário com IA que aprende seus gostos — de cultura a aventura, cidade ou praia.',
  },
  {
    icon: 'place',
    title: 'Dicas Locais',
    desc: 'Restaurantes escondidos, atrações fora do circuito turístico e experiências que só locais conhecem.',
  },
  {
    icon: 'support_agent',
    title: 'Suporte 24/7',
    desc: 'Equipe disponível durante toda a sua viagem para ajudar com imprevistos, mudanças e dúvidas.',
  },
  {
    icon: 'tune',
    title: 'Flexibilidade Total',
    desc: 'Ajuste datas, destinos e orçamento a qualquer momento. O plano se adapta a você, não o contrário.',
  },
]

export function LandingBenefits() {
  return (
    <section id="beneficios" data-tour="beneficios" className="bg-foreground py-20 scroll-mt-20">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <header className="fade-up max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
            Por que a Goofly?
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-white leading-tight">
            Tudo o que você precisa
            <br />
            em um lugar só
          </h2>
        </header>

        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="fade-up landing-benefit-card group p-8"
            >
              <div className="landing-benefit-icon mb-5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary size-[52px]">
                <Icon name={icon} className="text-2xl" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
