import { readLatLng } from './coordinates.js'
import { MAX_TRIP_DURATION_DAYS, todayIsoCalendarDate, tripSpanDayCount } from './dateInput.js'

function where(dests, index) {
  return dests.length > 1 ? ` no destino ${index + 1}` : ''
}

/**
 * @typedef {{
 *   code: string,
 *   message: string,
 *   destIndex?: number,
 *   field?: 'city'|'country'|'arrivalDate'|'departureDate'|'destinations'|'span'|'interests'|'adults'|'accommodation',
 * }} StepError
 */

/**
 * Erros do passo 1 (Destinos), na ordem de exibição.
 * @returns {StepError[]}
 */
export function collectStep1Errors(destinations, { requirePlaceSelection = false } = {}) {
  const dests = Array.isArray(destinations) ? destinations : []
  /** @type {StepError[]} */
  const errors = []

  if (dests.length === 0) {
    errors.push({
      code: 'destinations_required',
      message: 'Adicione pelo menos um destino',
      field: 'destinations',
    })
    return errors
  }

  for (let i = 0; i < dests.length; i += 1) {
    const d = dests[i]
    const suffix = where(dests, i)
    const city = String(d.city || '').trim()
    const country = String(d.country || '').trim()

    if (!city) {
      errors.push({
        code: 'city_required',
        message: `Preencha a cidade${suffix}`,
        destIndex: i,
        field: 'city',
      })
    } else if (!country) {
      errors.push({
        code: 'country_required',
        message: `Preencha o país${suffix}`,
        destIndex: i,
        field: 'country',
      })
    } else if (requirePlaceSelection && !readLatLng({ coordinates: d.coordinates })) {
      errors.push({
        code: 'place_selection_required',
        message: `Selecione "${city}" nas sugestões do autocomplete para localizar o destino no mapa`,
        destIndex: i,
        field: 'city',
      })
    }

    if (!d.arrivalDate && !d.departureDate) {
      errors.push({
        code: 'dates_required',
        message: `Preencha as datas de chegada e saída${suffix}`,
        destIndex: i,
        field: 'arrivalDate',
      })
    } else if (!d.arrivalDate) {
      errors.push({
        code: 'arrival_required',
        message: `Preencha a data de chegada${suffix}`,
        destIndex: i,
        field: 'arrivalDate',
      })
    } else if (!d.departureDate) {
      errors.push({
        code: 'departure_required',
        message: `Preencha a data de saída${suffix}`,
        destIndex: i,
        field: 'departureDate',
      })
    } else {
      const today = todayIsoCalendarDate()
      if (d.arrivalDate < today || d.departureDate < today) {
        errors.push({
          code: 'dates_before_today',
          message: `As datas não podem ser anteriores a hoje${suffix}`,
          destIndex: i,
          field: d.arrivalDate < today ? 'arrivalDate' : 'departureDate',
        })
      }
      if (d.arrivalDate >= d.departureDate) {
        errors.push({
          code: 'departure_after_arrival',
          message: `A saída deve ser pelo menos 1 dia após a chegada${city ? ` em ${city}` : suffix}`,
          destIndex: i,
          field: 'departureDate',
        })
      }
    }
  }

  for (let i = 1; i < dests.length; i += 1) {
    const prevDep = dests[i - 1].departureDate
    const currArr = dests[i].arrivalDate
    if (prevDep && currArr && currArr < prevDep) {
      errors.push({
        code: 'dest_sequence',
        message: 'A chegada do próximo destino não pode ser antes da saída do anterior',
        destIndex: i,
        field: 'arrivalDate',
      })
    }
  }

  const allDated = dests.every((d) => d.arrivalDate && d.departureDate)
  if (allDated) {
    const spanDays = tripSpanDayCount(dests)
    if (spanDays > MAX_TRIP_DURATION_DAYS) {
      errors.push({
        code: 'trip_span_exceeded',
        message: `A viagem pode ter no máximo 1 mês e meio (${MAX_TRIP_DURATION_DAYS} dias). A sua está com ${spanDays} dias — ajuste as datas para continuar.`,
        field: 'span',
      })
    }
  }

  return errors
}

/** @returns {string | null} */
export function firstStep1Error(destinations, options) {
  return collectStep1Errors(destinations, options)[0]?.message || null
}

/** @returns {string[]} */
export function step1ErrorMessages(destinations, options) {
  return collectStep1Errors(destinations, options).map((e) => e.message)
}

/**
 * @param {{ interests?: string[], travelers?: { adults?: unknown } }} data
 * @returns {StepError[]}
 */
export function collectStep3Errors(data) {
  /** @type {StepError[]} */
  const errors = []
  if (!data?.interests?.length) {
    errors.push({
      code: 'interests_required',
      message: 'Selecione pelo menos 1 interesse',
      field: 'interests',
    })
  }
  const adults = Number(data?.travelers?.adults)
  if (!Number.isFinite(adults) || adults < 1) {
    errors.push({
      code: 'adults_required',
      message: 'Informe o número de adultos',
      field: 'adults',
    })
  }
  return errors
}

/**
 * Chave estável para comparar se um erro ainda vale.
 * @param {StepError | string} err
 */
export function stepErrorKey(err) {
  if (typeof err === 'string') return err
  return `${err.code}|${err.destIndex ?? ''}|${err.field ?? ''}|${err.message}`
}
