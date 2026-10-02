import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import { AuthProvider } from './context/AuthContext'
import { MetaPixelProvider } from './components/analytics/MetaPixelProvider'
import { ThemeProvider } from './context/ThemeContext'
import { I18nProvider } from './i18n'
import { initErrorReporting } from './utils/errorReporting'
import './index.css'

initErrorReporting()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <ThemeProvider>
          <AuthProvider>
            <MetaPixelProvider>
              <ErrorBoundary name="root">
                <App />
              </ErrorBoundary>
            </MetaPixelProvider>
          </AuthProvider>
        </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
