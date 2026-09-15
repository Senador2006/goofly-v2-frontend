import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { tripService } from '../../services/tripService'
import {
  readLatLng,
  formatRouteDistance,
  formatRouteDuration,
} from '../../utils/coordinates'
import { routeDataMatchesDay } from '../../utils/itineraryRouteDay'
import {
  apiRouteMatchesVisibleActivities,
  buildOptimisticMarkersFromActivities,
  buildVisibleActivityIdSet,
  mergeAccommodationsForMap,
  plottableAccommodationsFromProps,
  resolveLegPolylinePositions,
  resolveMapMarkers,
  resolvePolylinePositions,
  orderDaysForPrefetch,
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
import { ItineraryMealMapSheet } from './ItineraryMealMapSheet'
import { ItineraryStopMapSheet } from './ItineraryStopMapSheet'
import {
  buildMealMapMarkerHtml,
  resolveMealRouteAnchor,
  resolveVisibleMealMarkers,
} from '../../utils/itineraryMealHelpers'
import {
  buildLayoutPins,
  computePinLayout,
  buildAnimSafePinLayout,
  layoutPinId,
  pinZIndexOffset,
  stackedStopIdSet,
} from '../../utils/itineraryMapPinLayout'
import { slimActivitiesForRoutePreview } from '../../utils/itineraryPersistPayload'
import { ItineraryMapStopStackPopup } from './ItineraryMapStopStackPopup'

/**
 * RF04.3 — Mapa do roteiro por dia: pins numerados + rota (Geoapify).
 * Mostra coords locais enquanto a rota carrega; prefetch dos outros dias no cache.
 * Cache em memória por trip+dia; limpa via clearItineraryRouteCache após edições.
 */

const ROUTE_PROFILE = 'foot-walking'
const ROUTE_PREVIEW_DEBOUNCE_MS = 400
const PREFETCH_CONCURRENCY = 2

/** @type {Map<string, { data: object, activitySig: string }>} */
const routeCacheByKey = new Map()

/** Prefetch em voo / cancelamento por trip. */
let prefetchGeneration = 0

function cacheKey(tripId, day, accessSig = '', accSig = '') {
  const base = `${tripId}:${day}`
  const withAcc = accSig ? `${base}:acc:${accSig}` : base
  return accessSig ? `${withAcc}:${accessSig}` : withAcc
}

function draftCacheKey(tripId, day, accSig = '') {
  const base = `${tripId}:${day}:draft`
  return accSig ? `${base}:acc:${accSig}` : base
}

/** Chave estável do GET route (não draft): trip+dia+restrição. */
function dayRouteCacheKey(tripId, day, routeRestricted = false) {
  return cacheKey(tripId, day, routeRestricted ? 'restricted' : '', '')
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

/** Ordena dias para prefetch: vizinhos do atual primeiro, depois o restante. */
export { orderDaysForPrefetch }

/**
 * Pré-carrega rotas dos outros dias no cache em memória (concorrência baixa).
 * @param {string} tripId
 * @param {{ days?: number[], currentDay?: number, routeRestricted?: boolean, concurrency?: number }} options
 */
export function prefetchItineraryDayRoutes(tripId, options = {}) {
  if (!tripId) return () => {}
  const {
    days = [],
    currentDay,
    routeRestricted = false,
    concurrency = PREFETCH_CONCURRENCY,
  } = options
  const ordered = orderDaysForPrefetch(days, currentDay)
  if (ordered.length === 0) return () => {}

  const gen = ++prefetchGeneration
  let cancelled = false
  const cancel = () => {
    cancelled = true
  }

  const run = async () => {
    let idx = 0
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (!cancelled && gen === prefetchGeneration && idx < ordered.length) {
        const day = ordered[idx]
        idx += 1
        const key = dayRouteCacheKey(tripId, day, routeRestricted)
        if (routeCacheByKey.has(key)) continue
        try {
          const data = await tripService.getItineraryRoute(tripId, {
            day,
            profile: ROUTE_PROFILE,
          })
          if (cancelled || gen !== prefetchGeneration) return
          if (!routeDataMatchesDay(data, day)) continue
          routeCacheByKey.set(key, { data, activitySig: 'prefetch' })
        } catch {
          // Prefetch best-effort; o dia ainda pode carregar sob demanda.
        }
      }
    })
    await Promise.all(workers)
  }

  void run()
  return cancel
}

function coordsSignature(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return ''
  return coords
    .map((c) => {
      if (!Array.isArray(c) || c.length < 2) return ''
      return `${Number(c[0]).toFixed(5)},${Number(c[1]).toFixed(5)}`
    })
    .filter(Boolean)
    .join('|')
}

/** Leaflet explode com `Invalid LatLng` se receber NaN no render do Marker/Polyline. */
function isFiniteLatLng(c) {
  return (
    Array.isArray(c) &&
    c.length >= 2 &&
    Number.isFinite(Number(c[0])) &&
    Number.isFinite(Number(c[1]))
  )
}

/**
 * Enquadra paradas/hospedagens. Usa flyTo* em mudanças posteriores (ex.: troca de dia)
 * para evitar salto brusco de zoom.
 * @param {{ coords: number[][], enabled?: boolean }} props
 */
function FitBoundsToPoints({ coords, enabled = true }) {
  const map = useMap()
  const prevSigRef = useRef('')
  const sig = coordsSignature(coords)

  useEffect(() => {
    if (!enabled) return
    if (!coords || coords.length === 0) {
      if (prevSigRef.current) {
        map.setView([20, 0], 2)
        prevSigRef.current = ''
      }
      return
    }
    if (sig === prevSigRef.current) return
    const hadPrevious = Boolean(prevSigRef.current)
    prevSigRef.current = sig

    if (coords.length === 1) {
      if (!hadPrevious) map.setView(coords[0], 14)
      else map.flyTo(coords[0], Math.max(map.getZoom(), 12), { duration: 0.65 })
      return
    }
    const bounds = L.latLngBounds(coords)
    const opts = { padding: [48, 48], maxZoom: 15 }
    if (!hadPrevious) map.fitBounds(bounds, opts)
    else map.flyToBounds(bounds, { ...opts, duration: 0.7 })
  }, [map, coords, sig, enabled])

  return null
}

/**
 * Quando a opção de restaurante muda, acompanha o pin com pan/fly suave
 * sem refazer o fitBounds de todo o dia (que “tirava o zoom”).
 */
