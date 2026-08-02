/** Formata duração de visita em chip compacto: `45min` / `2h` / `3h25`. */

const DURATION_LABEL_RE = /^(\d+)h(\d{2})?$|^(\d+)\s*min$/i

/**
 * @param {unknown} minutes
 * @param {string} [fallback='2h']
 * @returns {string}
 */
export function formatActivityDurationMinutes(minutes, fallback = '2h') {
  const mins = Math.round(Number(minutes))
  if (!Number.isFinite(mins) || mins <= 0) return fallback

  const h = Math.floor(mins / 60)
  const m = mins % 60

  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

/**
 * Minutos entre dois horários HH:MM no mesmo dia.
 * @param {unknown} startStr
 * @param {unknown} endStr
 * @returns {number | null}
 */
export function minutesBetweenStarts(startStr, endStr) {
  if (!startStr || !endStr) return null
  const [sh, sm] = String(startStr).split(':').map(Number)
  const [eh, em] = String(endStr).split(':').map(Number)
  if (![sh, sm, eh, em].every(Number.isFinite)) return null
  const mins = eh * 60 + em - (sh * 60 + sm)
  return mins > 0 ? mins : null
}

/**
 * Resolve o label de duração de uma atividade do roteiro.
 * Prioridade: janela Início–Fim → duration_minutes → duration string válida → fallback.
 *
 * @param {Record<string, unknown> | null | undefined} act
 * @param {unknown} [startResolved]
 * @param {unknown} [endResolved]
 * @param {string} [fallback='2h']
 * @returns {string}
 */
export function formatActivityDuration(act, startResolved, endResolved, fallback = '2h') {
  const fromWindow = minutesBetweenStarts(startResolved, endResolved)
  if (fromWindow != null) {
    return formatActivityDurationMinutes(fromWindow, fallback)
  }

  const storedMins = act?.duration_minutes ?? act?.durationMinutes
  if (storedMins != null && Number(storedMins) > 0) {
    return formatActivityDurationMinutes(storedMins, fallback)
  }

  const raw = typeof act?.duration === 'string' ? act.duration.trim() : ''
  if (raw && DURATION_LABEL_RE.test(raw)) return raw

  return fallback
}
