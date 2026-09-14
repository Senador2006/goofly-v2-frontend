export function RoteiroStopsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Carregando paradas">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className="h-28 rounded-2xl bg-neutral-100 dark:bg-neutral-800 animate-pulse"
        />
      ))}
    </div>
  )
}
