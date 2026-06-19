import { Icon } from '../common/Icon'

const items = [
  {
    text: 'Economizei 30% na minha viagem para Portugal. As recomendações de lugares menos conhecidos foram incríveis — senti que viajei como local.',
    name: 'Carla Santos',
    meta: 'Viagem para Portugal',
    initials: 'CS',
  },
  {
    text: 'O roteiro personalizado me ajudou a aproveitar cada hora em Nova York. Visitei tudo que queria sem correr contra o relógio.',
    name: 'Ricardo Oliveira',
    meta: 'Viagem para Nova York, EUA',
    initials: 'RO',
  },
  {
    text: 'As dicas de restaurantes em Bangkok foram perfeitas! Economizei muito e tive experiências que jamais teria descoberto sozinha.',
    name: 'Amanda Pereira',
    meta: 'Viagem para Tailândia',
    initials: 'AP',
  },
]

export function LandingTestimonials() {
  return (
    <section id="depoimentos" data-tour="depoimentos" className="bg-background-light py-20 scroll-mt-20">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
        <header className="fade-up max-w-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
            Comunidade
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground leading-tight mb-2">
            Viajantes felizes
          </h2>
          <p className="text-text-secondary">Veja o que nossos usuários estão dizendo</p>
        </header>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((t) => (
            <article
              key={t.name}
              className="fade-up flex flex-col gap-4 p-7 rounded-2xl bg-white border border-border-light hover:shadow-lg transition-shadow"
            >
              <div className="flex gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name="star" filled className="text-base" />
                ))}
              </div>
              <p className="text-sm italic text-text-secondary leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full bg-foreground text-primary font-bold text-sm flex items-center justify-center shrink-0">
                  {t.initials}
                </div>
                <div>
                  <div className="font-bold text-sm text-foreground">{t.name}</div>
                  <div className="text-xs text-text-secondary mt-px">{t.meta}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-text-secondary">
          Junte-se a mais de <strong className="text-foreground">10.000 viajantes</strong> satisfeitos por todo o mundo
        </p>
      </div>
    </section>
  )
}
