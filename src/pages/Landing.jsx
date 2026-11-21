import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Landing() {
  useDocumentTitle('Goofly — Seu Roteiro Ideal', { exact: true })

  return (
    <iframe
      className="landing-page"
      title="Goofly — Planeje sua viagem"
      src={'/pagina-inicial/index.html' + window.location.search + window.location.hash}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, background: '#fff' }}
    />
  )
}
