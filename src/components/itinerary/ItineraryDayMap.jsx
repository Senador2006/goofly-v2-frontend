import { useEffect, useMemo, useState, useRef } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { tripService } from '../../services/tripService'
import {
  readLatLng,
  formatRouteDistance,
  formatRouteDuration,
} from '../../utils/coordinates'
import { routeDataMatchesDay } from '../../utils/itineraryRouteDay'
import {
  apiRouteMatchesVisibleActivities,
  buildVisibleActivityIdSet,
  mergeAccommodationsForMap,
  plottableAccommodationsFromProps,
  resolveLegPolylinePositions,
  resolveMapMarkers,
  resolvePolylinePositions,
} from '../../utils/itineraryMapRoute'
import {
  accommodationsCacheSignature,
  accommodationDisplayLabel,
  hasPlottableAccommodation,
  pickPrimaryAccommodationForLegs,
} from '../../utils/accommodationDayResolver'
import { resolveAccommodationLegDisplay } from '../../utils/itineraryAccommodationLegs'
import { MapAccommodationRoutesToggle } from './MapAccommodationRoutesToggle'

/**
 * RF04.3 — Mapa do roteiro por dia: pins numerados + rota (OpenRouteService ou linha reta).
 * Cache em memória por trip+dia; invalida quando as atividades do dia mudam.
 */

const ROUTE_PROFILE = 'foot-walking'
const ROUTE_PREVIEW_DEBOUNCE_MS = 400

/** @type {Map<string, { data: object, activitySig: string }>} */
const routeCacheByKey = new Map()

function cacheKey(tripId, day, accessSig = '', accSig = '') {
  const base = `${tripId}:${day}`
  const withAcc = accSig ? `${base}:acc:${accSig}` : base
  return accessSig ? `${withAcc}:${accessSig}` : withAcc
}

function draftCacheKey(tripId, day, accSig = '') {
  const base = `${tripId}:${day}:draft`
  return accSig ? `${base}:acc:${accSig}` : base
}

function countGeolocatedActivities(activities) {
  return (activities || []).filter((a) => readLatLng(a)).length
}

/**
 * Assinatura estável das atividades visíveis no dia. Inclui id E coordenadas
 * para que a rota seja recalculada quando uma parada é geocodificada (nova) ou
 * renomeada (coordenada muda) — não só quando os ids mudam.
 */
function activitiesCacheSignature(activities) {
  return (activities || [])
    .map((a) => {
      const id = String(a?.id ?? a?.placeId ?? a?.place_id ?? '')
      const c = readLatLng(a)
      const coord = c ? `${c[0].toFixed(5)},${c[1].toFixed(5)}` : 'nocoord'
      return `${id}@${coord}`
    })
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
  const size = isHighlighted ? 30 : 26
  const fontSize = isHighlighted ? 12 : 11
  const ring = isHighlighted
    ? '0 0 0 3px #fff, 0 0 0 7px #FEC641, 0 0 18px 4px rgba(254,198,65,0.85)'
    : '0 0 0 2px #fff, 0 0 0 4px rgba(254,198,65,0.45)'
  return L.divIcon({
    className: isHighlighted ? 'goofly-itinerary-marker goofly-itinerary-marker--tracked' : 'goofly-itinerary-marker',
    html:
      `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:800;color:#1c1c0d;background:#FEC641;box-shadow:${ring};">` +
      String(order) +
      '</div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -10],
  })
}

function getHomeIcon(homeOrder = null) {
  const size = 28
  const showNumber = homeOrder != null && homeOrder > 1
  const inner = showNumber ? String(homeOrder) : '⌂'
  const fontSize = showNumber ? 11 : 15
  return L.divIcon({
    className: 'goofly-itinerary-marker goofly-itinerary-marker--home',
    html:
      `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:800;color:#fff;background:#16a34a;box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(22,163,74,0.45);">` +
      inner +
      '</div>',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -10],
  })
}

