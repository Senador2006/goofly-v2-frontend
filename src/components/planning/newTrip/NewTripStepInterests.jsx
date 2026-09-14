import {
  fieldInputClass,
  INTERESTS,
  ITINERARY_STYLES,
} from '../../../constants/newTripFormOptions'
import { stepFieldErrorMessage } from '../../../utils/newTripFormValidation'
import { FieldHint } from './FieldHint'

export function NewTripStepInterests({ formData, errors, toggleMulti, updateField }) {
  const interestsError = stepFieldErrorMessage(errors, 'interests')
  const adultsError = stepFieldErrorMessage(errors, 'adults')
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Interesses e Preferências</h3>
      <div>
        <label className="block text-sm font-semibold mb-2">Interesses * (mín. 1)</label>
        <div
          className={`newtrip-choice-chips flex flex-wrap gap-2 max-w-full rounded-xl ${
            interestsError ? 'ring-2 ring-red-500/40 p-1' : ''
          }`}
        >
          {INTERESTS.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggleMulti('interests', slug)}
              className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-full text-sm font-medium max-w-full transition-all ${
                formData.interests.includes(slug)
                  ? 'bg-primary text-foreground'
                  : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <FieldHint>{interestsError}</FieldHint>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">Descrição da viagem (opcional)</label>
        <textarea
          value={formData.tripDescription}
          onChange={(e) => updateField('tripDescription', e.target.value.slice(0, 2000))}
          placeholder="Descreva como você imagina sua viagem ideal..."
          rows={3}
          maxLength={2000}
          className={`${fieldInputClass} resize-none`}
        />
        <span className="text-xs text-text-secondary">{formData.tripDescription.length}/2000</span>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">Estilo do roteiro</label>
        <div className="newtrip-choice-chips flex flex-wrap gap-2">
          {ITINERARY_STYLES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => updateField('itineraryStyle', value)}
              className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-xl text-sm font-medium transition-all ${
                formData.itineraryStyle === value
                  ? 'bg-primary text-foreground'
                  : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">Viajantes *</label>
        <div className="flex items-start gap-6">
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs leading-none text-text-secondary">Adultos</span>
            <input
              type="number"
              min={1}
              aria-label="Adultos"
              aria-invalid={adultsError ? 'true' : undefined}
              value={formData.travelers.adults}
              onChange={(e) => {
                const raw = e.target.value
                updateField('travelers', {
                  ...formData.travelers,
                  adults: raw === '' ? '' : Math.max(1, parseInt(raw, 10) || 1),
                })
              }}
              onBlur={() => {
                if (formData.travelers.adults === '' || Number(formData.travelers.adults) < 1) {
                  updateField('travelers', { ...formData.travelers, adults: 1 })
                }
              }}
              className={`box-border h-11 w-20 rounded-xl border px-2 text-center text-base tabular-nums bg-background-light dark:bg-background-dark [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                adultsError
                  ? 'border-red-500/60 dark:border-red-400/50'
                  : 'border-border-light dark:border-border-dark'
              }`}
            />
            <FieldHint>{adultsError}</FieldHint>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-xs leading-none text-text-secondary">Crianças</span>
            <input
              type="number"
              min={0}
              aria-label="Crianças"
              value={formData.travelers.children}
              onChange={(e) => {
                const raw = e.target.value
                updateField('travelers', {
                  ...formData.travelers,
                  children: raw === '' ? '' : Math.max(0, parseInt(raw, 10) || 0),
                })
              }}
              onBlur={() => {
                if (formData.travelers.children === '' || Number(formData.travelers.children) < 0) {
                  updateField('travelers', { ...formData.travelers, children: 0 })
                }
              }}
              className="box-border h-11 w-20 rounded-xl border border-border-light bg-background-light px-2 text-center text-base tabular-nums dark:border-border-dark dark:bg-background-dark [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
