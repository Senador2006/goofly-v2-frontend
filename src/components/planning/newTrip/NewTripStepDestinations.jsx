import { Button } from '../../common/Button'
import { DateInput } from '../../common/DateInput'
import { Icon } from '../../common/Icon'
import { GooglePlaceAutocompleteField } from '../GooglePlaceAutocompleteField'
import {
  fieldInputClass,
  fieldInputInvalidClass,
} from '../../../constants/newTripFormOptions'
import { fieldErrorMessage, stepFieldErrorMessage } from '../../../utils/newTripFormValidation'
import { FieldHint } from './FieldHint'

export function NewTripStepDestinations({
  formData,
  errors,
  mapsReady,
  mapsUnavailable,
  mapsStatus,
  loading,
  todayIso,
  tripMaxDeparture,
  addCalendarDaysIso,
  updateDestination,
  addDestination,
  removeDestination,
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Destinos e Datas</h3>
      {formData.destinations.map((dest, i) => {
        const cityErr = fieldErrorMessage(errors, i, 'city')
        const countryErr = fieldErrorMessage(errors, i, 'country')
        const arrivalErr = fieldErrorMessage(errors, i, 'arrivalDate')
        const departureErr = fieldErrorMessage(errors, i, 'departureDate')
        const arrivalMin = i > 0 ? formData.destinations[i - 1]?.departureDate || todayIso : todayIso
        const departureMin = dest.arrivalDate
          ? addCalendarDaysIso(dest.arrivalDate, 1) || undefined
          : undefined
        return (
          <div key={dest.id} className="p-4 rounded-md md:rounded-xl border border-border-light dark:border-border-dark space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-text-secondary">Destino {i + 1}</span>
              {formData.destinations.length > 1 && (
                <button type="button" onClick={() => removeDestination(i)} className="text-red-500 text-sm">
                  Remover
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block min-w-0">
                <span className="block text-sm font-semibold mb-2 text-[#1c1c0d] dark:text-white">
                  Cidade *
                </span>
                {mapsReady ? (
                  <GooglePlaceAutocompleteField
                    key={`ac-${dest.id}`}
                    id={`planning-city-ac-${dest.id}`}
                    value={dest.city}
                    placeholder="Ex.: Paris, Tóquio, Porto…"
                    disabled={loading}
                    onDraftChange={(text) => updateDestination(i, { city: text })}
                    onResolved={(patch) =>
                      updateDestination(i, {
                        ...(patch.city != null ? { city: patch.city } : {}),
                        ...(patch.country != null ? { country: patch.country } : {}),
                        ...(patch.coordinates ? { coordinates: patch.coordinates } : {}),
                      })
                    }
                  />
                ) : (
                  <input
                    type="text"
                    id={`planning-city-${dest.id}`}
                    value={dest.city}
                    disabled
                    readOnly
                    placeholder={mapsStatus === 'checking'
                      ? 'Aguardando Google Maps…'
                      : 'Autocomplete indisponível — configure Maps'}
                    aria-invalid={cityErr || mapsUnavailable ? 'true' : undefined}
                    className={`${cityErr || mapsUnavailable ? fieldInputInvalidClass : fieldInputClass} opacity-70 cursor-not-allowed`}
                  />
                )}
                <FieldHint>{cityErr}</FieldHint>
              </label>
              <div className="min-w-0">
                <label className="block text-sm font-semibold mb-2">País *</label>
                <input
                  type="text"
                  value={dest.country}
                  onChange={(e) => updateDestination(i, { country: e.target.value })}
                  placeholder="Ex: França"
                  aria-invalid={countryErr ? 'true' : undefined}
                  className={countryErr ? fieldInputInvalidClass : fieldInputClass}
                />
                <FieldHint>{countryErr}</FieldHint>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0" data-field={`dest-${i}-arrival`}>
                <label className="block text-sm font-semibold mb-2">Chegada *</label>
                <DateInput
                  value={dest.arrivalDate}
                  onChange={(next) => updateDestination(i, { arrivalDate: next })}
                  aria-label="Chegada"
                  min={arrivalMin}
                  max={tripMaxDeparture}
                  error={arrivalErr}
                  className={`${fieldInputClass} !pr-10 sm:!pr-11`}
                />
              </div>
              <div className="min-w-0" data-field={`dest-${i}-departure`}>
                <label className="block text-sm font-semibold mb-2">Saída *</label>
                <DateInput
                  value={dest.departureDate}
                  onChange={(next) => updateDestination(i, { departureDate: next })}
                  aria-label="Saída"
                  min={departureMin}
                  max={tripMaxDeparture}
                  error={departureErr}
                  className={`${fieldInputClass} !pr-10 sm:!pr-11`}
                />
              </div>
            </div>
          </div>
        )
      })}
      <FieldHint>{stepFieldErrorMessage(errors, 'span')}</FieldHint>
      <div className="space-y-3">
        <Button type="button" variant="secondary" onClick={addDestination} className="w-full min-h-11 md:w-auto">
          <Icon name="add" />
          Adicionar destino
        </Button>
        <div
          className="flex gap-2 rounded-md border border-amber-500/15 bg-amber-500/[0.05] px-2.5 py-2 text-xs leading-snug text-amber-900/80 dark:border-amber-400/15 dark:bg-amber-400/[0.05] dark:text-amber-100/80"
          role="note"
        >
          <Icon name="warning" className="mt-0.5 shrink-0 text-sm text-amber-600/80 dark:text-amber-300/80" aria-hidden />
          <div className="space-y-1">
            <p>
              <span className="font-semibold">Atenção:</span> Se a viagem tiver mais de um
              destino, adicione todos aqui nesta etapa — com datas em sequência. Você pode
              voltar depois para editar, mas é mais simples deixar tudo certo antes de avançar.
            </p>
            <p className="text-amber-800/65 dark:text-amber-100/55">
              Exemplo: Orlando e Nova York.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
