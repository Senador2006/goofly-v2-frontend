import { useCallback, useEffect, useRef, useState } from 'react'
import { tdvDiscoverService } from '../services/tdvDiscoverService'
import {
  getTdvPlaceId,
  mergeTdvLikeListsById,
} from '../utils/tdvLikeEntry'
import {
  clearTdvDeckSession,
  readTdvDeckSession,
  saveTdvDeckSession,
} from '../utils/tdvDeckSession'
import { placeContentKey } from '../utils/tdvPlaceFingerprint'
import { isTdvDiscoverCircuitOpen } from '../utils/tdvDiscoverCircuit'
import { getRequestErrorMessage } from '../utils/errors'
import {
  PREFETCH_WHEN_REMAINING_AT_MOST,
  DECK_MAX_PLACES,
  EMPTY_DECK_PREFETCH_MAX_ATTEMPTS,
  EMPTY_DECK_PREFETCH_RETRY_MS,
  FREE_CAP_SOFT_RETRY_MAX,
  FREE_CAP_SOFT_RETRY_MS,
  FREE_CAP_MAX_PLACES,
  isHardFreeCap,
  isPaidBatchCap,
  shouldRetryPrefetchOnEmpty,
  shouldLatchFreeCapPaywall,
} from '../utils/tdvFreeCapPolicy'

function getPlaceId(p) {
  return getTdvPlaceId(p)
}

/**
 * Carrega / prefetch / restore do baralho TDV (sessionStorage + discover).
 */
