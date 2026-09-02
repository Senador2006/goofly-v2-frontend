/** Campo de data no formulário: exibição DD/MM/AAAA, valor persistido YYYY-MM-DD. */

export function isoToBrDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim())
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** Partes DD / MM / AAAA a partir de ISO YYYY-MM-DD. */
export function splitIsoToParts(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '').trim())
  if (!m) return { day: '', month: '', year: '' }
  return { day: m[3], month: m[2], year: m[1] }
}

function calendarIso(year, month, day) {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const dt = new Date(Date.UTC(year, month - 1, day))
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Dias no mês (UTC). Sem ano: fev=29, meses de 30/31 corretos. */
export function daysInMonth(month, year) {
  const m = Number(month)
  if (!Number.isFinite(m) || m < 1 || m > 12) return 31
  const y = Number(year)
  if (Number.isFinite(y) && y >= 1000) {
    return new Date(Date.UTC(y, m, 0)).getUTCDate()
  }
  if (m === 2) return 29
  if (m === 4 || m === 6 || m === 9 || m === 11) return 30
  return 31
}

/** Monta ISO a partir dos três campos (só quando os três estão completos e válidos). */
export function partsToIso({ day, month, year }) {
  const d = String(day || '').replace(/\D/g, '')
  const mo = String(month || '').replace(/\D/g, '')
  const y = String(year || '').replace(/\D/g, '')
  if (d.length !== 2 || mo.length !== 2 || y.length !== 4) return null
  return calendarIso(Number(y), Number(mo), Number(d))
}

/** Digits only, capped; used by segmented fields. */
export function digitsOnly(raw, maxLen) {
  return String(raw || '').replace(/\D/g, '').slice(0, maxLen)
}

/** Pad 1 dígito → 01 no blur do dia/mês. */
export function padDateSegment(raw, maxLen) {
  const d = digitsOnly(raw, maxLen)
  if (!d) return ''
  if (d.length >= maxLen) return d.slice(0, maxLen)
  return d.padStart(maxLen, '0')
}

/**
 * Limita digitação de dia/mês a valores de calendário.
 * - mês: 01–12
 * - dia: 01–diasDoMês (respeita mês/ano; fev sem ano = 29)
 * Retorna também se o segmento já está “completo” o bastante para avançar.
 */
export function sanitizeDateSegment(key, raw, parts = {}) {
  if (key === 'year') {
    const year = digitsOnly(raw, 4)
    return { value: year, advance: year.length === 4 }
  }

  let value = digitsOnly(raw, 2)

  if (key === 'month') {
    if (value.length === 1) {
      const n = Number(value)
      // 2–9 → mês óbvio (02–09), completa e avança
      if (n >= 2 && n <= 9) {
        return { value: padDateSegment(value, 2), advance: true }
      }
      return { value, advance: false }
    }
    if (value.length >= 2) {
      let n = Number(value.slice(0, 2))
      if (n === 0) n = 1
      if (n > 12) n = 12
      return { value: String(n).padStart(2, '0'), advance: true }
    }
    return { value: '', advance: false }
  }

  // day
  if (value.length === 1) {
    const n = Number(value)
    // 4–9 → dia óbvio (04–09)
    if (n >= 4 && n <= 9) {
      const max = daysInMonth(parts.month, parts.year)
      const clamped = Math.min(n, max)
      return { value: String(clamped).padStart(2, '0'), advance: true }
    }
    return { value, advance: false }
  }
  if (value.length >= 2) {
    let n = Number(value.slice(0, 2))
    const max = daysInMonth(parts.month, parts.year)
    if (n === 0) n = 1
    if (n > max) n = max
    return { value: String(n).padStart(2, '0'), advance: true }
  }
  return { value: '', advance: false }
}

/** Após mudar mês/ano, garante que o dia não exceda o mês. */
export function clampDayToMonth(parts) {
  const day = digitsOnly(parts.day, 2)
  if (day.length !== 2) return parts
  const max = daysInMonth(parts.month, parts.year)
  let n = Number(day)
  if (!Number.isFinite(n) || n < 1) n = 1
  if (n > max) n = max
  return { ...parts, day: String(n).padStart(2, '0') }
}

/** Normaliza partes antes de gravar (dd/mm com zero à esquerda). */
export function finalizeDateParts(p) {
  let next = {
    day: p.day ? padDateSegment(p.day, 2) : '',
    month: p.month ? padDateSegment(p.month, 2) : '',
    year: digitsOnly(p.year, 4),
  }
  if (next.month) {
    let m = Number(next.month)
    if (!Number.isFinite(m) || m < 1) m = 1
    if (m > 12) m = 12
    next.month = String(m).padStart(2, '0')
  }
  if (next.day) {
    next = clampDayToMonth(next)
  }
  return next
}

/** Hoje no calendário local (YYYY-MM-DD). */
export function todayIsoCalendarDate(now = new Date()) {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Menor data permitida: `min` explícito e, por padrão, não anterior a hoje.
 * @param {string | null | undefined} min
 * @param {{ disallowPast?: boolean, now?: Date }} [options]
 */
export function resolveEffectiveDateMin(min, options = {}) {
  const { disallowPast = true, now } = options
  const today = disallowPast ? todayIsoCalendarDate(now) : null
  const floor = typeof min === 'string' && /^\d{4}-\d{2}-\d{2}/.test(min) ? min.slice(0, 10) : null
  if (!floor && !today) return undefined
  if (!floor) return today || undefined
  if (!today) return floor
  return floor > today ? floor : today
}

export function maskBrDateInput(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function isCompleteBrDate(raw) {
  return /^\d{2}\/\d{2}\/\d{4}$/.test(String(raw || '').trim())
}

/** Interpreta DD/MM/AAAA, DD/MM/AA legado ou cola de ISO YYYY-MM-DD. */
export function parseBrDateToIso(raw) {
  const text = String(raw || '').trim()
  const isoHit = /^(\d{4})-(\d{2})-(\d{2})/.exec(text)
  if (isoHit) return calendarIso(Number(isoHit[1]), Number(isoHit[2]), Number(isoHit[3]))

  const digits = text.replace(/\D/g, '')
  if (digits.length === 8) {
    return calendarIso(Number(digits.slice(4, 8)), Number(digits.slice(2, 4)), Number(digits.slice(0, 2)))
  }
  if (digits.length !== 6) return null
  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = 2000 + Number(digits.slice(4, 6))
  return calendarIso(year, month, day)
}

export function isoInInclusiveRange(iso, minIso, maxIso) {
  if (!iso) return false
  if (minIso && iso < minIso) return false
  if (maxIso && iso > maxIso) return false
  return true
}

/**
 * Mensagem amigável quando uma data ISO completa está fora de [min, max].
 * @param {string} iso
 * @param {string | null | undefined} minIso
 * @param {string | null | undefined} maxIso
 * @param {{ now?: Date, disallowPast?: boolean }} [options]
 * @returns {string | null}
 */
export function describeDateRangeViolation(iso, minIso, maxIso, options = {}) {
  const value = String(iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  if (isoInInclusiveRange(value, minIso, maxIso)) return null

  const today = todayIsoCalendarDate(options.now)
  const floor = typeof minIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(minIso) ? minIso.slice(0, 10) : null
  const ceiling = typeof maxIso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(maxIso) ? maxIso.slice(0, 10) : null

  if (floor && value < floor) {
    if (options.disallowPast !== false && floor === today) {
      return 'A data não pode ser anterior a hoje'
    }
    return `A data deve ser a partir de ${isoToBrDisplay(floor)}`
  }
  if (ceiling && value > ceiling) {
    return `A data deve ser até ${isoToBrDisplay(ceiling)}`
  }
  return 'Data fora do intervalo permitido'
}

/** Limite de duração total da viagem (chegada do 1º destino → saída do último). */
export const MAX_TRIP_DURATION_DAYS = 15

/**
 * Soma/subtrai dias em um calendário ISO (YYYY-MM-DD), sem fuso local.
 * @param {string | null | undefined} iso
 * @param {number} delta
 * @returns {string | null}
 */
export function addCalendarDaysIso(iso, delta) {
  const start = String(iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(delta)) return null
  const [y, m, d] = start.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Maior data de saída permitida para uma viagem de até MAX_TRIP_DURATION_DAYS a partir da 1ª chegada. */
export function tripSpanMaxDepartureIso(firstArrivalIso) {
  return addCalendarDaysIso(firstArrivalIso, MAX_TRIP_DURATION_DAYS - 1)
}

/** Limpa ISO se estiver fora do intervalo [min, max] (inclusive). */
export function clampOrClearIso(iso, minIso, maxIso) {
  const value = String(iso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''
  if (minIso && value < minIso) return ''
  if (maxIso && value > maxIso) return ''
  return value
}

/** Dias de calendário inclusivos entre duas datas ISO (YYYY-MM-DD). */
export function countInclusiveCalendarDays(startIso, endIso) {
  const start = String(startIso || '').slice(0, 10)
  const end = String(endIso || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
    return 0
  }
  const [ys, ms, ds] = start.split('-').map(Number)
  const [ye, me, de] = end.split('-').map(Number)
  const a = Date.UTC(ys, ms - 1, ds)
  const b = Date.UTC(ye, me - 1, de)
  return Math.floor((b - a) / 86_400_000) + 1
}

/**
 * Duração total da viagem em dias (primeira chegada → última saída).
 * @param {Array<{ arrivalDate?: string, departureDate?: string }>} destinations
 */
export function tripSpanDayCount(destinations) {
  const list = Array.isArray(destinations) ? destinations : []
  let first = null
  let last = null
  for (const d of list) {
    const arr = String(d?.arrivalDate || '').slice(0, 10)
    const dep = String(d?.departureDate || '').slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(arr)) {
      if (first == null || arr < first) first = arr
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dep)) {
      if (last == null || dep > last) last = dep
    }
  }
  if (!first || !last) return 0
  return countInclusiveCalendarDays(first, last)
}
