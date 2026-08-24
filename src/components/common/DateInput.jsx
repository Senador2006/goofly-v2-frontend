import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from './Icon'
import {
  clampDayToMonth,
  describeDateRangeViolation,
  finalizeDateParts,
  isoInInclusiveRange,
  parseBrDateToIso,
  partsToIso,
  resolveEffectiveDateMin,
  sanitizeDateSegment,
  splitIsoToParts,
} from '../../utils/dateInput'

const SEGMENTS = [
  { key: 'day', maxLen: 2, placeholder: 'dd', widthClass: 'w-7' },
  { key: 'month', maxLen: 2, placeholder: 'mm', widthClass: 'w-7' },
  { key: 'year', maxLen: 4, placeholder: 'aaaa', widthClass: 'w-12' },
]

function emptyParts() {
  return { day: '', month: '', year: '' }
}

function selectionCoversAll(el) {
  if (!el) return false
  const len = String(el.value || '').length
  if (len === 0) return true
  return el.selectionStart === 0 && el.selectionEnd === len
}

export function DateInput({
  value,
  onChange,
  className,
  min,
  max,
  /** Quando true (padrão), não permite datas anteriores a hoje. */
  disallowPast = true,
  disabled = false,
  id,
  name,
  'aria-label': ariaLabel,
  /** Erro controlado pelo pai (ex.: validação do formulário). */
  error = null,
  /** Chamado quando a data completa está fora do intervalo. */
  onValidationError,
}) {
  const focusedRef = useRef(false)
  const pickerRef = useRef(null)
  const dayRef = useRef(null)
  const monthRef = useRef(null)
  const yearRef = useRef(null)
  const refs = { day: dayRef, month: monthRef, year: yearRef }
  const partsRef = useRef(splitIsoToParts(value))
  const valueRef = useRef(value)

  const [parts, setParts] = useState(() => splitIsoToParts(value))
  const [localError, setLocalError] = useState(null)
  const effectiveMin = useMemo(
    () => resolveEffectiveDateMin(min, { disallowPast }),
    [min, disallowPast],
  )

  valueRef.current = value

  // Motivo local (fora do intervalo) tem prioridade sobre o erro genérico do pai.
  const shownError = localError || error

  const applyParts = (next) => {
    partsRef.current = next
    setParts(next)
  }

  const clearLocalError = () => {
    setLocalError((prev) => (prev ? null : prev))
  }

  const rangeMessageFor = (iso) =>
    describeDateRangeViolation(iso, effectiveMin, max, { disallowPast }) ||
    'Data fora do intervalo permitido'

  /**
   * Sempre grava data completa no formulário (mesmo fora do min/max),
   * para a validação do passo explicar o motivo real — não "preencha".
   */
  const commitIso = (iso, { announceRangeError = true } = {}) => {
    const inRange = isoInInclusiveRange(iso, effectiveMin, max)
    valueRef.current = iso
    onChange(iso)
    applyParts(splitIsoToParts(iso))
    if (inRange) {
      clearLocalError()
      return true
    }
    if (announceRangeError) {
      const msg = rangeMessageFor(iso)
      setLocalError(msg)
      onValidationError?.(msg)
    }
    return false
  }

  // Só sincroniza do pai quando o campo NÃO está em edição.
  useEffect(() => {
    if (focusedRef.current) return
    const next = splitIsoToParts(value)
    partsRef.current = next
    setParts(next)
    if (value && isoInInclusiveRange(value, effectiveMin, max)) {
      clearLocalError()
    } else if (value) {
      setLocalError(rangeMessageFor(value))
    }
  }, [value, effectiveMin, max, disallowPast])

  const tryCommit = (nextParts) => {
    const finalized = finalizeDateParts(nextParts)
    const iso = partsToIso(finalized)
    if (!iso) return false
    return commitIso(iso)
  }

  const focusSegment = (key) => {
    const el = refs[key]?.current
    if (!el) return
    el.focus()
    requestAnimationFrame(() => {
      el.select?.()
    })
  }

  const updateSegment = (key, raw) => {
    clearLocalError()
    const { value: nextVal, advance } = sanitizeDateSegment(key, raw, partsRef.current)
    let nextParts = { ...partsRef.current, [key]: nextVal }

    if (key === 'month' || key === 'year') {
      nextParts = clampDayToMonth(nextParts)
    }

    applyParts(nextParts)

    if (!nextParts.day && !nextParts.month && !nextParts.year) {
      valueRef.current = ''
      onChange('')
      return
    }

    if (advance) {
      tryCommit(nextParts)
      if (key === 'day') focusSegment('month')
      else if (key === 'month') focusSegment('year')
    }
  }

  const handleGroupBlur = () => {
    requestAnimationFrame(() => {
      const root = dayRef.current?.closest('[data-date-input]')
      if (root?.contains(document.activeElement)) {
        focusedRef.current = true
        return
      }
      focusedRef.current = false

      const finalized = finalizeDateParts(partsRef.current)

      if (!finalized.day && !finalized.month && !finalized.year) {
        applyParts(emptyParts())
        clearLocalError()
        if (valueRef.current) {
          valueRef.current = ''
          onChange('')
        }
        return
      }

      const iso = partsToIso(finalized)
      if (iso) {
        commitIso(iso)
        return
      }

      // Incompleta: volta ao último valor commitado (display = formData).
      clearLocalError()
      applyParts(splitIsoToParts(valueRef.current))
    })
  }

  const handleKeyDown = (key, e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return

    if (e.key === 'ArrowLeft' && e.currentTarget.selectionStart === 0) {
      e.preventDefault()
      if (key === 'month') focusSegment('day')
      if (key === 'year') focusSegment('month')
      return
    }
    if (
      e.key === 'ArrowRight' &&
      e.currentTarget.selectionStart === String(e.currentTarget.value).length
    ) {
      e.preventDefault()
      if (key === 'day') focusSegment('month')
      if (key === 'month') focusSegment('year')
      return
    }
    if (e.key === '/' || e.key === '-' || e.key === '.') {
      e.preventDefault()
      if (key === 'day') focusSegment('month')
      else if (key === 'month') focusSegment('year')
      return
    }
    if (e.key === 'Backspace' && !e.currentTarget.value) {
      e.preventDefault()
      if (key === 'month') focusSegment('day')
      if (key === 'year') focusSegment('month')
      return
    }

    if (/^\d$/.test(e.key) && selectionCoversAll(e.currentTarget)) {
      e.preventDefault()
      updateSegment(key, e.key)
      return
    }

    const allowed = new Set([
      'Backspace',
      'Delete',
      'Tab',
      'Escape',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
    ])
    if (allowed.has(e.key)) return
    if (/^\d$/.test(e.key)) return
    e.preventDefault()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    clearLocalError()
    const text = e.clipboardData?.getData('text') ?? ''
    const isoFromPaste = parseBrDateToIso(text)
    if (isoFromPaste) {
      commitIso(isoFromPaste)
      focusSegment('year')
      return
    }
    const digits = String(text || '').replace(/\D/g, '').slice(0, 8)
    if (digits.length >= 8) {
      let next = {
        day: digits.slice(0, 2),
        month: digits.slice(2, 4),
        year: digits.slice(4, 8),
      }
      next = {
        ...next,
        month: sanitizeDateSegment('month', next.month, next).value,
      }
      next = {
        ...next,
        day: sanitizeDateSegment('day', next.day, next).value,
      }
      next = finalizeDateParts(next)
      applyParts(next)
      tryCommit(next)
    }
  }

  const openCalendar = () => {
    if (disabled) return
    const el = pickerRef.current
    if (!el) return
    try {
      if (typeof el.showPicker === 'function') {
        el.showPicker()
        return
      }
    } catch {
      /* fallback */
    }
    el.click()
  }

  const handlePickerChange = (e) => {
    const iso = e.target.value || ''
    if (!iso) {
      clearLocalError()
      applyParts(emptyParts())
      valueRef.current = ''
      onChange('')
      return
    }
    // Picker já respeita min/max nativo; ainda assim commitamos e validamos.
    commitIso(iso)
  }

  const shellClass = [
    className,
    shownError ? '!border-red-500/60 dark:!border-red-400/50' : null,
    'relative flex w-full min-w-0 items-center gap-0.5 overflow-hidden pr-10 sm:pr-11 tabular-nums',
  ]
    .filter(Boolean)
    .join(' ')

  const segmentClass =
    'bg-transparent text-center outline-none border-0 p-0 m-0 text-base focus:ring-0 appearance-none text-[#1c1c0d] dark:text-zinc-100 placeholder:text-text-secondary/55 dark:placeholder:text-zinc-500 focus:placeholder:text-transparent focus:placeholder:opacity-0'

  return (
    <div className="min-w-0 w-full">
      <div
        data-date-input
        className={shellClass}
        role="group"
        aria-label={ariaLabel || 'Data'}
        aria-invalid={shownError ? 'true' : undefined}
      >
        {SEGMENTS.map((seg, idx) => (
          <span key={seg.key} className="inline-flex items-center">
            {idx > 0 ? (
              <span className="px-0.5 text-text-secondary dark:text-zinc-400 select-none" aria-hidden>
                /
              </span>
            ) : null}
            <input
              ref={refs[seg.key]}
              type="text"
              inputMode="numeric"
              lang="pt-BR"
              id={idx === 0 ? id : undefined}
              name={idx === 0 ? name : undefined}
              className={`${segmentClass} ${seg.widthClass}`}
              value={parts[seg.key]}
              disabled={disabled}
              placeholder={seg.placeholder}
              maxLength={seg.maxLen}
              autoComplete="off"
              aria-invalid={shownError ? 'true' : undefined}
              aria-label={
                seg.key === 'day' ? 'Dia' : seg.key === 'month' ? 'Mês' : 'Ano'
              }
              onFocus={(e) => {
                focusedRef.current = true
                e.target.select?.()
              }}
              onChange={(e) => updateSegment(seg.key, e.target.value)}
              onBlur={handleGroupBlur}
              onKeyDown={(e) => handleKeyDown(seg.key, e)}
              onPaste={handlePaste}
            />
          </span>
        ))}

        <button
          type="button"
          disabled={disabled}
          onClick={openCalendar}
          className="absolute inset-y-0 right-0 z-[1] flex w-10 sm:w-11 items-center justify-center rounded-r-[10px] text-text-secondary dark:text-zinc-400 hover:text-[#1c1c0d] dark:hover:text-white disabled:opacity-40"
          aria-label="Abrir calendário"
          tabIndex={-1}
        >
          <Icon name="calendar_today" className="text-[1.15rem]" aria-hidden />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={value || ''}
          min={effectiveMin || undefined}
          max={max || undefined}
          disabled={disabled}
          onChange={handlePickerChange}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-px w-px opacity-0"
        />
      </div>
      {shownError ? (
        <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 leading-snug" role="alert">
          {shownError}
        </p>
      ) : null}
    </div>
  )
}
