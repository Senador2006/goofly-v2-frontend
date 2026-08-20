import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { heroDestinations } from '../../utils/landingDestinations'

const stats = [
  { icon: 'luggage', v: '1.000+', title: 'Viagens planejadas', sub: 'e contando' },
  { icon: 'sentiment_satisfied', v: '98%', title: 'Satisfação', sub: 'de quem viaja' },
  { icon: 'trending_up', v: '−30%', title: 'Economia média', sub: 'na sua viagem' },
]

export function LandingHero() {
  return (
    <section
      id="hero"
      className="relative bg-[#0A0A0A] pt-[70px] min-h-screen overflow-hidden scroll-mt-20"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 lg:px-10 py-10 lg:py-14 grid lg:grid-cols-2 gap-10 lg:gap-12 items-center min-h-[calc(100vh-70px)]">
        <div data-tour="hero" className="flex flex-col justify-center fade-up">
          <h1 className="font-black text-white leading-[1.35] tracking-[-0.02em] text-[2.35rem] sm:text-5xl lg:text-[3.35rem] mb-6">
            O roteiro perfeito
            <br />
            <span className="text-primary">começa muito antes</span>
            <br />
            do embarque.
          </h1>

          <p className="text-white/70 text-base lg:text-lg leading-relaxed max-w-md mb-9">
            Menos estresse, mais experiências.
            <br />
            Seu itinerário personalizado,{' '}
            <span className="text-primary font-semibold">do seu jeito.</span>
          </p>

          <div data-tour="hero-cta" className="flex flex-col sm:flex-row gap-3 mb-10">
            <Link to="/register" className="landing-btn landing-btn-hero-primary w-full sm:w-auto">
              Começar agora — é grátis
              <Icon name="arrow_forward" className="text-base" />
            </Link>
            <Link to="/login" className="landing-btn landing-btn-hero-secondary w-full sm:w-auto">
              Já tenho conta
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.v} className="landing-stat-card text-center px-3 py-4">
                <div className="mx-auto mb-2.5 size-9 rounded-full bg-primary flex items-center justify-center text-foreground">
                  <Icon name={s.icon} className="text-[1.15rem]" />
                </div>
                <strong className="block font-display text-2xl font-bold text-primary leading-none">
                  {s.v}
                </strong>
                <span className="block mt-1.5 text-[13px] font-medium text-white leading-tight">
                  {s.title}
                </span>
                <span className="block text-[12px] text-white/50">{s.sub}</span>
              </div>
            ))}
          </div>
        </div>

        <div
          id="destinos"
          data-tour="destinos"
          className="grid grid-cols-2 gap-3.5 scroll-mt-24"
        >
          {heroDestinations.map((d) => (
            <Link
              key={d.city}
              to="/register"
              className={`landing-dest-card group relative overflow-hidden min-h-[200px] lg:min-h-[230px] ${
                d.span ? 'col-span-2 min-h-[240px] lg:min-h-[280px]' : ''
              }`}
            >
              <img
                src={d.img}
                alt={d.city}
                loading="lazy"
                className="absolute inset-0 size-full object-cover brightness-[0.78] group-hover:brightness-[0.9] group-hover:scale-105 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <span className="inline-block mb-2 px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide rounded-full border border-primary text-primary bg-black/40">
                  {d.tag}
                </span>
                <div className="font-display text-xl sm:text-2xl font-bold text-white">
                  {d.city}
                </div>
                <p className="mt-1 text-xs sm:text-sm text-white/80 leading-snug max-w-sm">
                  {d.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
