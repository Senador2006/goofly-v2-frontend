export const PRIMARY_NAV_ITEMS = [
  { to: '/dashboard', icon: 'dashboard', label: 'Início' },
  { to: '/trips', icon: 'luggage', label: 'Viagens' },
  { to: '/discover', icon: 'explore', label: 'Descobrir' },
  { to: '/memories', icon: 'photo_library', label: 'Memórias' },
]

export const ACCOUNT_NAV_ITEM = {
  to: '/settings',
  icon: 'person',
  label: 'Perfil',
}

export const MOBILE_NAV_ITEMS = [...PRIMARY_NAV_ITEMS, ACCOUNT_NAV_ITEM]
