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
    'bg-[#FFFDF7]/95 backdrop-blur-md border-b border-foreground/5',
    scrolled ? 'shadow-[0_4px_24px_rgba(18,16,14,0.10)]' : '',
  ].filter(Boolean).join(' ')

  return (
    <>
      <header className={headerClass}>
        <div className="mx-auto w-full max-w-[1200px] px-6 lg:px-8 flex items-center gap-8">
          <Link to="/" className="flex items-center shrink-0">
            <GooflyLogo forceLight heightClass="h-14 sm:h-16" className="max-w-[min(100%,18rem)]" />
          </Link>

          <nav className="hidden lg:flex mx-auto">
            <ul className="flex items-center gap-1">
              {links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="px-4 py-2 text-sm font-medium text-text-secondary rounded-lg hover:bg-background-light hover:text-foreground transition-colors"
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
              <Icon name="rocket_launch" />
              Começar agora
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="lg:hidden ml-auto p-2 text-foreground"
            aria-label="Abrir menu"
          >
            <Icon name={open ? 'close' : 'menu'} className="text-2xl" />
          </button>
        </div>
      </header>

      <div
        className={`fixed inset-x-0 top-[70px] z-40 lg:hidden bg-white border-b border-border-light shadow-lg transition-all duration-200 origin-top ${
          open ? 'opacity-100 scale-y-100' : 'pointer-events-none opacity-0 scale-y-95'
        }`}
      >
        <div className="px-6 py-5">
          <ul className="mb-4">
            {links.map((l) => (
              <li key={l.href} className="border-b border-border-light">
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block py-3 font-medium text-foreground"
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
              <Icon name="rocket_launch" />
              Começar agora
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
