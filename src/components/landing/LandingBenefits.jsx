import { Icon } from '../common/Icon'

const items = [
  {
    icon: 'map',
    title: 'Roteiro Personalizado',
    desc: 'Monte seu itinerário com IA que aprende seus gostos — de cultura a aventura, cidade ou praia.',
    points: [
      'Itinerário feito para o seu perfil',
      'Sugestões que combinam com você',
      'Roteiro organizado dia a dia',
    ],
  },
  {
    icon: 'location_on',
    title: 'Dicas Locais',
    desc: 'Restaurantes escondidos, atrações fora do circuito turístico e experiências que só locais conhecem.',
    points: [
      'Lugares autênticos',
      'Experiências únicas',
      'Conteúdo sempre atualizado',
    ],
  },
  {
    icon: 'tune',
    title: 'Flexibilidade Total',
    desc: 'Ajuste datas, destinos e orçamento a qualquer momento. O plano se adapta a você, não o contrário.',
    points: [
      'Edite quando quiser',
      'Compare opções facilmente',
      'Viaje do seu jeito',
    ],
  },
]

export function LandingBenefits() {
  return (
    <section id="beneficios" data-tour="beneficios" className="bg-[#0A0A0A] py-20 lg:py-24 scroll-mt-20">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <header className="fade-up text-center max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-3">
            Feito para você
          </p>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-black text-white">
            Tudo o que você precisa para uma{' '}
            <span className="text-primary">viagem incrível</span>
          </h2>
          <p className="mt-4 text-white/60 text-base leading-relaxed max-w-2xl mx-auto">
            A Goofly combina inteligência artificial e curadoria de qualidade para criar roteiros
            que realmente fazem sentido para você.
          </p>
        </header>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map(({ icon, title, desc, points }) => (
            <div key={title} className="fade-up landing-benefit-card group p-7 lg:p-8">
              <div className="mb-5 size-14 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-primary">
                <Icon name={icon} className="text-3xl" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed mb-5">{desc}</p>
              <ul>
                {points.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2.5 py-2.5 text-sm text-white border-t border-white/10"
                  >
                    <span className="landing-check-circle shrink-0">
                      <Icon name="check" className="text-[0.85rem]" />
                    </span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="fade-up landing-callout-dark mt-10 flex items-center justify-center gap-3 px-6 py-4">
          <span className="size-8 rounded-full border border-primary flex items-center justify-center shrink-0">
            <Icon name="star" filled className="text-primary text-base" />
          </span>
          <p className="text-sm sm:text-base text-white/80">
            <strong className="text-white font-semibold">Sua viagem, do seu jeito.</strong>{' '}
            Com a Goofly, cada detalhe faz sentido.
          </p>
        </div>
      </div>
    </section>
  )
}
