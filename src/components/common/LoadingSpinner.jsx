export function LoadingSpinner({ className = '' }) {
  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <div className="size-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