function SoftTrackMealSelection({ mealMarkers, dayKey }) {
  const map = useMap()
  const dayRef = useRef(dayKey)
  const prevBySlotRef = useRef(new Map())

  const mealSig = useMemo(
    () =>
      (mealMarkers || [])
        .map((m) => {
          const slot = String(m?.slotKey ?? '')
          const c = m?.coords
          if (!slot || !Array.isArray(c) || c.length < 2) return ''
          return `${slot}@${Number(c[0]).toFixed(5)},${Number(c[1]).toFixed(5)}`
        })
        .filter(Boolean)
        .join('|'),
    [mealMarkers],
  )

  useEffect(() => {
    const nextMap = new Map()
    for (const m of mealMarkers || []) {
      const slot = String(m?.slotKey ?? '')
      const c = m?.coords
      if (!slot || !Array.isArray(c) || c.length < 2) continue
      nextMap.set(slot, [Number(c[0]), Number(c[1])])
    }

    if (dayRef.current !== dayKey) {
      dayRef.current = dayKey
      prevBySlotRef.current = nextMap
      return
    }

    let moved = null
    for (const [slot, coords] of nextMap) {
      const prev = prevBySlotRef.current.get(slot)
      if (
        prev &&
        (Math.abs(prev[0] - coords[0]) > 1e-6 || Math.abs(prev[1] - coords[1]) > 1e-6)
      ) {
        moved = coords
        break
      }
    }
    prevBySlotRef.current = nextMap
    if (!moved) return

    // flyTo único no mesmo framing do popup — evita panTo + panBy em cascata.
    flyMapToPoint(map, moved, {
      padding: DESKTOP_POPUP_FOCUS_PADDING,
      minZoom: PIN_FOCUS_MIN_ZOOM,
      duration: 0.45,
    })
  }, [map, mealMarkers, mealSig, dayKey])

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

/** Fecha destaque / sheet ao tocar no mapa (área vazia), sem bloquear pan/zoom. */
function DismissOnMapClick({ active, onDismiss }) {
  const map = useMap()
  useEffect(() => {
    if (!active || typeof onDismiss !== 'function') return undefined
    const handler = (e) => {
      // Clique em pin/popup não é "fundo" — senão fecha o que acabou de abrir.
      const target = e?.originalEvent?.target
      if (
        target &&
        typeof target.closest === 'function' &&
        target.closest(
          '.leaflet-marker-icon, .leaflet-popup, .leaflet-control, .goofly-map-stop-popup',
        )
      ) {
        return
      }
      onDismiss()
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map, active, onDismiss])
  return null
}

/** Área útil no mobile: chrome topo + peek card na base do mapa. */
const MOBILE_MEAL_SHEET_TRACK_PADDING = {
  top: 52,
  right: 44,
  bottom: 72,
  left: 16,
}

/** Stack sheet com carrossel: reserva espaço acima do peek. */
const MOBILE_STOP_SHEET_TRACK_PADDING = {
  top: 52,
  right: 44,
  bottom: 148,
  left: 16,
}

/** Padding do balão desktop (toggles no topo). */
const DESKTOP_POPUP_FOCUS_PADDING = {
  top: 56,
  right: 24,
  bottom: 32,
  left: 24,
}

/** Zoom mínimo ao focar pin (parada / refeição) — um único flyTo. */
const PIN_FOCUS_MIN_ZOOM = 15
const PIN_FOCUS_DURATION = 0.42

/** @deprecated alias — prefer PIN_FOCUS_MIN_ZOOM */
const MOBILE_MEAL_FOCUS_MIN_ZOOM = PIN_FOCUS_MIN_ZOOM

/**
 * Um único flyTo: coloca `latlng` no centro da área útil e sobe o zoom.
 * Substitui a sequência antiga panTo → idle → panBy (popup abre, depois câmera).
 */
function flyMapToPoint(
  map,
  latlng,
  {
    padding = DESKTOP_POPUP_FOCUS_PADDING,
    minZoom = PIN_FOCUS_MIN_ZOOM,
    duration = PIN_FOCUS_DURATION,
    /** Y do pin no container (px); default = centro vertical da área útil */
    targetY = null,
    /** Stacks: só pan/framing — não sobe o zoom */
    lockZoom = false,
  } = {},
) {
  if (!map || !latlng) return
  const mapSize = map.getSize()
  if (!mapSize?.x || !mapSize?.y) return

  const curZoom = Number(map.getZoom()) || 0
  const zoom = lockZoom ? curZoom : Math.max(curZoom, minZoom)
  const safeCenterX = padding.left + (mapSize.x - padding.left - padding.right) / 2
  const safeCenterY =
    targetY != null
      ? targetY
      : padding.top + (mapSize.y - padding.top - padding.bottom) / 2

  const projected = map.project(latlng, zoom)
  const targetCenter = map.unproject(
    L.point(
      projected.x + (mapSize.x / 2 - safeCenterX),
      projected.y + (mapSize.y / 2 - safeCenterY),
    ),
    zoom,
  )

  const cur = map.getCenter()
  if (
    Number.isFinite(curZoom) &&
    Math.abs(curZoom - zoom) < 0.08 &&
    Math.abs(cur.lat - targetCenter.lat) < 2e-5 &&
    Math.abs(cur.lng - targetCenter.lng) < 2e-5
  ) {
    return
  }

  map.flyTo(targetCenter, zoom, { duration, easeLinearity: 0.25 })
}

/**
 * Desktop: mede pin→balão e faz um flyTo (zoom + framing) — sem panBy atrasado.
 * @param {object} [opts]
 * @param {[number, number]|{lat:number,lng:number}|null} [opts.focusLatLng]
 *   Coords verdadeiras (meals): evita voar ao offset lateral e ficar “no vazio”
 *   quando o layout recolhe no zoom final.
 * @param {boolean} [opts.lockZoom] stacks — sem zoom-in
 */
function flyMapToMarkerPopup(map, marker, opts = {}) {
  if (!map || !marker) return

  const popup = marker.getPopup?.()
  const popupEl = popup?.getElement?.()
  const markerLatLng = marker.getLatLng?.()
  if (!markerLatLng) return

  const focusLatLng = opts.focusLatLng || markerLatLng
  const padding = { ...DESKTOP_POPUP_FOCUS_PADDING }
  let targetY = null

  if (popupEl) {
    const mapEl = map.getContainer()
    const mapRect = mapEl.getBoundingClientRect()
    const popupRect = popupEl.getBoundingClientRect()
    // Offset pin→topo do balão em px (âncora DOM); medir no marker atual.
    const markerPoint = map.latLngToContainerPoint(markerLatLng)
    const popupTop = popupRect.top - mapRect.top
    const markerToPopupTop = popupTop - markerPoint.y
    const desiredPopupTop = padding.top + 6
    targetY = desiredPopupTop - markerToPopupTop
  }

  flyMapToPoint(map, focusLatLng, {
    padding,
    targetY,
    lockZoom: Boolean(opts.lockZoom),
  })
}

/** @deprecated use flyMapToMarkerPopup — mantido para leituras/testes legados */
function trackMapToMarkerPopup(map, marker) {
  flyMapToMarkerPopup(map, marker)
}

/**
 * Mobile — um flyTo (zoom + área acima do sheet). Sem timer + panTo + panBy em cascata.
 */
function FocusHighlightedMealPin({ mealMarkers, slotKey, frameNonce = 0 }) {
  const map = useMap()
  const lastFramedRef = useRef(null)
  const focusSig = useMemo(() => {
    if (slotKey == null) return ''
    const m = (mealMarkers || []).find((x) => String(x.slotKey) === String(slotKey))
    if (!m?.coords) return String(slotKey)
    return `${slotKey}:${m.activityId ?? ''}:${Number(m.coords[0]).toFixed(5)},${Number(m.coords[1]).toFixed(5)}`
  }, [mealMarkers, slotKey])

  useEffect(() => {
    if (!slotKey || !focusSig) return undefined
    const frameId = `${frameNonce}:${focusSig}`
    if (lastFramedRef.current === frameId) return undefined

    const meal = (mealMarkers || []).find((x) => String(x.slotKey) === String(slotKey))
    if (!meal?.coords) return undefined

    lastFramedRef.current = frameId
    try {
      map.invalidateSize()
    } catch {
      /* ignore */
    }
    flyMapToPoint(map, meal.coords, {
      padding: MOBILE_MEAL_SHEET_TRACK_PADDING,
      minZoom: PIN_FOCUS_MIN_ZOOM,
    })
    return undefined
  }, [map, slotKey, focusSig, frameNonce, mealMarkers])

  return null
}

/**
 * Mobile — enquadra o pin da parada/stack acima do bottom sheet ao abrir o peek.
 */
function FocusMobileStopSheetPin({ coords, focusKey, isStack = false }) {
  const map = useMap()
  const lastKeyRef = useRef(null)

  useEffect(() => {
    if (!coords || !focusKey) return undefined
    if (lastKeyRef.current === focusKey) return undefined

    lastKeyRef.current = focusKey
    try {
      map.invalidateSize()
    } catch {
      /* ignore */
    }
    const padding = isStack
      ? MOBILE_STOP_SHEET_TRACK_PADDING
      : MOBILE_MEAL_SHEET_TRACK_PADDING
    flyMapToPoint(map, coords, {
      padding,
      minZoom: PIN_FOCUS_MIN_ZOOM,
      lockZoom: isStack,
    })
    return undefined
  }, [map, coords, focusKey, isStack])

  return null
}

function getMealPopupProps() {
  // Desktop: autoPan do Leaflet é abrupto; framing fica no flyMapToMarkerPopup (popupopen).
  return {
    className: 'goofly-map-stop-popup goofly-map-stop-popup--meal',
    autoPan: false,
    autoPanPadding: [24, 24],
    offset: [0, -4],
  }
}

/**
 * Recalcula layout de pins (stacks + offset lateral) em zoom/pan.
 * Durante pan/fly usa buildAnimSafePinLayout: stacks e offsets congelados
 * (exceto quando true coords mudam, ex. troca de restaurante).
 */
function mapIsAnimating(map) {
  return Boolean(map?._flyToFrame || map?._panAnim || map?._animatingZoom)
}

function PinOverlapLayoutSync({ pins, onLayout }) {
  const map = useMap()
  const timerRef = useRef(null)
  const animSafeActiveRef = useRef(false)
  const lastFullLayoutRef = useRef({ entries: new Map(), stacks: [] })

  useEffect(() => {
    if (typeof onLayout !== 'function') return undefined

    const runFull = () => {
      animSafeActiveRef.current = false
      const result = computePinLayout(pins, {
        project: (ll) => {
          if (!isFiniteLatLng(ll)) return { x: 0, y: 0 }
          const p = map.latLngToLayerPoint(L.latLng(ll[0], ll[1]))
          return { x: p.x, y: p.y }
        },
        unproject: (pt) => {
          const ll = map.layerPointToLatLng(L.point(pt.x, pt.y))
          const out = [ll.lat, ll.lng]
          return isFiniteLatLng(out) ? out : [0, 0]
        },
      })
      lastFullLayoutRef.current = result
      onLayout(result)
    }

    const runAnimSafe = () => {
      if (animSafeActiveRef.current) return
      animSafeActiveRef.current = true
      onLayout(buildAnimSafePinLayout(pins, lastFullLayoutRef.current))
    }

    const scheduleFull = () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(runFull, 50)
    }

    const onMoveStart = () => {
      animSafeActiveRef.current = false
    }

    const onMove = () => {
      if (mapIsAnimating(map)) runAnimSafe()
    }

    const onMoveEnd = () => scheduleFull()

    if (mapIsAnimating(map)) runAnimSafe()
    else runFull()

    map.on('movestart', onMoveStart)
    map.on('move', onMove)
    map.on('zoomend', scheduleFull)
    map.on('moveend', onMoveEnd)
    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
      map.off('movestart', onMoveStart)
      map.off('move', onMove)
      map.off('zoomend', scheduleFull)
      map.off('moveend', onMoveEnd)
    }
  }, [map, pins, onLayout])

  return null
}

