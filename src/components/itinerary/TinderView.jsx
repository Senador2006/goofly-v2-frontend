import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { EmptyState } from '../common/EmptyState'
import { placeService } from '../../services/placeService'
import { getPlaceCoverImageUrl, getPlaceVideoUrls } from '../../utils/placeImages'
import { getRequestErrorMessage } from '../../utils/errors'
import { useT } from '../../i18n'
import { PlaceCardGallery } from './PlaceCardGallery'
import { readLatLng } from '../../utils/coordinates'

function getPlaceId(p) {
  return p?.id ?? p?.placeId ?? p?.place_id
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

/** Só antecipa próximo lote quando restam poucas cartas (evita conflito com o 1º fetch da sessão). */
const PREFETCH_WHEN_REMAINING_AT_MOST = 3
/** Retentativas automáticas quando o baralho esvazia antes do próximo batch chegar. */
const EMPTY_DECK_PREFETCH_MAX_ATTEMPTS = 5
const EMPTY_DECK_PREFETCH_RETRY_MS = 2000

/**
 * TDV — mobile: pilha única (card · ações · finalizar/listas).
 * lg+: cartão à esquerda, painel finalizar + curtidas/descartes na lateral direita (sticky).
 */
export function TinderView({ tripId, trip, onItineraryUpdate, isActive, onTdvSatisfied, finalizingTdv = false }) {
  const t = useT()
  const [places, setPlaces] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentDay, setCurrentDay] = useState(1)
  const [totalLikes, setTotalLikes] = useState(0)
  const [likedPlaces, setLikedPlaces] = useState([])
  const [dislikedPlaces, setDislikedPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [prefetchLoading, setPrefetchLoading] = useState(false)
  const [error, setError] = useState(null)
  const [swipeFeedback, setSwipeFeedback] = useState(null)
  /** Pilha LIFO: desfazer só a última curtida/descarte (espelha o servidor). */
  const [undoStack, setUndoStack] = useState([])
  const [undoLoading, setUndoLoading] = useState(false)
  const [undoNotice, setUndoNotice] = useState(null)
  const undoBusyRef = useRef(false)

  const prefetchInFlightRef = useRef(false)
  const prefetchReturnedEmptyRef = useRef(false)
  /** Tamanho do baralho logo após o último `discoverSession` (ignora append de prefetch). */
  const sessionDeckBaselineRef = useRef(0)
  /** Após like/dislike que remove carta; volta a false no próximo session load ou undo que restaura o baseline. */
  const consumedSinceSessionRef = useRef(false)
  const loadGenRef = useRef(0)
  const loadAbortRef = useRef(null)
  const prefetchGenRef = useRef(0)
  const prefetchAbortRef = useRef(null)
  const prefetchEmptyAttemptsRef = useRef(0)
  const [emptyDeckRetryTick, setEmptyDeckRetryTick] = useState(0)

  const currentPlace = places[currentIndex]
  const placeVideoLinks = useMemo(
    () => (currentPlace ? getPlaceVideoUrls(currentPlace) : []),
    [currentPlace]
  )

  const loadPlaces = useCallback(async (day) => {
    if (!tripId) {
      setLoading(false)
      return
    }
    loadAbortRef.current?.abort()
    const ac = new AbortController()
    loadAbortRef.current = ac
    const gen = ++loadGenRef.current
    setLoading(true)
    setError(null)
    try {
      const res = await placeService.discoverSession(tripId, day, undefined, { signal: ac.signal })
      if (gen !== loadGenRef.current) return
      const p = res.places ?? []
      const cd = res.currentDay ?? 1
      const list = Array.isArray(p) ? p : []
      sessionDeckBaselineRef.current = list.length
      consumedSinceSessionRef.current = false
      setPlaces(list)
      setUndoStack([])
      setTotalLikes(res.totalLikes ?? 0)
      setLikedPlaces(res.likedPlaces || [])
      setDislikedPlaces(res.dislikedPlaces || [])
      setCurrentDay(day != null ? day : cd)
      setCurrentIndex(0)
    } catch (err) {
      if (gen !== loadGenRef.current) return
      const aborted =
        ac.signal.aborted ||
        err.code === 'ERR_CANCELED' ||
        err.name === 'CanceledError' ||
        err.message === 'canceled'
      if (aborted) return
      setError(getRequestErrorMessage(err))
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }, [tripId])

  const lastTripIdRef = useRef(null)
  useEffect(() => {
    if (lastTripIdRef.current !== tripId) {
      lastTripIdRef.current = tripId
      setPlaces([])
      setCurrentDay(1)
      setCurrentIndex(0)
      setLikedPlaces([])
      setDislikedPlaces([])
      setTotalLikes(0)
      setError(null)
      setUndoStack([])
      sessionDeckBaselineRef.current = 0
      consumedSinceSessionRef.current = false
    }
  }, [tripId])

  const deckKey = places
    .map((p) => getPlaceId(p))
    .filter(Boolean)
    .sort()
    .join('|')
  useEffect(() => {
    prefetchReturnedEmptyRef.current = false
    prefetchEmptyAttemptsRef.current = 0
  }, [deckKey])

  // Carrega ao ativar a aba / mudar viagem. Não incluir places.length nem loading nas deps:
  // com lista vazia (API ok) ou erro (ex.: 429), isso re-disparava o efeito em loop.
  useEffect(() => {
    if (!isActive || !tripId) return
    loadPlaces()
  }, [isActive, tripId, loadPlaces])

  // Antecipa o próximo lote quando o baralho encolheu (inclui baralho vazio — continuidade TDV).
  useEffect(() => {
    if (!isActive || !tripId || loading) return
    const n = places.length
    if (n > PREFETCH_WHEN_REMAINING_AT_MOST) return
    const baseline = sessionDeckBaselineRef.current
    if (n > 0 && baseline > 0 && n === baseline && !consumedSinceSessionRef.current) return
    if (prefetchInFlightRef.current) return
    if (n > 0 && prefetchReturnedEmptyRef.current) return

    const excludePlaceIds = places.map(getPlaceId).filter(Boolean)
    const existingIds = new Set(excludePlaceIds.map((id) => String(id)))

    prefetchAbortRef.current?.abort()
    const ac = new AbortController()
    prefetchAbortRef.current = ac
    const prefetchGen = ++prefetchGenRef.current

    let cancelled = false
    prefetchInFlightRef.current = true
    setPrefetchLoading(true)

    ;(async () => {
      try {
        const res = await placeService.discover(tripId, currentDay, excludePlaceIds, { signal: ac.signal })
        if (cancelled || prefetchGen !== prefetchGenRef.current) return
        const incoming = Array.isArray(res.places) ? res.places : []
        if (incoming.length === 0) {
          if (n === 0 && prefetchEmptyAttemptsRef.current < EMPTY_DECK_PREFETCH_MAX_ATTEMPTS) {
            prefetchEmptyAttemptsRef.current += 1
            window.setTimeout(() => {
              if (!cancelled && prefetchGen === prefetchGenRef.current) {
                setEmptyDeckRetryTick((t) => t + 1)
              }
            }, EMPTY_DECK_PREFETCH_RETRY_MS)
            return
          }
          prefetchReturnedEmptyRef.current = true
          return
        }
        prefetchEmptyAttemptsRef.current = 0
        let wouldAdd = 0
        for (const p of incoming) {
          const id = getPlaceId(p)
          const sid = id != null ? String(id) : ''
          if (sid && !existingIds.has(sid)) wouldAdd += 1
        }
        if (wouldAdd === 0) {
          if (n === 0 && prefetchEmptyAttemptsRef.current < EMPTY_DECK_PREFETCH_MAX_ATTEMPTS) {
            prefetchEmptyAttemptsRef.current += 1
            window.setTimeout(() => {
              if (!cancelled && prefetchGen === prefetchGenRef.current) {
                setEmptyDeckRetryTick((t) => t + 1)
              }
            }, EMPTY_DECK_PREFETCH_RETRY_MS)
            return
          }
          prefetchReturnedEmptyRef.current = true
          return
        }
        setPlaces((prev) => {
          const seen = new Set(
            prev.map(getPlaceId).filter(Boolean).map((id) => String(id))
          )
          const out = [...prev]
          for (const p of incoming) {
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
      } catch {
        // silencioso (abort ou rede): utilizador ainda tem cartas no baralho
        if (n === 0 && prefetchEmptyAttemptsRef.current < EMPTY_DECK_PREFETCH_MAX_ATTEMPTS) {
          prefetchEmptyAttemptsRef.current += 1
          window.setTimeout(() => {
            if (!cancelled && prefetchGen === prefetchGenRef.current) {
              setEmptyDeckRetryTick((t) => t + 1)
            }
          }, EMPTY_DECK_PREFETCH_RETRY_MS)
        }
      } finally {
        if (prefetchGen === prefetchGenRef.current) {
          prefetchInFlightRef.current = false
          setPrefetchLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [isActive, tripId, loading, places, currentDay, emptyDeckRetryTick])

  const handleNextDay = useCallback(async () => {
    if (!tripId) return
    const nextDay = currentDay + 1
    if (places.length > 0) {
      try {
        await placeService.cacheSkippedPlaces(tripId, places)
      } catch (err) {
        setError(getRequestErrorMessage(err, 'Erro ao avançar'))
        return
      }
    }
    await loadPlaces(nextDay)
    onItineraryUpdate?.()
  }, [tripId, places, currentDay, loadPlaces, onItineraryUpdate])

  const handleLike = useCallback(async () => {
    if (!currentPlace || !tripId) return
    const placeId = getPlaceId(currentPlace)
    if (!placeId) {
      setError('Lugar sem ID válido')
      return
    }
      setSwipeFeedback('like')
      setUndoNotice(null)
    setTimeout(() => setSwipeFeedback(null), 400)
    try {
      const latLng = readLatLng(currentPlace)
      const placeData = {
        name: currentPlace.name,
        description: currentPlace.description || currentPlace.aiReasoning,
        location:
          currentPlace.location ||
          (currentPlace.city && currentPlace.country ? `${currentPlace.city}, ${currentPlace.country}` : undefined),
        ...(latLng
          ? { coordinates: { latitude: latLng[0], longitude: latLng[1] } }
          : {}),
      }
      const res = await placeService.like(tripId, placeId, currentDay, placeData)
      setTotalLikes(typeof res?.likesUsedTotal === 'number' ? res.likesUsedTotal : totalLikes + 1)
      setCurrentDay(res?.currentDay ?? currentDay)
      setLikedPlaces((prev) => [{ placeId, name: currentPlace.name, day: res?.currentDay ?? currentDay }, ...prev])
      setPlaces((prev) => prev.filter((x) => getPlaceId(x) !== placeId))
      consumedSinceSessionRef.current = true
      setCurrentIndex(0)
      setUndoStack((prev) => [...prev, { type: 'like', place: { ...currentPlace } }])
      onItineraryUpdate?.()
    } catch (err) {
      setSwipeFeedback(null)
      setError(getRequestErrorMessage(err, 'Erro ao dar like'))
    }
  }, [currentPlace, tripId, currentDay, totalLikes, onItineraryUpdate])

  const handleDislike = useCallback(async () => {
    if (!currentPlace || !tripId) return
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
      setDislikedPlaces((prev) => [{ placeId, name: currentPlace.name }, ...prev].slice(0, 30))
      setPlaces((prev) => prev.filter((x) => getPlaceId(x) !== placeId))
      consumedSinceSessionRef.current = true
      setCurrentIndex(0)
      setUndoStack((prev) => [...prev, { type: 'dislike', place: { ...currentPlace } }])
    } catch (err) {
      setSwipeFeedback(null)
      setError(getRequestErrorMessage(err, 'Erro ao descartar'))
    }
  }, [currentPlace, tripId])

  const handleUndo = useCallback(async () => {
    if (!tripId || undoBusyRef.current) return

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
        if (typeof res?.currentDay === 'number') setCurrentDay(res.currentDay)
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
  }, [tripId, onItineraryUpdate])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!currentPlace) return
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
  }, [currentPlace, handleLike, handleDislike])

  const firstDest = trip?.destinations?.[0]
  const destTitle = firstDest ? `${firstDest.city}, ${firstDest.country}` : 'Sua viagem'

  const choicesPanel = (
    <div className="grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-2 lg:mx-0 lg:max-w-none lg:grid-cols-1 lg:gap-2">
      <div className="p-2.5 sm:p-3 rounded-xl bg-primary/[0.08] dark:bg-primary/[0.06] border border-primary/20">
        <h5 className="font-bold text-xs mb-0.5 flex items-center gap-1.5 text-foreground dark:text-white">
          <Icon name="favorite" className="text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
          Curtidas
        </h5>
        {likedPlaces.length === 0 ? (
          <p className="text-[11px] text-text-secondary">Nenhuma ainda</p>
        ) : (
          <ul className="space-y-1 max-h-20 overflow-y-auto mt-1">
            {likedPlaces.map((place, idx) => (
              <li
                key={`${place.placeId}-${idx}`}
                className="text-xs text-foreground dark:text-white flex items-start gap-2"
              >
                <Icon name="check_circle" className="text-primary text-sm shrink-0 mt-0.5" />
                <span className="line-clamp-2">{place.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="p-2.5 sm:p-3 rounded-xl bg-red-500/[0.07] border border-red-500/20">
        <h5 className="font-bold text-xs mb-0.5 flex items-center gap-1.5 text-foreground dark:text-white">
          <Icon name="close" className="text-sm text-red-500 dark:text-red-400" />
          Descartados
        </h5>
        {dislikedPlaces.length === 0 ? (
          <p className="text-[11px] text-text-secondary">Nenhum ainda</p>
        ) : (
          <ul className="space-y-1 max-h-20 overflow-y-auto mt-1">
            {dislikedPlaces.map((place, idx) => (
              <li
                key={`${place.placeId}-${idx}`}
                className="text-xs text-foreground dark:text-white/90 flex items-start gap-2"
              >
                <Icon name="not_interested" className="text-red-500/80 text-sm shrink-0 mt-0.5" />
                <span className="line-clamp-2">{place.name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  const finalizePanel = (
    <div className="relative z-[1] w-full max-w-xl lg:mx-0 lg:max-w-none mx-auto p-3 sm:p-4 rounded-2xl bg-white dark:bg-surface-dark/90 border border-border-light dark:border-border-dark shadow-sm">
      <p className="text-[11px] sm:text-xs text-text-secondary mb-2 leading-relaxed">
        Ao finalizar, a IA usa o formulário da viagem e, se houver, suas curtidas e descartes. Sem curtidas, o roteiro
        vem só do planejamento.
      </p>
      <Button onClick={onTdvSatisfied} disabled={finalizingTdv} className="w-full rounded-full py-2.5 sm:py-3">
        {finalizingTdv ? t('tdv.finalize_generating') : t('tdv.finalize_cta')}
      </Button>
      {totalLikes < 1 && (
        <p className="text-[10px] text-text-secondary mt-1.5 text-center">{t('tdv.finalize_hint')}</p>
      )}
    </div>
  )

  const belowFoldContent = (
    <>
      {finalizePanel}
      {(undoStack.length > 0 || undoLoading || undoNotice) && (
        <div className="w-full max-w-xl lg:mx-0 lg:max-w-none mx-auto flex flex-col items-center gap-1 lg:items-stretch">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={undoStack.length === 0 || undoLoading}
            className="rounded-full"
            onClick={handleUndo}
            aria-label="Desfazer última ação no TDV"
          >
            <Icon name="undo" className="text-lg" />
            {undoLoading ? 'Desfazendo...' : 'Desfazer última ação'}
          </Button>
          {undoNotice && (
            <p className="text-[11px] text-red-500 dark:text-red-400 text-center px-2">{undoNotice}</p>
          )}
        </div>
      )}
      {choicesPanel}
    </>
  )

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-background-light dark:bg-card-dark" role="status" aria-live="polite">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background-light dark:bg-card-dark">
        <div className="max-w-md w-full p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-2xl text-sm text-center" role="alert">
          {error}
        </div>
        <Button
          variant="secondary"
          className="mt-4 rounded-full"
          onClick={() => {
            setError(null)
            loadPlaces(currentDay)
          }}
        >
          Tentar de novo
        </Button>
      </div>
    )
  }

  // Reserva ~15rem para header app + faixa TDV + dica + botões; teto em px evita cartão gigante em monitores altos.
  const cardSurface =
    'w-[min(100%,24rem)] sm:w-full lg:w-full mx-auto lg:mx-0 aspect-[3/4] max-h-[min(56dvh,400px)] sm:max-h-[min(53dvh,420px)] md:max-h-[min(50dvh,400px)] lg:max-h-[min(calc(100dvh-15rem),380px)] xl:max-h-[min(calc(100dvh-15rem),400px)] 2xl:max-h-[min(calc(100dvh-15rem),420px)] rounded-2xl sm:rounded-3xl'

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain bg-gradient-to-b from-background-light to-white dark:from-card-dark dark:to-background-dark">
      <div className="flex-shrink-0 px-3 sm:px-4 py-2 border-b border-border-light/70 dark:border-border-dark/70 bg-white/50 dark:bg-card-dark/30">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 max-w-3xl mx-auto w-full">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{t('tdv.title')}</p>
            <p className="text-base sm:text-lg font-bold text-foreground dark:text-white truncate">{destTitle}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark">
              <Icon name="calendar_today" className="text-xs text-primary" />
              {t('tdv.day_label', { day: currentDay })}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark">
              <Icon name="favorite" className="text-xs text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
              {totalLikes === 1
                ? t('tdv.likes_one', { count: totalLikes })
                : t('tdv.likes_other', { count: totalLikes })}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] lg:pb-6">
        <div className="mx-auto w-full max-w-lg px-3 pt-4 sm:px-5 sm:pt-4 lg:max-w-[90rem] xl:max-w-[96rem] 2xl:max-w-[110rem] lg:px-6 xl:px-8 lg:pt-4">
          {currentPlace ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(14rem,16rem)] lg:items-start lg:gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] xl:gap-8 2xl:gap-10">
              <div className="flex min-w-0 w-full flex-col gap-3 sm:gap-4 lg:gap-4">
                <div className="relative isolate mx-auto mt-1 flex w-full max-w-[min(100%,24rem)] justify-center pb-8 sm:max-w-none sm:pb-10 lg:mx-0 lg:w-full lg:pb-6">
                  {places[currentIndex + 1] && (
                    <div
                      className={`pointer-events-none absolute left-1/2 top-0 z-0 ${cardSurface} -translate-x-1/2 origin-top overflow-hidden shadow-lg border border-border-light dark:border-border-dark bg-card-dark scale-[0.92] opacity-55`}
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
                    className={`relative z-[1] ${cardSurface} overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/5 dark:ring-white/10 transition-[transform,opacity] duration-300 group bg-card-dark motion-reduce:transition-none ${
                      swipeFeedback === 'like'
                        ? 'ring-4 ring-primary sm:translate-y-px motion-reduce:translate-y-0'
                        : ''
                    } ${swipeFeedback === 'dislike' ? 'opacity-[0.92] sm:translate-y-0.5 motion-reduce:translate-y-0' : ''}`}
                  >
                    <PlaceCardGallery place={currentPlace} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none z-[10]" />
                    {/* z acima da faixa de zoom da galeria (z-30), senão o toque médio captura o clique dos links de vídeo */}
                    <div className="absolute bottom-0 left-0 right-0 z-[40] px-4 pb-3 pt-10 text-white pointer-events-none sm:px-5 sm:pb-4 sm:pt-12">
                      <div className="flex gap-1.5 mb-1.5 overflow-x-auto no-scrollbar">
                        {(currentPlace.tags || currentPlace.categories || []).filter(Boolean).map((tag) => {
                          const label = typeof tag === 'string' ? tag : tag?.name || tag?.label || String(tag)
                          return (
                            <span
                              key={label}
                              className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider whitespace-nowrap"
                            >
                              {label}
                            </span>
                          )
                        })}
                      </div>
                      <h2 className="text-lg sm:text-2xl font-extrabold mb-1.5 leading-snug drop-shadow-md line-clamp-3">
                        {currentPlace.name}
                      </h2>
                      <div className="flex min-w-0 items-center gap-1.5 text-white/90 mb-1">
                        <Icon name="location_on" className="text-sm shrink-0" />
                        <span className="text-xs font-medium truncate">
                          {currentPlace.location ||
                            (currentPlace.city && currentPlace.country
                              ? `${currentPlace.city}, ${currentPlace.country}`
                              : currentPlace.city || currentPlace.country || 'Destino')}
                        </span>
                      </div>
                      <p className="text-[11px] sm:text-sm text-white/90 leading-relaxed line-clamp-2 lg:line-clamp-3">
                        {currentPlace.description || currentPlace.aiReasoning || 'Descubra este lugar.'}
                      </p>
                      {placeVideoLinks.length > 0 ? (
                        <div className="mt-2.5 pointer-events-auto border-t border-white/15 pt-2.5 text-left">
                          <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-white/75">
                            {t('tdv.video_links_heading')}
                          </p>
                          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                            {placeVideoLinks.map((href, i) => (
                              <li key={`${href}-${i}`} className="min-w-0">
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-white underline decoration-white/50 underline-offset-2 transition-colors hover:text-white hover:decoration-white"
                                  aria-label={t('tdv.video_link_aria', { n: i + 1 })}
                                >
                                  <Icon name="videocam" className="shrink-0 text-sm text-white/90" />
                                  <span className="min-w-0 truncate">
                                    {t('tdv.video_link_label', { n: i + 1, source: videoLinkLabel(href) })}
                                  </span>
                                  <Icon name="open_in_new" className="shrink-0 text-xs text-white/70" aria-hidden />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                <p className="mx-auto max-w-[min(100%,24rem)] shrink-0 px-4 text-center text-[10px] leading-relaxed text-text-secondary sm:max-w-none sm:text-[11px] lg:px-0">
                  {t('tdv.photo_hint')}
                </p>

                <div className="relative z-[30] isolate mx-auto flex w-full max-w-[18rem] shrink-0 justify-between gap-6 px-6 pt-0.5 sm:max-w-none sm:justify-center sm:gap-[4.75rem] sm:px-16 lg:px-4">
                  <button
                    type="button"
                    onClick={handleDislike}
                    className="flex size-[3.25rem] shrink-0 items-center justify-center rounded-full border border-border-light bg-white text-text-secondary shadow-lg ring-1 ring-border-light/90 active:scale-95 motion-safe:transition-[transform,colors] hover:text-red-500 dark:border-border-dark dark:bg-card-dark dark:ring-white/15 hover:shadow-xl sm:size-14"
                    aria-label="Descartar"
                  >
                    <Icon name="close" className="text-2xl sm:text-3xl" />
                  </button>
                  <button
                    type="button"
                    onClick={handleLike}
                    className="flex size-[3.625rem] shrink-0 items-center justify-center rounded-full bg-primary text-foreground shadow-primary-glow dark:shadow-primary-glow-dark ring-2 ring-primary/15 active:scale-95 motion-safe:transition-transform sm:size-16"
                    aria-label="Curtir"
                  >
                    <Icon name="favorite" className="text-3xl sm:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }} />
                  </button>
                </div>
              </div>

              <aside className="flex min-w-0 flex-col gap-3 border-t border-border-light/60 pt-5 dark:border-border-dark/55 lg:sticky lg:top-3 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:border-t-0 lg:pt-0 lg:gap-4">
                {belowFoldContent}
              </aside>
            </div>
          ) : prefetchLoading ? (
          <div className="w-full py-12 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
            <LoadingSpinner />
            <p className="text-sm text-text-secondary">Buscando mais lugares...</p>
          </div>
          ) : (
          <div className="w-full py-4">
            <EmptyState
              icon="explore"
              title="Sem mais lugares agora"
              description="Avance o dia ou recarregue. Quando quiser, finalize para gerar o roteiro."
              action={
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button onClick={handleNextDay} className="rounded-full">
                    Próximo dia
                  </Button>
                  <Button variant="outline" onClick={() => loadPlaces(currentDay)} className="rounded-full">
                    Recarregar
                  </Button>
                </div>
              }
            />
            <div className="flex flex-col gap-4 mt-8 pt-4 border-t border-border-light/50 dark:border-border-dark/60">
              {belowFoldContent}
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
