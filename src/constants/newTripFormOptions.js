import { ALLOWED_CURRENCIES } from '../utils/tripCurrency.js'

export const INTERESTS = [
  { slug: 'historia', label: 'História' },
  { slug: 'arte-e-cultura', label: 'Arte e Cultura' },
  { slug: 'aventura', label: 'Aventura' },
  { slug: 'vida-noturna', label: 'Vida Noturna' },
  { slug: 'restaurantes-e-gastronomia', label: 'Gastronomia' },
  { slug: 'natureza-paisagens', label: 'Natureza' },
  { slug: 'compras', label: 'Compras' },
  { slug: 'fotografia', label: 'Fotografia' },
  { slug: 'espiritualidade', label: 'Espiritualidade' },
  { slug: 'esportes', label: 'Esportes' },
  { slug: 'musica-shows', label: 'Música e Shows' },
  { slug: 'arquitetura', label: 'Arquitetura' },
  { slug: 'familia', label: 'Família' },
  { slug: 'romantico', label: 'Romântico' },
  { slug: 'tecnologia-inovacao', label: 'Tecnologia' },
]

export const ITINERARY_STYLES = [
  { value: 'relaxante', label: 'Tranquilo', desc: 'Mais tempo livre' },
  { value: 'equilibrado', label: 'Equilibrado', desc: 'Balanceia atividades e tempo livre' },
  { value: 'ativo', label: 'Ativo', desc: 'Muitas atividades por dia' },
]

export const AVOID_OPTIONS = [
  { slug: 'multidoes', label: 'Multidões' },
  { slug: 'gastos-altos', label: 'Gastos Altos' },
  { slug: 'atividades-noturnas', label: 'Atividades Noturnas' },
  { slug: 'esportes-radicais', label: 'Esportes Radicais' },
  { slug: 'lugares-turisticos', label: 'Lugares Turísticos' },
  { slug: 'comida-picante', label: 'Comida Picante' },
  { slug: 'transporte-publico-lotado', label: 'Transporte Lotado' },
  { slug: 'lugares-barulhentos', label: 'Lugares Barulhentos' },
  { slug: 'atividades-ao-ar-livre', label: 'Atividades ao Ar Livre' },
]

export const PRIORITIZE_OPTIONS = [
  { slug: 'lugares-famosos', label: 'Lugares Famosos' },
  { slug: 'landmarks', label: 'Landmarks' },
  { slug: 'lugares-escondidos', label: 'Lugares Escondidos' },
  { slug: 'cultura-local', label: 'Cultura Local' },
  { slug: 'gastronomia-local', label: 'Gastronomia Local' },
  { slug: 'vistas-panoramicas', label: 'Vistas Panorâmicas' },
  { slug: 'arquitetura-historica', label: 'Arquitetura Histórica' },
  { slug: 'mercados-locais', label: 'Mercados Locais' },
  { slug: 'parques-natureza', label: 'Parques e Natureza' },
  { slug: 'arte-de-rua', label: 'Arte de Rua' },
  { slug: 'vida-noturna-local', label: 'Vida Noturna Local' },
]

export const CUSTOM_PREF_MAX = 500
export const CURRENCIES = ALLOWED_CURRENCIES
export const STEPS = [
  { id: 1, label: 'Destinos' },
  { id: 2, label: 'Estadia' },
  { id: 3, label: 'Interesses' },
  { id: 4, label: 'Preferências' },
]
export const fieldInputClass =
  'w-full min-w-0 px-4 py-3 text-base rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark'
export const fieldInputInvalidClass =
  'w-full min-w-0 px-4 py-3 text-base rounded-xl border border-red-500/60 dark:border-red-400/50 bg-background-light dark:bg-background-dark'
