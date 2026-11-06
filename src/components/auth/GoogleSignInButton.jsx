import { useEffect, useRef } from 'react'

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let gsiScriptPromise = null

function loadGsiScript() {
  if (window.google?.accounts?.id) return Promise.resolve()
  if (!gsiScriptPromise) {
    gsiScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GSI_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = resolve
      script.onerror = () => {
        gsiScriptPromise = null
        reject(new Error('Falha ao carregar o Google Sign-In'))
      }
      document.head.appendChild(script)
    })
  }
  return gsiScriptPromise
}

/**
 * Botão oficial "Entrar com Google" (Google Identity Services).
 * `onCredential` recebe o ID token (JWT) que deve ser enviado ao backend em `POST /auth/google`.
 */
export function GoogleSignInButton({ onCredential, onError }) {
  const containerRef = useRef(null)
  const onCredentialRef = useRef(onCredential)
  onCredentialRef.current = onCredential
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

  useEffect(() => {
    if (!clientId) return
    let cancelled = false

    loadGsiScript()
      .then(() => {
        if (cancelled || !containerRef.current) return
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => onCredentialRef.current?.(response.credential),
        })
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          locale: 'pt-BR',
          width: Math.min(containerRef.current.offsetWidth || 320, 400),
        })
      })
      .catch((err) => onErrorRef.current?.(err.message))

    return () => {
      cancelled = true
    }
  }, [clientId])

  if (!clientId) return null

  return <div ref={containerRef} className="w-full flex justify-center" />
}