export function useTdvDeck({
  tripId,
  trip,
  isActive,
  finalizingTdv = false,
  replaceUndoStack,
}) {
  const [places, setPlaces] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [totalLikes, setTotalLikes] = useState(0)
  const [likedPlaces, setLikedPlaces] = useState([])
  const [dislikedPlaces, setDislikedPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [introReady, setIntroReady] = useState(false)
  const [prefetchLoading, setPrefetchLoading] = useState(false)
  const [error, setError] = useState(null)
  const [emptyDeckRetryTick, setEmptyDeckRetryTick] = useState(0)
  const [placesSource, setPlacesSource] = useState(null)
  const [deckUnavailable, setDeckUnavailable] = useState(false)
  const [freeCapReached, setFreeCapReached] = useState(false)
  const [paidBatchCapReached, setPaidBatchCapReached] = useState(false)

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

  const placesRef = useRef(places)
  const tripIdRef = useRef(tripId)
  const likedPlacesRef = useRef(likedPlaces)
  const dislikedPlacesRef = useRef(dislikedPlaces)
  const replaceUndoStackRef = useRef(replaceUndoStack)
  placesRef.current = places
  tripIdRef.current = tripId
  likedPlacesRef.current = likedPlaces
  dislikedPlacesRef.current = dislikedPlaces
  replaceUndoStackRef.current = replaceUndoStack

  const releaseDeckToServer = useCallback(async (targetTripId = tripIdRef.current, opts = {}) => {
    const deck = placesRef.current
    if (!targetTripId || deck.length === 0) return
    // 1) sessionStorage sync (restore preferido) 2) POST cache-skipped best-effort (keepalive).
    saveTdvDeckSession(targetTripId, deck)
    try {
      await tdvDiscoverService.cacheSkippedPlaces(targetTripId, deck, {
        keepalive: Boolean(opts.keepalive),
      })
    } catch {
      // best-effort: cartas não consumidas voltam ao cache no servidor
    }
  }, [])

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
      setPaidBatchCapReached(false)
      return { hard: false, softRetry: false, paidCap: false }
    }
    if (isPaidBatchCap(res)) {
      freeCapSoftRetryRef.current = 0
      setFreeCapReached(false)
      setPaidBatchCapReached(true)
      return { hard: false, softRetry: false, paidCap: true }
    }
    setPaidBatchCapReached(false)
    if (res?.placesSource !== 'free_cap') {
      freeCapSoftRetryRef.current = 0
      setFreeCapReached(false)
      return { hard: false, softRetry: false, paidCap: false }
    }
    const swiped = res?.tdvLimit?.placesSwiped ?? swipeCount
    if (swiped < FREE_CAP_MAX_PLACES) {
      // Prefetch/issued esgotado sem 10 swipes — não é paywall.
      setFreeCapReached(false)
      if (freeCapSoftRetryRef.current >= FREE_CAP_SOFT_RETRY_MAX) {
        return { hard: false, softRetry: false, paidCap: false }
      }
      freeCapSoftRetryRef.current += 1
      return { hard: false, softRetry: true, paidCap: false }
    }
    if (isHardFreeCap(res, swipeCount)) {
      freeCapSoftRetryRef.current = 0
      setFreeCapReached(true)
      return { hard: true, softRetry: false, paidCap: false }
    }
    setFreeCapReached(false)
    return { hard: false, softRetry: false, paidCap: false }
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
      replaceUndoStackRef.current?.([])
      setPlacesSource(restoredFromSession ? 'cache' : null)
      setFreeCapReached(false)
      setPaidBatchCapReached(false)
      setDeckUnavailable(false)
      setCurrentIndex(0)
      setIntroReady(true)
      setLoading(false)
      setError(null)
      tdvDiscoverService
        .getTdvSummary(tripId)
        .then((summary) => {
          if (gen !== loadGenRef.current) return
          const likedFromRes = Array.isArray(summary.likedPlaces) ? summary.likedPlaces : []
          const dislikedFromRes = Array.isArray(summary.dislikedPlaces)
            ? summary.dislikedPlaces
            : []
          const likesCount = summary.likesCount ?? likedFromRes.length
          if (consumedSinceSessionRef.current) {
            setLikedPlaces((prev) => mergeTdvLikeListsById(likedFromRes, prev))
            setDislikedPlaces((prev) => mergeTdvLikeListsById(dislikedFromRes, prev))
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
      const res = await tdvDiscoverService.discoverSession(tripId, undefined, { signal: ac.signal })
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
        tdvDiscoverService.cacheSkippedPlaces(tripId, localDeck).catch(() => {})
        saveTdvDeckSession(tripId, localDeck)
      } else {
        list = serverList
        if (list.length > 0) saveTdvDeckSession(tripId, list)
        else clearTdvDeckSession(tripId)
      }

      sessionDeckBaselineRef.current = list.length
      consumedSinceSessionRef.current = false
      setPlaces(list)
      replaceUndoStackRef.current?.([])
      setTotalLikes(res.totalLikes ?? 0)
      setLikedPlaces(likedFromRes)
      setDislikedPlaces(dislikedFromRes)
      setPlacesSource(restoredFromSession ? 'cache' : res.placesSource ?? null)
      const swipeCount = likedFromRes.length + dislikedFromRes.length
      const { softRetry, hard, paidCap } = applyFreeCapFromResponse(
        restoredFromSession ? { ...res, placesSource: 'cache' } : res,
        list.length,
        swipeCount
      )
      if ((hard || paidCap) && list.length === 0) clearTdvDeckSession(tripId)
      const sessionSwiped = res?.tdvLimit?.placesSwiped ?? swipeCount
      // Paywall só com ≥10 swipes. Estoque esgotado com swipes < 10 → deckUnavailable.
      if (
        list.length === 0 &&
        !restoredFromSession &&
        shouldLatchFreeCapPaywall(res, sessionSwiped)
      ) {
        setFreeCapReached(true)
        setPaidBatchCapReached(false)
        setDeckUnavailable(false)
      } else if (list.length === 0 && !restoredFromSession && paidCap) {
        setPaidBatchCapReached(true)
        setDeckUnavailable(false)
      } else {
        setDeckUnavailable(
          list.length === 0 &&
            !restoredFromSession &&
            !softRetry &&
            !paidCap &&
            Boolean(res) &&
            !shouldRetryPrefetchOnEmpty(res, sessionSwiped) &&
            !shouldLatchFreeCapPaywall(res, sessionSwiped)
        )
      }
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
        setPaidBatchCapReached(false)
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
      setPaidBatchCapReached(false)
      freeCapSoftRetryRef.current = 0
      setError(null)
      replaceUndoStackRef.current?.([])
      setIntroReady(false)
      sessionDeckBaselineRef.current = 0
      consumedSinceSessionRef.current = false
      hadDeckRef.current = false
    }
  }, [tripId, releaseDeckToServer])

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
    if (finalizingTdv || paidBatchCapReached) return
    // C21: free-cap latched pós-unlock — limpa e busca lote pago (paywall não se aplica).
    if (freeCapReached) {
      const unlocked = Boolean(trip?.planning_unlocked_at ?? trip?.planningUnlockedAt)
      if (!unlocked) return
      setFreeCapReached(false)
      // C23: não restaurar cartas free residuais do sessionStorage.
      clearTdvDeckSession(tripId)
      hadDeckRef.current = false
      sessionDeckBaselineRef.current = 0
      consumedSinceSessionRef.current = false
      setPlaces([])
      setCurrentIndex(0)
    }
    prefetchEmptyAttemptsRef.current = 0
    freeCapSoftRetryRef.current = 0
    setDeckUnavailable(false)
    loadPlaces()
  }, [finalizingTdv, freeCapReached, paidBatchCapReached, loadPlaces, trip, tripId])

  // Carrega ao ativar a aba / mudar viagem. Com deck local, reexibe na hora (sem discover).
  useEffect(() => {
    if (!isActive || !tripId) return
    // Fire-and-forget: acorda gateway/services no Render antes do discover (não bloqueia UI).
    try {
      const base = String(import.meta.env.VITE_API_GATEWAY_URL || '').replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '')
      const healthUrl = base && base.startsWith('http') ? `${base}/health` : '/health'
      void fetch(healthUrl, { method: 'GET', credentials: 'omit', cache: 'no-store' }).catch(() => {})
    } catch {
      /* ignore */
    }
    if (placesRef.current.length > 0) return
    loadPlaces()
  }, [isActive, tripId, loadPlaces])

  // Após unlock do planejamento, busca novos batches além do limite free (uma vez).
  // C19: também quando o vazio foi `deckUnavailable` (agente/batches), não só free-cap.
  // C23: limpa sessionStorage do deck free antes do discover — senão loadPlaces
  // restaura cartas residuais e adia o 1º lote pago.
  const planningUnlockedAt = trip?.planning_unlocked_at ?? trip?.planningUnlockedAt ?? null
  const unlockReloadDoneRef = useRef(false)
  useEffect(() => {
    unlockReloadDoneRef.current = false
  }, [tripId])
  useEffect(() => {
    if (!isActive || !tripId || !planningUnlockedAt) return
    if (unlockReloadDoneRef.current) return
    // Baralho útil já visível e sem bloqueio — não pisa o ponto do usuário.
    if (!freeCapReached && !deckUnavailable && places.length > 0) return
    unlockReloadDoneRef.current = true
    clearTdvDeckSession(tripId)
    setFreeCapReached(false)
    setDeckUnavailable(false)
    setPaidBatchCapReached(false)
    freeCapSoftRetryRef.current = 0
    prefetchEmptyAttemptsRef.current = 0
    sessionDeckBaselineRef.current = 0
    consumedSinceSessionRef.current = false
    hadDeckRef.current = false
    setPlaces([])
    setCurrentIndex(0)
    loadPlaces()
  }, [
    isActive,
    tripId,
    planningUnlockedAt,
    freeCapReached,
    deckUnavailable,
    places.length,
    loadPlaces,
  ])

  // Corrige corrida: baralho vazio localmente com 10 swipes antes do discover refletir free_cap.
  useEffect(() => {
    if (!isActive || loading || finalizingTdv || freeCapReached) return
    if (places.length > 0) return
    const unlocked = Boolean(trip?.planning_unlocked_at ?? trip?.planningUnlockedAt)
    if (unlocked) return
    const localSwiped = likedPlaces.length + dislikedPlaces.length
    if (localSwiped >= FREE_CAP_MAX_PLACES) {
      freeCapSoftRetryRef.current = 0
      setFreeCapReached(true)
      setDeckUnavailable(false)
    }
  }, [
    isActive,
    loading,
    finalizingTdv,
    freeCapReached,
    places.length,
    likedPlaces.length,
    dislikedPlaces.length,
    trip,
  ])

  // Antecipa o próximo lote quando o baralho encolheu (inclui baralho vazio — continuidade TDV).
  // Não aborta discover em voo por swipe: cleanup só marca cancelled; abort só em trip/unmount/finalize.
  const placesCount = places.length
  const likedCount = likedPlaces.length
  const dislikedCount = dislikedPlaces.length
  useEffect(() => {
    if (!isActive || !tripId || loading || deckUnavailable || freeCapReached || paidBatchCapReached || finalizingTdv) return
    const n = placesCount
    if (n >= DECK_MAX_PLACES) return
    if (n > PREFETCH_WHEN_REMAINING_AT_MOST) return
    const baseline = sessionDeckBaselineRef.current
    if (n > 0 && baseline > 0 && n === baseline && !consumedSinceSessionRef.current) return
    if (prefetchInFlightRef.current) return
    // B09: circuit aberto após 429 — não dispara prefetch/agente.
    if (isTdvDiscoverCircuitOpen()) return

    const deckNow = placesRef.current
    const likedNow = likedPlacesRef.current
    const dislikedNow = dislikedPlacesRef.current
    const excludePlaceIds = deckNow
      .map(getPlaceId)
      .map((id) => (id != null ? String(id).trim() : ''))
      .filter(Boolean)
    const existingIds = new Set(
      [
        ...excludePlaceIds,
        ...likedNow.map((p) => p?.placeId ?? p?.place_id ?? p?.id),
        ...dislikedNow.map((p) => p?.placeId ?? p?.place_id ?? p?.id),
      ]
        .map((id) => (id != null ? String(id).trim() : ''))
        .filter(Boolean)
    )
    const existingContentKeys = new Set(
      [
        ...deckNow.map(placeContentKey),
        ...likedNow.map(placeContentKey),
        ...dislikedNow.map(placeContentKey),
      ].filter(Boolean)
    )

    const ac = new AbortController()
    prefetchAbortRef.current = ac
    const prefetchGen = ++prefetchGenRef.current
    const startedTripId = tripId

    prefetchInFlightRef.current = true
    setPrefetchLoading(true)

    const stillCurrent = () =>
      prefetchGen === prefetchGenRef.current &&
      tripIdRef.current === startedTripId &&
      !ac.signal.aborted

    const scheduleEmptyRetry = (res = null) => {
      const swipeCount = likedNow.length + dislikedNow.length
      if (n !== 0) return
      if (res && !shouldRetryPrefetchOnEmpty(res, swipeCount)) {
        if (shouldLatchFreeCapPaywall(res, swipeCount)) {
          if (stillCurrent()) {
            freeCapSoftRetryRef.current = 0
            setFreeCapReached(true)
            setPaidBatchCapReached(false)
            setDeckUnavailable(false)
          }
        } else if (isPaidBatchCap(res)) {
          if (stillCurrent()) {
            setPaidBatchCapReached(true)
            setDeckUnavailable(false)
          }
        } else if (stillCurrent()) {
          setDeckUnavailable(true)
        }
        return
      }
      if (prefetchEmptyAttemptsRef.current >= EMPTY_DECK_PREFETCH_MAX_ATTEMPTS) {
        if (stillCurrent()) setDeckUnavailable(true)
        return
      }
      prefetchEmptyAttemptsRef.current += 1
      window.setTimeout(() => {
        if (stillCurrent()) {
          setEmptyDeckRetryTick((t) => t + 1)
        }
      }, EMPTY_DECK_PREFETCH_RETRY_MS)
    }

    ;(async () => {
      try {
        const res = await tdvDiscoverService.discover(tripId, excludePlaceIds, { signal: ac.signal })
        if (!stillCurrent()) return
        const incoming = Array.isArray(res.places) ? res.places : []
        if (res.placesSource) setPlacesSource(res.placesSource)

        if (res.placesSource === 'free_cap') {
          // Ainda há cartas locais: só para o prefetch — não mostra paywall.
          if (n > 0) return
          const swipeCount = likedNow.length + dislikedNow.length
          const { hard, softRetry } = applyFreeCapFromResponse(res, incoming.length, swipeCount)
          if (hard) return
          if (softRetry) {
            window.setTimeout(() => {
              if (stillCurrent()) {
                setEmptyDeckRetryTick((t) => t + 1)
              }
            }, FREE_CAP_SOFT_RETRY_MS)
          }
          return
        }

        if (res.placesSource === 'paid_batch_cap' || isPaidBatchCap(res)) {
          if (n > 0) return
          if (stillCurrent()) {
            setPaidBatchCapReached(true)
            setDeckUnavailable(false)
          }
          return
        }

        if (res.placesSource === 'none') {
          // Baralho ainda tem cartas: prefetch falhou mas usuário segue swipando.
          if (n > 0) return
          const swiped =
            typeof res?.tdvLimit?.placesSwiped === 'number'
              ? res.tdvLimit.placesSwiped
              : likedNow.length + dislikedNow.length
          if (shouldLatchFreeCapPaywall(res, swiped)) {
            freeCapSoftRetryRef.current = 0
            setFreeCapReached(true)
            setPaidBatchCapReached(false)
            setDeckUnavailable(false)
            return
          }
          if (isPaidBatchCap(res)) {
            setPaidBatchCapReached(true)
            setDeckUnavailable(false)
            return
          }
          if (shouldRetryPrefetchOnEmpty(res, swiped)) {
            scheduleEmptyRetry(res)
          } else if (stillCurrent()) {
            setDeckUnavailable(true)
          }
          return
        }

        if (incoming.length === 0) {
          scheduleEmptyRetry(res)
          return
        }

        prefetchEmptyAttemptsRef.current = 0
        freeCapSoftRetryRef.current = 0
        let wouldAdd = 0
        for (const p of incoming) {
          const id = getPlaceId(p)
          const sid = id != null ? String(id) : ''
          const ckey = placeContentKey(p)
          if (sid && existingIds.has(sid)) continue
          if (ckey && existingContentKeys.has(ckey)) continue
          if (sid || ckey) wouldAdd += 1
        }
        if (wouldAdd === 0) {
          scheduleEmptyRetry(res)
          return
        }
        setDeckUnavailable(false)
        setPaidBatchCapReached(false)
        setPlaces((prev) => {
          const room = DECK_MAX_PLACES - prev.length
          if (room <= 0) return prev
          const seen = new Set(
            prev.map(getPlaceId).filter(Boolean).map((id) => String(id))
          )
          const seenContent = new Set(prev.map(placeContentKey).filter(Boolean))
          for (const id of existingIds) seen.add(id)
          for (const k of existingContentKeys) seenContent.add(k)
          const out = [...prev]
          for (const p of incoming) {
            if (out.length >= DECK_MAX_PLACES) break
            const id = getPlaceId(p)
            const sid = id != null ? String(id) : ''
            const ckey = placeContentKey(p)
            if (sid && seen.has(sid)) continue
            if (ckey && seenContent.has(ckey)) continue
            if (sid) seen.add(sid)
            if (ckey) seenContent.add(ckey)
            out.push(p)
          }
          return out
        })
        if (typeof res.totalLikes === 'number') setTotalLikes(res.totalLikes)
      } catch (err) {
        if (ac.signal.aborted || !stillCurrent()) return
        if (n === 0) scheduleEmptyRetry()
      } finally {
        if (prefetchAbortRef.current === ac) {
          prefetchInFlightRef.current = false
        }
        if (prefetchGen === prefetchGenRef.current) {
          setPrefetchLoading(false)
        }
      }
    })()

    // Sem cleanup abort/cancelled: swipe re-render não descarta discover em voo.
  }, [
    isActive,
    tripId,
    loading,
    placesCount,
    deckUnavailable,
    freeCapReached,
    paidBatchCapReached,
    emptyDeckRetryTick,
    finalizingTdv,
    applyFreeCapFromResponse,
    likedCount,
    dislikedCount,
  ])

  // Abort prefetch só ao trocar viagem ou desmontar (não a cada swipe).
  useEffect(() => {
    return () => {
      prefetchAbortRef.current?.abort()
      prefetchInFlightRef.current = false
    }
  }, [tripId])

  // Congela o TDV durante finalize: aborta discover/prefetch em voo (não compete com n8n).
  useEffect(() => {
    if (!finalizingTdv) return
    loadAbortRef.current?.abort()
    prefetchAbortRef.current?.abort()
    prefetchInFlightRef.current = false
    setPrefetchLoading(false)
  }, [finalizingTdv])

  return {
    places,
    setPlaces,
    placesRef,
    currentIndex,
    setCurrentIndex,
    totalLikes,
    setTotalLikes,
    likedPlaces,
    setLikedPlaces,
    dislikedPlaces,
    setDislikedPlaces,
    loading,
    introReady,
    prefetchLoading,
    error,
    setError,
    placesSource,
    deckUnavailable,
    setDeckUnavailable,
    freeCapReached,
    paidBatchCapReached,
    loadPlaces,
    handleRetryDeck,
    releaseDeckToServer,
    sessionDeckBaselineRef,
    consumedSinceSessionRef,
  }
}
