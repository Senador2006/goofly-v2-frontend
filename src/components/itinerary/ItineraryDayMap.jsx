import { useEffect, useMemo, useState, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { tripService } from '../../services/tripService'
import {
  readLatLng,
  routeGeometryToLatLngs,
  formatRouteDistance,
  formatRouteDuration,
} from '../../utils/coordinates'
import { routeDataMatchesDay } from '../../utils/itineraryRouteDay'

/**
 * RF04.3 — Mapa do roteiro por dia: pins numerados + rota (OpenRouteService ou linha reta).
 * Cache em memória por trip+dia; invalida quando as atividades do dia mudam.
 */

const ROUTE_PROFILE = 'foot-walking'

/** @type {Map<string, { data: object, activitySig: string }>} */
const routeCacheByKey = new Map()

function cacheKey(tripId, day) {
  return `${tripId}:${day}`
}

/** Assinatura estável das atividades visíveis no dia (invalida cache se ids mudarem). */
function activitiesCacheSignature(activities) {
  return (activities || [])
    .map((a) => String(a?.id ?? a?.placeId ?? a?.place_id ?? ''))
    .join('|')
}

function FitBoundsToPoints({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (!coords || coords.length === 0) {
      map.setView([20, 0], 2)
      return
    }
    if (coords.length === 1) {
      map.setView(coords[0], 14)
      return
    }
    const bounds = L.latLngBounds(coords)
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15 })
  }, [map, coords])
  return null
}

function MapInvalidateSize({ watch }) {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100)
    return () => clearTimeout(t)
  }, [map, watch])
  return null
}

function getNumberedIcon(order, isHighlighted) {
  const ring = isHighlighted
    ? '0 0 0 5px rgba(254,198,65,0.9)'
    : '0 0 0 3px rgba(254,198,65,0.45)'
  return L.divIcon({
    className: 'goofly-itinerary-marker',
    html:
      '<div style="width:26px;height:26px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#1c1c0d;background:#FEC641;box-shadow:0 0 0 2px #fff,' +
      ring +
      ';">' +
      String(order) +
      '</div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -10],
  })
}

function buildLocalMarkers(activities) {
  return (activities || [])
    .map((act, idx) => {
      const coords = readLatLng(act)
      if (!coords) return null
      return {
        order: idx + 1,
        activityId: act.id || act.placeId || `local-${idx}`,
        name: act.name || 'Parada',
        startTime: act.startTime || act.start_time || act.time || null,
        coords,
      }
    })
    .filter(Boolean)
}

function parseApiMarkers(routeData) {
  return (routeData?.markers || [])
    .map((m) => {
      const coords = readLatLng(m)
      if (!coords) return null
      return { ...m, coords }
    })
    .filter(Boolean)
}

/** Limpa entradas de um trip (ex.: após otimizar roteiro). */
export function clearItineraryRouteCache(tripId) {
  if (!tripId) return
  const prefix = `${tripId}:`
  for (const key of [...routeCacheByKey.keys()]) {
    if (key.startsWith(prefix)) routeCacheByKey.delete(key)
  }
}

