import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { heroDestinations } from '../../utils/landingDestinations'

export function LandingHero() {
  return (
    <section id="hero" className="relative bg-foreground pt-[70px] grid lg:grid-cols-2 min-h-screen overflow-hidden scroll-mt-20">
      <div data-tour="hero" className="px-6 sm:px-10 lg:px-20 py-16 lg:py-24 flex flex-col justify-center fade-up">
        <span className="inline-flex w-fit items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest bg-primary/15 text-primary border border-primary/30 mb-6">
          <Icon name="auto_awesome" className="text-sm" />
          Planejamento inteligente de viagens
        </span>

        <h1 className="font-display font-black text-white leading-tight tracking-tight text-4xl sm:text-5xl lg:text-6xl mb-6">
          Viagens <em className="not-italic text-primary">incríveis</em>
          <br />
          pelo menor preço.
        </h1>

        <p className="text-white/70 text-base lg:text-lg leading-relaxed max-w-md mb-10">
          Planeje viagens personalizadas em minutos e economize até 30%. Roteiros sob medida para quem
          quer mais experiência, menos estresse.
        </p>

        <div data-tour="hero-cta" className="flex flex-col sm:flex-row gap-3 mb-12">
          <Link to="/register" className="landing-btn landing-btn-hero-primary w-full sm:w-auto">
            Começar agora — é grátis
            <Icon name="arrow_forward" className="text-base" />
          </Link>
          <Link to="/login" className="landing-btn landing-btn-hero-secondary w-full sm:w-auto">
            Já tenho conta
          </Link>
        </div>

        <div className="flex flex-wrap gap-10 pt-8 border-t border-white/10">
          {[
            { v: '1.000+', l: 'Viagens planejadas' },
            { v: '98%', l: 'Satisfação' },
            { v: '−30%', l: 'Economia média' },
          ].map((s) => (
            <div key={s.l}>
              <strong className="block font-display text-3xl font-bold text-primary leading-none">
                {s.v}
              </strong>
              <span className="block mt-1 text-xs text-white/50">{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative h-[60vw] lg:h-screen grid grid-cols-2 grid-rows-2 gap-[3px] bg-card-dark">
        {heroDestinations.map((d) => (
          <div
            key={d.city}
            className={`relative overflow-hidden cursor-pointer group ${d.span ? 'col-span-2' : ''}`}
          >
            <img
              src={d.img}
              alt={d.city}
              loading="lazy"
              className="absolute inset-0 size-full object-cover brightness-[0.7] group-hover:brightness-[0.85] group-hover:scale-105 transition-all duration-500"
            />
            <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-foreground/85 to-transparent">
              {d.tag && (
                <span className="inline-block mb-1.5 px-3 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide rounded-full bg-primary/20 text-primary">
                  {d.tag}
                </span>
              )}
              <div className="font-display text-xl font-bold text-white">{d.city}</div>
              {d.price && d.price !== '\n' && (
                <div className="mt-0.5 text-sm font-semibold text-primary">{d.price}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
