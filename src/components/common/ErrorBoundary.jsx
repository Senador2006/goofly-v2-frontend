import { Component } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background-light dark:bg-background-dark">
          <div className="max-w-md text-center rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-card-dark p-8 shadow-lg">
            <Icon name="error_outline" className="text-5xl text-primary mx-auto mb-4" />
            <h1 className="text-xl font-bold text-[#1c1c0d] dark:text-white mb-2">
              Algo deu errado
            </h1>
            <p className="text-sm text-text-secondary mb-6">
              Ocorreu um erro inesperado. Recarregue a página ou volte ao início.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => window.location.reload()}>Recarregar</Button>
              <Button variant="secondary" onClick={() => { window.location.href = '/' }}>
                Ir ao início
              </Button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
