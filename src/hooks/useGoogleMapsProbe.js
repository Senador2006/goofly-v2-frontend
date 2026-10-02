import { useEffect, useState } from 'react'
import {
  getGoogleMapsKeyStatus,
  probeGoogleMapsPlaces,
} from '../services/googleMapsPlacesLoader'

export function useGoogleMapsProbe() {
  const [mapsStatus, setMapsStatus] = useState(() => getGoogleMapsKeyStatus())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const status = await probeGoogleMapsPlaces()
      if (!cancelled) setMapsStatus(status)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return {
    mapsStatus,
    mapsReady: mapsStatus === 'ready',
    mapsUnavailable: mapsStatus === 'missing_key' || mapsStatus === 'load_failed',
  }
}
