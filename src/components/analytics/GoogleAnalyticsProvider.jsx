import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getGaMeasurementId,
  initGoogleAnalytics,
  isGaAdminPath,
  trackGaPageView,
} from '../../utils/googleAnalytics'

/**
 * Completa o snippet do index.html na SPA: page_view em cada troca de rota
 * (o HTML já disparou o primeiro). Pula /admin como o Meta Pixel.
 */
export function GoogleAnalyticsProvider({ children }) {
  const location = useLocation()
  const skipFirstPageViewRef = useRef(true)

  useEffect(() => {
    const measurementId = getGaMeasurementId()
    if (!measurementId) return
    initGoogleAnalytics(measurementId)
  }, [])

  useEffect(() => {
    if (!getGaMeasurementId()) return
    if (isGaAdminPath(location.pathname)) return

    if (skipFirstPageViewRef.current) {
      skipFirstPageViewRef.current = false
      return
    }

    trackGaPageView(location.pathname, location.search)
  }, [location.pathname, location.search])

  return children
}
