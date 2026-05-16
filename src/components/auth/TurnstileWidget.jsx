import { useEffect, useRef, useState } from 'react'

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let turnstileScriptPromise

const loadTurnstileScript = () => {
  if (window.turnstile) {
    return Promise.resolve(window.turnstile)
  }

  if (turnstileScriptPromise) {
    return turnstileScriptPromise
  }

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.turnstile), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Falha ao carregar o captcha.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = TURNSTILE_SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.turnstile)
    script.onerror = () => reject(new Error('Falha ao carregar o captcha.'))
    document.head.appendChild(script)
  })

  return turnstileScriptPromise
}

export function TurnstileWidget({ siteKey, onTokenChange, resetNonce = 0 }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const [status, setStatus] = useState(siteKey ? 'loading' : 'missing-key')

  useEffect(() => {
    let active = true

    const renderWidget = async () => {
      if (!siteKey) {
        setStatus('missing-key')
        onTokenChange('')
        return
      }

      setStatus('loading')

      try {
        const turnstile = await loadTurnstileScript()

        if (!active || !containerRef.current || !turnstile) {
          return
        }

        if (widgetIdRef.current !== null && window.turnstile?.remove) {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
        }

        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'auto',
          callback: (token) => {
            if (!active) return
            setStatus('ready')
            onTokenChange(token)
          },
          'expired-callback': () => {
            if (!active) return
            setStatus('expired')
            onTokenChange('')
          },
          'error-callback': () => {
            if (!active) return
            setStatus('error')
            onTokenChange('')
          },
          'unsupported-callback': () => {
            if (!active) return
            setStatus('unsupported')
            onTokenChange('')
          },
        })
      } catch (_) {
        if (!active) return
        setStatus('error')
        onTokenChange('')
      }
    }

    renderWidget()

    return () => {
      active = false
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [siteKey, onTokenChange])

  useEffect(() => {
    if (widgetIdRef.current !== null && window.turnstile?.reset) {
      window.turnstile.reset(widgetIdRef.current)
      onTokenChange('')
      setStatus('loading')
    }
  }, [resetNonce, onTokenChange])

  const helperMessage = {
    loading: 'Carregando verificacao de seguranca...',
    ready: 'Verificacao concluida.',
    expired: 'A verificacao expirou. Confirme novamente para continuar.',
    error: 'Nao foi possivel carregar o captcha. Tente atualizar a pagina.',
    unsupported: 'Seu navegador nao conseguiu carregar o captcha.',
    'missing-key': 'Captcha nao configurado neste ambiente.',
  }[status]

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="min-h-[65px]"
      />
      <p className={`text-xs ${status === 'ready' ? 'text-green-600 dark:text-green-400' : 'text-text-secondary'}`}>
        {helperMessage}
      </p>
    </div>
  )
}