export function ItineraryDayMap({
  tripId,
  day,
  activities = [],
  disabled = false,
  highlightedIndex = null,
  className = '',
  ariaLabel = 'Mapa do roteiro do dia',
  mapLayoutWatch,
}) {
  const [routeData, setRouteData] = useState(null)
  const [routeDay, setRouteDay] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fetchGenRef = useRef(0)

  const activitySig = useMemo(() => activitiesCacheSignature(activities), [activities])
  const dayNum = day != null ? Number(day) : null

  useEffect(() => {
    if (!tripId) {
      routeCacheByKey.clear()
    }
  }, [tripId])

  useEffect(() => {
    if (!tripId || !dayNum || !Number.isFinite(dayNum) || dayNum < 1 || disabled) {
      setRouteData(null)
      setRouteDay(null)
      setLoading(false)
      setError(null)
      return undefined
    }

    const key = cacheKey(tripId, dayNum)
    const cached = routeCacheByKey.get(key)
    if (
      cached &&
      cached.activitySig === activitySig &&
      routeDataMatchesDay(cached.data, dayNum)
    ) {
      setRouteData(cached.data)
      setRouteDay(dayNum)
      setLoading(false)
      setError(null)
      return undefined
    }
    if (cached && !routeDataMatchesDay(cached.data, dayNum)) {
      routeCacheByKey.delete(key)
    }

    const gen = ++fetchGenRef.current
    setRouteData(null)
    setRouteDay(null)
    setLoading(true)
    setError(null)

    tripService
      .getItineraryRoute(tripId, { day: dayNum, profile: ROUTE_PROFILE })
      .then((data) => {
        if (fetchGenRef.current !== gen) return
        if (!routeDataMatchesDay(data, dayNum)) {
          routeCacheByKey.delete(key)
          setRouteData(null)
          setRouteDay(null)
          return
        }
        routeCacheByKey.set(key, { data, activitySig })
        setRouteData(data)
        setRouteDay(dayNum)
      })
      .catch((err) => {
        if (fetchGenRef.current !== gen) return
        setError(err?.message || 'Não foi possível carregar a rota')
        setRouteData(null)
        setRouteDay(null)
      })
      .finally(() => {
        if (fetchGenRef.current === gen) setLoading(false)
      })

    return undefined
  }, [tripId, dayNum, activitySig, disabled])

  const routePayloadValid =
    routeData != null && routeDay === dayNum && routeDataMatchesDay(routeData, dayNum)
  const routeReady = routePayloadValid && !loading

  const localMarkers = useMemo(() => buildLocalMarkers(activities), [activities])
  const apiMarkers = useMemo(
    () => (routePayloadValid ? parseApiMarkers(routeData) : []),
    [routePayloadValid, routeData]
  )

  const useApiLayer = routeReady && apiMarkers.length > 0
  const markers = localMarkers.length > 0 ? localMarkers : apiMarkers
  const usingLocalFallback =
    localMarkers.length > 0 && (!useApiLayer || apiMarkers.length === 0) && !loading && !disabled

  const polylinePositions = useMemo(() => {
    if (routePayloadValid) {
      const fromApi = routeGeometryToLatLngs(routeData?.route)
      if (fromApi.length >= 2) return fromApi
    }
    if (markers.length >= 2) return markers.map((m) => m.coords)
    return []
  }, [routePayloadValid, routeData, markers])

  const allCoords = useMemo(() => markers.map((m) => m.coords), [markers])

  const distanceLabel = formatRouteDistance(
    routePayloadValid ? (routeData?.stats?.distance_m ?? routeData?.total_distance) : null
  )
  const durationLabel = formatRouteDuration(
    routePayloadValid ? (routeData?.stats?.duration_s ?? routeData?.estimated_duration) : null
  )

  const warnings = routePayloadValid ? routeData?.warnings || [] : []
  const skippedCount = routePayloadValid ? (routeData?.skipped?.length ?? 0) : 0
  const routeSource = routePayloadValid
    ? routeData?.routeSource || routeData?.route?.properties?.source
    : null

  const showStraightHint =
    routeSource === 'straight_line' || warnings.includes('ors_not_configured')

  const mapInstanceKey = `${tripId}-${dayNum ?? 'none'}`

  return (
    <div
      className={`relative w-full h-full min-h-[280px] ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      <MapContainer
        key={mapInstanceKey}
        center={[20, 0]}
        zoom={2}
        minZoom={2}
        worldCopyJump
        scrollWheelZoom
        style={{ width: '100%', height: '100%', minHeight: 280 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Rotas: <a href="https://openrouteservice.org">OpenRouteService</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {polylinePositions.length >= 2 ? (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: '#3b82f6',
              weight: 4,
              opacity: 0.85,
              dashArray: showStraightHint ? '8 8' : undefined,
            }}
          />
        ) : null}
        {markers.map((m, idx) => (
          <Marker
            key={m.activityId || `${m.coords[0]}-${m.coords[1]}-${idx}`}
            position={m.coords}
            icon={getNumberedIcon(m.order ?? idx + 1, highlightedIndex === idx)}
          >
            <Popup>
              <p className="m-0 text-sm font-bold text-foreground">
                {m.order != null ? `${m.order}. ` : ''}
                {m.name}
              </p>
              {m.startTime ? (
                <p className="m-0 text-xs text-text-secondary mt-1">{m.startTime}</p>
              ) : null}
            </Popup>
          </Marker>
        ))}
        <FitBoundsToPoints coords={allCoords} />
        <MapInvalidateSize watch={`${mapInstanceKey}-${markers.length}-${mapLayoutWatch ?? ''}`} />
      </MapContainer>

      {dayNum != null && !disabled ? (
        <div className="pointer-events-none absolute top-3 left-3 z-[500]">
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-white/92 dark:bg-card-dark/92 border border-border-light dark:border-border-dark shadow-sm text-foreground dark:text-white">
            Dia {dayNum}
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/30 dark:bg-black/30 backdrop-blur-[1px] z-[500]">
          <p className="text-xs font-semibold px-3 py-1.5 rounded-full bg-white/90 dark:bg-card-dark/90 border border-border-light dark:border-border-dark shadow">
            Carregando rota…
          </p>
        </div>
      ) : null}

      {disabled ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 z-[400]">
          <div className="rounded-2xl bg-white/90 dark:bg-card-dark/90 backdrop-blur px-5 py-4 text-center border border-border-light dark:border-border-dark shadow-md max-w-xs">
            <p className="text-sm font-bold text-foreground dark:text-white">Dia bloqueado na prévia</p>
            <p className="text-xs text-text-secondary mt-1">
              Desbloqueie o roteiro completo para ver o mapa deste dia.
            </p>
          </div>
        </div>
      ) : null}

      {!disabled && markers.length === 0 && !loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 z-[400]">
          <div className="rounded-2xl bg-white/90 dark:bg-card-dark/90 backdrop-blur px-5 py-4 text-center border border-border-light dark:border-border-dark shadow-md max-w-xs">
            <p className="text-sm font-bold text-foreground dark:text-white">Sem paradas no mapa</p>
            <p className="text-xs text-text-secondary mt-1">
              {skippedCount > 0
                ? `${skippedCount} parada(s) sem localização neste dia.`
                : 'Nenhuma atividade com coordenadas para este dia.'}
            </p>
          </div>
        </div>
      ) : null}

      {!disabled && markers.length > 0 ? (
        <div className="absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap items-end gap-2 pointer-events-none">
          <div className="rounded-xl bg-white/92 dark:bg-card-dark/92 backdrop-blur border border-border-light dark:border-border-dark shadow-md px-3 py-2 text-xs">
            {distanceLabel ? (
              <span className="font-bold text-foreground dark:text-white">{distanceLabel}</span>
            ) : null}
            {distanceLabel && durationLabel ? (
              <span className="text-text-secondary mx-1.5">·</span>
            ) : null}
            {durationLabel ? (
              <span className="text-text-secondary">{durationLabel} a pé</span>
            ) : null}
            {!distanceLabel && !durationLabel ? (
              <span className="text-text-secondary">
                {markers.length} parada{markers.length === 1 ? '' : 's'}
              </span>
            ) : null}
            {showStraightHint ? (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5 m-0">
                Trajeto aproximado (linha reta)
              </p>
            ) : null}
            {usingLocalFallback && !showStraightHint ? (
              <p className="text-[10px] text-text-secondary mt-0.5 m-0">
                Trajeto pelas paradas do dia
              </p>
            ) : null}
          </div>
          {warnings.includes('duplicate_coordinates') ? (
            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10px] text-amber-900 dark:text-amber-200 max-w-[11rem]">
              Várias paradas no mesmo ponto
            </div>
          ) : null}
        </div>
      ) : null}

      {error && markers.length === 0 && !disabled ? (
        <div className="absolute top-3 right-3 z-[500] max-w-[14rem]">
          <p className="text-xs text-red-600 dark:text-red-400 bg-white/90 dark:bg-card-dark/90 rounded-lg px-2 py-1 border border-red-200 dark:border-red-900/40">
            {error}
          </p>
        </div>
      ) : null}
    </div>
  )
}
