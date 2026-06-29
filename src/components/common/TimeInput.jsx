import { useEffect, useRef, useState } from 'react'
import {
  completeTimeOnBlur,
  isCompleteTimeValue,
  maskTime24Input,
  normalizeTimeValue,
} from '../../utils/timeInput'

const ALLOWED_KEYS = new Set([
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

function valueToDisplay(value, { allowEmpty, fallback }) {
  if (allowEmpty && !String(value ?? '').trim()) return ''
  if (!allowEmpty && !String(value ?? '').trim()) return normalizeTimeValue(fallback)
  if (isCompleteTimeValue(value)) return normalizeTimeValue(value)
  return maskTime24Input(value)
}

export function TimeInput({
  value,
  onChange,
  className,
  placeholder = '09:00',
  allowEmpty = false,
  fallback = '09:00',
  autoComplete = 'off',
  id,
  name,
}) {
  const focusedRef = useRef(false)
  const [display, setDisplay] = useState(() => valueToDisplay(value, { allowEmpty, fallback }))

  useEffect(() => {
    if (focusedRef.current) return
    setDisplay(valueToDisplay(value, { allowEmpty, fallback }))
  }, [value, allowEmpty, fallback])

  const commit = (next) => {
    setDisplay(next)
    onChange(next)
  }

  const handleChange = (e) => {
    const masked = maskTime24Input(e.target.value)
    commit(masked)
  }

  const handleBlur = () => {
    focusedRef.current = false
    const completed = completeTimeOnBlur(display, { allowEmpty, fallback })
    if (completed !== display) commit(completed)
    else if (isCompleteTimeValue(display)) commit(normalizeTimeValue(display))
  }

  const handleFocus = () => {
    focusedRef.current = true
  }

  const handleKeyDown = (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (ALLOWED_KEYS.has(e.key)) return
    if (/^\d$/.test(e.key)) return
    e.preventDefault()
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const text = e.clipboardData?.getData('text') ?? ''
    const masked = maskTime24Input(text)
    commit(masked)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      name={name}
      className={className}
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      placeholder={placeholder}
      autoComplete={autoComplete}
      maxLength={5}
      aria-label={placeholder}
    />
  )
}
