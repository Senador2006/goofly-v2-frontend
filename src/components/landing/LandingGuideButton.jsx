import { Icon } from '../common/Icon'

export function LandingGuideButton({ onStart, className = '' }) {
  return (
    <button
      type="button"
      onClick={onStart}
      aria-label="Iniciar tour guiado do site"
      className={`guide-button-fab fixed bottom-7 right-7 z-50 inline-flex items-center gap-2 px-5 py-3 rounded-full bg-foreground text-primary border-2 border-primary font-bold text-sm shadow-lg hover:bg-primary hover:text-foreground hover:-translate-y-0.5 transition-all ${className}`.trim()}
    >
      <Icon name="help" className="text-base" />
      Guia
    </button>
  )
}
