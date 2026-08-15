import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  buildAdvancedMatching,
  getMetaPixelId,
  initMetaPixel,
  isMetaPixelAdminPath,
  trackMetaPageView,
} from '../../utils/metaPixel'

/**
 * Completa o snippet do index.html na SPA: PageView em cada troca de rota
 * (o HTML já disparou o primeiro) e Advanced Matching quando há sessão.
 */
export function MetaPixelProvider({ children }) {
  const location = useLocation()
  const { user } = useAuth()
  const skipFirstPageViewRef = useRef(true)

  useEffect(() => {
    const pixelId = getMetaPixelId()
    if (!pixelId) return
    initMetaPixel(pixelId, buildAdvancedMatching(user))
  }, [user?.id, user?.email, user?.name])

  useEffect(() => {
    if (!getMetaPixelId()) return
    if (isMetaPixelAdminPath(location.pathname)) return

    if (skipFirstPageViewRef.current) {
      skipFirstPageViewRef.current = false
      return
    }

    trackMetaPageView()
  }, [location.pathname, location.search])

  return children
}
