import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
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
import { getRealPlaceImageUrls } from '../../utils/placeImages'
import { MapAccommodationRoutesToggle } from './MapAccommodationRoutesToggle'
import { MapMealsToggle } from './MapMealsToggle'
import { ItineraryMapStopPopup } from './ItineraryMapStopPopup'
import { ItineraryMealMapPopup } from './ItineraryMealMapPopup'
import {
  buildMealMapMarkerHtml,
  resolveMealRouteAnchor,
  resolveVisibleMealMarkers,
} from '../../utils/itineraryMealHelpers'

/**
 * RF04.3 — Mapa do roteiro por dia: pins numerados + rota (Geoapify pelo nome).
 * Ignora coordenadas do agente otimizador; o backend geocodifica só o nome.
 * Cache em memória por trip+dia; invalida quando os nomes do dia mudam.
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

function countNamedActivities(activities) {
  return (activities || []).filter((a) =>
    String(a?.name || a?.title || a?.placeName || '').trim(),
  ).length
}

/**
 * Assinatura estável das paradas visíveis no dia. Usa id + nome (não as
 * coordenadas do agente) para recalcular a rota quando o usuário renomeia.
 */
function activitiesCacheSignature(activities) {
  return (activities || [])
    .map((a) => {
      const id = String(a?.id ?? a?.placeId ?? a?.place_id ?? '')
      const name = String(a?.name || a?.title || a?.placeName || '')
        .trim()
        .toLowerCase()
      return `${id}@${name}`
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

/** Fecha destaque de refeição ao tocar no mapa (área vazia), sem bloquear pan/zoom. */
function DismissMealPopupOnMapClick({ active, onDismiss }) {
  const map = useMap()
  useEffect(() => {
    if (!active || typeof onDismiss !== 'function') return undefined
    const handler = () => onDismiss()
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, active, onDismiss])
  return null
}

const MOBILE_MEAL_POPUP_TRACK_PADDING = {
  top: 76,
  right: 52,
  bottom: 32,
  left: 20,
}

/**
 * Pan suave no mobile: centraliza pin + balão na área útil do mapa.
 * Mede a distância real pin→balão e ancora o topo do card abaixo dos toggles.
 */
function trackMapToMealPopup(map, marker) {
  if (!map || !marker) return

  const popup = marker.getPopup?.()
  const popupEl = popup?.getElement?.()
  const latlng = marker.getLatLng?.()
  if (!popupEl || !latlng) return

  const mapSize = map.getSize()
  if (!mapSize?.x || !mapSize?.y) return

  const padding = MOBILE_MEAL_POPUP_TRACK_PADDING
  const mapEl = map.getContainer()
  const mapRect = mapEl.getBoundingClientRect()
  const popupRect = popupEl.getBoundingClientRect()
  const markerPoint = map.latLngToContainerPoint(latlng)

  const popupTop = popupRect.top - mapRect.top
  const markerToPopupTop = popupTop - markerPoint.y

  const safeCenterX = padding.left + (mapSize.x - padding.left - padding.right) / 2
  const desiredPopupTop = padding.top + 6
  const targetMarkerY = desiredPopupTop - markerToPopupTop

  const dx = markerPoint.x - safeCenterX
  const dy = markerPoint.y - targetMarkerY

  if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return
  map.panBy([dx, dy], { animate: true, duration: 0.35 })
}

/** @param {boolean} isMobileMap */
function getMealPopupProps(isMobileMap) {
  if (isMobileMap) {
    return {
      className: 'goofly-map-stop-popup goofly-map-stop-popup--mobile goofly-map-stop-popup--meal',
      autoPan: false,
      offset: [0, -14],
    }
  }
  return {
    className: 'goofly-map-stop-popup goofly-map-stop-popup--meal',
    autoPan: true,
    autoPanPadding: [24, 24],
    offset: [0, -4],
  }
}

/**
 * Pin de refeição com balão Leaflet ancorado ao marcador.
 * Abre o popup ao receber destaque (ex.: "Ver no mapa" na timeline).
 */
function MealMapMarker({
  marker,
  idx,
  isHighlighted,
  isMobileMap = false,
  popupProps,
  onMealSlotFocus,
  onMealGoToTimeline,
  onMealViewOptions,
  onMealDismiss,
}) {
  const map = useMap()
  const markerRef = useRef(null)
  const skipCloseDismissRef = useRef(false)

  const trackPopup = useCallback(() => {
    if (!isMobileMap) return
    const run = () => trackMapToMealPopup(map, markerRef.current)
    requestAnimationFrame(() => {
      requestAnimationFrame(run)
    })
    // Pin cresce ao destacar — reajusta após o layout estabilizar.
    window.setTimeout(run, 130)
  }, [isMobileMap, map])

  useEffect(() => {
    if (!isHighlighted) return undefined
    const leafletMarker = markerRef.current
    if (!leafletMarker) return undefined
    skipCloseDismissRef.current = true
    const openTimer = setTimeout(() => {
      leafletMarker.openPopup()
      setTimeout(() => {
        skipCloseDismissRef.current = false
      }, 150)
    }, 60)
    return () => clearTimeout(openTimer)
  }, [isHighlighted])

  const armSkipCloseDismiss = () => {
    skipCloseDismissRef.current = true
    setTimeout(() => {
      skipCloseDismissRef.current = false
    }, 150)
  }

  return (
    <Marker
      ref={markerRef}
      position={marker.coords}
      icon={getMealIcon(marker.mealType, isHighlighted)}
      zIndexOffset={400}
      eventHandlers={{
        click: () => {
          armSkipCloseDismiss()
          if (typeof onMealSlotFocus === 'function') {
            onMealSlotFocus(marker.slotKey)
          }
        },
        popupopen: () => {
          trackPopup()
        },
        popupclose: () => {
          if (skipCloseDismissRef.current || typeof onMealDismiss !== 'function') return
          onMealDismiss()
        },
      }}
    >
      <Popup
        className={popupProps.className}
        offset={popupProps.offset}
        autoPan={popupProps.autoPan}
        autoPanPadding={popupProps.autoPanPadding}
      >
        <ItineraryMealMapPopup
          mealType={marker.mealType}
          name={marker.name}
          startTime={marker.startTime}
          mealPosition={marker.mealPosition}
          optionCount={marker.optionCount}
          onViewInTimeline={
            typeof onMealGoToTimeline === 'function'
              ? () => onMealGoToTimeline(marker.slotKey)
              : typeof onMealSlotFocus === 'function'
                ? () => onMealSlotFocus(marker.slotKey)
                : null
          }
          onViewOptions={
            typeof onMealViewOptions === 'function'
              ? () => onMealViewOptions(marker.slotKey)
              : null
          }
        />
      </Popup>
    </Marker>
  )
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
    popupAnchor: [0, -(size / 2 + 4)],
  })
}

/** @param {boolean} isMobileMap */
function getActivityPopupProps(isMobileMap) {
  if (isMobileMap) {
    return {
      className: 'goofly-map-stop-popup goofly-map-stop-popup--mobile',
      autoPan: false,
      offset: [0, 0],
    }
  }
  return {
    className: 'goofly-map-stop-popup',
    autoPan: true,
    autoPanPadding: [24, 24],
    offset: [0, -4],
  }
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

function getMealIcon(mealType, isHighlighted) {
  const size = isHighlighted ? 30 : 26
  return L.divIcon({
    className: isHighlighted
      ? 'goofly-itinerary-marker goofly-itinerary-marker--meal goofly-itinerary-marker--tracked'
      : 'goofly-itinerary-marker goofly-itinerary-marker--meal',
    html: buildMealMapMarkerHtml(mealType, isHighlighted),
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 2)],
  })
}

