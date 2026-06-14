import { useCallback, useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import { createTourConfig } from '../utils/siteTour'

const REGISTER_HREF = '/register'

export function useSiteTour() {
  const driverRef = useRef(null)

  useEffect(() => {
    driverRef.current = driver(createTourConfig(REGISTER_HREF))

    return () => {
      driverRef.current?.destroy()
      driverRef.current = null
    }
  }, [])

  const startTour = useCallback(() => {
    const instance = driverRef.current
    if (!instance) return

    if (instance.isActive()) {
      instance.destroy()
    }

    window.scrollTo({ top: 0, behavior: 'auto' })
    requestAnimationFrame(() => instance.drive(0))
  }, [])

  return { startTour }
}
