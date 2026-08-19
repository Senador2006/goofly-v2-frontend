import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { EmptyState } from '../common/EmptyState'
import { placeService } from '../../services/placeService'
import { getPlaceCoverImageUrl, getPlaceVideoUrls } from '../../utils/placeImages'
import { buildTdvLikePlaceData } from '../../utils/tdvLikePlaceData'
import {
  clearTdvDeckSession,
  readTdvDeckSession,
  saveTdvDeckSession,
} from '../../utils/tdvDeckSession'
import { getRequestErrorMessage } from '../../utils/errors'
import { useT } from '../../i18n'
import { PlaceCardGallery } from './PlaceCardGallery'

function getPlaceId(p) {
  return p?.id ?? p?.placeId ?? p?.place_id
}

/** Mescla listas de lugares por id; itens locais prevalecem (swipes recentes). */
function mergePlaceListsById(incoming, local) {
  const map = new Map()
  for (const p of incoming || []) {
    const id = String(getPlaceId(p) || '').trim()
    if (id) map.set(id, p)
  }
  for (const p of local || []) {
    const id = String(getPlaceId(p) || '').trim()
    if (id) map.set(id, p)
  }
  return [...map.values()]
}

function videoLinkLabel(url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host.includes('instagram.com')) return 'Instagram'
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube'
    if (host.includes('tiktok.com')) return 'TikTok'
    if (host.includes('vimeo.com')) return 'Vimeo'
    return host
  } catch {
    return 'Link'
  }
}

/** Antecipa prefetch com ~1 lote de folga (3–5 cartas); nunca esperar baralho zerar. */
const PREFETCH_WHEN_REMAINING_AT_MOST = 5
/** Teto de cartas no baralho local (espelha TDV_CACHE_MAX do servidor). */
const DECK_MAX_PLACES = 15
/** Retentativas quando o baralho esvazia aguardando resposta do agente (máx. 3; n8n já retornou vazio → sem retry). */
const EMPTY_DECK_PREFETCH_MAX_ATTEMPTS = 3
const EMPTY_DECK_PREFETCH_RETRY_MS = 2000
/** free_cap com issued < 10: race de re-cache — retry curto, não latchear paywall. */
const FREE_CAP_SOFT_RETRY_MAX = 2
const FREE_CAP_SOFT_RETRY_MS = 400
const FREE_CAP_MAX_PLACES = 10

function isHardFreeCap(res, swipeCount = 0) {
  if (res?.placesSource !== 'free_cap') return false
  // Paywall = 10 swipes (curtidas+descartes). Prefetch/issued sozinho não bloqueia.
  const swiped = res?.tdvLimit?.placesSwiped
  if (typeof swiped === 'number') return swiped >= FREE_CAP_MAX_PLACES
  return swipeCount >= FREE_CAP_MAX_PLACES
}

function tdvIntroStorageKey(tripId) {
  return `goofly:tdv-intro:${tripId}`
}

function tdvModifyIntroStorageKey(tripId) {
  return `goofly:tdv-modify-intro:${tripId}`
}

function readIntroAcknowledged(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(tdvIntroStorageKey(tripId)) === '1'
  } catch {
    return false
  }
}

function writeIntroAcknowledged(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(tdvIntroStorageKey(tripId), '1')
  } catch {
    /* ignore quota / private mode */
  }
}

function readModifyIntroAcknowledged(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return false
  try {
    return sessionStorage.getItem(tdvModifyIntroStorageKey(tripId)) === '1'
  } catch {
    return false
  }
}

function writeModifyIntroAcknowledged(tripId) {
  if (!tripId || typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(tdvModifyIntroStorageKey(tripId), '1')
  } catch {
    /* ignore */
  }
}

/**
 * TDV — layout fixo sem scroll de página: card relativo à viewport + barra inferior
 * com undo / dislike / like / finalizar. Histórico na lateral (lg+) ou sheet (mobile).
 *
 * @param {'planning' | 'postUnlock'} [tdvMode]
 */