function shouldFetchDayRoute(activities, accommodations) {
  const geoActivities = countGeolocatedActivities(activities)
  if (geoActivities >= 2) return true
  if (hasPlottableAccommodation(accommodations) && geoActivities >= 1) return true
  return false
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
  accommodations = [],
  disabled = false,
  routeRestricted = false,
  highlightedIndex = null,
  preferLocalRoute = false,
  className = '',
  ariaLabel = 'Mapa do roteiro do dia',
  mapLayoutWatch,
  showAccommodationRoutes = true,
  onShowAccommodationRoutesChange,
}) {
  const [routeData, setRouteData] = useState(null)
  const [routeDay, setRouteDay] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fetchGenRef = useRef(0)

  const activitySig = useMemo(() => activitiesCacheSignature(activities), [activities])
  const accSig = useMemo(() => accommodationsCacheSignature(accommodations), [accommodations])
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

    if (!shouldFetchDayRoute(activities, accommodations)) {
      setRouteData(null)
      setRouteDay(null)
      setLoading(false)
      setError(null)
      return undefined
    }

    const key = preferLocalRoute
      ? draftCacheKey(tripId, dayNum, accSig)
      : cacheKey(tripId, dayNum, routeRestricted ? activitySig : '', accSig)
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
    let cancelled = false

    const runFetch = () => {
      if (cancelled || fetchGenRef.current !== gen) return

      setRouteData(null)
      setRouteDay(null)
      setLoading(true)
      setError(null)

      const request = preferLocalRoute
        ? tripService.previewItineraryRoute(tripId, {
            day: dayNum,
            profile: ROUTE_PROFILE,
            activities,
          })
        : tripService.getItineraryRoute(tripId, { day: dayNum, profile: ROUTE_PROFILE })

      request
        .then((data) => {
          if (cancelled || fetchGenRef.current !== gen) return
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
          if (cancelled || fetchGenRef.current !== gen) return
          setError(err?.message || 'Não foi possível carregar a rota')
          setRouteData(null)
          setRouteDay(null)
        })
        .finally(() => {
          if (!cancelled && fetchGenRef.current === gen) setLoading(false)
        })
    }

    const delay = preferLocalRoute ? ROUTE_PREVIEW_DEBOUNCE_MS : 0
    const timer = setTimeout(runFetch, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [tripId, dayNum, activitySig, accSig, disabled, preferLocalRoute, routeRestricted, activities, accommodations])

  const routePayloadValid =
    routeData != null && routeDay === dayNum && routeDataMatchesDay(routeData, dayNum)

  const visibleActivityIds = useMemo(() => buildVisibleActivityIdSet(activities), [activities])

  const localMarkers = useMemo(() => buildLocalMarkers(activities), [activities])
  const apiMarkers = useMemo(
    () => (routePayloadValid ? parseApiMarkers(routeData) : []),
    [routePayloadValid, routeData]
  )

  const apiRouteSafeForPreview = useMemo(() => {
    if (!routeRestricted || !routePayloadValid) return true
    return apiRouteMatchesVisibleActivities(routeData, visibleActivityIds)
  }, [routeRestricted, routePayloadValid, routeData, visibleActivityIds])

  const markers = useMemo(
    () => resolveMapMarkers({ localMarkers, apiMarkers, routeRestricted }),
    [localMarkers, apiMarkers, routeRestricted],
  )

  const mapAccommodations = useMemo(() => {
    const fromProps = plottableAccommodationsFromProps(accommodations)
    const fromApi = routePayloadValid ? routeData?.accommodations : null
    return mergeAccommodationsForMap(fromProps, fromApi)
  }, [accommodations, routePayloadValid, routeData])

  const primaryAccommodation = useMemo(
    () => pickPrimaryAccommodationForLegs(mapAccommodations, markers),
    [mapAccommodations, markers],
  )

  const usingMarkerPolylineFallback =
    !routePayloadValid && markers.length >= 2 && !loading && !disabled

  const polylinePositions = useMemo(
    () =>
      resolvePolylinePositions({
        routePayloadValid,
        routeData,
        markers,
        routeRestricted,
        apiRouteSafeForPreview,
      }),
    [routePayloadValid, routeData, markers, routeRestricted, apiRouteSafeForPreview],
  )

  const legToFirstPositions = useMemo(() => {
    if (!primaryAccommodation?.coords || markers.length < 1) return []
    return resolveLegPolylinePositions(
      routePayloadValid ? routeData?.legs?.toFirst : null,
      primaryAccommodation.coords,
      markers[0].coords,
    )
  }, [primaryAccommodation, markers, routePayloadValid, routeData])

  const legFromLastPositions = useMemo(() => {
    if (!primaryAccommodation?.coords || markers.length < 1) return []
    const last = markers[markers.length - 1]
    return resolveLegPolylinePositions(
      routePayloadValid ? routeData?.legs?.fromLast : null,
      last.coords,
      primaryAccommodation.coords,
    )
  }, [primaryAccommodation, markers, routePayloadValid, routeData])

  const accommodationLegDisplay = useMemo(
    () =>
      resolveAccommodationLegDisplay({
        toFirst: legToFirstPositions,
        fromLast: legFromLastPositions,
        showLegs: legToFirstPositions.length >= 2 && legFromLastPositions.length >= 2,
        markers,
      }),
    [legToFirstPositions, legFromLastPositions, markers],
  )

  const accommodationLegOpacity = showAccommodationRoutes ? 0.9 : 0
  const toFirstStraight =
    routeData?.legs?.toFirst?.routeSource === 'straight_line'
  const fromLastStraight =
    routeData?.legs?.fromLast?.routeSource === 'straight_line'

  const showAccommodationRoutesToggle =
    !disabled &&
    Boolean(primaryAccommodation?.coords) &&
    markers.length >= 1 &&
    typeof onShowAccommodationRoutesChange === 'function'

  const allCoords = useMemo(() => {
    const coords = markers.map((m) => m.coords)
    for (const acc of mapAccommodations) {
      if (acc?.coords) coords.push(acc.coords)
    }
    return coords
  }, [markers, mapAccommodations])

  const hasMapContent = markers.length > 0 || mapAccommodations.length > 0
  const showHomeNumbers = mapAccommodations.length > 1

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
    routeSource === 'straight_line' ||
    warnings.includes('ors_not_configured') ||
    usingMarkerPolylineFallback

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
        {accommodationLegDisplay.yellow.length >= 2 ? (
          <Polyline
            positions={accommodationLegDisplay.yellow}
            pathOptions={{
              color: '#eab308',
              weight: 4,
              opacity: accommodationLegOpacity,
              className: 'goofly-acc-leg-polyline',
              dashArray: toFirstStraight || fromLastStraight ? '6 6' : undefined,
            }}
          />
        ) : null}
        {accommodationLegDisplay.green.length >= 2 ? (
          <Polyline
            positions={accommodationLegDisplay.green}
            pathOptions={{
              color: '#22c55e',
              weight: 4,
              opacity: accommodationLegOpacity,
              className: 'goofly-acc-leg-polyline',
              dashArray: toFirstStraight ? '6 6' : undefined,
            }}
          />
        ) : null}
        {accommodationLegDisplay.red.length >= 2 ? (
          <Polyline
            positions={accommodationLegDisplay.red}
            pathOptions={{
              color: '#ef4444',
              weight: 4,
              opacity: accommodationLegOpacity,
              className: 'goofly-acc-leg-polyline',
              dashArray: fromLastStraight ? '6 6' : undefined,
            }}
          />
        ) : null}
        {mapAccommodations.map((acc, accIdx) => (
          <Marker
            key={acc.id || `home-${acc.coords[0]}-${acc.coords[1]}-${accIdx}`}
            position={acc.coords}
            icon={getHomeIcon(showHomeNumbers ? accIdx + 1 : null)}
          >
            <Popup>
              <p className="m-0 text-sm font-bold text-foreground">
                Hospedagem{showHomeNumbers ? ` ${accIdx + 1}` : ''}
                {primaryAccommodation?.id === acc.id ? (
                  <span className="text-[10px] font-semibold text-green-700 dark:text-green-400">
                    {' '}
                    · rota ida/volta
                  </span>
                ) : null}
              </p>
              <p className="m-0 text-xs text-text-secondary mt-1">
                {accommodationDisplayLabel(acc)}
              </p>
            </Popup>
          </Marker>
        ))}
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
        <MapInvalidateSize
          watch={`${mapInstanceKey}-${markers.length}-${activitySig}-${mapLayoutWatch ?? ''}`}
        />
      </MapContainer>

      {dayNum != null && !disabled ? (
        <div className="pointer-events-none absolute top-3 left-3 z-[500]">
          <span className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-white/92 dark:bg-card-dark/92 border border-border-light dark:border-border-dark shadow-sm text-foreground dark:text-white">
            Dia {dayNum}
          </span>
        </div>
      ) : null}

      {showAccommodationRoutesToggle ? (
        <div className="absolute top-3 right-3 z-[500]">
          <MapAccommodationRoutesToggle
            checked={showAccommodationRoutes}
            onChange={onShowAccommodationRoutesChange}
          />
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

      {!disabled && !hasMapContent && !loading ? (
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

      {!disabled && hasMapContent ? (
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
                {markers.length > 0
                  ? `${markers.length} parada${markers.length === 1 ? '' : 's'}`
                  : 'Hospedagem'}
                {mapAccommodations.length > 0 && markers.length > 0
                  ? ` · ${mapAccommodations.length} hospedagem${mapAccommodations.length === 1 ? '' : 'ns'}`
                  : ''}
              </span>
            ) : null}
            {showStraightHint ? (
              <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5 m-0">
                Trajeto aproximado (linha reta)
              </p>
            ) : routePayloadValid && routeSource === 'openrouteservice' ? (
              <p className="text-[10px] text-text-secondary mt-0.5 m-0">Rota a pé (OpenRouteService)</p>
            ) : null}
          </div>
          {warnings.includes('duplicate_coordinates') ? (
            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10px] text-amber-900 dark:text-amber-200 max-w-[11rem]">
              Várias paradas no mesmo ponto
            </div>
          ) : null}
        </div>
      ) : null}

      {error && !hasMapContent && !disabled ? (
        <div className="absolute top-3 right-3 z-[500] max-w-[14rem]">
          <p className="text-xs text-red-600 dark:text-red-400 bg-white/90 dark:bg-card-dark/90 rounded-lg px-2 py-1 border border-red-200 dark:border-red-900/40">
            {error}
          </p>
        </div>
      ) : null}
    </div>
  )
}
