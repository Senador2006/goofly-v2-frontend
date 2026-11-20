/**
 * Regras de senha do cadastro/reset — espelho de `PASSWORD_STRENGTH_REGEX`
 * em goofly-v2-api-services/src/utils/authValidation.js.
 * A checagem de senha comum fica só no servidor (lista não vai para o bundle).
 */
export const PASSWORD_RULES = [
  { key: 'length', label: 'Mínimo de 8 caracteres', test: (p) => p.length >= 8 },
  { key: 'upper', label: '1 letra maiúscula', test: (p) => /[A-Z]/.test(p) },
  { key: 'digit', label: '1 número', test: (p) => /\d/.test(p) },
  { key: 'symbol', label: '1 símbolo', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

/** Atributo `passwordrules` (Safari/iCloud Keychain) alinhado às regras acima. */
export const PASSWORD_RULES_ATTR = 'minlength: 8; required: upper; required: digit; required: special;'

export const PASSWORD_MISMATCH_MESSAGE = 'As senhas não coincidem.'
export const PASSWORD_WEAK_MESSAGE =
  'A senha deve ter no mínimo 8 caracteres, com 1 letra maiúscula, 1 número e 1 símbolo.'

/** @returns {{ key: string, label: string, ok: boolean }[]} */
export function evaluatePassword(password) {
  const value = typeof password === 'string' ? password : ''
  return PASSWORD_RULES.map(({ key, label, test }) => ({ key, label, ok: test(value) }))
}

export function isPasswordStrong(password) {
  return evaluatePassword(password).every((rule) => rule.ok)
}

/** Comparação exata (sem trim / sem ignorar maiúsculas) — igual ao hash do backend. */
export function passwordsMatch(password, confirmPassword) {
  return typeof password === 'string' && password.length > 0 && password === confirmPassword
}

/** @returns {string} mensagem de erro, ou '' quando válido */
export function validateNewPassword(password, confirmPassword) {
  if (!isPasswordStrong(password)) return PASSWORD_WEAK_MESSAGE
  if (!passwordsMatch(password, confirmPassword)) return PASSWORD_MISMATCH_MESSAGE
  return ''
}
