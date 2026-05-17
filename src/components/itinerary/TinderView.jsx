import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { EmptyState } from '../common/EmptyState'
import { placeService } from '../../services/placeService'
import { getPlaceCoverImageUrl } from '../../utils/placeImages'
import { getRequestErrorMessage } from '../../utils/errors'
import { useT } from '../../i18n'
import { PlaceCardGallery } from './PlaceCardGallery'

function getPlaceId(p) {
  return p?.id ?? p?.placeId ?? p?.place_id
}

/** Quando restam poucos cards, pede discover em background (servidor: cache ou 1 batch n8n). */
const PREFETCH_WHEN_REMAINING_AT_MOST = 5

/**
 * TDV — uma coluna principal: card em destaque, resumo e histórico abaixo (sem terceira barra lateral).
 */
export function TinderView({ tripId, trip, onItineraryUpdate, isActive, onTdvSatisfied, finalizingTdv = false }) {
  const t = useT()
  const navigate = useNavigate()
  const [places, setPlaces] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentDay, setCurrentDay] = useState(1)
  const [totalLikes, setTotalLikes] = useState(0)
  const [likedPlaces, setLikedPlaces] = useState([])
  const [dislikedPlaces, setDislikedPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [swipeFeedback, setSwipeFeedback] = useState(null)
  const [tdvRestriction, setTdvRestriction] = useState(null)
  /** Pilha LIFO: desfazer só a última curtida/descarte (espelha o servidor). */
  const [undoStack, setUndoStack] = useState([])
  const [undoLoading, setUndoLoading] = useState(false)
  const [undoNotice, setUndoNotice] = useState(null)
  const undoBusyRef = useRef(false)

  const prefetchInFlightRef = useRef(false)
  const prefetchReturnedEmptyRef = useRef(false)

  const currentPlace = places[currentIndex]

  const loadPlaces = useCallback(async (day) => {
    if (!tripId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await placeService.discoverSession(tripId, day)
      const p = res.places ?? []
      const cd = res.currentDay ?? 1
      setTdvRestriction(res.tdvRestriction ?? null)
      setPlaces(Array.isArray(p) ? p : [])
      setUndoStack([])
      setTotalLikes(res.totalLikes ?? 0)
      setLikedPlaces(res.likedPlaces || [])
      setDislikedPlaces(res.dislikedPlaces || [])
      setCurrentDay(day != null ? day : cd)
      setCurrentIndex(0)
    } catch (err) {
      setError(getRequestErrorMessage(err))
    } finally {
      setLoading(false)
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
      setTdvRestriction(null)
      setError(null)
      setUndoStack([])
    }
  }, [tripId])

  const deckKey = places
    .map((p) => getPlaceId(p))
    .filter(Boolean)
    .sort()
    .join('|')
  useEffect(() => {
    prefetchReturnedEmptyRef.current = false
  }, [deckKey])

  // Carrega ao ativar a aba / mudar viagem. Não incluir places.length nem loading nas deps:
  // com lista vazia (API ok) ou erro (ex.: 429), isso re-disparava o efeito em loop.
  useEffect(() => {
    if (!isActive || !tripId) return
    loadPlaces()
  }, [isActive, tripId, loadPlaces])

  // Antecipa o próximo lote quando o baralho está baixo (back: cache TDV ou 1 batch sync ao agente).
  useEffect(() => {
    if (!isActive || !tripId || loading) return
    const n = places.length
    if (n === 0 || n > PREFETCH_WHEN_REMAINING_AT_MOST) return
    if (prefetchInFlightRef.current || prefetchReturnedEmptyRef.current) return

    const excludePlaceIds = places.map(getPlaceId).filter(Boolean)
    if (excludePlaceIds.length === 0) return

    const existingIds = new Set(excludePlaceIds.map((id) => String(id)))

    let cancelled = false
    prefetchInFlightRef.current = true

    ;(async () => {
      try {
        const res = await placeService.discover(tripId, currentDay, excludePlaceIds)
        if (cancelled) return
        const incoming = Array.isArray(res.places) ? res.places : []
        if (incoming.length === 0) {
          if (res.tdvRestriction) setTdvRestriction(res.tdvRestriction)
          else prefetchReturnedEmptyRef.current = true
          return
        }
        let wouldAdd = 0
        for (const p of incoming) {
          const id = getPlaceId(p)
          const sid = id != null ? String(id) : ''
          if (sid && !existingIds.has(sid)) wouldAdd += 1
        }
        if (wouldAdd === 0) {
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
        setTdvRestriction(res.tdvRestriction ?? null)
        if (typeof res.totalLikes === 'number') setTotalLikes(res.totalLikes)
      } catch {
        // silencioso: o utilizador ainda tem cartas no baralho
      } finally {
        prefetchInFlightRef.current = false
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isActive, tripId, loading, places, currentDay])

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
      const placeData = {
        name: currentPlace.name,
        description: currentPlace.description || currentPlace.aiReasoning,
        location:
          currentPlace.location ||
          (currentPlace.city && currentPlace.country ? `${currentPlace.city}, ${currentPlace.country}` : undefined),
      }
      const res = await placeService.like(tripId, placeId, currentDay, placeData)
      setTotalLikes(typeof res?.likesUsedTotal === 'number' ? res.likesUsedTotal : totalLikes + 1)
      setCurrentDay(res?.currentDay ?? currentDay)
      setLikedPlaces((prev) => [{ placeId, name: currentPlace.name, day: res?.currentDay ?? currentDay }, ...prev])
      setPlaces((prev) => prev.filter((x) => getPlaceId(x) !== placeId))
      setCurrentIndex(0)
      setUndoStack((prev) => [...prev, { type: 'like', place: { ...currentPlace } }])
      onItineraryUpdate?.()
    } catch (err) {
      setSwipeFeedback(null)
      const code = err.response?.data?.error?.code
      const msg = err.response?.data?.error?.message || err.message || 'Erro ao dar like'
      if (code === 'TDV_DAY_LIMIT') {
        setError(null)
        setPlaces([])
        setTdvRestriction({ message: msg })
      } else {
        setError(getRequestErrorMessage(err, 'Erro ao dar like'))
      }
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
        return [entry.place, ...filtered]
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl mx-auto">
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
    <div className="w-full max-w-xl mx-auto p-3 sm:p-4 rounded-2xl bg-white dark:bg-surface-dark/90 border border-border-light dark:border-border-dark shadow-sm">
      <p className="text-[11px] sm:text-xs text-text-secondary mb-2 leading-relaxed">
        Ao finalizar, a IA combina o formulário da viagem com suas curtidas e descartes para montar o roteiro.
      </p>
      <Button onClick={onTdvSatisfied} disabled={finalizingTdv || totalLikes < 1} className="w-full rounded-full py-2.5 sm:py-3">
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
        <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-1">
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

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-background-light to-white dark:from-card-dark dark:to-background-dark">
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
            {tdvRestriction?.maxDays != null && tdvRestriction?.tripDays != null && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/25">
                {t('tdv.free_badge', {
                  maxDays: tdvRestriction.maxDays,
                  tripDays: tdvRestriction.tripDays,
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col min-h-[calc(100%-2.75rem)]">
      <section className="flex-1 flex flex-col justify-center px-4 sm:px-6 pt-2 pb-1 min-h-0">
        <div className="w-full max-w-lg sm:max-w-xl mx-auto flex flex-col items-center gap-2.5">
          {currentPlace ? (
            <>
              <div className="relative w-full flex justify-center items-end">
              {places[currentIndex + 1] && (
                <div
                  className="absolute w-[94%] aspect-[3/4] max-h-[min(48dvh,320px)] sm:max-h-[min(52dvh,360px)] rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-border-light dark:border-border-dark bg-card-dark"
                  style={{ transform: 'scale(0.94)', opacity: 0.55 }}
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
                className={`relative w-full aspect-[3/4] max-h-[min(48dvh,320px)] sm:max-h-[min(52dvh,360px)] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-300 group ${
                  swipeFeedback === 'like' ? 'scale-[1.02] ring-4 ring-primary' : ''
                } ${swipeFeedback === 'dislike' ? 'scale-[0.98] opacity-85' : ''}`}
              >
                <PlaceCardGallery place={currentPlace} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent pointer-events-none z-[10]" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 text-white z-[18] pointer-events-none">
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
                    <h2 className="text-xl sm:text-2xl font-extrabold mb-1 leading-tight drop-shadow-md line-clamp-2">
                      {currentPlace.name}
                    </h2>
                    <div className="flex items-center gap-1.5 text-white/90 mb-1">
                      <Icon name="location_on" className="text-sm shrink-0" />
                      <span className="text-xs font-medium truncate">
                        {currentPlace.location ||
                          (currentPlace.city && currentPlace.country
                            ? `${currentPlace.city}, ${currentPlace.country}`
                            : currentPlace.city || currentPlace.country || 'Destino')}
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-white/90 leading-snug line-clamp-2">
                      {currentPlace.description || currentPlace.aiReasoning || 'Descubra este lugar.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-7 sm:gap-9">
                <button
                  type="button"
                  onClick={handleDislike}
                  className="size-12 sm:size-14 rounded-full bg-white dark:bg-card-dark flex items-center justify-center text-text-secondary hover:text-red-500 hover:shadow-xl hover:scale-105 active:scale-95 transition-all border-2 border-border-light dark:border-border-dark"
                  aria-label="Descartar"
                >
                  <Icon name="close" className="text-2xl sm:text-3xl" />
                </button>
                <button
                  type="button"
                  onClick={handleLike}
                  className="size-14 sm:size-16 rounded-full bg-primary flex items-center justify-center text-foreground shadow-primary hover:scale-105 active:scale-95 transition-all"
                  aria-label="Curtir"
                >
                  <Icon name="favorite" className="text-3xl sm:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }} />
                </button>
              </div>
              <p className="text-[10px] sm:text-[11px] text-text-secondary text-center max-w-sm leading-snug">
                {t('tdv.photo_hint')}
              </p>
            </>
          ) : tdvRestriction ? (
            <div className="text-center max-w-md px-2 py-4 w-full">
              <div className="size-12 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-2">
                <Icon name="lock" className="text-xl text-primary" />
              </div>
              <h3 className="text-base font-bold text-foreground dark:text-white mb-1">Limite do plano gratuito</h3>
              <p className="text-text-secondary text-sm mb-4 leading-relaxed">{tdvRestriction.message}</p>
              <Button
                type="button"
                className="rounded-full"
                onClick={() => navigate(`/pagamento?tripId=${encodeURIComponent(tripId)}`)}
              >
                <Icon name="workspace_premium" />
                Planejamento Completo
              </Button>
            </div>
          ) : (
            <div className="w-full py-2">
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
            </div>
          )}

          {(undoStack.length > 0 || undoLoading || undoNotice) && (
            <div className="w-full max-w-xl flex flex-col items-center gap-1">
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

          <div className="w-full max-w-xl p-4 sm:p-5 rounded-2xl bg-white dark:bg-surface-dark/80 border border-border-light dark:border-border-dark shadow-sm">
            <p className="text-xs sm:text-sm text-text-secondary mb-3 leading-relaxed">
              Ao finalizar, a IA monta o roteiro com base no formulário da viagem
              {totalLikes > 0 ? ', nas suas curtidas e descartes do TDV' : ''}. O TDV é opcional — você pode
              gerar o roteiro mesmo sem curtir lugares.
            </p>
            <Button onClick={onTdvSatisfied} disabled={finalizingTdv} className="w-full rounded-full py-3">
              {finalizingTdv ? 'Gerando roteiro...' : 'Gerar roteiro'}
            </Button>
          </div>
        </div>
      </section>

      </div>

      <div className="px-4 sm:px-6 pb-6 mt-8 sm:mt-6 pt-1">
        <div className="w-full max-w-lg sm:max-w-xl mx-auto flex flex-col gap-2.5">{belowFoldContent}</div>
      </div>
    </div>
  )
}
