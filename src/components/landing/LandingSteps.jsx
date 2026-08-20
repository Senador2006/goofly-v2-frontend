import { Icon } from '../common/Icon'

const steps = [
  {
    n: 1,
    icon: 'edit_note',
    title: 'Informe seu destino, datas, preferências e o que você espera da viagem',
  },
  {
    n: 2,
    icon: 'travel_explore',
    title: 'Utilize o Tinder de viagem para descobrir qual atração você gosta ou não',
  },
  {
    n: 3,
    icon: 'map',
    title:
      'A inteligência artificial transforma essas informações em um roteiro personalizado e organizado, pensado para o seu perfil',
  },
]

export function LandingSteps() {
  return (
    <section
      id="como-funciona"
      data-tour="como-funciona"
      className="bg-[#F7F4EE] py-20 lg:py-24 scroll-mt-20"
    >
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
        <header className="fade-up text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-3">
            Simples assim
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground">
            Deixe a parte mais difícil com a Goofly
          </h2>
          <p className="mt-4 text-text-secondary leading-relaxed">
            Conte como você quer viajar e nossa inteligência artificial transforma essas informações
            em um roteiro personalizado e organizado.
          </p>
        </header>

        <div className="relative mt-16 pt-5 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          <div
            className="hidden md:block absolute top-5 left-[16.6%] right-[16.6%] h-0.5"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #FEC107 0 8px, transparent 8px 16px)',
            }}
          />
          {steps.map((s) => (
            <div key={s.n} className="fade-up relative">
              <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2 size-10 rounded-full bg-primary text-white font-bold text-lg flex items-center justify-center">
                {s.n}
              </div>
              <div className="landing-step-card relative z-10 bg-white rounded-2xl px-7 pt-12 pb-10 text-center">
                <div className="mx-auto mb-6 size-[88px] rounded-full bg-[#FFF5E6] flex items-center justify-center text-foreground">
                  <Icon name={s.icon} className="text-4xl" />
                </div>
                <p className="font-bold text-[15px] text-foreground leading-snug">{s.title}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="fade-up landing-callout-light mt-12 mx-auto max-w-2xl flex items-center justify-center gap-3 px-5 py-3.5">
          <span className="size-8 rounded-full bg-white border border-black/5 flex items-center justify-center shrink-0">
            <Icon name="favorite" filled className="text-primary text-base" />
          </span>
          <p className="text-sm text-text-secondary">
            Mais de{' '}
            <strong className="text-primary font-bold">10.000 viajantes</strong> satisfeitos por todo
            o mundo
          </p>
        </div>
      </div>
    </section>
  )
}
