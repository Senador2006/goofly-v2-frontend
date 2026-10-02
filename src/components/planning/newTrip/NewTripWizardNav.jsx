import { Button } from '../../common/Button'

function NavButtons({ step, skipStay, loading, handleBack, handleNextClick, handleCreateTripClick, mobile }) {
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={handleBack}
        disabled={step === 1}
        className={mobile ? 'min-h-11 w-full' : undefined}
      >
        Voltar
      </Button>
      {step < 4 ? (
        <Button
          type="button"
          onClick={handleNextClick}
          className={mobile ? 'min-h-11 w-full' : undefined}
        >
          {skipStay ? 'Pular' : 'Próximo'}
        </Button>
      ) : (
        <Button
          type="button"
          disabled={loading}
          onClick={handleCreateTripClick}
          className={mobile ? 'min-h-11 w-full' : undefined}
        >
          {loading ? 'Criando...' : 'Criar Viagem'}
        </Button>
      )}
    </>
  )
}

export function NewTripWizardNav({ mobile = false, ...props }) {
  if (mobile) {
    return (
      <>
        <div className="mobile-task-cta-spacer md:hidden" aria-hidden />
        <div className="mobile-task-cta md:hidden">
          <div className="grid grid-cols-2 gap-3">
            <NavButtons {...props} mobile />
          </div>
        </div>
      </>
    )
  }
  return (
    <div className="hidden md:flex items-center justify-between mt-8 pt-6 border-t border-border-light dark:border-border-dark">
      <NavButtons {...props} />
    </div>
  )
}