export function TinderView({
  tripId,
  trip,
  onItineraryUpdate,
  isActive,
  onTdvSatisfied,
  onModifyRoteiro,
  onRequestClose,
  finalizingTdv = false,
  tdvMode = 'planning',
  warnTdvLockOnGenerate = false,
}) {
  const t = useT()
  const navigate = useNavigate()
  const isPostUnlock = tdvMode === 'postUnlock'
  const [places, setPlaces] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalLikes, setTotalLikes] = useState(0)
  const [likedPlaces, setLikedPlaces] = useState([])
  const [dislikedPlaces, setDislikedPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [introAcknowledged, setIntroAcknowledged] = useState(() =>
    isPostUnlock ? readModifyIntroAcknowledged(tripId) : readIntroAcknowledged(tripId),
  )
  const [introReady, setIntroReady] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [sheetDragY, setSheetDragY] = useState(0)
  const [sheetDragging, setSheetDragging] = useState(false)
  const [sheetDismissing, setSheetDismissing] = useState(false)
  const sheetDragRef = useRef(null)
  const sheetPanelRef = useRef(null)
  const sheetDismissingRef = useRef(false)
  const sheetDismissTimerRef = useRef(null)
  const [prefetchLoading, setPrefetchLoading] = useState(false)
  const [error, setError] = useState(null)
  const [swipeFeedback, setSwipeFeedback] = useState(null)
  /** Pilha LIFO: desfazer só a última curtida/descarte (espelha o servidor). */
  const [undoStack, setUndoStack] = useState([])
  const [undoLoading, setUndoLoading] = useState(false)
  const [undoNotice, setUndoNotice] = useState(null)
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false)
  const [balloonLockWarnOpen, setBalloonLockWarnOpen] = useState(false)
  const [panelLockWarnOpen, setPanelLockWarnOpen] = useState(false)
  const [freeCapLockWarnOpen, setFreeCapLockWarnOpen] = useState(false)
  const undoBusyRef = useRef(false)
  const finalizeConfirmRef = useRef(null)

  const SHEET_DISMISS_PX = 88
  const SHEET_DISMISS_MS = 340
  const SHEET_DRAG_START_PX = 6
  const SHEET_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

  const closeMobilePanel = useCallback(() => {
    setMobilePanelOpen(false)
    setSheetDragY(0)
    setSheetDragging(false)
    setSheetDismissing(false)
    sheetDismissingRef.current = false
    sheetDragRef.current = null
  }, [])

  const runSheetDismiss = useCallback(() => {
    if (sheetDismissingRef.current) return
    sheetDismissingRef.current = true
    setSheetDismissing(true)
    setSheetDragging(false)

    const panelH = sheetPanelRef.current?.offsetHeight
    const exitY = (panelH && panelH > 0 ? panelH : Math.round(window.innerHeight * 0.92)) + 32

    // 1º frame: liga a transition (sai de dragging); 2º: alvo off-screen — evita “corte” no meio.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setSheetDragY(exitY)
      })
    })

    if (sheetDismissTimerRef.current != null) window.clearTimeout(sheetDismissTimerRef.current)
    sheetDismissTimerRef.current = window.setTimeout(() => {
      closeMobilePanel()
    }, SHEET_DISMISS_MS)
  }, [closeMobilePanel])

  useEffect(() => {
    if (!mobilePanelOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    setSheetDragY(0)
    setSheetDragging(false)
    setSheetDismissing(false)
    sheetDismissingRef.current = false
    return () => {
      document.body.style.overflow = prev
      if (sheetDismissTimerRef.current != null) {
        window.clearTimeout(sheetDismissTimerRef.current)
        sheetDismissTimerRef.current = null
      }
    }
  }, [mobilePanelOpen])

  const onSheetHeaderPointerDown = (e) => {
    if (sheetDismissingRef.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (e.target?.closest?.('button')) return
    e.stopPropagation()
    sheetDragRef.current = { y: e.clientY, pointerId: e.pointerId, active: false }
    setSheetDragging(true)
    try {
      e.currentTarget.setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const onSheetHeaderPointerMove = (e) => {
    const start = sheetDragRef.current
    if (!start || start.pointerId !== e.pointerId || sheetDismissingRef.current) return
    const dy = e.clientY - start.y
    if (!start.active) {
      if (Math.abs(dy) < SHEET_DRAG_START_PX) return
      start.active = true
    }
    setSheetDragY(Math.max(0, dy))
  }

  const endSheetHeaderDrag = (e, { cancelled = false } = {}) => {
    const start = sheetDragRef.current
    sheetDragRef.current = null
    if (!start || cancelled || sheetDismissingRef.current) {
      setSheetDragging(false)
      if (!sheetDismissingRef.current) setSheetDragY(0)
      return
    }
    const dy = e.clientY - start.y
    if (start.active && dy >= SHEET_DISMISS_PX) {
      runSheetDismiss()
      return
    }
    // Volta com transition (não no mesmo paint que dragging=true).
    setSheetDragging(false)
    requestAnimationFrame(() => {
      setSheetDragY(0)
    })
  }

  const onSheetHeaderPointerUp = (e) => {
    if (sheetDragRef.current?.pointerId != null && e.pointerId !== sheetDragRef.current.pointerId) {
      return
    }
    endSheetHeaderDrag(e)
  }

  const onSheetHeaderPointerCancel = (e) => {
    endSheetHeaderDrag(e, { cancelled: true })
  }

  const prefetchInFlightRef = useRef(false)
  /** Tamanho do baralho logo após o último `discoverSession` (ignora append de prefetch). */
  const sessionDeckBaselineRef = useRef(0)
  /** Após like/dislike que remove carta; volta a false no próximo session load ou undo que restaura o baseline. */
  const consumedSinceSessionRef = useRef(false)
  const loadGenRef = useRef(0)
  const loadAbortRef = useRef(null)
  const prefetchGenRef = useRef(0)
  const prefetchAbortRef = useRef(null)
  const prefetchEmptyAttemptsRef = useRef(0)
  const freeCapSoftRetryRef = useRef(0)
  const freeCapSoftRetryTimerRef = useRef(null)
  const [emptyDeckRetryTick, setEmptyDeckRetryTick] = useState(0)
  const [placesSource, setPlacesSource] = useState(null)
  const [deckUnavailable, setDeckUnavailable] = useState(false)
  const [freeCapReached, setFreeCapReached] = useState(false)

  const placesRef = useRef(places)
  const tripIdRef = useRef(tripId)
  placesRef.current = places
  tripIdRef.current = tripId

  const releaseDeckToServer = useCallback(async (targetTripId = tripIdRef.current, opts = {}) => {
    const deck = placesRef.current
    if (!targetTripId || deck.length === 0) return
    // Sync primeiro: sobrevive a navegação SPA mesmo se o POST for abortado.
    saveTdvDeckSession(targetTripId, deck)
    try {
      await placeService.cacheSkippedPlaces(targetTripId, deck, {
        keepalive: Boolean(opts.keepalive),
      })
    } catch {
      // best-effort: cartas não consumidas voltam ao cache no servidor
    }
  }, [])
  const currentPlace = places[currentIndex]
  const placeVideoLinks = useMemo(
    () => (currentPlace ? getPlaceVideoUrls(currentPlace) : []),
    [currentPlace]
  )

  // Mantém backup do baralho a cada mudança (troca de rota SPA / remount).
  // Não limpa no mount com places=[] — isso apagaria o backup antes do loadPlaces.
  const hadDeckRef = useRef(false)
  useEffect(() => {
    if (!tripId) return
    if (places.length > 0) {
      hadDeckRef.current = true
      saveTdvDeckSession(tripId, places)
    } else if (hadDeckRef.current && consumedSinceSessionRef.current) {
      clearTdvDeckSession(tripId)
      hadDeckRef.current = false
    }
  }, [tripId, places])

  const applyFreeCapFromResponse = useCallback((res, listLength, swipeCount = 0) => {
    if (listLength > 0) {
      freeCapSoftRetryRef.current = 0
      setFreeCapReached(false)
      return { hard: false, softRetry: false }
    }
    if (res?.placesSource !== 'free_cap') {
      freeCapSoftRetryRef.current = 0
      setFreeCapReached(false)
      return { hard: false, softRetry: false }
    }
    const swiped = res?.tdvLimit?.placesSwiped ?? swipeCount
    if (swiped < FREE_CAP_MAX_PLACES) {
      // Prefetch/issued esgotado sem 10 swipes — não é paywall.
      setFreeCapReached(false)
      if (freeCapSoftRetryRef.current >= FREE_CAP_SOFT_RETRY_MAX) {
        return { hard: false, softRetry: false }
      }
      freeCapSoftRetryRef.current += 1
      return { hard: false, softRetry: true }
    }
    if (isHardFreeCap(res, swipeCount)) {
      freeCapSoftRetryRef.current = 0
      setFreeCapReached(true)
      return { hard: true, softRetry: false }
    }
    setFreeCapReached(false)
    return { hard: false, softRetry: false }
  }, [])

  const loadPlaces = useCallback(async () => {
    if (!tripId) {
      setLoading(false)
      return
    }
    loadAbortRef.current?.abort()
    if (freeCapSoftRetryTimerRef.current) {
      clearTimeout(freeCapSoftRetryTimerRef.current)
      freeCapSoftRetryTimerRef.current = null
    }
    const ac = new AbortController()
    loadAbortRef.current = ac
    const gen = ++loadGenRef.current
    prefetchEmptyAttemptsRef.current = 0

    const localDeck = readTdvDeckSession(tripId)
    // Preferir baralho local (free e pago): ao sair da viagem o agente unlocked
    // devolveria um lote novo e apagaria o ponto onde o usuário parou.
    if (localDeck.length > 0) {
      const restoredFromSession = true
      sessionDeckBaselineRef.current = localDeck.length
      consumedSinceSessionRef.current = false
      hadDeckRef.current = true
      setPlaces(localDeck)
      setUndoStack([])
      setPlacesSource(restoredFromSession ? 'cache' : null)
      setFreeCapReached(false)
      setDeckUnavailable(false)
      setCurrentIndex(0)
      setIntroReady(true)
      setLoading(false)
      setError(null)
      placeService
        .getTdvSummary(tripId)
        .then((summary) => {
          if (gen !== loadGenRef.current) return
          const likedFromRes = Array.isArray(summary.likedPlaces) ? summary.likedPlaces : []
          const dislikedFromRes = Array.isArray(summary.dislikedPlaces)
            ? summary.dislikedPlaces
            : []
          const likesCount = summary.likesCount ?? likedFromRes.length
          if (consumedSinceSessionRef.current) {
            setLikedPlaces((prev) => mergePlaceListsById(likedFromRes, prev))
            setDislikedPlaces((prev) => mergePlaceListsById(dislikedFromRes, prev))
            setTotalLikes((prev) => Math.max(Number(prev) || 0, likesCount))
            return
          }
          setLikedPlaces(likedFromRes)
          setDislikedPlaces(dislikedFromRes)
          setTotalLikes(likesCount)
        })
        .catch(() => {})
      return
    }

    setLoading(true)
    setIntroReady(false)
    setError(null)
    try {
      const res = await placeService.discoverSession(tripId, undefined, { signal: ac.signal })
      if (gen !== loadGenRef.current) return

      const likedFromRes = Array.isArray(res.likedPlaces) ? res.likedPlaces : []
      const dislikedFromRes = Array.isArray(res.dislikedPlaces) ? res.dislikedPlaces : []
      const swipedIds = new Set(
        [...likedFromRes, ...dislikedFromRes]
          .map((p) => String(p?.placeId || p?.place_id || p?.id || '').trim())
          .filter(Boolean)
      )

      const localDeck = readTdvDeckSession(tripId).filter((p) => {
        const id = String(getPlaceId(p) || '').trim()
        return id && !swipedIds.has(id)
      })
      const serverList = Array.isArray(res.places) ? res.places : []

      // Preferir baralho local (free e pago): ao sair da viagem o agente unlocked
      // devolveria um lote novo e apagaria o ponto onde o usuário parou.
      let list
      let restoredFromSession = false
      if (localDeck.length > 0) {
        list = localDeck
        restoredFromSession = true
        placeService.cacheSkippedPlaces(tripId, localDeck).catch(() => {})
        saveTdvDeckSession(tripId, localDeck)
      } else {
        list = serverList
        if (list.length > 0) saveTdvDeckSession(tripId, list)
        else clearTdvDeckSession(tripId)
      }

      sessionDeckBaselineRef.current = list.length
      consumedSinceSessionRef.current = false
      setPlaces(list)
      setUndoStack([])
      setTotalLikes(res.totalLikes ?? 0)
      setLikedPlaces(likedFromRes)
      setDislikedPlaces(dislikedFromRes)
      setPlacesSource(restoredFromSession ? 'cache' : res.placesSource ?? null)
      const swipeCount = likedFromRes.length + dislikedFromRes.length
      const { softRetry, hard } = applyFreeCapFromResponse(
        restoredFromSession ? { ...res, placesSource: 'cache' } : res,
        list.length,
        swipeCount
      )
      if (hard && list.length === 0) clearTdvDeckSession(tripId)
      setDeckUnavailable(
        list.length === 0 && !restoredFromSession && res.placesSource === 'none'
      )
      setCurrentIndex(0)
      setIntroReady(true)
      if (softRetry && !restoredFromSession) {
        freeCapSoftRetryTimerRef.current = window.setTimeout(() => {
          freeCapSoftRetryTimerRef.current = null
          if (gen === loadGenRef.current) loadPlaces()
        }, FREE_CAP_SOFT_RETRY_MS)
      }
    } catch (err) {
      if (gen !== loadGenRef.current) return
      const aborted =
        ac.signal.aborted ||
        err.code === 'ERR_CANCELED' ||
        err.name === 'CanceledError' ||
        err.message === 'canceled'
      if (aborted) return
      // Rede falhou ao voltar: ainda tenta o backup local.
      const localDeck = readTdvDeckSession(tripId)
      if (localDeck.length > 0) {
        setPlaces(localDeck)
        setFreeCapReached(false)
        setDeckUnavailable(false)
        setCurrentIndex(0)
        setIntroReady(true)
        setError(null)
        return
      }
      setIntroReady(false)
      setError(getRequestErrorMessage(err))
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }, [tripId, applyFreeCapFromResponse])

  const lastTripIdRef = useRef(null)
  useEffect(() => {
    if (lastTripIdRef.current !== tripId) {
      const prevTripId = lastTripIdRef.current
      if (prevTripId != null && placesRef.current.length > 0) {
        releaseDeckToServer(prevTripId)
      }
      lastTripIdRef.current = tripId
      setPlaces([])
      setCurrentIndex(0)
      setLikedPlaces([])
      setDislikedPlaces([])
      setTotalLikes(0)
      setPlacesSource(null)
      setDeckUnavailable(false)
      setFreeCapReached(false)
      freeCapSoftRetryRef.current = 0
      setError(null)
      setUndoStack([])
      setIntroAcknowledged(
        isPostUnlock ? readModifyIntroAcknowledged(tripId) : readIntroAcknowledged(tripId),
      )
      setIntroReady(false)
      sessionDeckBaselineRef.current = 0
      consumedSinceSessionRef.current = false
      hadDeckRef.current = false
    }
  }, [tripId, releaseDeckToServer, isPostUnlock])

  // Persistência ao sair da viagem / fechar aba: keepalive para o POST completar.
  useEffect(() => {
    if (!tripId) return undefined
    return () => {
      releaseDeckToServer(tripId, { keepalive: true })
    }
  }, [tripId, releaseDeckToServer])

  useEffect(() => {
    const onPageHide = () => {
      releaseDeckToServer(undefined, { keepalive: true })
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [releaseDeckToServer])

  useEffect(() => {
    return () => {
      if (freeCapSoftRetryTimerRef.current) {
        clearTimeout(freeCapSoftRetryTimerRef.current)
        freeCapSoftRetryTimerRef.current = null
      }
    }
  }, [])

  const deckKey = places
    .map((p) => getPlaceId(p))
    .filter(Boolean)
    .sort()
    .join('|')
  useEffect(() => {
    prefetchEmptyAttemptsRef.current = 0
  }, [deckKey])

  const handleRetryDeck = useCallback(() => {
    if (finalizingTdv || freeCapReached) return
    prefetchEmptyAttemptsRef.current = 0
    freeCapSoftRetryRef.current = 0
    setDeckUnavailable(false)
    loadPlaces()
  }, [finalizingTdv, freeCapReached, loadPlaces])

  // Carrega ao ativar a aba / mudar viagem. Com deck local, reexibe na hora (sem discover).
  useEffect(() => {
    if (!isActive || !tripId) return
    if (placesRef.current.length > 0) return
    loadPlaces()
  }, [isActive, tripId, loadPlaces])

  // Após unlock do planejamento, busca novos batches além do limite free (uma vez).
  const planningUnlockedAt = trip?.planning_unlocked_at ?? trip?.planningUnlockedAt ?? null
  const unlockReloadDoneRef = useRef(false)
  useEffect(() => {
    unlockReloadDoneRef.current = false
  }, [tripId])
  useEffect(() => {
    if (!isActive || !tripId || !planningUnlockedAt || !freeCapReached) return
    if (unlockReloadDoneRef.current) return
    unlockReloadDoneRef.current = true
    setFreeCapReached(false)
    freeCapSoftRetryRef.current = 0
    loadPlaces()
  }, [isActive, tripId, planningUnlockedAt, freeCapReached, loadPlaces])

  useEffect(() => {
    if (!freeCapReached) setFreeCapLockWarnOpen(false)
  }, [freeCapReached])

  // Antecipa o próximo lote quando o baralho encolheu (inclui baralho vazio — continuidade TDV).
  useEffect(() => {
    if (!isActive || !tripId || loading || deckUnavailable || freeCapReached || finalizingTdv) return
    const n = places.length
    if (n >= DECK_MAX_PLACES) return
    if (n > PREFETCH_WHEN_REMAINING_AT_MOST) return
    const baseline = sessionDeckBaselineRef.current
    if (n > 0 && baseline > 0 && n === baseline && !consumedSinceSessionRef.current) return
    if (prefetchInFlightRef.current) return

    const excludePlaceIds = places.map(getPlaceId).filter(Boolean)
    const existingIds = new Set(excludePlaceIds.map((id) => String(id)))

    prefetchAbortRef.current?.abort()
    const ac = new AbortController()
    prefetchAbortRef.current = ac
    const prefetchGen = ++prefetchGenRef.current

    let cancelled = false
    prefetchInFlightRef.current = true
    setPrefetchLoading(true)

    const scheduleEmptyRetry = () => {
      if (n !== 0 || prefetchEmptyAttemptsRef.current >= EMPTY_DECK_PREFETCH_MAX_ATTEMPTS) {
        if (n === 0) setDeckUnavailable(true)
        return
      }
      prefetchEmptyAttemptsRef.current += 1
      window.setTimeout(() => {
        if (!cancelled && prefetchGen === prefetchGenRef.current) {
          setEmptyDeckRetryTick((t) => t + 1)
        }
      }, EMPTY_DECK_PREFETCH_RETRY_MS)
    }

    ;(async () => {
      try {
        const res = await placeService.discover(tripId, excludePlaceIds, { signal: ac.signal })
        if (cancelled || prefetchGen !== prefetchGenRef.current) return
        const incoming = Array.isArray(res.places) ? res.places : []
        if (res.placesSource) setPlacesSource(res.placesSource)

        if (res.placesSource === 'free_cap') {
          // Ainda há cartas locais: só para o prefetch — não mostra paywall.
          if (n > 0) return
          const swipeCount = likedPlaces.length + dislikedPlaces.length
          const { hard, softRetry } = applyFreeCapFromResponse(res, incoming.length, swipeCount)
          if (hard) return
          if (softRetry) {
            window.setTimeout(() => {
              if (!cancelled && prefetchGen === prefetchGenRef.current) {
                setEmptyDeckRetryTick((t) => t + 1)
              }
            }, FREE_CAP_SOFT_RETRY_MS)
          }
          return
        }

        if (res.placesSource === 'none') {
          if (n === 0) setDeckUnavailable(true)
          return
        }

        if (incoming.length === 0) {
          scheduleEmptyRetry()
          return
        }

        prefetchEmptyAttemptsRef.current = 0
        freeCapSoftRetryRef.current = 0
        let wouldAdd = 0
        for (const p of incoming) {
          const id = getPlaceId(p)
          const sid = id != null ? String(id) : ''
          if (sid && !existingIds.has(sid)) wouldAdd += 1
        }
        if (wouldAdd === 0) {
          scheduleEmptyRetry()
          return
        }
        setDeckUnavailable(false)
        setPlaces((prev) => {
          const room = DECK_MAX_PLACES - prev.length
          if (room <= 0) return prev
          const seen = new Set(
            prev.map(getPlaceId).filter(Boolean).map((id) => String(id))
          )
          const out = [...prev]
          for (const p of incoming) {
            if (out.length >= DECK_MAX_PLACES) break
            const id = getPlaceId(p)
            const sid = id != null ? String(id) : ''
            if (sid && !seen.has(sid)) {
              seen.add(sid)
              out.push(p)
            }
          }
          return out
        })
        if (typeof res.totalLikes === 'number') setTotalLikes(res.totalLikes)
      } catch (err) {
        if (cancelled || ac.signal.aborted) return
        if (n === 0) scheduleEmptyRetry()
      } finally {
        prefetchInFlightRef.current = false
        if (prefetchGen === prefetchGenRef.current) {
          setPrefetchLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
      prefetchInFlightRef.current = false
    }
  }, [
    isActive,
    tripId,
    loading,
    places,
    deckUnavailable,
    freeCapReached,
    emptyDeckRetryTick,
    finalizingTdv,
    applyFreeCapFromResponse,
    likedPlaces,
    dislikedPlaces,
  ])

  // Congela o TDV durante finalize: aborta discover/prefetch em voo (não compete com n8n).
  useEffect(() => {
    if (!finalizingTdv) return
    setFinalizeConfirmOpen(false)
    loadAbortRef.current?.abort()
    prefetchAbortRef.current?.abort()
    prefetchInFlightRef.current = false
    setPrefetchLoading(false)
  }, [finalizingTdv])

  useEffect(() => {
    if (!finalizeConfirmOpen) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (balloonLockWarnOpen) setBalloonLockWarnOpen(false)
        else setFinalizeConfirmOpen(false)
      }
    }
    const onPointerDown = (e) => {
      if (finalizeConfirmRef.current?.contains(e.target)) return
      setFinalizeConfirmOpen(false)
      setBalloonLockWarnOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [finalizeConfirmOpen, balloonLockWarnOpen])

  const closeFinalizeBalloon = useCallback(() => {
    setFinalizeConfirmOpen(false)
    setBalloonLockWarnOpen(false)
  }, [])

  const handleLike = useCallback(async () => {
    if (finalizingTdv || !currentPlace || !tripId) return
    const placeId = getPlaceId(currentPlace)
    if (!placeId) {
      setError('Lugar sem ID válido')
      return
    }
      setSwipeFeedback('like')
      setUndoNotice(null)
    setTimeout(() => setSwipeFeedback(null), 400)
    try {
      const placeData = buildTdvLikePlaceData(currentPlace)
      const res = await placeService.like(tripId, placeId, placeData)
      setTotalLikes(typeof res?.likesUsedTotal === 'number' ? res.likesUsedTotal : totalLikes + 1)
      setLikedPlaces((prev) => [{ placeId, name: currentPlace.name }, ...prev])
      setPlaces((prev) => prev.filter((x) => getPlaceId(x) !== placeId))
      consumedSinceSessionRef.current = true
      setCurrentIndex(0)
      setUndoStack((prev) => [...prev, { type: 'like', place: { ...currentPlace } }])
      onItineraryUpdate?.()
    } catch (err) {
      setSwipeFeedback(null)
      setError(getRequestErrorMessage(err, 'Erro ao dar like'))
    }
  }, [finalizingTdv, currentPlace, tripId, totalLikes, onItineraryUpdate])

  const handleDislike = useCallback(async () => {
    if (finalizingTdv || !currentPlace || !tripId) return
    const placeId = getPlaceId(currentPlace)
    if (!placeId) {
      setError('Lugar sem ID válido')
      return
    }
    setSwipeFeedback('dislike')
      setUndoNotice(null)
    setTimeout(() => setSwipeFeedback(null), 400)
    try {
      await placeService.dislike(tripId, placeId, currentPlace)
      setDislikedPlaces((prev) => [{ placeId, name: currentPlace.name }, ...prev])
      setPlaces((prev) => prev.filter((x) => getPlaceId(x) !== placeId))
      consumedSinceSessionRef.current = true
      setCurrentIndex(0)
      setUndoStack((prev) => [...prev, { type: 'dislike', place: { ...currentPlace } }])
    } catch (err) {
      setSwipeFeedback(null)
      setError(getRequestErrorMessage(err, 'Erro ao descartar'))
    }
  }, [finalizingTdv, currentPlace, tripId])

  const handleUndo = useCallback(async () => {
    if (finalizingTdv || !tripId || undoBusyRef.current) return

    let entry
    setUndoStack((prev) => {
      if (prev.length === 0) return prev
      entry = prev[prev.length - 1]
      return prev.slice(0, -1)
    })

    if (!entry) return

    const pid = getPlaceId(entry.place)
    if (!pid) {
      setUndoStack((prev) => [...prev, entry])
      return
    }

    undoBusyRef.current = true
    setUndoLoading(true)
    setUndoNotice(null)

    try {
      if (entry.type === 'like') {
        const res = await placeService.undoLike(tripId, pid)
        if (typeof res?.likesUsedTotal === 'number') setTotalLikes(res.likesUsedTotal)
        setLikedPlaces((prev) => {
          const i = prev.findIndex((p) => String(p.placeId) === String(pid))
          if (i === -1) return prev
          return prev.filter((_, idx) => idx !== i)
        })
        onItineraryUpdate?.()
      } else {
        await placeService.undoDislike(tripId, pid)
        setDislikedPlaces((prev) => {
          const i = prev.findIndex((p) => String(p.placeId) === String(pid))
          if (i === -1) return prev
          return prev.filter((_, idx) => idx !== i)
        })
      }

      setPlaces((prev) => {
        const filtered = prev.filter((x) => getPlaceId(x) !== pid)
        const next = [entry.place, ...filtered]
        if (next.length === sessionDeckBaselineRef.current) consumedSinceSessionRef.current = false
        return next
      })
      setCurrentIndex(0)
    } catch (err) {
      setUndoStack((prev) => [...prev, entry])
      setUndoNotice(err.response?.data?.error?.message || err.message || 'Não foi possível desfazer')
    } finally {
      undoBusyRef.current = false
      setUndoLoading(false)
    }
  }, [finalizingTdv, tripId, onItineraryUpdate])

  useEffect(() => {
    if (finalizingTdv) return undefined
    const onKeyDown = (e) => {
      if (!currentPlace) return
      // Desktop: ← → trocam fotos (PlaceCardGallery). Mobile: curtida/descarte.
      if (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches) {
        return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleDislike()
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleLike()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finalizingTdv, currentPlace, handleLike, handleDislike])

  const likesChip = (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-[#5c4810] shadow-sm dark:border-primary/25 dark:bg-primary/10 dark:text-primary dark:shadow-none sm:text-xs">
      <Icon name="favorite" className="text-xs text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
      {totalLikes === 1
        ? t('tdv.likes_one', { count: totalLikes })
        : t('tdv.likes_other', { count: totalLikes })}
    </span>
  )

  const historyTriggerButton = (
    <button
      type="button"
      onClick={() => setMobilePanelOpen(true)}
      className="group inline-flex items-center gap-1 rounded-full border border-white/35 bg-black/55 py-1 pl-2 pr-1.5 text-[10px] font-bold leading-none text-white shadow-[0_3px_10px_rgba(0,0,0,0.4)] backdrop-blur-md transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
      aria-label={t('tdv.history_section')}
    >
      <Icon
        name="favorite"
        className="text-xs text-primary"
        style={{ fontVariationSettings: "'FILL' 1" }}
      />
      <span className="tabular-nums">{totalLikes}</span>
      <span
        className="flex size-4 items-center justify-center rounded-full bg-white/15 text-white/90 transition-colors group-active:bg-white/25"
        aria-hidden
      >
        <Icon name="expand_more" className="text-sm leading-none" />
      </span>
    </button>
  )

  const renderChoicesPanel = (layout = 'sidebar') => {
    // sidebar: listas com scroll interno (lateral desktop).
    // sheet: altura natural — o sheet mobile rola o conteúdo inteiro até Descartados.
    const isSheet = layout === 'sheet'
    const listWrapClass = isSheet
      ? 'px-2 pb-2 pt-0.5 sm:px-2.5 sm:pb-2.5'
      : 'relative min-h-0 flex-1 px-2 pb-2 pt-0.5 sm:px-2.5 sm:pb-2.5'
    const listClass = isSheet
      ? 'space-y-1 py-0.5 pl-1 pr-2.5'
      : 'tdv-choices-scroll h-full space-y-1 overflow-y-auto py-0.5 pl-1 pr-2.5'

    return (
      <div
        className={
          isSheet
            ? 'grid w-full grid-cols-1 gap-2'
            : 'grid min-h-0 w-full max-w-xl flex-1 grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2 lg:mx-0 lg:max-w-none lg:grid-cols-1'
        }
      >
        <div
          className={
            isSheet
              ? 'flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-none'
              : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-none'
          }
        >
          <h5 className="flex shrink-0 items-center gap-1.5 border-b border-amber-100 bg-amber-50/80 px-2.5 pt-1.5 pb-1.5 text-xs font-bold leading-none text-[#5c4810] dark:border-primary/15 dark:bg-primary/[0.08] dark:text-primary sm:px-3 sm:pt-2 sm:pb-2">
            <Icon name="favorite" className="text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
            Curtidas
          </h5>
          {likedPlaces.length === 0 ? (
            <p className="px-2.5 pb-1.5 text-[11px] text-text-secondary sm:px-3 sm:pb-2">Nenhuma ainda</p>
          ) : (
            <div className={listWrapClass}>
              <ul className={listClass}>
                {likedPlaces.map((place, idx) => (
                  <li
                    key={`${place.placeId}-${idx}`}
                    className="flex items-start gap-2 text-xs text-foreground dark:text-white/90"
                  >
                    <Icon name="check_circle" className="mt-0.5 shrink-0 text-sm text-primary" />
                    <span className="line-clamp-2">{place.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div
          className={
            isSheet
              ? 'flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-none'
              : 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm dark:border-white/[0.08] dark:bg-white/[0.035] dark:shadow-none'
          }
        >
          <h5 className="flex shrink-0 items-center gap-1 border-b border-red-100 bg-red-50/70 px-2.5 pt-1.5 pb-1.5 text-xs font-bold leading-none text-red-700 dark:border-red-400/15 dark:bg-red-500/[0.08] dark:text-red-300 sm:px-3 sm:pt-2 sm:pb-2">
            <Icon name="close" className="text-base leading-none text-red-500 dark:text-red-400" />
            Descartados
          </h5>
          {dislikedPlaces.length === 0 ? (
            <p className="px-2.5 pb-1.5 text-[11px] text-text-secondary sm:px-3 sm:pb-2">Nenhum ainda</p>
          ) : (
            <div className={listWrapClass}>
              <ul className={listClass}>
                {dislikedPlaces.map((place, idx) => (
                  <li
                    key={`${place.placeId}-${idx}`}
                    className="flex items-start gap-2 text-xs text-text-secondary dark:text-white/70"
                  >
                    <Icon name="not_interested" className="mt-0.5 shrink-0 text-sm text-red-500/90 dark:text-red-400/90" />
                    <span className="line-clamp-2 line-through decoration-red-300/80 dark:decoration-red-400/40">
                      {place.name}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    )
  }

  const choicesPanel = renderChoicesPanel('sidebar')

  const requestGenerateFromTdv = useCallback((opts = {}) => {
    onTdvSatisfied?.()
  }, [onTdvSatisfied])

  const requestModifyRoteiro = useCallback(() => {
    onModifyRoteiro?.(likedPlaces)
  }, [onModifyRoteiro, likedPlaces])

  const renderFinalizeFlow = ({
    lockWarnOpen,
    onRequestLockWarn,
    onCancelLockWarn,
    onAfterConfirm,
  }) => {
    if (isPostUnlock) {
      return (
        <>
          <p className="mb-2 text-[11px] leading-snug text-text-secondary sm:text-xs lg:mb-3 lg:text-[13px] lg:leading-relaxed">
            {t('tdv.modify_confirm_body')}
          </p>
          <Button
            onClick={() => {
              onAfterConfirm?.()
              requestModifyRoteiro()
            }}
            disabled={finalizingTdv}
            className="w-full rounded-full py-2.5 sm:py-3 lg:py-3.5 lg:text-[15px]"
          >
            {t('tdv.modify_cta')}
          </Button>
        </>
      )
    }

    if (lockWarnOpen) {
      return (
        <>
          <p className="mb-2 text-[11px] leading-snug text-text-secondary sm:text-xs lg:mb-3 lg:text-[13px] lg:leading-relaxed">
            {t('tdv.lock_warn_body')}
          </p>
          <Button
            onClick={() => {
              onAfterConfirm?.()
              requestGenerateFromTdv()
            }}
            disabled={finalizingTdv}
            className="w-full rounded-full py-2.5 sm:py-3 lg:py-3.5 lg:text-[15px]"
          >
            {finalizingTdv ? t('tdv.finalize_generating') : t('tdv.lock_warn_confirm')}
          </Button>
          <button
            type="button"
            onClick={onCancelLockWarn}
            className="mt-2 w-full text-center text-[11px] font-semibold text-text-secondary transition-colors hover:text-[#1c1c0d] dark:hover:text-white"
          >
            {t('tdv.lock_warn_cancel')}
          </button>
        </>
      )
    }

    return (
      <>
        <p className="mb-2 text-[11px] leading-snug text-text-secondary sm:text-xs lg:mb-3 lg:text-[13px] lg:leading-relaxed">
          Ao finalizar, a IA usa o formulário da viagem e, se houver, suas curtidas e descartes. Sem
          curtidas, o roteiro vem só do planejamento.
        </p>
        <Button
          onClick={() => {
            if (warnTdvLockOnGenerate) {
              onRequestLockWarn?.()
              return
            }
            onAfterConfirm?.()
            requestGenerateFromTdv()
          }}
          disabled={finalizingTdv}
          className="w-full rounded-full py-2.5 sm:py-3 lg:py-3.5 lg:text-[15px]"
        >
          {finalizingTdv ? t('tdv.finalize_generating') : t('tdv.finalize_cta')}
        </Button>
        {totalLikes < 1 ? (
          <p className="mt-1.5 text-center text-[10px] text-text-secondary lg:mt-2 lg:text-[11px]">
            {t('tdv.finalize_hint')}
          </p>
        ) : null}
      </>
    )
  }

  const finalizePanel = (
    <div className="relative z-[1] mx-auto w-full max-w-xl shrink-0 rounded-2xl border border-border-light bg-white p-3 shadow-sm dark:border-white/[0.08] dark:bg-surface-dark dark:shadow-none sm:p-3.5 lg:mx-0 lg:max-w-none">
      {renderFinalizeFlow({
        lockWarnOpen: panelLockWarnOpen,
        onRequestLockWarn: () => setPanelLockWarnOpen(true),
        onCancelLockWarn: () => setPanelLockWarnOpen(false),
        onAfterConfirm: () => setPanelLockWarnOpen(false),
      })}
    </div>
  )

  const belowFoldContent = (
    <div className="flex h-full min-h-0 w-full flex-col gap-2.5">
      <div className="mx-auto flex w-full max-w-xl shrink-0 justify-center lg:mx-0 lg:max-w-none lg:justify-start">
        {likesChip}
      </div>
      {finalizePanel}
      {choicesPanel}
    </div>
  )

  if (!introAcknowledged && (loading || introReady)) {
    return (
      <div
        className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#f0f0ee] px-6 py-8 dark:bg-[#0e0e0e]"
        role="status"
        aria-live="polite"
      >
        <div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
          {loading ? <LoadingSpinner className="p-4" /> : null}
          <p className="text-sm leading-relaxed text-text-secondary">
            {isPostUnlock ? t('tdv.modify_intro_body') : t('tdv.intro_body')}
          </p>
          <Button
            type="button"
            className="rounded-full"
            disabled={loading || !introReady}
            onClick={() => {
              if (isPostUnlock) {
                writeModifyIntroAcknowledged(tripId)
              } else {
                writeIntroAcknowledged(tripId)
              }
              setIntroAcknowledged(true)
            }}
          >
            {isPostUnlock ? t('tdv.modify_intro_understood') : t('tdv.intro_understood')}
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden bg-[#f0f0ee] p-6 dark:bg-[#0e0e0e]" role="status" aria-live="polite">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#f0f0ee] p-6 dark:bg-[#0e0e0e]">
        <div className="w-full max-w-md rounded-2xl border border-red-200/80 bg-red-50 p-4 text-center text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-300" role="alert">
          {error}
        </div>
        <Button
          variant="secondary"
          className="mt-4 rounded-full"
          onClick={() => {
            setError(null)
            loadPlaces()
          }}
        >
          Tentar de novo
        </Button>
      </div>
    )
  }

  // Card preenche a coluna. Mobile (<lg): sem raio no topo (padrão travado). Desktop: cantos arredondados.
  const cardSurface =
    'h-full w-full min-h-0 rounded-none lg:rounded-t-3xl lg:rounded-b-none'

  // Undo: neutro. Dislike: rejeição (vermelho). Like: afirmação (primary). Finalize: sucesso (verde).
  const undoBtnClass =
    'flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-500 shadow-sm active:scale-95 motion-safe:transition-[transform,colors,box-shadow] hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-800 dark:border-white/10 dark:bg-white/[0.06] dark:text-white/55 dark:hover:border-white/20 dark:hover:bg-white/[0.1] dark:hover:text-white lg:size-11 lg:shadow-md disabled:opacity-35 disabled:pointer-events-none'
  const dislikeBtnClass =
    'flex size-11 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-600 shadow-sm active:scale-95 motion-safe:transition-[transform,colors,box-shadow] hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:border-red-400/45 dark:hover:bg-red-500/18 dark:hover:text-red-300 lg:size-14 lg:shadow-md disabled:opacity-45 disabled:pointer-events-none'
  const likeBtnClass =
    'flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-foreground shadow-primary-glow ring-2 ring-primary/20 active:scale-95 motion-safe:transition-[transform,box-shadow] hover:brightness-[1.03] dark:shadow-primary-glow-dark dark:ring-primary/25 lg:size-16 disabled:opacity-45 disabled:pointer-events-none'
  const finalizeBtnClass =
    'flex size-9 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm active:scale-95 motion-safe:transition-[transform,colors,box-shadow] hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:border-emerald-400/45 dark:hover:bg-emerald-500/18 dark:hover:text-emerald-300 lg:size-11 lg:shadow-md disabled:opacity-35 disabled:pointer-events-none'

  const actionButtons = (
    <>
      <button
        type="button"
        onClick={handleUndo}
        disabled={finalizingTdv || undoStack.length === 0 || undoLoading}
        className={undoBtnClass}
        aria-label={undoLoading ? t('tdv.undo_loading') : t('tdv.undo_action')}
        title={t('tdv.undo_action')}
      >
        <Icon name={undoLoading ? 'progress_activity' : 'undo'} className={`text-lg lg:text-2xl ${undoLoading ? 'animate-spin' : ''}`} />
      </button>
      <button
        type="button"
        onClick={handleDislike}
        disabled={finalizingTdv}
        className={dislikeBtnClass}
        aria-label="Descartar"
      >
        <Icon name="close" className="text-xl lg:text-3xl" />
      </button>
      <button
        type="button"
        onClick={handleLike}
        disabled={finalizingTdv}
        className={likeBtnClass}
        aria-label="Curtir"
      >
        <Icon name="favorite" className="text-2xl lg:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }} />
      </button>
      <div className="relative shrink-0" ref={finalizeConfirmRef}>
        {finalizeConfirmOpen ? (
          <div
            className="absolute bottom-[calc(100%+0.65rem)] right-0 z-[50] w-[min(17.5rem,calc(100vw-1.25rem))] rounded-2xl border border-border-light bg-white p-3 shadow-xl dark:border-white/[0.1] dark:bg-surface-dark lg:bottom-[calc(100%+1.5rem)] lg:left-1/2 lg:right-auto lg:w-[22.5rem] lg:-translate-x-1/2 lg:p-4 lg:shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={
              isPostUnlock
                ? t('tdv.modify_cta')
                : balloonLockWarnOpen
                  ? t('tdv.lock_warn_title')
                  : t('tdv.finalize_action')
            }
          >
            {renderFinalizeFlow({
              lockWarnOpen: balloonLockWarnOpen,
              onRequestLockWarn: () => setBalloonLockWarnOpen(true),
              onCancelLockWarn: () => setBalloonLockWarnOpen(false),
              onAfterConfirm: closeFinalizeBalloon,
            })}
            <span
              className="pointer-events-none absolute -bottom-1.5 right-3 size-3 rotate-45 border-b border-r border-border-light bg-white dark:border-white/[0.1] dark:bg-surface-dark lg:left-1/2 lg:right-auto lg:-translate-x-1/2"
              aria-hidden
            />
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setFinalizeConfirmOpen((open) => {
              if (open) setBalloonLockWarnOpen(false)
              return !open
            })
          }}
          disabled={finalizingTdv}
          className={`${finalizeBtnClass} ${
            finalizeConfirmOpen ? 'ring-2 ring-emerald-500/40 dark:ring-emerald-400/40' : ''
          }`}
          aria-label={
            isPostUnlock
              ? t('tdv.modify_cta')
              : finalizingTdv
                ? t('tdv.finalize_generating')
                : t('tdv.finalize_action')
          }
          aria-expanded={finalizeConfirmOpen}
          aria-haspopup="dialog"
          title={isPostUnlock ? t('tdv.modify_cta') : t('tdv.finalize_action')}
        >
          <Icon
            name={finalizingTdv ? 'progress_activity' : isPostUnlock ? 'swap_horiz' : 'task_alt'}
            className={`text-lg lg:text-2xl ${finalizingTdv ? 'animate-spin' : ''}`}
            filled={!finalizingTdv}
          />
        </button>
      </div>
    </>
  )

  const placeCard = currentPlace ? (
    <div className="relative isolate h-full w-full min-h-0">
      {places[currentIndex + 1] && (
        <div
          className={`pointer-events-none absolute inset-0 z-0 ${cardSurface} origin-center overflow-hidden border-0 bg-zinc-800 opacity-40 shadow-lg scale-[0.985]`}
          aria-hidden
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${getPlaceCoverImageUrl(places[currentIndex + 1])})`,
            }}
          />
        </div>
      )}
      <div
        className={`absolute inset-0 z-[1] ${cardSurface} overflow-hidden border-0 bg-zinc-900 shadow-xl ring-1 ring-black/[0.04] transition-[transform,opacity] duration-300 group dark:ring-white/[0.08] motion-reduce:transition-none ${
          swipeFeedback === 'like'
            ? 'ring-4 ring-primary sm:translate-y-px motion-reduce:translate-y-0'
            : ''
        } ${swipeFeedback === 'dislike' ? 'opacity-[0.92] ring-4 ring-red-400/50 sm:translate-y-0.5 motion-reduce:translate-y-0' : ''}`}
      >
        <PlaceCardGallery place={currentPlace} />
        <div className="pointer-events-none absolute inset-0 z-[10] bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[40] px-3 pb-2 pt-5 text-white sm:px-5 sm:pb-3 sm:pt-10">
          <div className="mb-0.5 flex gap-1 overflow-x-auto no-scrollbar sm:mb-1">
            {(currentPlace.tags || currentPlace.categories || []).filter(Boolean).map((tag) => {
              const label = typeof tag === 'string' ? tag : tag?.name || tag?.label || String(tag)
              return (
                <span
                  key={label}
                  className="whitespace-nowrap rounded-full border border-white/15 bg-white/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/95 backdrop-blur-md sm:px-2 sm:text-[9px]"
                >
                  {label}
                </span>
              )
            })}
          </div>
          <h2 className="mb-0.5 line-clamp-2 text-base font-extrabold leading-tight drop-shadow-md sm:text-2xl">
            {currentPlace.name}
          </h2>
          <div className="mb-0.5 flex min-w-0 items-center gap-1 text-white/90">
            <Icon name="location_on" className="shrink-0 text-xs sm:text-sm" />
            <span className="truncate text-[11px] font-medium sm:text-xs">
              {currentPlace.location ||
                (currentPlace.city && currentPlace.country
                  ? `${currentPlace.city}, ${currentPlace.country}`
                  : currentPlace.city || currentPlace.country || 'Destino')}
            </span>
          </div>
          <p className="line-clamp-2 text-[10px] leading-snug text-white/90 sm:text-sm">
            {currentPlace.description || currentPlace.aiReasoning || 'Descubra este lugar.'}
          </p>
          {placeVideoLinks.length > 0 ? (
            <div className="pointer-events-auto mt-1 border-t border-white/20 pt-1 sm:mt-1.5 sm:pt-1.5">
              <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                <p className="m-0 shrink-0 text-[9px] font-bold uppercase tracking-wider text-white/70 sm:text-[10px]">
                  {t('tdv.video_links_heading')}
                </p>
                <ul className="m-0 flex min-w-0 list-none items-center gap-1 overflow-x-auto p-0 no-scrollbar sm:gap-1.5">
                  {placeVideoLinks.map((href, i) => (
                    <li key={`${href}-${i}`} className="shrink-0">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-[8.5rem] items-center gap-0.5 rounded-full border border-white/30 bg-black/35 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-md transition-colors hover:border-white/45 hover:bg-black/50 sm:max-w-[11rem] sm:gap-1 sm:px-2.5 sm:py-1 sm:text-[11px]"
                        aria-label={t('tdv.video_link_aria', { n: i + 1 })}
                      >
                        <Icon name="videocam" className="shrink-0 text-xs text-white/90 sm:text-sm" />
                        <span className="min-w-0 truncate">
                          {t('tdv.video_link_label', { n: i + 1, source: videoLinkLabel(href) })}
                        </span>
                        <Icon name="open_in_new" className="shrink-0 text-[9px] text-white/70 sm:text-[10px]" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#f0f0ee] dark:bg-[#0e0e0e]">
      {placesSource === 'mock' && (
        <div className="flex-shrink-0 border-b border-amber-400/30 bg-amber-50 px-3 py-1.5 dark:border-amber-500/20 dark:bg-amber-500/10 sm:px-4">
          <p className="mx-auto max-w-3xl text-center text-[11px] text-amber-900 dark:text-amber-200 sm:text-xs">
            {t('tdv.mock_banner')}
          </p>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Coluna esquerda: card + barra — bloco contínuo, gutters mínimos e simétricos */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <div className="absolute inset-0">
              {currentPlace ? (
                placeCard
              ) : freeCapReached ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-3">
                  <EmptyState
                    icon="lock"
                    title={t('tdv.free_cap_title')}
                    description={t('tdv.free_cap_body')}
                    action={
                      <div className="flex w-full max-w-sm flex-col gap-2">
                        {freeCapLockWarnOpen && warnTdvLockOnGenerate ? (
                          <div
                            className="rounded-2xl border border-border-light bg-white p-3 text-left shadow-xl dark:border-white/[0.1] dark:bg-surface-dark sm:p-4"
                            role="dialog"
                            aria-modal="true"
                            aria-label={t('tdv.lock_warn_title')}
                          >
                            <p className="mb-2 text-[11px] leading-snug text-text-secondary sm:text-xs lg:mb-3 lg:text-[13px] lg:leading-relaxed">
                              {t('tdv.lock_warn_body')}
                            </p>
                            <Button
                              onClick={() => {
                                setFreeCapLockWarnOpen(false)
                                requestGenerateFromTdv()
                              }}
                              disabled={finalizingTdv}
                              className="w-full rounded-full py-2.5 sm:py-3 lg:py-3.5 lg:text-[15px]"
                            >
                              {finalizingTdv
                                ? t('tdv.finalize_generating')
                                : t('tdv.lock_warn_confirm')}
                            </Button>
                            <button
                              type="button"
                              onClick={() => setFreeCapLockWarnOpen(false)}
                              className="mt-2 w-full text-center text-[11px] font-semibold text-text-secondary transition-colors hover:text-[#1c1c0d] dark:hover:text-white"
                            >
                              {t('tdv.lock_warn_cancel')}
                            </button>
                          </div>
                        ) : (
                          <>
                            <Button
                              onClick={() => {
                                if (warnTdvLockOnGenerate) {
                                  setFreeCapLockWarnOpen(true)
                                  return
                                }
                                requestGenerateFromTdv()
                              }}
                              disabled={finalizingTdv}
                              className="w-full rounded-full"
                            >
                              {t('tdv.free_cap_generate')}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() =>
                                navigate(
                                  `/pagamento?tripId=${encodeURIComponent(tripId)}&from=tdv`,
                                )
                              }
                              disabled={finalizingTdv}
                              className="w-full rounded-full"
                            >
                              {t('tdv.free_cap_unlock')}
                            </Button>
                          </>
                        )}
                      </div>
                    }
                  />
                </div>
              ) : deckUnavailable ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-3">
                  <EmptyState
                    icon="cloud_off"
                    title={t('tdv.empty_title')}
                    description={t('tdv.agent_unavailable')}
                    action={
                      <Button onClick={handleRetryDeck} disabled={finalizingTdv} className="rounded-full">
                        {t('tdv.retry')}
                      </Button>
                    }
                  />
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3" role="status" aria-live="polite">
                  <LoadingSpinner />
                  <p className="text-sm text-text-secondary">{t('tdv.fetching')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="tdv-action-bar relative z-[30] flex shrink-0 flex-col items-center border-t border-zinc-200/90 bg-white px-3 py-2 shadow-[0_-4px_16px_rgba(17,17,17,0.04)] dark:border-white/[0.07] dark:bg-[#141414] dark:shadow-[0_-6px_20px_rgba(0,0,0,0.35)] lg:px-5 lg:py-2.5">
            {undoNotice ? (
              <p className="mb-1 max-w-[20rem] px-2 text-center text-[10px] leading-snug text-red-600 dark:text-red-400 lg:text-[11px]" role="alert">
                {undoNotice}
              </p>
            ) : null}
            <div className="flex w-full max-w-md items-center justify-between px-1 lg:max-w-lg lg:px-3">
              {actionButtons}
            </div>
          </div>

          {/* Mobile: histórico à direita; pontinhos ficam à esquerda (PlaceCardGallery) */}
          <div className="absolute right-3 top-3 z-[45] lg:hidden">{historyTriggerButton}</div>
        </div>

        {/* Lateral alinhada ao bloco do card — mesmo fundo, sem faixa morta na junção */}
        <aside className="hidden min-h-0 w-[min(100%,16.5rem)] shrink-0 flex-col gap-2.5 overflow-hidden border-l border-zinc-200/80 bg-[#f7f7f5] px-2.5 py-2.5 dark:border-white/[0.07] dark:bg-[#121212] lg:flex xl:w-[17.5rem] xl:px-3">
          {belowFoldContent}
        </aside>
      </div>

      {mobilePanelOpen
        ? createPortal(
            <div
              className="fixed inset-0 z-[1200] lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label={t('tdv.history_section')}
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/55"
                aria-label="Fechar"
                style={{
                  opacity: Math.max(0, 1 - sheetDragY / Math.max(1, (sheetPanelRef.current?.offsetHeight || 480) * 0.85)),
                  transition:
                    sheetDragging && !sheetDismissing
                      ? 'none'
                      : `opacity ${SHEET_DISMISS_MS}ms ${SHEET_EASE}`,
                }}
                onClick={runSheetDismiss}
              />
              <div
                ref={sheetPanelRef}
                className="absolute inset-x-0 bottom-0 flex max-h-[min(90dvh,44rem)] flex-col rounded-t-2xl border border-border-light bg-background-light shadow-2xl will-change-transform dark:border-border-dark dark:bg-card-dark"
                style={{
                  transform: `translate3d(0, ${sheetDragY}px, 0)`,
                  transition:
                    sheetDragging && !sheetDismissing
                      ? 'none'
                      : `transform ${SHEET_DISMISS_MS}ms ${SHEET_EASE}`,
                }}
              >
                <div
                  className="flex shrink-0 touch-none cursor-grab flex-col active:cursor-grabbing"
                  onPointerDown={onSheetHeaderPointerDown}
                  onPointerMove={onSheetHeaderPointerMove}
                  onPointerUp={onSheetHeaderPointerUp}
                  onPointerCancel={onSheetHeaderPointerCancel}
                >
                  <div className="flex justify-center pb-1 pt-2" aria-hidden>
                    <span className="h-1 w-10 rounded-full bg-black/20 dark:bg-white/25" />
                  </div>
                  <div className="flex items-center justify-between gap-2 border-b border-border-light/70 px-4 pb-3 dark:border-border-dark/70">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="m-0 text-sm font-bold text-foreground dark:text-white">
                        {t('tdv.history_section')}
                      </p>
                      {likesChip}
                    </div>
                    <button
                      type="button"
                      onClick={runSheetDismiss}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Fechar"
                    >
                      <Icon name="close" className="text-xl" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                  <div className="flex w-full flex-col gap-2.5">
                    {finalizePanel}
                    {renderChoicesPanel('sheet')}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
