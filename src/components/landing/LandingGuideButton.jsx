import { Icon } from '../common/Icon'

export function LandingGuideButton({ onStart, className = '' }) {
  return (
    <button
      type="button"
      onClick={onStart}
      aria-label="Iniciar tour guiado do site"
      className={`guide-button-fab fixed bottom-7 right-7 z-50 inline-flex items-center gap-2.5 pl-2.5 pr-4 py-2 rounded-full bg-[#0A0A0A] text-primary border-2 border-primary font-bold text-sm hover:bg-primary hover:text-foreground hover:-translate-y-0.5 transition-all ${className}`.trim()}
    >
      <span className="size-8 rounded-full bg-primary text-foreground flex items-center justify-center">
        <Icon name="help" filled className="text-[1.35rem] leading-none" />
      </span>
      Guia
    </button>
  )
}