/**
 * Marker de parada/stack no desktop com fly único do balão (autoPan: false).
 * No mobile o caller passa eventHandlers de click → bottom sheet e sem Popup.
 */
function DesktopTrackedStopMarker({
  position,
  icon,
  zIndexOffset,
  eventHandlers,
  popupProps,
  onMealDismiss = null,
  /** Stacks: framing sem zoom-in */
  lockZoom = false,
  children,
}) {
  const map = useMap()
  const markerRef = useRef(null)
  const focusRafRef = useRef(0)

  useEffect(() => {
    return () => {
      if (focusRafRef.current) cancelAnimationFrame(focusRafRef.current)
    }
  }, [])

  const mergedHandlers = useMemo(() => {
    const focusOnOpen = () => {
      if (!popupProps || popupProps.autoPan !== false) return
      if (focusRafRef.current) cancelAnimationFrame(focusRafRef.current)
      // 1 frame: popup já tem layout; flyTo único (zoom + framing), sem idle→panBy.
      focusRafRef.current = requestAnimationFrame(() => {
        focusRafRef.current = 0
        flyMapToMarkerPopup(map, markerRef.current, { lockZoom })
      })
    }
    return {
      ...(eventHandlers || {}),
      click: (e) => {
        // Libera o destaque da refeição antes do focus — senão o meal
        // pode reabrir o balão e fechar o popup da parada/stack.
        if (typeof onMealDismiss === 'function') onMealDismiss()
        eventHandlers?.click?.(e)
      },
      popupopen: (e) => {
        if (typeof onMealDismiss === 'function') onMealDismiss()
        eventHandlers?.popupopen?.(e)
        focusOnOpen()
      },
    }
  }, [map, eventHandlers, popupProps, onMealDismiss, lockZoom])

  return (
    <Marker
      ref={markerRef}
      position={position}
      icon={icon}
      zIndexOffset={zIndexOffset}
      eventHandlers={mergedHandlers}
    >
      {children}
    </Marker>
  )
}

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
  onMealDismissIfSlot = null,
  position = null,
  zIndexOffset = 200,
}) {
  const map = useMap()
  const markerRef = useRef(null)
  const skipCloseDismissRef = useRef(false)
  const focusRafRef = useRef(0)

  const focusPopup = useCallback(() => {
    if (isMobileMap) return
    if (focusRafRef.current) cancelAnimationFrame(focusRafRef.current)
    focusRafRef.current = requestAnimationFrame(() => {
      focusRafRef.current = 0
      // Voar às coords verdadeiras — não ao offset lateral (senão no zoom final
      // o pin recolhe e a câmera fica no vazio).
      flyMapToMarkerPopup(map, markerRef.current, {
        focusLatLng: marker.coords,
      })
    })
  }, [map, isMobileMap, marker.coords])

  useEffect(() => {
    return () => {
      if (focusRafRef.current) cancelAnimationFrame(focusRafRef.current)
    }
  }, [])

  useEffect(() => {
    // Mobile usa bottom sheet — sem balão Leaflet.
    if (isMobileMap || !isHighlighted) return undefined
    const leafletMarker = markerRef.current
    if (!leafletMarker) return undefined
    skipCloseDismissRef.current = true
    // Abre já no frame seguinte — sem atraso de 60ms antes do fly.
    const openRaf = requestAnimationFrame(() => {
      leafletMarker.openPopup()
      setTimeout(() => {
        skipCloseDismissRef.current = false
      }, 200)
    })
    return () => cancelAnimationFrame(openRaf)
    // NÃO incluir `position` (offset de layout): pan/animSafe muda displayLatLng
    // e reabria o meal por cima do popup de parada/stack.
  }, [isHighlighted, isMobileMap, marker.activityId, marker.coords])

  const armSkipCloseDismiss = () => {
    skipCloseDismissRef.current = true
    setTimeout(() => {
      skipCloseDismissRef.current = false
    }, 150)
  }

  return (
    <Marker
      ref={markerRef}
      position={position || marker.coords}
      icon={getMealIcon(marker.mealType, isHighlighted)}
      zIndexOffset={zIndexOffset}
      eventHandlers={{
        click: () => {
          armSkipCloseDismiss()
          if (typeof onMealSlotFocus === 'function') {
            onMealSlotFocus(marker.slotKey)
          }
        },
        popupopen: () => {
          focusPopup()
        },
        popupclose: () => {
          if (isMobileMap || skipCloseDismissRef.current) return
          // Só limpa se este slot ainda for o destacado — meal A→B não apaga o B.
          if (typeof onMealDismissIfSlot === 'function') {
            onMealDismissIfSlot(marker.slotKey)
            return
          }
          if (typeof onMealDismiss === 'function') onMealDismiss()
        },
      }}
    >
      {!isMobileMap && popupProps ? (
        <Popup
          className={popupProps.className}
          offset={popupProps.offset}
          autoPan={popupProps.autoPan}
          autoPanPadding={popupProps.autoPanPadding}
          closeOnClick={false}
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
      ) : null}
    </Marker>
  )
}

