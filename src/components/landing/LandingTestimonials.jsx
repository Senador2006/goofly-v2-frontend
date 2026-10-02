import { Icon } from '../common/Icon'

const items = [
  {
    text: 'Eu tinha vários lugares salvos, mas não sabia como organizar tudo. A Goofly conseguiu transformar minhas ideias em um roteiro que realmente fazia sentido.',
    name: 'Juliana Costa',
    meta: 'Viagem para Portugal',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=160&q=80&auto=format&fit=crop',
  },
  {
    text: 'O que mais gostei foi não receber um roteiro genérico. Ele levou em consideração o que eu gosto e o ritmo que queria ter durante a viagem.',
    name: 'Rafael Mendes',
    meta: 'Viagem para Nova York, EUA',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&q=80&auto=format&fit=crop',
  },
  {
    text: 'Eu estava adiando o planejamento porque não sabia nem por onde começar. Com a Goofly, consegui estruturar minha viagem de uma forma muito mais simples.',
    name: 'Camila Souza',
    meta: 'Viagem para Tailândia',
    photo: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&q=80&auto=format&fit=crop',
  },
]

export function LandingTestimonials() {
  return (
    <section
      id="depoimentos"
      data-tour="depoimentos"
      className="bg-[#FBF8F2] py-20 lg:py-24 scroll-mt-20"
    >
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
        <header className="fade-up text-center max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary mb-3">
            Comunidade
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground mb-4">
            O planejamento muda quando o roteiro é{' '}
            <span className="text-primary">feito para você.</span>
          </h2>
          <p className="text-text-secondary">
            Veja como um roteiro personalizado pode transformar a experiência de planejar uma viagem.
          </p>
        </header>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((t) => (
            <article
              key={t.name}
              className="fade-up flex flex-col p-7 lg:p-8 rounded-[1.35rem] bg-white shadow-[0_8px_28px_rgba(18,16,14,0.06)]"
            >
              <div className="flex gap-0.5 text-primary mb-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Icon key={i} name="star" filled className="text-base" />
                ))}
              </div>
              <div className="relative flex-1 mb-5">
                <span
                  className="absolute -top-3 -left-1 font-display text-6xl leading-none text-primary/25 select-none"
                  aria-hidden
                >
                  “
                </span>
                <p className="relative z-10 text-sm italic text-foreground/80 leading-relaxed px-1">
                  {t.text}
                </p>
                <span
                  className="block text-right font-display text-6xl leading-none text-primary/25 -mt-3 select-none"
                  aria-hidden
                >
                  ”
                </span>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-black/10">
                <img
                  src={t.photo}
                  alt={t.name}
                  className="size-12 rounded-full object-cover shrink-0"
                />
                <div>
                  <div className="font-bold text-sm text-foreground">{t.name}</div>
                  <div className="text-xs text-text-secondary mt-px">{t.meta}</div>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="fade-up landing-callout-light mt-12 mx-auto max-w-2xl rounded-full flex items-center justify-center gap-3 px-5 py-3.5">
          <Icon name="public" className="text-primary text-xl shrink-0" />
          <p className="text-sm text-foreground">
            Junte-se a quem já começou a planejar a próxima viagem com a{' '}
            <strong>Goofly</strong>.
          </p>
        </div>
      </div>
    </section>
  )
}
