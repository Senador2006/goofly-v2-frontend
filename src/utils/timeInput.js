/** Máscara de horário 24h (HH:MM) com ":" fixo após as horas. */

export function isCompleteTimeValue(value) {
  return /^\d{2}:\d{2}$/.test(String(value ?? ''))
}

export function normalizeTimeValue(raw) {
  const trimmed = String(raw ?? '').trim()
  if (!trimmed || trimmed === '—') return ''

  const colonMatch = /^(\d{1,2}):(\d{1,2})$/.exec(trimmed)
  if (colonMatch) {
    const hours = Math.min(23, Math.max(0, Number(colonMatch[1])))
    const minutes = Math.min(59, Math.max(0, Number(colonMatch[2])))
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const digits = trimmed.replace(/\D/g, '').slice(0, 4)
  if (!digits) return ''

  const hours = Math.min(23, Number(digits.slice(0, 2)))
  const minutes = Math.min(59, Number((digits.slice(2, 4) || '0').padEnd(2, '0')))
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function maskTime24Input(raw) {
  let digits = String(raw ?? '').replace(/\D/g, '').slice(0, 4)
  if (!digits) return ''

  if (digits.length === 4) {
    let hours = Number(digits.slice(0, 2))
    let minutes = Number(digits.slice(2, 4))
    if (hours > 23) {
      hours = 23
      minutes = 59
    } else if (minutes > 59) {
      minutes = 59
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  if (digits.length === 1) {
    const first = Number(digits[0])
    if (first > 2) return `0${digits[0]}:`
    return digits
  }

  if (digits.length >= 2) {
    let h1 = digits[0]
    let h2 = digits[1]
    if (h1 === '2' && Number(h2) > 3) h2 = '3'
    digits = h1 + h2 + digits.slice(2)
  }

  if (digits.length >= 3) {
    const m1 = digits[2]
    if (Number(m1) > 5) {
      digits = `${digits.slice(0, 2)}5${digits.slice(3)}`
    }
  }

  if (digits.length >= 4) {
    const minutes = Number(digits.slice(2, 4))
    if (minutes > 59) {
      digits = `${digits.slice(0, 2)}59`
    }
  }

  if (digits.length <= 2) {
    return digits.length === 2 ? `${digits}:` : digits
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

export function completeTimeOnBlur(value, { allowEmpty = false, fallback = '09:00' } = {}) {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return allowEmpty ? '' : fallback

  if (trimmed.includes(':')) {
    const [hPart, mPart = ''] = trimmed.split(':')
    const hDigits = hPart.replace(/\D/g, '')
    const mDigits = mPart.replace(/\D/g, '')
    if (!hDigits && !mDigits) return allowEmpty ? '' : fallback
    return normalizeTimeValue(`${hDigits || '0'}:${mDigits || '0'}`)
  }

  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return allowEmpty ? '' : fallback

  if (digits.length === 1) return normalizeTimeValue(`${digits}:00`)
  if (digits.length === 2) return normalizeTimeValue(`${digits}:00`)
  if (digits.length === 3) return normalizeTimeValue(`${digits.slice(0, 2)}:${digits.slice(2)}`)

  return normalizeTimeValue(`${digits.slice(0, 2)}:${digits.slice(2, 4)}`)
}
