/** Moeda canônica da viagem (B12) — espelha BE `tripCurrency.js`. */

export const DEFAULT_CURRENCY = 'BRL'

export const ALLOWED_CURRENCIES = Object.freeze(['USD', 'EUR', 'BRL', 'GBP'])

const ALLOWED_SET = new Set(ALLOWED_CURRENCIES)

/**
 * @param {unknown} value
 * @returns {'USD'|'EUR'|'BRL'|'GBP'}
 */
export function normalizeTripCurrency(value) {
  if (value == null || value === '') return DEFAULT_CURRENCY
  const code = String(value).trim().toUpperCase()
  return ALLOWED_SET.has(code) ? code : DEFAULT_CURRENCY
}
