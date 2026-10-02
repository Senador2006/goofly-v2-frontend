import { Header } from '../components/layout/Header'
import { AccommodationReplaceConfirmDialog } from '../components/itinerary/AccommodationReplaceConfirmDialog'
import { NewTripFormAlerts } from '../components/planning/newTrip/NewTripFormAlerts'
import { NewTripStepDestinations } from '../components/planning/newTrip/NewTripStepDestinations'
import { NewTripStepInterests } from '../components/planning/newTrip/NewTripStepInterests'
import { NewTripStepPreferences } from '../components/planning/newTrip/NewTripStepPreferences'
import { NewTripStepStay } from '../components/planning/newTrip/NewTripStepStay'
import { NewTripStepTabs } from '../components/planning/newTrip/NewTripStepTabs'
import { NewTripWizardNav } from '../components/planning/newTrip/NewTripWizardNav'
import { useCreateTrip } from '../hooks/useCreateTrip'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useGoogleMapsProbe } from '../hooks/useGoogleMapsProbe'
import { useNewTripWizard } from '../hooks/useNewTripWizard'

export function NewTrip() {
  useDocumentTitle('Nova viagem')
  const maps = useGoogleMapsProbe()
  const wizard = useNewTripWizard(maps)
  const createTrip = useCreateTrip({
    step: wizard.step,
    setStep: wizard.setStep,
    formDataRef: wizard.formDataRef,
    collectForStep: wizard.collectForStep,
    showStepErrors: wizard.showStepErrors,
    clearFormErrors: wizard.clearFormErrors,
    setApiError: wizard.setApiError,
    errorBannerRef: wizard.errorBannerRef,
  })
  const navProps = {
    step: wizard.step,
    skipStay: wizard.skipStay,
    loading: createTrip.loading,
    handleBack: wizard.handleBack,
    handleNextClick: wizard.handleNextClick,
    handleCreateTripClick: createTrip.handleCreateTripClick,
  }

  return (
    <div className="mobile-task-shell max-w-2xl mx-auto">
      <div className="hidden md:block">
        <Header
          title="Nova Viagem"
          subtitle="Preencha o formulário para criar sua próxima aventura"
        />
      </div>
      <NewTripStepTabs
        step={wizard.step}
        unlockedStep={wizard.unlockedStep}
        tryGoToStep={wizard.tryGoToStep}
        setStayNotice={wizard.setStayNotice}
      />
      <form
        onSubmit={wizard.handleFormSubmit}
        className="bg-white dark:bg-card-dark rounded-xl p-4 md:p-8 border border-border-light dark:border-border-dark min-w-0 max-w-full overflow-x-clip md:overflow-visible"
      >
        <NewTripFormAlerts
          bannerMessages={wizard.bannerMessages}
          apiError={wizard.apiError}
          stayNotice={wizard.stayNotice}
          mapsUnavailable={maps.mapsUnavailable}
          mapsStatus={maps.mapsStatus}
          step={wizard.step}
          errorBannerRef={wizard.errorBannerRef}
        />
        {wizard.step === 1 && (
          <NewTripStepDestinations
            formData={wizard.formData}
            errors={wizard.errors}
            mapsReady={maps.mapsReady}
            mapsUnavailable={maps.mapsUnavailable}
            mapsStatus={maps.mapsStatus}
            loading={createTrip.loading}
            todayIso={wizard.todayIso}
            tripMaxDeparture={wizard.tripMaxDeparture}
            addCalendarDaysIso={wizard.addCalendarDaysIso}
            updateDestination={wizard.updateDestination}
            addDestination={wizard.addDestination}
            removeDestination={wizard.removeDestination}
          />
        )}
        {wizard.step === 2 && (
          <NewTripStepStay
            formData={wizard.formData}
            loading={createTrip.loading}
            mapsReady={maps.mapsReady}
            addAccommodation={wizard.addAccommodation}
            updateAccommodation={wizard.updateAccommodation}
            removeAccommodation={wizard.removeAccommodation}
          />
        )}
        {wizard.step === 3 && (
          <NewTripStepInterests
            formData={wizard.formData}
            errors={wizard.errors}
            toggleMulti={wizard.toggleMulti}
            updateField={wizard.updateField}
          />
        )}
        {wizard.step === 4 && (
          <NewTripStepPreferences
            formData={wizard.formData}
            toggleMulti={wizard.toggleMulti}
            updateField={wizard.updateField}
          />
        )}
        <NewTripWizardNav {...navProps} />
      </form>
      <NewTripWizardNav {...navProps} mobile />
      <AccommodationReplaceConfirmDialog
        open={Boolean(wizard.pendingStayAdvance)}
        messages={wizard.pendingStayAdvance?.warningMessages || []}
        confirmLabel="Confirmar e continuar"
        onCancel={() => wizard.setPendingStayAdvance(null)}
        onConfirm={() => {
          if (!wizard.pendingStayAdvance) return
          wizard.applyStayStepAndAdvance(
            wizard.pendingStayAdvance.resolved,
            wizard.pendingStayAdvance.warningMessages.map((message) => ({ message })),
          )
        }}
      />
    </div>
  )
}
