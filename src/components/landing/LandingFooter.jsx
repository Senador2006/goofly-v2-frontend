import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { LANDING_SOCIAL_LINKS } from '../../constants/landingSocialLinks'
import { LandingSocialIcon } from './LandingSocialIcon'

export function LandingFooter() {
  return (
    <footer id="contato" className="bg-foreground text-white/60 pt-16 pb-8">
      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="font-display text-2xl font-black tracking-tight text-white inline-flex mb-3">
            Goo<span className="text-primary">Fly</span>
          </Link>
          <p className="text-sm leading-relaxed max-w-[260px] mb-5">
            Planejamento de viagens personalizadas, feito para quem quer mais experiência pelo menor preço possível.
          </p>
          <div className="flex gap-2">
            {LANDING_SOCIAL_LINKS.map((social) => {
              const className =
                'size-9 flex items-center justify-center rounded-[10px] bg-white/[0.07] border border-white/10 text-white/50 hover:bg-primary hover:border-primary hover:text-foreground hover:-translate-y-0.5 transition-all'

              if (!social.href) {
                return (
                  <span
                    key={social.id}
                    className={`${className} opacity-50 cursor-not-allowed`}
                    title={`${social.label} — configure em src/constants/landingSocialLinks.js`}
                    aria-label={social.label}
                  >
                    <LandingSocialIcon id={social.id} />
                  </span>
                )
              }

              return (
                <a
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className={className}
                >
                  <LandingSocialIcon id={social.id} />
                </a>
              )
            })}
          </div>
        </div>

        <FooterCol
          title="Produto"
          links={[
            { label: 'Buscar destinos', to: '/register' },
            { label: 'Montar roteiro', to: '/register' },
            { label: 'Entrar', to: '/login' },
            { label: 'Criar conta grátis', to: '/register' },
          ]}
        />
        <FooterCol
          title="Empresa"
          links={[
            { label: 'Sobre nós', to: null },
            { label: 'Blog de viagens', to: null },
            { label: 'Termos de uso', to: null },
            { label: 'Privacidade', to: null },
          ]}
        />

        <div>
          <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-5">Contato</h4>
          <p className="text-sm mb-2">goofly.team@gmail.com</p>
          <p className="text-sm mb-2">(11) 99993-7400</p>
          <p className="text-sm">São Paulo, Brasil</p>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-8 pt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm inline-flex items-center gap-1">
          Feito com
          <Icon name="favorite" filled className="text-red-400 text-base" />
          para exploradores do mundo
        </p>
        <p className="text-sm">© 2026 Goofly. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h4 className="text-white font-bold text-xs uppercase tracking-widest mb-5">{title}</h4>
      {links.map((l) =>
        l.to ? (
          <Link key={l.label} to={l.to} className="block text-sm mb-2.5 hover:text-primary transition-colors">
            {l.label}
          </Link>
        ) : (
          <span key={l.label} className="block text-sm mb-2.5 text-white/60">
            {l.label}
          </span>
        ),
      )}
    </div>
  )
}
