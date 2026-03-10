export function Button({ children, variant = 'primary', size = 'md', className = '', ...props }) {
  const base = 'rounded-full font-bold transition-all duration-300 inline-flex items-center justify-center gap-2'
  const variants = {
    primary: 'bg-primary text-[#1c1c0d] hover:opacity-90 hover:shadow-primary',
    secondary: 'bg-surface-light dark:bg-surface-dark text-[#1c1c0d] dark:text-white hover:bg-opacity-80',
    outline: 'border-2 border-primary text-primary hover:bg-primary/10',
    ghost: 'bg-transparent hover:bg-surface-light dark:hover:bg-surface-dark',
  }
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
    icon: 'p-3',
  }
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
