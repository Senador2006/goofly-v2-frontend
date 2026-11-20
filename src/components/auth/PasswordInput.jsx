import { useEffect, useRef, useState } from 'react'
import { AUTH_INPUT_CLASS } from './AuthPageLayout'
import { Icon } from '../common/Icon'

/**
 * Campo de senha com botão mostrar/ocultar.
 * - Volta a ocultar no submit do form: gerenciadores de senha detectam o campo
 *   como `type=password` e a senha não fica exposta após navegar.
 * - `customValidity` alimenta `setCustomValidity` (bloqueio nativo do submit).
 */
export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid = false,
  customValidity = '',
  children,
  ...rest
}) {
  const [visible, setVisible] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.setCustomValidity(customValidity || '')
  }, [customValidity])

  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return undefined
    const hide = () => setVisible(false)
    form.addEventListener('submit', hide)
    return () => form.removeEventListener('submit', hide)
  }, [])

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold mb-2 text-text-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          className={`${AUTH_INPUT_CLASS} pr-12`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          aria-controls={id}
          title={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-xl text-text-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-r-xl"
        >
          <Icon name={visible ? 'visibility_off' : 'visibility'} aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  )
}
