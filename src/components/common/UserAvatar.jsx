const SIZE_CLASSES = {
  sm: { box: 'size-10', text: 'text-sm' },
  md: { box: 'size-12', text: 'text-sm' },
  lg: { box: 'size-20', text: 'text-2xl' },
}

function getInitial(name) {
  const trimmed = (name || '').trim()
  return (trimmed[0] || 'U').toUpperCase()
}

export function UserAvatar({ user, size = 'md', className = '', bordered = true }) {
  const { box, text } = SIZE_CLASSES[size] || SIZE_CLASSES.md
  const displayName = user?.name?.trim() || 'Viajante'
  const borderClass = bordered ? 'border-2 border-primary' : ''

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt={`Foto de perfil de ${displayName}`}
        className={`${box} rounded-full object-cover shrink-0 ${borderClass} ${className}`.trim()}
      />
    )
  }

  return (
    <div
      className={`${box} rounded-full bg-primary flex items-center justify-center overflow-hidden shrink-0 ${borderClass} ${className}`.trim()}
      aria-hidden="true"
    >
      <span className={`text-foreground font-bold ${text}`}>{getInitial(user?.name)}</span>
    </div>
  )
}
