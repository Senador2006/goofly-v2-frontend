import { useEffect } from 'react'

const BASE_TITLE = 'Goofly v2 — Travel Planner'

/**
 * Define `document.title` enquanto o componente estiver montado.
 *
 * Uso:
 *   useDocumentTitle('Dashboard')           // "Dashboard · Goofly v2 — Travel Planner"
 *   useDocumentTitle('Roma', { exact: true }) // "Roma" (sem sufixo)
 *
 * Restaura o título anterior no unmount, evitando "title leak" quando o
 * usuário navega entre rotas.
 */
export function useDocumentTitle(title, { exact = false } = {}) {
  useEffect(() => {
    if (!title) return

    const previous = document.title
    document.title = exact ? title : `${title} · ${BASE_TITLE}`

    return () => {
      document.title = previous
    }
  }, [title, exact])
}

export { BASE_TITLE }
