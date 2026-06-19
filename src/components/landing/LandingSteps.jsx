const steps = [
  {
    n: 1,
    title: 'Conte seus sonhos',
    desc: 'Responda perguntas rápidas sobre destino, datas, orçamento e estilo de viagem.',
  },
  {
    n: 2,
    title: 'Receba seu roteiro',
    desc: 'Em minutos, você tem um plano personalizado com voos, hotéis e atividades curadas.',
  },
  {
    n: 3,
    title: 'Viaje e economize',
    desc: 'Aproveite cada momento com mais experiência e menos gasto do que se planejasse sozinho.',
  },
]

export function LandingSteps() {
  return (
    <section id="como-funciona" data-tour="como-funciona" className="bg-background-light py-20 scroll-mt-20">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-8">
        <header className="fade-up max-w-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
            Simples assim
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground leading-tight">
            Planeje em 3 passos
          </h2>
        </header>

        <div className="relative mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div
            className="hidden md:block absolute top-[36px] left-[16.6%] right-[16.6%] h-0.5"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #FEC107 0 8px, transparent 8px 16px)',
            }}
          />
          {steps.map((s) => (
            <div
              key={s.n}
              className="fade-up relative z-10 bg-white rounded-2xl p-8 text-center shadow-lg"
            >
              <div className="mx-auto mb-5 size-14 flex items-center justify-center rounded-full bg-primary text-foreground font-display text-2xl font-black border-[3px] border-white outline outline-[3px] outline-primary">
                {s.n}
              </div>
              <h3 className="font-bold text-base text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
