import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { offers } from '../../utils/landingDestinations'

export function LandingOffers() {
  return (
    <section id="destinos" data-tour="destinos" className="bg-white py-20 scroll-mt-20">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4 mb-10 fade-up">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">
              Inspirações de destinos
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-black text-foreground leading-tight">
              Pra onde vamos te levar?
            </h2>
          </div>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary border-b border-primary pb-px hover:opacity-70 transition-opacity"
          >
            Montar meu roteiro
            <Icon name="arrow_forward" className="text-sm" />
          </Link>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 fade-up">
          {offers.map((o) => (
            <Link
              key={o.city}
              to="/register"
              className="group block rounded-2xl overflow-hidden bg-white border border-border-light hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="aspect-[4/3] overflow-hidden bg-background-light">
                <img
                  src={o.img}
                  alt={o.city}
                  loading="lazy"
                  className="size-full object-cover group-hover:scale-[1.07] transition-transform duration-500"
                />
              </div>
              <div className="p-4">
                <span className="inline-block mb-2 px-2.5 py-0.5 text-[0.7rem] font-bold rounded-full bg-primary/20 text-foreground border border-primary/40">
                  {o.badge}
                </span>
                <div className="font-bold text-base text-foreground">{o.city}</div>
                <div className="text-xs text-text-secondary mt-0.5 mb-2">{o.detail}</div>
                {o.price !== '\n' && (
                  <div className="text-base font-bold text-foreground">
                    <span className="text-xs font-normal text-text-secondary mr-1">a partir de</span>
                    {o.price}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