/** Cache de DivIcon — react-leaflet chama setIcon se a ref mudar a cada render. */
const markerIconCache = new Map()

function cachedDivIcon(cacheKey, factory) {
  let icon = markerIconCache.get(cacheKey)
  if (!icon) {
    icon = factory()
    markerIconCache.set(cacheKey, icon)
  }
  return icon
}

function getNumberedIcon(order, isHighlighted) {
  // Tamanho constante: highlight só no anel — evita deslocar popupAnchor.
  const size = 28
  const fontSize = 11
  const cacheKey = `stop:${order}:${isHighlighted ? 1 : 0}`
  return cachedDivIcon(cacheKey, () => {
    const ring = isHighlighted
      ? '0 0 0 3px #fff, 0 0 0 7px #FEC641, 0 0 18px 4px rgba(254,198,65,0.85)'
      : '0 0 0 2px #fff, 0 0 0 4px rgba(254,198,65,0.45)'
    return L.divIcon({
      className: isHighlighted
        ? 'goofly-itinerary-marker goofly-itinerary-marker--tracked'
        : 'goofly-itinerary-marker',
      html:
        `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:800;color:#1c1c0d;background:#FEC641;box-shadow:${ring};">` +
        String(order) +
        '</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    })
  })
}

/** Pin de stack: número da parada selecionada + badge com quantidade. */
function getStackedStopIcon(order, count, isHighlighted) {
  const size = 28
  const fontSize = 11
  const cacheKey = `stack:${order}:${count}:${isHighlighted ? 1 : 0}`
  return cachedDivIcon(cacheKey, () => {
    const ring = isHighlighted
      ? '0 0 0 3px #fff, 0 0 0 7px #FEC641, 0 0 18px 4px rgba(254,198,65,0.85)'
      : '0 0 0 2px #fff, 0 0 0 4px rgba(254,198,65,0.45)'
    const badge =
      count > 1
        ? `<span style="position:absolute;top:-4px;right:-6px;min-width:16px;height:16px;padding:0 4px;border-radius:9999px;background:#1c1c0d;color:#FEC641;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #fff;line-height:1;">${count}</span>`
        : ''
    return L.divIcon({
      className: isHighlighted
        ? 'goofly-itinerary-marker goofly-itinerary-marker--stack goofly-itinerary-marker--tracked'
        : 'goofly-itinerary-marker goofly-itinerary-marker--stack',
      html:
        `<div style="position:relative;width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:800;color:#1c1c0d;background:#FEC641;box-shadow:${ring};">` +
        String(order) +
        badge +
        '</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    })
  })
}

/** Props do balão Leaflet de parada (desktop). Mobile usa bottom sheet. */
function getActivityPopupProps() {
  // Igual meals: autoPan do Leaflet remonta stacks no meio da animação.
  // Framing + zoom ficam no flyMapToMarkerPopup (popupopen → flyTo único).
  return {
    className: 'goofly-map-stop-popup',
    autoPan: false,
    autoPanPadding: [24, 24],
    offset: [0, -4],
  }
}

function getHomeIcon(homeOrder = null) {
  const size = 28
  const showNumber = homeOrder != null && homeOrder > 1
  const inner = showNumber ? String(homeOrder) : '⌂'
  const fontSize = showNumber ? 11 : 15
  const cacheKey = `home:${showNumber ? homeOrder : 0}`
  return cachedDivIcon(cacheKey, () =>
    L.divIcon({
      className: 'goofly-itinerary-marker goofly-itinerary-marker--home',
      html:
        `<div style="width:${size}px;height:${size}px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:800;color:#fff;background:#16a34a;box-shadow:0 0 0 2px #fff,0 0 0 4px rgba(22,163,74,0.45);">` +
        inner +
        '</div>',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -10],
    }),
  )
}

function getMealIcon(mealType, isHighlighted) {
  const size = 28
  const cacheKey = `meal:${mealType || ''}:${isHighlighted ? 1 : 0}`
  return cachedDivIcon(cacheKey, () =>
    L.divIcon({
      className: isHighlighted
        ? 'goofly-itinerary-marker goofly-itinerary-marker--meal goofly-itinerary-marker--tracked'
        : 'goofly-itinerary-marker goofly-itinerary-marker--meal',
      html: buildMealMapMarkerHtml(mealType, isHighlighted),
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 2)],
    }),
  )
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
  prefetchGeneration += 1
  if (!tripId) return
  const prefix = `${tripId}:`
  for (const key of [...routeCacheByKey.keys()]) {
    if (key.startsWith(prefix)) routeCacheByKey.delete(key)
  }
}

export function ItineraryDayMap({
  tripId,
  day,
  days: prefetchDaysProp = [],
  activities = [],
  timelineActivities = [],
  accommodations = [],
  mealSlots = [],
  selectedMealIds = {},
  disabled = false,
  routeRestricted = false,
  highlightedIndex = null,
  highlightedMealSlotKey = null,
  mealMapFrameNonce = 0,
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
  onMealDismissIfSlot = null,
  isMobileMap = false,
}) {
  const [routeData, setRouteData] = useState(null)
  const [routeDay, setRouteDay] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pinLayout, setPinLayout] = useState(() => ({
    entries: new Map(),
    stacks: [],
  }))
  /** @type {[Record<string, string>, Function]} */
  const [stackSelection, setStackSelection] = useState({})
  /**
   * Mobile: peek sheet de parada/stack (sem balão Leaflet).
   * Snapshot de coords/memberIds evita o sheet sumir se o layout animar.
   * @type {[{
   *   kind: 'stop' | 'stack',
   *   id: string,
   *   coords?: [number, number] | null,
   *   memberIds?: string[],
   * } | null, Function]}
   */
  const [mobileStopFocus, setMobileStopFocus] = useState(null)
  const [mobileStopFrameNonce, setMobileStopFrameNonce] = useState(0)
  const fetchGenRef = useRef(0)

  const onPinLayout = useCallback((result) => {
    setPinLayout({
      entries: result?.entries instanceof Map ? result.entries : new Map(),
      stacks: Array.isArray(result?.stacks) ? result.stacks : [],
    })
  }, [])

  const selectStackMember = useCallback((stackId, pinId) => {
    setStackSelection((prev) => {
      if (prev[stackId] === pinId) return prev
      return { ...prev, [stackId]: pinId }
    })
  }, [])

  const dismissMobileStopSheet = useCallback(() => {
    setMobileStopFocus(null)
  }, [])

  const openMobileStopSheet = useCallback(
    (focus) => {
      if (!focus?.kind || !focus?.id) return
      if (typeof onMealDismiss === 'function') onMealDismiss()
      setMobileStopFocus({
        kind: focus.kind,
        id: focus.id,
        coords: Array.isArray(focus.coords) ? focus.coords : null,
        memberIds: Array.isArray(focus.memberIds) ? focus.memberIds : undefined,
      })
      setMobileStopFrameNonce((n) => n + 1)
    },
    [onMealDismiss],
  )

  useEffect(() => {
    setMobileStopFocus(null)
  }, [day, tripId])

  useEffect(() => {
    if (highlightedMealSlotKey != null) setMobileStopFocus(null)
  }, [highlightedMealSlotKey])

  const activitySig = useMemo(() => activitiesCacheSignature(activities), [activities])
  const mealSig = useMemo(
    () =>
      activitiesCacheSignature(
        (mealSlots || []).flatMap((slot) => slot.options || []),
      ),
    [mealSlots],
  )
  const accSig = useMemo(() => accommodationsCacheSignature(accommodations), [accommodations])
  const dayNum = day != null ? Number(day) : null
  const allMealActivities = useMemo(
    () => (mealSlots || []).flatMap((slot) => slot.options || []),
    [mealSlots],
  )
  const prefetchDaysSig = useMemo(
    () =>
      (Array.isArray(prefetchDaysProp) ? prefetchDaysProp : [])
        .map(Number)
        .filter((d) => Number.isFinite(d) && d >= 1)
        .join(','),
    [prefetchDaysProp],
  )
  const prefetchDaysList = useMemo(
    () =>
      prefetchDaysSig
        ? prefetchDaysSig.split(',').map(Number)
        : [],
    [prefetchDaysSig],
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

    // mealSelection NÃO entra na key: a API devolve todos os mealMarkers;
    // a opção ativa é filtrada no client (resolveVisibleMealMarkers).
    const key = preferLocalRoute
      ? draftCacheKey(tripId, dayNum, accSig)
      : dayRouteCacheKey(tripId, dayNum, routeRestricted)
    const cached = routeCacheByKey.get(key)
    const combinedSig = `${activitySig}|${mealSig}`
    if (cached && routeDataMatchesDay(cached.data, dayNum)) {
      // Draft: ainda valida assinatura das activities (renomear / editar).
      if (!preferLocalRoute || cached.activitySig === combinedSig) {
        setRouteData(cached.data)
        setRouteDay(dayNum)
        setLoading(false)
        setError(null)
        let cancelPrefetch = () => {}
        if (!preferLocalRoute && prefetchDaysList.length > 1) {
          cancelPrefetch = prefetchItineraryDayRoutes(tripId, {
            days: prefetchDaysList,
            currentDay: dayNum,
            routeRestricted,
          })
        }
        return () => {
          cancelPrefetch()
        }
      }
      routeCacheByKey.delete(key)
    }
    if (cached && !routeDataMatchesDay(cached.data, dayNum)) {
      routeCacheByKey.delete(key)
    }

    const gen = ++fetchGenRef.current
    let cancelled = false
    let cancelPrefetch = () => {}

    const runFetch = () => {
      if (cancelled || fetchGenRef.current !== gen) return

      setRouteData(null)
      setRouteDay(null)
      setLoading(true)
      setError(null)

      // Prefetch dos outros dias assim que o dia atual começa a carregar.
      if (!preferLocalRoute && prefetchDaysList.length > 1) {
        cancelPrefetch = prefetchItineraryDayRoutes(tripId, {
          days: prefetchDaysList,
          currentDay: dayNum,
          routeRestricted,
        })
      }

      const request = preferLocalRoute
        ? tripService.previewItineraryRoute(tripId, {
            day: dayNum,
            profile: ROUTE_PROFILE,
            activities: slimActivitiesForRoutePreview(activities),
            mealActivities: slimActivitiesForRoutePreview(allMealActivities),
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
          routeCacheByKey.set(key, {
            data,
            activitySig: preferLocalRoute ? combinedSig : 'live',
          })
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
      cancelPrefetch()
    }
  }, [tripId, dayNum, activitySig, mealSig, accSig, disabled, preferLocalRoute, routeRestricted, activities, accommodations, allMealActivities, prefetchDaysList])

  const routePayloadValid =
    routeData != null && routeDay === dayNum && routeDataMatchesDay(routeData, dayNum)

  const visibleActivityIds = useMemo(() => buildVisibleActivityIdSet(activities), [activities])

  const localMarkers = useMemo(() => {
    if (routePayloadValid) return []
    return buildOptimisticMarkersFromActivities(activities)
  }, [routePayloadValid, activities])
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

  /** Enquadramento base: sem meals — troca de restaurante não dispara fitBounds. */
  const fitCoords = useMemo(() => {
    const coords = markers.map((m) => m.coords)
    for (const acc of mapAccommodations) {
      if (acc?.coords) coords.push(acc.coords)
    }
    return coords
  }, [markers, mapAccommodations])

  const layoutPins = useMemo(
    () =>
      buildLayoutPins({
        markers,
        mealMarkers: visibleMealMarkers,
        accommodations: mapAccommodations,
        showMeals: showMealsOnMap,
      }),
    [markers, visibleMealMarkers, mapAccommodations, showMealsOnMap],
  )

  const pinEntries =
    pinLayout?.entries instanceof Map ? pinLayout.entries : new Map()
  const pinStacks = Array.isArray(pinLayout?.stacks) ? pinLayout.stacks : []

  const stackedIds = useMemo(() => stackedStopIdSet(pinStacks), [pinStacks])

  const markerByPinId = useMemo(() => {
    const map = new Map()
    markers.forEach((m, idx) => {
      const id = layoutPinId('stop', m.activityId, m.coords, idx)
      map.set(id, { marker: m, idx })
    })
    return map
  }, [markers])

  // Se a timeline destaca uma parada que está num stack, seleciona essa parada no pin.
  useEffect(() => {
    if (highlightedIndex == null || !markers[highlightedIndex]) return
    const m = markers[highlightedIndex]
    const pinId = layoutPinId('stop', m.activityId, m.coords, highlightedIndex)
    const entry = pinEntries.get(pinId)
    if (!entry?.stackId) return
    setStackSelection((prev) => {
      if (prev[entry.stackId] === pinId) return prev
      return { ...prev, [entry.stackId]: pinId }
    })
  }, [highlightedIndex, markers, pinEntries])

  const highlightedMealPinId = useMemo(() => {
    if (highlightedMealSlotKey == null) return null
    const idx = visibleMealMarkers.findIndex(
      (m) => String(m.slotKey) === String(highlightedMealSlotKey),
    )
    if (idx < 0) return null
    const m = visibleMealMarkers[idx]
    return layoutPinId('meal', m.activityId ?? m.slotKey, m.coords, idx)
  }, [highlightedMealSlotKey, visibleMealMarkers])

  const pinLeaderLines = useMemo(() => {
    const lines = []
    for (const [id, entry] of pinEntries) {
      if (!entry?.isOffset || !isFiniteLatLng(entry.trueLatLng) || !isFiniteLatLng(entry.displayLatLng)) {
        continue
      }
      // Meal em foco ancora nas coords verdadeiras — sem linha do offset.
      if (highlightedMealPinId && id === highlightedMealPinId) continue
      const kind = id.startsWith('meal:') ? 'meal' : id.startsWith('home:') ? 'home' : 'stop'
      lines.push({
        id,
        kind,
        positions: [entry.trueLatLng, entry.displayLatLng],
      })
    }
    return lines
  }, [pinEntries, highlightedMealPinId])

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

  const highlightedMealMarker = useMemo(() => {
    if (highlightedMealSlotKey == null) return null
    return (
      visibleMealMarkers.find(
        (m) => String(m.slotKey) === String(highlightedMealSlotKey),
      ) ?? null
    )
  }, [highlightedMealSlotKey, visibleMealMarkers])

  const showMealSheet =
    isMobileMap && showMealsOnMap && highlightedMealMarker != null

  const mobileStopSheetData = useMemo(() => {
    if (!isMobileMap || !mobileStopFocus) return null
    if (mobileStopFocus.kind === 'stack') {
      const stack = pinStacks.find((s) => s.stackId === mobileStopFocus.id)
      const memberIds =
        (stack?.memberIds?.length ? stack.memberIds : null) ||
        mobileStopFocus.memberIds ||
        []
      const members = memberIds
        .map((pinId) => {
          const hit = markerByPinId.get(pinId)
          if (!hit) return null
          const { marker: m, idx } = hit
          return {
            pinId,
            order: m.order ?? idx + 1,
            name: m.name,
            startTime: m.startTime,
            imageUrls: imagesByActivityId.get(String(m.activityId ?? '')) || [],
          }
        })
        .filter(Boolean)
      if (members.length === 0) return null
      const selectedPinId =
        stackSelection[mobileStopFocus.id] &&
        members.some((m) => m.pinId === stackSelection[mobileStopFocus.id])
          ? stackSelection[mobileStopFocus.id]
          : members[0].pinId
      const selected = members.find((m) => m.pinId === selectedPinId) || members[0]
      return {
        kind: 'stack',
        stackId: mobileStopFocus.id,
        coords:
          stack?.displayLatLng ||
          mobileStopFocus.coords ||
          markerByPinId.get(selected.pinId)?.marker?.coords ||
          null,
        members,
        selectedPinId,
        selected,
      }
    }
    const hit = markerByPinId.get(mobileStopFocus.id)
    if (!hit) return null
    const { marker: m, idx } = hit
    const layoutEntry = pinEntries.get(mobileStopFocus.id)
    return {
      kind: 'stop',
      pinId: mobileStopFocus.id,
      coords:
        layoutEntry?.displayLatLng ||
        mobileStopFocus.coords ||
        m.coords,
      members: null,
      selectedPinId: mobileStopFocus.id,
      selected: {
        pinId: mobileStopFocus.id,
        order: m.order ?? idx + 1,
        name: m.name,
        startTime: m.startTime,
        imageUrls: imagesByActivityId.get(String(m.activityId ?? '')) || [],
      },
    }
  }, [
    isMobileMap,
    mobileStopFocus,
    pinStacks,
    markerByPinId,
    stackSelection,
    imagesByActivityId,
    pinEntries,
  ])

  const showStopSheet = Boolean(mobileStopSheetData) && !showMealSheet

  // Abertura pelo roteiro: não faz FitBounds do dia (evita pan→fit→pan).
  // O MapContainer já nasce no pin; o Focus só faz o soft pan/settle como no desktop.
  const mobileMealFrameCoords =
    isMobileMap && mealMapFrameNonce > 0 && highlightedMealMarker?.coords
      ? highlightedMealMarker.coords
      : null

  // Evita FitBounds brigando com soft-track de popup/sheet.
  const suppressDayFit =
    Boolean(mobileMealFrameCoords) ||
    Boolean(showStopSheet) ||
    (isMobileMap && showMealSheet) ||
    (!isMobileMap && highlightedMealSlotKey != null)

  const mapInstanceKey = String(tripId || 'none')

  return (
    <div
      className={`relative w-full h-full min-h-[280px] ${className}`}
      role="region"
      aria-label={ariaLabel}
    >
      <MapContainer
        key={mapInstanceKey}
        center={mobileMealFrameCoords || [20, 0]}
        zoom={mobileMealFrameCoords ? MOBILE_MEAL_FOCUS_MIN_ZOOM : 2}
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
        <PinOverlapLayoutSync pins={layoutPins} onLayout={onPinLayout} />
        {pinLeaderLines.map((line) => (
          <Polyline
            key={`pin-leader-${line.id}`}
            positions={line.positions}
            pathOptions={{
              color: line.kind === 'meal' ? '#f59e0b' : '#94a3b8',
              weight: 1.5,
              opacity: 0.7,
              dashArray: '3 5',
              interactive: false,
              className: 'goofly-pin-leader-polyline',
            }}
          />
        ))}
        {mapAccommodations.map((acc, accIdx) => {
          const pinId = layoutPinId('home', acc.id, acc.coords, accIdx)
          const layoutEntry = pinEntries.get(pinId)
          const displayPos = isFiniteLatLng(layoutEntry?.displayLatLng)
            ? layoutEntry.displayLatLng
            : acc.coords
          if (!isFiniteLatLng(displayPos)) return null
          return (
          <Marker
            key={acc.id || `home-${acc.coords[0]}-${acc.coords[1]}-${accIdx}`}
            position={displayPos}
            icon={getHomeIcon(showHomeNumbers ? accIdx + 1 : null)}
            zIndexOffset={pinZIndexOffset({
              kind: 'home',
              sideIndex: layoutEntry?.sideIndex ?? accIdx,
            })}
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
          )
        })}
        {pinStacks.map((stack) => {
          const members = (stack.memberIds || [])
            .map((pinId) => {
              const hit = markerByPinId.get(pinId)
              if (!hit) return null
              const { marker: m, idx } = hit
              return {
                pinId,
                order: m.order ?? idx + 1,
                name: m.name,
                startTime: m.startTime,
                imageUrls: imagesByActivityId.get(String(m.activityId ?? '')) || [],
                idx,
              }
            })
            .filter(Boolean)
          if (members.length === 0) return null
          const selectedPinId =
            stackSelection[stack.stackId] &&
            members.some((m) => m.pinId === stackSelection[stack.stackId])
              ? stackSelection[stack.stackId]
              : members[0].pinId
          const selected = members.find((m) => m.pinId === selectedPinId) || members[0]
          const isHighlighted =
            (highlightedIndex != null && members.some((m) => m.idx === highlightedIndex)) ||
            (isMobileMap &&
              mobileStopFocus?.kind === 'stack' &&
              mobileStopFocus.id === stack.stackId)
          const popupProps = isMobileMap ? null : getActivityPopupProps()
          const markerProps = {
            position: stack.displayLatLng,
            icon: getStackedStopIcon(selected.order, members.length, isHighlighted),
            zIndexOffset: pinZIndexOffset({
              kind: 'stop',
              order: selected.order,
              isHighlighted,
              isStack: true,
            }),
            eventHandlers: isMobileMap
              ? {
                  click: () =>
                    openMobileStopSheet({
                      kind: 'stack',
                      id: stack.stackId,
                      coords: stack.displayLatLng,
                      memberIds: stack.memberIds,
                    }),
                }
              : undefined,
          }
          const popupNode =
            !isMobileMap && popupProps ? (
              <Popup
                className={popupProps.className}
                offset={popupProps.offset}
                autoPan={popupProps.autoPan}
                autoPanPadding={popupProps.autoPanPadding}
              >
                <ItineraryMapStopStackPopup
                  members={members}
                  selectedPinId={selectedPinId}
                  onSelect={(pinId) => selectStackMember(stack.stackId, pinId)}
                />
              </Popup>
            ) : null
          if (isMobileMap) {
            return (
              <Marker key={stack.stackId} {...markerProps}>
                {popupNode}
              </Marker>
            )
          }
          return (
            <DesktopTrackedStopMarker
              key={stack.stackId}
              {...markerProps}
              popupProps={popupProps}
              onMealDismiss={onMealDismiss}
              lockZoom
            >
              {popupNode}
            </DesktopTrackedStopMarker>
          )
        })}
        {markers.map((m, idx) => {
          const pinId = layoutPinId('stop', m.activityId, m.coords, idx)
          if (stackedIds.has(pinId)) return null
          const imageUrls = imagesByActivityId.get(String(m.activityId ?? '')) || []
          const isHighlighted =
            highlightedIndex === idx ||
            (isMobileMap &&
              mobileStopFocus?.kind === 'stop' &&
              mobileStopFocus.id === pinId)
          const popupProps = isMobileMap ? null : getActivityPopupProps()
          const layoutEntry = pinEntries.get(pinId)
          const displayPos = layoutEntry?.displayLatLng ?? m.coords
          const markerProps = {
            position: displayPos,
            icon: getNumberedIcon(m.order ?? idx + 1, isHighlighted),
            zIndexOffset: pinZIndexOffset({
              kind: 'stop',
              order: m.order ?? idx + 1,
              isHighlighted,
            }),
            eventHandlers: isMobileMap
              ? {
                  click: () =>
                    openMobileStopSheet({
                      kind: 'stop',
                      id: pinId,
                      coords: displayPos,
                    }),
                }
              : undefined,
          }
          const popupNode =
            !isMobileMap && popupProps ? (
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
            ) : null
          const markerKey = m.activityId || `${m.coords[0]}-${m.coords[1]}-${idx}`
          if (isMobileMap) {
            return (
              <Marker key={markerKey} {...markerProps}>
                {popupNode}
              </Marker>
            )
          }
          return (
            <DesktopTrackedStopMarker
              key={markerKey}
              {...markerProps}
              popupProps={popupProps}
              onMealDismiss={onMealDismiss}
            >
              {popupNode}
            </DesktopTrackedStopMarker>
          )
        })}
        {showMealsOnMap
          ? visibleMealMarkers.map((m, idx) => {
              const mealPopupProps = isMobileMap ? null : getMealPopupProps()
              const pinId = layoutPinId('meal', m.activityId ?? m.slotKey, m.coords, idx)
              const layoutEntry = pinEntries.get(pinId)
              const isHighlighted =
                highlightedMealSlotKey != null && highlightedMealSlotKey === m.slotKey
              return (
                <MealMapMarker
                  key={String(m.slotKey || `meal-${idx}`)}
                  marker={m}
                  idx={idx}
                  isMobileMap={isMobileMap}
                  // Em foco: ancora na posição real (offset lateral some no zoom e deixava a câmera no vazio).
                  position={isHighlighted ? m.coords : (layoutEntry?.displayLatLng ?? m.coords)}
                  zIndexOffset={pinZIndexOffset({
                    kind: 'meal',
                    sideIndex: layoutEntry?.sideIndex ?? idx,
                    isHighlighted,
                  })}
                  isHighlighted={isHighlighted}
                  popupProps={mealPopupProps}
                  onMealSlotFocus={onMealSlotFocus}
                  onMealGoToTimeline={onMealGoToTimeline}
                  onMealViewOptions={onMealViewOptions}
                  onMealDismiss={onMealDismiss}
                  onMealDismissIfSlot={onMealDismissIfSlot}
                />
              )
            })
          : null}
        {highlightedMealSlotKey != null && typeof onMealDismiss === 'function' ? (
          <DismissOnMapClick active onDismiss={onMealDismiss} />
        ) : null}
        {showStopSheet ? (
          <DismissOnMapClick active onDismiss={dismissMobileStopSheet} />
        ) : null}
        <FitBoundsToPoints coords={fitCoords} enabled={!suppressDayFit} />
        {showMealsOnMap && !isMobileMap ? (
          <SoftTrackMealSelection
            mealMarkers={visibleMealMarkers}
            dayKey={`${tripId}:${dayNum ?? ''}`}
          />
        ) : null}
        {showMealsOnMap && isMobileMap && highlightedMealSlotKey != null ? (
          <FocusHighlightedMealPin
            mealMarkers={visibleMealMarkers}
            slotKey={highlightedMealSlotKey}
            frameNonce={mealMapFrameNonce}
          />
        ) : null}
        {showStopSheet && mobileStopSheetData?.coords && mobileStopFrameNonce > 0 ? (
          <FocusMobileStopSheetPin
            coords={mobileStopSheetData.coords}
            focusKey={`${mobileStopFrameNonce}:${mobileStopSheetData.kind}:${
              mobileStopSheetData.kind === 'stack'
                ? mobileStopSheetData.stackId
                : mobileStopSheetData.pinId
            }`}
            isStack={mobileStopSheetData.kind === 'stack'}
          />
        ) : null}
        <MapInvalidateSize
          watch={`${mapInstanceKey}-${markers.length}-${activitySig}-${mapLayoutWatch ?? ''}`}
        />
      </MapContainer>

      {dayNum != null && !disabled ? (
        <div
          className={
            isMobileMap
              ? 'pointer-events-none absolute top-2.5 left-12 z-[1000]'
              : 'pointer-events-none absolute top-3 left-14 z-[1000]'
          }
        >
          <span
            className={
              isMobileMap
                ? 'text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/88 dark:bg-card-dark/88 border border-border-light/80 dark:border-border-dark/80 shadow-sm text-foreground dark:text-white'
                : 'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-white/92 dark:bg-card-dark/92 border border-border-light dark:border-border-dark shadow-sm text-foreground dark:text-white'
            }
          >
            Dia {dayNum}
          </span>
        </div>
      ) : null}

      {showAccommodationRoutesToggle || showMealsToggle ? (
        <div
          className={
            isMobileMap
              ? 'absolute top-2.5 right-2.5 z-[500] flex flex-col items-end gap-1.5'
              : 'absolute top-3 right-3 z-[500] flex flex-col items-end gap-2'
          }
        >
          {showMealsToggle ? (
            <MapMealsToggle
              checked={showMealsOnMap}
              onChange={onShowMealsOnMapChange}
              compact={isMobileMap}
            />
          ) : null}
          {showAccommodationRoutesToggle ? (
            <MapAccommodationRoutesToggle
              checked={showAccommodationRoutes}
              onChange={onShowAccommodationRoutesChange}
              compact={isMobileMap}
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

      {!disabled && hasMapContent && !showMealSheet && !showStopSheet ? (
        <div
          className={
            isMobileMap
              ? 'absolute bottom-2.5 left-2.5 right-2.5 z-[500] flex flex-wrap items-end gap-1.5 pointer-events-none'
              : 'absolute bottom-3 left-3 right-3 z-[500] flex flex-wrap items-end gap-2 pointer-events-none'
          }
        >
          <div
            className={
              isMobileMap
                ? 'rounded-lg bg-white/88 dark:bg-card-dark/88 backdrop-blur border border-border-light/80 dark:border-border-dark/80 shadow-sm px-2.5 py-1.5 text-[11px]'
                : 'rounded-xl bg-white/92 dark:bg-card-dark/92 backdrop-blur border border-border-light dark:border-border-dark shadow-md px-3 py-2 text-xs'
            }
          >
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
              Algumas paradas sem coordenadas precisas
            </div>
          ) : null}
        </div>
      ) : null}

      {showMealSheet ? (
        <ItineraryMealMapSheet
          mealType={highlightedMealMarker.mealType}
          name={highlightedMealMarker.name}
          startTime={highlightedMealMarker.startTime}
          optionCount={highlightedMealMarker.optionCount}
          onDismiss={typeof onMealDismiss === 'function' ? onMealDismiss : null}
          onViewOptions={
            typeof onMealViewOptions === 'function'
              ? () => onMealViewOptions(highlightedMealMarker.slotKey)
              : null
          }
        />
      ) : null}

      {showStopSheet && mobileStopSheetData ? (
        <ItineraryStopMapSheet
          order={mobileStopSheetData.selected.order}
          name={mobileStopSheetData.selected.name}
          startTime={mobileStopSheetData.selected.startTime}
          imageUrls={mobileStopSheetData.selected.imageUrls || []}
          stackMembers={
            mobileStopSheetData.kind === 'stack' ? mobileStopSheetData.members : null
          }
          selectedPinId={mobileStopSheetData.selectedPinId}
          onSelectStackMember={
            mobileStopSheetData.kind === 'stack'
              ? (pinId) => selectStackMember(mobileStopSheetData.stackId, pinId)
              : null
          }
          onDismiss={dismissMobileStopSheet}
        />
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
