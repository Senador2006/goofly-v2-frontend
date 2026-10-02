import {
  AVOID_OPTIONS,
  CURRENCIES,
  CUSTOM_PREF_MAX,
  fieldInputClass,
  PRIORITIZE_OPTIONS,
} from '../../../constants/newTripFormOptions'
import { normalizeTripCurrency } from '../../../utils/tripCurrency'

export function NewTripStepPreferences({ formData, toggleMulti, updateField }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Preferências Detalhadas</h3>
      <div>
        <label className="block text-sm font-semibold mb-2">Coisas a evitar (opcional)</label>
        <div className="newtrip-choice-chips flex flex-wrap gap-2 max-w-full">
          {AVOID_OPTIONS.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggleMulti('avoidPreferences', slug)}
              className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-full text-sm font-medium max-w-full transition-all ${
                formData.avoidPreferences.includes(slug)
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400'
                  : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={formData.avoidCustom}
          onChange={(e) => updateField('avoidCustom', e.target.value.slice(0, CUSTOM_PREF_MAX))}
          maxLength={CUSTOM_PREF_MAX}
          placeholder="Outro (custom)"
          className={`mt-2 ${fieldInputClass}`}
        />
        <span className="text-xs text-text-secondary">{formData.avoidCustom.length}/{CUSTOM_PREF_MAX}</span>
      </div>
      <div>
        <label className="block text-sm font-semibold mb-2">Coisas a priorizar (opcional)</label>
        <div className="newtrip-choice-chips flex flex-wrap gap-2 max-w-full">
          {PRIORITIZE_OPTIONS.map(({ slug, label }) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggleMulti('prioritizePreferences', slug)}
              className={`newtrip-choice-chip px-3 py-2 md:py-1.5 rounded-full text-sm font-medium max-w-full transition-all ${
                formData.prioritizePreferences.includes(slug)
                  ? 'bg-primary text-foreground'
                  : 'bg-surface-light dark:bg-surface-dark hover:bg-primary/20'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={formData.prioritizeCustom}
          onChange={(e) => updateField('prioritizeCustom', e.target.value.slice(0, CUSTOM_PREF_MAX))}
          maxLength={CUSTOM_PREF_MAX}
          placeholder="Outro (custom)"
          className={`mt-2 ${fieldInputClass}`}
        />
        <span className="text-xs text-text-secondary">{formData.prioritizeCustom.length}/{CUSTOM_PREF_MAX}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <label className="block text-sm font-semibold mb-2">Orçamento (opcional)</label>
          <input
            type="number"
            min={0}
            value={formData.budget}
            onChange={(e) => updateField('budget', e.target.value)}
            placeholder="0"
            className={fieldInputClass}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-sm font-semibold mb-2">Moeda</label>
          <select
            value={formData.currency}
            onChange={(e) => updateField('currency', normalizeTripCurrency(e.target.value))}
            className={fieldInputClass}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
