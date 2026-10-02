import { STEPS } from '../../../constants/newTripFormOptions'

export function NewTripStepTabs({ step, unlockedStep, tryGoToStep, setStayNotice }) {
  return (
    <>
      <div className="md:hidden mb-4 min-w-0">
        <h1 className="text-xl font-black tracking-tight">Nova Viagem</h1>
        <p className="mt-1 text-sm text-text-secondary">Etapa {step} de 4</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5" role="tablist" aria-label="Etapas do formulário">
          {STEPS.map((s) => {
            const reachable = s.id <= unlockedStep
            const isCurrent = step === s.id
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                aria-label={`${s.label}${reachable ? '' : ' (ainda não disponível)'}`}
                disabled={!reachable}
                onClick={() => tryGoToStep(s.id)}
                className={`flex min-h-8 min-w-0 items-center gap-1.5 overflow-visible rounded-lg px-1.5 py-1 text-left ${
                  isCurrent ? 'bg-primary/20' : 'bg-surface-light dark:bg-surface-dark'
                } ${reachable ? '' : 'opacity-45'}`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                    isCurrent
                      ? 'bg-primary text-foreground'
                      : s.id < step
                        ? 'bg-primary/35 text-foreground dark:text-white'
                        : 'bg-white text-text-secondary dark:bg-card-dark'
                  }`}
                >
                  {s.id}
                </span>
                <span
                  className={`min-w-0 flex-1 text-[11px] font-semibold leading-none ${
                    isCurrent ? 'text-foreground dark:text-white' : 'text-text-secondary'
                  }`}
                >
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="hidden md:flex gap-2 mb-8">
        {STEPS.map((s) => {
          const reachable = s.id <= unlockedStep
          const isCurrent = step === s.id
          return (
            <button
              key={s.id}
              type="button"
              disabled={!reachable}
              aria-label={`${s.label}${reachable ? '' : ' (ainda não disponível)'}`}
              onClick={() => {
                setStayNotice(null)
                tryGoToStep(s.id)
              }}
              className={`px-4 py-2 rounded-full text-sm font-bold ${
                isCurrent
                  ? 'bg-primary text-foreground'
                  : 'bg-surface-light dark:bg-surface-dark'
              } ${reachable ? '' : 'opacity-45 cursor-not-allowed'}`}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
