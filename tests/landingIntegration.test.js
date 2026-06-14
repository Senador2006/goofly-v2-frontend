import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..')

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

function readAllLandingSources() {
  const landingDir = join(root, 'src/components/landing')
  const parts = []
  if (existsSync(join(root, 'src/pages/Landing.jsx'))) {
    parts.push(read('src/pages/Landing.jsx'))
  }
  if (existsSync(landingDir)) {
    for (const f of readdirSync(landingDir)) {
      if (f.endsWith('.jsx')) parts.push(read(`src/components/landing/${f}`))
    }
  }
  for (const f of ['src/hooks/useFadeUp.js', 'src/hooks/useSiteTour.js', 'src/utils/siteTour.js']) {
    if (existsSync(join(root, f))) parts.push(read(f))
  }
  return parts.join('\n')
}

describe('Fase 1 — Rotas e redirects', () => {
  it('App.jsx expõe LandingOrRedirect na rota /', () => {
    const app = read('src/App.jsx')
    assert.match(app, /function LandingOrRedirect/)
    assert.match(app, /path="\/" element=\{[\s\S]*LandingOrRedirect/)
  })

  it('App.jsx define /dashboard como rota protegida do app', () => {
    const app = read('src/App.jsx')
    assert.match(app, /path="\/dashboard"/)
    assert.match(app, /ProtectedRoute[\s\S]*Layout/)
  })

  it('/discover permanece protegido dentro do Layout', () => {
    const app = read('src/App.jsx')
    assert.match(app, /ProtectedRoute[\s\S]*path="\/discover"/)
  })

  it('PublicRoute redireciona autenticado para /dashboard', () => {
    const app = read('src/App.jsx')
    assert.match(app, /function PublicRoute[\s\S]*Navigate to="\/dashboard"/)
  })

  it('ProtectedRoute redireciona anônimo para /login', () => {
    const app = read('src/App.jsx')
    assert.match(app, /function ProtectedRoute[\s\S]*Navigate to="\/login"/)
  })

  it('CatchAllRedirect envia autenticado ao dashboard e anônimo à landing', () => {
    const app = read('src/App.jsx')
    assert.match(app, /function CatchAllRedirect/)
    assert.match(app, /isAuthenticated \? '\/dashboard' : '\/'/)
  })

  it('Login navega para /dashboard após sucesso', () => {
    assert.match(read('src/pages/Login.jsx'), /navigate\(['"]\/dashboard['"]\)/)
  })

  it('Register navega para /dashboard após sucesso', () => {
    assert.match(read('src/pages/Register.jsx'), /navigate\(['"]\/dashboard['"]\)/)
  })

  it('Sidebar aponta Dashboard para /dashboard', () => {
    const sidebar = read('src/components/layout/Sidebar.jsx')
    assert.match(sidebar, /to: '\/dashboard'/)
    assert.doesNotMatch(sidebar, /to: '\/', icon: 'dashboard'/)
  })

  it('MobileNav aponta Início para /dashboard', () => {
    const nav = read('src/components/layout/MobileNav.jsx')
    assert.match(nav, /to: '\/dashboard'/)
    assert.doesNotMatch(nav, /to: '\/', icon: 'dashboard'/)
  })

  it('AdminRoute redireciona não-admin para /dashboard', () => {
    assert.match(read('src/components/AdminRoute.jsx'), /Navigate to="\/dashboard"/)
  })

  it('AdminDashboard linka voltar ao app em /dashboard', () => {
    assert.match(read('src/pages/AdminDashboard.jsx'), /to="\/dashboard"/)
  })
})

describe('Fase 2 — Landing convergida ao frontend', () => {
  it('Landing.jsx existe e usa useDocumentTitle', () => {
    assert.ok(existsSync(join(root, 'src/pages/Landing.jsx')))
    assert.match(read('src/pages/Landing.jsx'), /useDocumentTitle/)
  })

  it('Landing.jsx envolve conteúdo em landing-page (sem dark mode)', () => {
    assert.match(read('src/pages/Landing.jsx'), /landing-page/)
  })

  it('componentes landing existem (9 seções)', () => {
    const expected = [
      'LandingNavbar.jsx',
      'LandingHero.jsx',
      'LandingOffers.jsx',
      'LandingBenefits.jsx',
      'LandingSteps.jsx',
      'LandingPlans.jsx',
      'LandingTestimonials.jsx',
      'LandingFooter.jsx',
      'LandingGuideButton.jsx',
    ]
    for (const f of expected) {
      assert.ok(existsSync(join(root, 'src/components/landing', f)), `faltando ${f}`)
    }
  })

  it('CTAs da landing não usam localhost', () => {
    const sources = readAllLandingSources()
    assert.doesNotMatch(sources, /localhost:\d+/)
  })

  it('Navbar usa GooflyLogo e classes landing-btn de CTA', () => {
    const nav = read('src/components/landing/LandingNavbar.jsx')
    assert.match(nav, /GooflyLogo/)
    assert.match(nav, /landing-btn-nav-primary/)
    assert.match(nav, /landing-btn-nav-secondary/)
  })

  it('Hero usa classes landing-btn e Link do react-router', () => {
    const hero = read('src/components/landing/LandingHero.jsx')
    assert.match(hero, /landing-btn-hero-primary/)
    assert.match(hero, /landing-btn-hero-secondary/)
    assert.match(hero, /<Link[\s\S]*to="\/register"/)
    assert.match(hero, /<Link[\s\S]*to="\/login"/)
  })

  it('landing usa tokens Tailwind do app (primary / foreground)', () => {
    const sources = readAllLandingSources()
    assert.match(sources, /bg-primary|text-primary/)
    assert.match(sources, /bg-foreground|text-foreground/)
  })

  it('landing não declara classes dark:', () => {
    const sources = readAllLandingSources()
    assert.doesNotMatch(sources, /\bdark:/)
  })

  it('useSiteTour aponta register relativo', () => {
    const tour = read('src/hooks/useSiteTour.js')
    assert.match(tour, /['"]\/register['"]/)
    assert.doesNotMatch(tour, /localhost/)
  })

  it('driver.js está nas dependências', () => {
    const pkg = read('package.json')
    assert.match(pkg, /"driver\.js"/)
  })
})

describe('Fase 3 — SEO e arquivos públicos', () => {
  it('robots.txt permite /, /login e /register', () => {
    const robots = read('public/robots.txt')
    assert.match(robots, /Allow: \/\$/)
    assert.match(robots, /Allow: \/login/)
    assert.match(robots, /Allow: \/register/)
  })

  it('robots.txt não indexa /discover nem /dashboard', () => {
    const robots = read('public/robots.txt')
    assert.doesNotMatch(robots, /Allow: \/discover/)
    assert.match(robots, /Disallow: \/discover/)
    assert.match(robots, /Disallow: \/dashboard/)
  })

  it('sitemap.xml lista apenas rotas públicas', () => {
    const sitemap = read('public/sitemap.xml')
    assert.match(sitemap, /<loc>https:\/\/www\.goofly\.com\.br\/<\/loc>/)
    assert.match(sitemap, /<loc>https:\/\/www\.goofly\.com\.br\/login<\/loc>/)
    assert.match(sitemap, /<loc>https:\/\/www\.goofly\.com\.br\/register<\/loc>/)
    assert.doesNotMatch(sitemap, /discover/)
  })

  it('index.html traz meta description e canonical da landing', () => {
    const html = read('index.html')
    assert.match(html, /Seu Roteiro Ideal/)
    assert.match(html, /Planeje viagens personalizadas/)
    assert.match(html, /rel="canonical"/)
    assert.match(html, /https:\/\/www\.goofly\.com\.br\//)
  })

  it('index.html inclui og:title e og:image no domínio Goofly', () => {
    const html = read('index.html')
    assert.match(html, /property="og:title"/)
    assert.match(html, /property="og:image"/)
    assert.doesNotMatch(html, /lovable\.dev/)
  })
})
