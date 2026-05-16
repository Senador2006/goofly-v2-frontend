import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import ptBR from './messages/pt-BR'

/**
 * Stub de i18n para o Goofly v2.
 *
 * Por que stub e não i18next?
 *  - O produto hoje atende só pt-BR. Adicionar i18next + ICU agora seria
 *    over-engineering para 0 usuários EN/ES. Mas estabelecer o pattern
 *    (chaves dot-notation, interpolação `{{var}}`, hook `useT`) permite
 *    migrar incrementalmente sem reescrever consumidores.
 *  - Se virar produto multilingue: trocar a implementação de `t()` e
 *    o provider; consumidores ficam idênticos.
 *
 * Uso:
 *   import { useT } from '@/i18n'
 *   const t = useT()
 *   return <h1>{t('auth.login.title')}</h1>
 *
 * Com interpolação:
 *   t('tdv.day_label', { day: 3 }) // "Dia 3"
 */

const messagesByLocale = {
  'pt-BR': ptBR
}

const DEFAULT_LOCALE = 'pt-BR'

function lookup(messages, key) {
  return key
    .split('.')
    .reduce((acc, segment) => (acc && acc[segment] !== undefined ? acc[segment] : undefined), messages)
}

function interpolate(template, params) {
  if (typeof template !== 'string' || !params) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) =>
    params[name] !== undefined ? String(params[name]) : `{{${name}}}`
  )
}

const I18nContext = createContext(null)

export function I18nProvider({ initialLocale = DEFAULT_LOCALE, children }) {
  const [locale, setLocale] = useState(initialLocale)

  const t = useCallback(
    (key, params) => {
      const msgs = messagesByLocale[locale] || messagesByLocale[DEFAULT_LOCALE]
      const raw = lookup(msgs, key)
      if (raw === undefined) {
        // Fallback ao locale default se a chave não existe no atual
        const fallback = lookup(messagesByLocale[DEFAULT_LOCALE], key)
        if (fallback === undefined) {
          if (import.meta.env.DEV) {
            console.warn(`[i18n] missing key: ${key} (locale: ${locale})`)
          }
          return key
        }
        return interpolate(fallback, params)
      }
      return interpolate(raw, params)
    },
    [locale]
  )

  const value = useMemo(() => ({ t, locale, setLocale }), [t, locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT() {
  const ctx = useContext(I18nContext)
  if (!ctx) {
    // Permitir uso antes do provider (ex.: em testes) sem crashar:
    // retorna a key mesma como fallback.
    return (key) => key
  }
  return ctx.t
}

export function useLocale() {
  const ctx = useContext(I18nContext)
  return ctx ?? { locale: DEFAULT_LOCALE, setLocale: () => {} }
}

export const SUPPORTED_LOCALES = Object.keys(messagesByLocale)
