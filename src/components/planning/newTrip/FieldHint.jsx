export function FieldHint({ children }) {
  if (!children) return null
  return (
    <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 leading-snug" role="alert">
      {children}
    </p>
  )
}
