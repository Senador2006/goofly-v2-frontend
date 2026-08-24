import { validateAccommodationFields } from './accommodationForm.js'
import {
  collectStep1Errors,
  collectStep3Errors,
} from './newTripStep1Validation.js'

/**
 * @param {number} step
 * @param {Record<string, unknown>} data
 * @param {{ requirePlaceSelection?: boolean }} [options]
 * @returns {import('./newTripStep1Validation').StepError[]}
 */
export function collectStepErrors(step, data, options = {}) {
  if (step === 1) {
    return collectStep1Errors(data?.destinations, {
      requirePlaceSelection: options.requirePlaceSelection,
    })
  }
  if (step === 2) {
    const msg = validateAccommodationFields(
      data?.destinations || [],
      data?.accommodations || [],
    )
    if (!msg) return []
    return [{ code: 'accommodation', message: msg, field: 'accommodation' }]
  }
  if (step === 3) {
    return collectStep3Errors(data)
  }
  return []
}

/** @returns {string | null} */
export function firstStepErrorMessage(step, data, options) {
  return collectStepErrors(step, data, options)[0]?.message || null
}

/**
 * Maior passo clicável: libera o próximo enquanto o prefixo estiver válido.
 * Só trava quando há erros — não exige ter clicado em "Próximo" antes.
 * @param {number} visited
 * @param {Record<string, unknown>} data
 * @param {{ requirePlaceSelection?: boolean }} [options]
 */
export function furthestUnlockedStep(visited, data, options = {}) {
  const peak = Math.max(1, Math.min(4, Number(visited) || 1))
  let unlocked = 1

  for (let s = 1; s <= 4; s += 1) {
    if (collectStepErrors(s, data, options).length > 0) {
      // Pode permanecer no passo com erro para corrigir; não avança além dele.
      return Math.max(unlocked, Math.min(s, peak))
    }
    unlocked = Math.min(s + 1, 4)
    // Prefixo 1..s válido → libera s+1 (um à frente), mesmo sem ter visitado ainda.
    if (unlocked > peak) return unlocked
  }

  return unlocked
}

/**
 * Mensagem de campo no destino, se houver.
 * @param {import('./newTripStep1Validation').StepError[]} errors
 * @param {number} destIndex
 * @param {string} field
 */
export function fieldErrorMessage(errors, destIndex, field) {
  const hit = (errors || []).find(
    (e) => e.destIndex === destIndex && e.field === field,
  )
  return hit?.message || null
}

/**
 * @param {import('./newTripStep1Validation').StepError[]} errors
 * @param {string} field
 */
export function stepFieldErrorMessage(errors, field) {
  const hit = (errors || []).find((e) => e.field === field)
  return hit?.message || null
}
