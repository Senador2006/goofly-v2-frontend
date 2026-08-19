import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GooflyLogo } from '../branding/GooflyLogo'
import { Icon } from '../common/Icon'

const links = [
  { href: '#destinos', label: 'Destinos' },
  { href: '#beneficios', label: 'Benefícios' },
  { href: '#como-funciona', label: 'Como Funciona' },
  { href: '#depoimentos', label: 'Depoimentos' },
  { href: '#contato', label: 'Contato' },
]

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const headerClass = [
    'fixed inset-x-0 top-0 z-50 h-[70px] flex items-center transition-shadow',
    'bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/10',
    scrolled ? 'shadow-[0_4px_24px_rgba(0,0,0,0.45)]' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <header className={headerClass}>
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8 flex items-center gap-8">
          <Link to="/" className="flex items-center shrink-0">
            <GooflyLogo forceDark heightClass="h-10 sm:h-12" className="max-w-[min(100%,14rem)]" />
          </Link>

          <nav className="hidden lg:flex mx-auto">
            <ul className="flex items-center gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="px-3.5 py-2 text-[13px] font-medium text-white/80 rounded-lg hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="hidden lg:flex items-center gap-2.5">
            <Link to="/login" className="landing-btn landing-btn-nav-secondary">
              Entrar
            </Link>
            <Link to="/register" className="landing-btn landing-btn-nav-primary">
              <Icon name="flight" />
              Começar agora
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden ml-auto p-2 text-white"
            aria-label="Abrir menu"
          >
            <Icon name={open ? 'close' : 'menu'} className="text-2xl" />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-x-0 top-[70px] z-40 lg:hidden bg-[#0A0A0A] border-b border-white/10 shadow-lg transition-all duration-200 origin-top ${
          open ? 'opacity-100 scale-y-100' : 'pointer-events-none opacity-0 scale-y-95'
        }`}
      >
        <div className="px-6 py-5">
          <ul className="mb-4">
            {links.map((l) => (
              <li key={l.href} className="border-b border-white/10">
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 font-medium text-white"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-2.5">
            <Link to="/login" className="landing-btn landing-btn-nav-secondary w-full justify-center">
              Entrar
            </Link>
            <Link to="/register" className="landing-btn landing-btn-nav-primary w-full justify-center">
              <Icon name="flight" />
              Começar agora
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
