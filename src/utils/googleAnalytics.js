/**
 * Google Analytics 4 (gtag.js) — wrapper para SPA.
 *
 * O base code em index.html faz config + page_view do primeiro load.
 * Daí em diante: page_view em cada rota (via GoogleAnalyticsProvider).
 * No-op se o Measurement ID não estiver configurado ou o script bloqueado.
 *
 * No GA4 Admin → Data stream → Enhanced measurement → Page views:
 * desative "Page changes based on browser history events" para não
 * duplicar page_view com o provider.
 */

export const GA_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js'

function getWindow() {
  return typeof globalThis !== 'undefined' ? globalThis.window : undefined
}

function getDocument() {
  return typeof globalThis !== 'undefined' ? globalThis.document : undefined
}

export function getGaMeasurementId() {
  const win = getWindow()
  if (win?.__GA_MEASUREMENT_ID__) {
    const fromWindow = String(win.__GA_MEASUREMENT_ID__).trim()
    if (fromWindow && !fromWindow.includes('%VITE_')) return fromWindow
  }

  try {
    return String(import.meta.env?.VITE_GA_MEASUREMENT_ID || '').trim()
  } catch {
    return ''
  }
}

export function isGaAdminPath(pathname = '') {
  return String(pathname).startsWith('/admin')
}

function installGtagStub(win) {
  win.dataLayer = win.dataLayer || []
  if (typeof win.gtag === 'function') return win.gtag

  function gtag() {
    win.dataLayer.push(arguments)
  }
  win.gtag = gtag
  return gtag
}

function appendGaScript(doc, measurementId) {
  if (!doc || typeof doc.createElement !== 'function') return
  if (doc.querySelector('script[data-ga-gtag="1"]')) return

  const script = doc.createElement('script')
  script.async = true
  script.src = `${GA_SCRIPT_URL}?id=${encodeURIComponent(measurementId)}`
  script.dataset.gaGtag = '1'
  const first = doc.getElementsByTagName('script')[0]
  if (first?.parentNode) {
    first.parentNode.insertBefore(script, first)
  } else {
    doc.head?.appendChild(script)
  }
}

/**
 * Garante dataLayer + gtag + script. Seguro chamar de novo (idempotente).
 */
export function initGoogleAnalytics(measurementId = getGaMeasurementId()) {
  const win = getWindow()
  if (!win) return false
  const id = String(measurementId || '').trim()
  if (!id || id.includes('%VITE_')) return false

  win.__GA_MEASUREMENT_ID__ = id
  installGtagStub(win)
  appendGaScript(getDocument(), id)
  return true
}

export function trackGaPageView(pathname, search = '') {
  const win = getWindow()
  if (typeof win?.gtag !== 'function') return

  const path = `${pathname || ''}${search || ''}` || '/'
  const locationHref = win.location?.href || path
  const title = getDocument()?.title || ''

  win.gtag('event', 'page_view', {
    page_path: path,
    page_location: locationHref,
    page_title: title,
  })
}

export function trackGaEvent(eventName, params = {}) {
  const win = getWindow()
  if (typeof win?.gtag !== 'function') return
  const name = String(eventName || '').trim()
  if (!name) return

  const payload = params && typeof params === 'object' ? params : {}
  win.gtag('event', name, payload)
}
