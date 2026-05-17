export function Button({ children, variant = 'primary', size = 'md', className = '', type = 'button', ...props }) {
  const base =
    'rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2'
  const variants = {
    primary:
      'bg-primary text-foreground hover:opacity-90 hover:shadow-primary focus-visible:ring-primary/50 focus-visible:ring-offset-background-light dark:focus-visible:ring-offset-background-dark',
    secondary:
      'bg-surface-light dark:bg-surface-dark text-foreground dark:text-white hover:bg-opacity-80 focus-visible:ring-foreground/20',
    inverse:
      'bg-foreground text-white hover:bg-foreground/90 focus-visible:ring-white/40 focus-visible:ring-offset-primary',
    'hero-light':
      'bg-white text-foreground border-2 border-foreground/20 hover:bg-white/95 focus-visible:ring-foreground/25 focus-visible:ring-offset-primary',
    outline:
      'border-2 border-primary text-primary hover:bg-primary/10 focus-visible:ring-primary/40',
    ghost:
      'bg-transparent hover:bg-surface-light dark:hover:bg-surface-dark focus-visible:ring-foreground/15',
  }
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
    icon: 'p-3',
  }
  return (
    <button
      {...props}
      type={type}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}
