import { Icon } from '../common/Icon'
import { evaluatePassword } from '../../utils/authPasswordValidation'

/** Checklist ao vivo das regras de senha (mesma regra do backend). */
export function PasswordRequirements({ id, password }) {
  const rules = evaluatePassword(password)
  return (
    <ul id={id} className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {rules.map(({ key, label, ok }) => (
        <li
          key={key}
          className={`flex items-center gap-1 ${ok ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
        >
          <Icon name={ok ? 'check_circle' : 'cancel'} className="text-sm" aria-hidden="true" />
          <span>{label}</span>
          <span className="sr-only">{ok ? '(atendido)' : '(pendente)'}</span>
        </li>
      ))}
    </ul>
  )
}

/** Feedback de confirmação: só aparece após blur/tentativa de envio. */
export function PasswordMatchHint({ id, show, match }) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={`mt-2 text-xs min-h-[1rem] ${match ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
    >
      {show ? (match ? 'As senhas coincidem.' : 'As senhas não coincidem.') : ''}
    </p>
  )
}