function shouldFetchDayRoute(activities, accommodations) {
  const named = countNamedActivities(activities)
  if (named >= 2) return true
  if (hasPlottableAccommodation(accommodations) && named >= 1) return true
  return false
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

function parseApiMealMarkers(routeData) {
  return (routeData?.mealMarkers || [])
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

const EMPTY_LOCAL_MARKERS = []

export function ItineraryDayMap({
  tripId,
  day,
  activities = [],
  timelineActivities = [],
  accommodations = [],
  mealSlots = [],
  selectedMealIds = {},
  disabled = false,
  routeRestricted = false,
  highlightedIndex = null,
  highlightedMealSlotKey = null,
  preferLocalRoute = false,
  className = '',
  ariaLabel = 'Mapa do roteiro do dia',
  mapLayoutWatch,
  showAccommodationRoutes = true,
  onShowAccommodationRoutesChange,
  showMealsOnMap = true,
  onShowMealsOnMapChange,
  onMealViewOptions,
  onMealSlotFocus,
  onMealGoToTimeline,
  onMealDismiss,
  isMobileMap = false,
}) {
  const [routeData, setRouteData] = useState(null)
  const [routeDay, setRouteDay] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fetchGenRef = useRef(0)

  const activitySig = useMemo(() => activitiesCacheSignature(activities), [activities])
  const mealSig = useMemo(
    () =>
      activitiesCacheSignature(
        (mealSlots || []).flatMap((slot) => slot.options || []),
      ),
    [mealSlots],
  )
  const mealSelectionSig = useMemo(
    () =>
      Object.entries(selectedMealIds || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('|'),
    [selectedMealIds],
  )
  const accSig = useMemo(() => accommodationsCacheSignature(accommodations), [accommodations])
  const dayNum = day != null ? Number(day) : null
  const allMealActivities = useMemo(
    () => (mealSlots || []).flatMap((slot) => slot.options || []),
    [mealSlots],
  )

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
      : cacheKey(tripId, dayNum, routeRestricted ? `${activitySig}|${mealSig}|${mealSelectionSig}` : `${mealSig}|${mealSelectionSig}`, accSig)
    const cached = routeCacheByKey.get(key)
    const combinedSig = `${activitySig}|${mealSig}|${mealSelectionSig}`
    if (
      cached &&
      cached.activitySig === combinedSig &&
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
            mealActivities: allMealActivities,
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
          routeCacheByKey.set(key, { data, activitySig: combinedSig })
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
  }, [tripId, dayNum, activitySig, mealSig, mealSelectionSig, accSig, disabled, preferLocalRoute, routeRestricted, activities, accommodations, allMealActivities])

  const routePayloadValid =
    routeData != null && routeDay === dayNum && routeDataMatchesDay(routeData, dayNum)

  const visibleActivityIds = useMemo(() => buildVisibleActivityIdSet(activities), [activities])

  const localMarkers = EMPTY_LOCAL_MARKERS
  const apiMarkers = useMemo(
    () => (routePayloadValid ? parseApiMarkers(routeData) : []),
    [routePayloadValid, routeData]
  )

  const apiRouteSafeForPreview = useMemo(() => {
    if (!routeRestricted || !routePayloadValid) return true
    return apiRouteMatchesVisibleActivities(routeData, visibleActivityIds)
  }, [routeRestricted, routePayloadValid, routeData, visibleActivityIds])

  const markers = useMemo(
    () =>
      resolveMapMarkers({
        localMarkers,
        apiMarkers,
        routeRestricted,
        apiRouteSafeForPreview,
        visibleActivityIds,
      }),
    [localMarkers, apiMarkers, routeRestricted, apiRouteSafeForPreview, visibleActivityIds],
  )

  const apiMealMarkers = useMemo(
    () => (routePayloadValid ? parseApiMealMarkers(routeData) : []),
    [routePayloadValid, routeData],
  )

  const visibleMealMarkers = useMemo(
    () => resolveVisibleMealMarkers(apiMealMarkers, mealSlots, selectedMealIds),
    [apiMealMarkers, mealSlots, selectedMealIds],
  )

  const mealLegPolylines = useMemo(() => {
    if (!showMealsOnMap || visibleMealMarkers.length === 0 || markers.length === 0) return []
    const orderedDay =
      timelineActivities.length > 0 ? timelineActivities : activities
    const markerByActivityId = new Map(
      markers.map((m) => [String(m.activityId ?? ''), m]),
    )
    return visibleMealMarkers
      .map((mealMarker) => {
        const slot = (mealSlots || []).find((s) => s.slotKey === mealMarker.slotKey)
        const mealAct =
          slot?.options?.find(
            (o) => String(o.id ?? o.placeId ?? o.place_id ?? '') === String(mealMarker.activityId),
          ) ?? null
        const anchorAct = mealAct
          ? resolveMealRouteAnchor(orderedDay, mealAct)
          : null
        const anchorId = String(anchorAct?.id ?? anchorAct?.placeId ?? anchorAct?.place_id ?? '')
        const anchorMarker = markerByActivityId.get(anchorId)
        if (!anchorMarker?.coords || !mealMarker.coords) return null
        return {
          slotKey: mealMarker.slotKey,
          positions: [anchorMarker.coords, mealMarker.coords],
        }
      })
      .filter(Boolean)
  }, [showMealsOnMap, visibleMealMarkers, markers, mealSlots, timelineActivities, activities])

  /** Galeria por activityId — mesmas URLs reais usadas nos cards do roteiro. */
  const imagesByActivityId = useMemo(() => {
    const map = new Map()
    for (const act of activities || []) {
      const id = String(act?.id ?? act?.placeId ?? act?.place_id ?? '')
      if (!id || map.has(id)) continue
      const urls = getRealPlaceImageUrls(act)
      if (urls.length > 0) map.set(id, urls)
    }
    return map
  }, [activities])

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

  const showMealsToggle =
    !disabled &&
    (mealSlots?.length ?? 0) > 0 &&
    typeof onShowMealsOnMapChange === 'function'

  const allCoords = useMemo(() => {
    const coords = markers.map((m) => m.coords)
    if (showMealsOnMap) {
      for (const meal of visibleMealMarkers) {
        if (meal?.coords) coords.push(meal.coords)
      }
    }
    for (const acc of mapAccommodations) {
      if (acc?.coords) coords.push(acc.coords)
    }
    return coords
  }, [markers, mapAccommodations, showMealsOnMap, visibleMealMarkers])

  const hasMapContent =
    markers.length > 0 || mapAccommodations.length > 0 || visibleMealMarkers.length > 0
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
    warnings.includes('geoapify_not_configured') ||
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
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Rotas: <a href="https://www.geoapify.com/">Geoapify</a>'
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
        {showMealsOnMap
          ? mealLegPolylines.map((leg) => (
              <Polyline
                key={`meal-leg-${leg.slotKey}`}
                positions={leg.positions}
                pathOptions={{
                  color: '#f59e0b',
                  weight: 3,
                  opacity: 0.75,
                  dashArray: '6 8',
                  className: 'goofly-meal-leg-polyline',
                }}
              />
            ))
          : null}
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
        {markers.map((m, idx) => {
          const imageUrls = imagesByActivityId.get(String(m.activityId ?? '')) || []
          const isHighlighted = highlightedIndex === idx
          const popupProps = getActivityPopupProps(isMobileMap)
          return (
            <Marker
              key={m.activityId || `${m.coords[0]}-${m.coords[1]}-${idx}`}
              position={m.coords}
              icon={getNumberedIcon(m.order ?? idx + 1, isHighlighted)}
            >
              <Popup
                className={popupProps.className}
                offset={popupProps.offset}
                autoPan={popupProps.autoPan}
                autoPanPadding={popupProps.autoPanPadding}
              >
                <ItineraryMapStopPopup
                  order={m.order ?? idx + 1}
                  name={m.name}
                  startTime={m.startTime}
                  imageUrls={imageUrls}
                />
              </Popup>
            </Marker>
          )
        })}
        {showMealsOnMap
          ? visibleMealMarkers.map((m, idx) => {
              const mealPopupProps = getMealPopupProps(isMobileMap)
              return (
                <MealMapMarker
                  key={m.activityId || `meal-${m.coords[0]}-${m.coords[1]}-${idx}`}
                  marker={m}
                  idx={idx}
                  isMobileMap={isMobileMap}
                  isHighlighted={
                    highlightedMealSlotKey != null && highlightedMealSlotKey === m.slotKey
                  }
                  popupProps={mealPopupProps}
                  onMealSlotFocus={onMealSlotFocus}
                  onMealGoToTimeline={onMealGoToTimeline}
                  onMealViewOptions={onMealViewOptions}
                  onMealDismiss={onMealDismiss}
                />
              )
            })
          : null}
        {isMobileMap && highlightedMealSlotKey != null && typeof onMealDismiss === 'function' ? (
          <DismissMealPopupOnMapClick active onDismiss={onMealDismiss} />
        ) : null}
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

      {showAccommodationRoutesToggle || showMealsToggle ? (
        <div className="absolute top-3 right-3 z-[500] flex flex-col items-end gap-2">
          {showMealsToggle ? (
            <MapMealsToggle checked={showMealsOnMap} onChange={onShowMealsOnMapChange} />
          ) : null}
          {showAccommodationRoutesToggle ? (
            <MapAccommodationRoutesToggle
              checked={showAccommodationRoutes}
              onChange={onShowAccommodationRoutesChange}
            />
          ) : null}
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
                : 'Nenhuma parada com nome para este dia.'}
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
            ) : routePayloadValid && routeSource === 'geoapify' ? (
              <p className="text-[10px] text-text-secondary mt-0.5 m-0">Rota a pé (Geoapify)</p>
            ) : null}
          </div>
          {warnings.includes('duplicate_coordinates') ? (
            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10px] text-amber-900 dark:text-amber-200 max-w-[11rem]">
              Várias paradas no mesmo ponto
            </div>
          ) : null}
          {warnings.includes('geocode_fallback_coordinates') ? (
            <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-1 text-[10px] text-amber-900 dark:text-amber-200 max-w-[11rem]">
              Algumas paradas usaram coordenadas salvas
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
