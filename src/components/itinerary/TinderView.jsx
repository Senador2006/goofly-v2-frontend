import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { EmptyState } from '../common/EmptyState'
import { placeService } from '../../services/placeService'

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80'
const LIKES_PER_DAY = 5

function getDisplayImageUrl(value) {
  if (value == null) return PLACEHOLDER_IMAGE
  const s = typeof value === 'string' ? value.trim() : String(value)
  const urlMatch = s.match(/https?:\/\/[^\s)]+/i)
  if (urlMatch) return urlMatch[0].replace(/[)\],]+$/, '')
  if (/^https?:\/\//i.test(s)) return s
  return value || PLACEHOLDER_IMAGE
}

function getRequestErrorMessage(err, fallback = 'Erro ao carregar lugares') {
  const status = err.response?.status
  if (status === 429) {
    return 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.'
  }
  return err.response?.data?.error?.message || fallback
}

/**
 * TDV — Tinder de Viagens
 * Lugares em cards (info + links). Like → roteiro; recusados/não vistos → cache para outros dias.
 * 5 likes por dia; 25% dos dias gratuitos (tripLimitService no backend).
 * Só chama discover quando está ativo (aba TDV) e a lista de lugares está vazia — evita gastar requests ao sair/voltar.
 */
export function TinderView({ tripId, trip, onItineraryUpdate, isActive }) {
  const [places, setPlaces] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [likesRemaining, setLikesRemaining] = useState(LIKES_PER_DAY)
  const [likesUsed, setLikesUsed] = useState(0)
  const [currentDay, setCurrentDay] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [swipeFeedback, setSwipeFeedback] = useState(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [totalTripDays, setTotalTripDays] = useState(null)
  const [freeMaxDays, setFreeMaxDays] = useState(null)
  const [upgradeRequired, setUpgradeRequired] = useState(false)
  const autoLoadAttemptedRef = useRef(false)

  const currentPlace = places[currentIndex]
  const dayFull = likesRemaining <= 0 && likesUsed >= LIKES_PER_DAY
  const atFreeDayLimit = freeMaxDays != null && currentDay > freeMaxDays
  const likeDisabled = likesRemaining <= 0 || atFreeDayLimit
  const showLimitReached = upgradeRequired || (atFreeDayLimit && !currentPlace)

  const loadPlaces = useCallback(async (day) => {
    if (!tripId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await placeService.discover(tripId, day)
      const p = res.places ?? []
      const lr = res.likesRemaining ?? LIKES_PER_DAY
      const limit = res.likesLimit ?? LIKES_PER_DAY
      const cd = res.currentDay ?? 1
      setPlaces(Array.isArray(p) ? p : [])
      setLikesRemaining(lr)
      setLikesUsed((limit ?? LIKES_PER_DAY) - lr)
      setCurrentDay(day != null ? day : cd)
      setCurrentIndex(0)
      if (res.totalTripDays != null) setTotalTripDays(res.totalTripDays)
      if (res.freeMaxDays != null) setFreeMaxDays(res.freeMaxDays)
      setUpgradeRequired(Boolean(res.upgradeRequired))
      if (res.upgradeRequired) setShowUpgradeModal(true)
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
      setError(null)
      autoLoadAttemptedRef.current = false
    }
  }, [tripId])

  useEffect(() => {
    if (!isActive) return
    if (places.length > 0) return
    if (autoLoadAttemptedRef.current) return

    autoLoadAttemptedRef.current = true
    loadPlaces()
  }, [isActive, places.length, loadPlaces])

  const handleNextDay = useCallback(async () => {
    if (!tripId) return
    const nextDay = currentDay + 1
    if (freeMaxDays != null && nextDay > freeMaxDays) {
      setShowUpgradeModal(true)
      return
    }
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
  }, [tripId, places, currentDay, freeMaxDays, loadPlaces, onItineraryUpdate])

  const getPlaceId = (p) => p?.id ?? p?.placeId ?? p?.place_id

  const handleLike = useCallback(async () => {
    if (!currentPlace || !tripId || likesRemaining <= 0) return
    const placeId = getPlaceId(currentPlace)
    if (!placeId) {
      setError('Lugar sem ID válido')
      return
    }
    setSwipeFeedback('like')
    setTimeout(() => setSwipeFeedback(null), 400)
    try {
      const placeData = {
        name: currentPlace.name,
        description: currentPlace.description || currentPlace.aiReasoning,
        location: currentPlace.location || (currentPlace.city && currentPlace.country ? `${currentPlace.city}, ${currentPlace.country}` : undefined)
      }
      const res = await placeService.like(tripId, placeId, currentDay, placeData)
      setLikesRemaining(typeof res?.likesRemaining === 'number' ? res.likesRemaining : Math.max(0, likesRemaining - 1))
      setLikesUsed((u) => u + 1)
      setCurrentDay(res?.currentDay ?? currentDay)
      setPlaces((prev) => prev.filter((x) => getPlaceId(x) !== placeId))
      setCurrentIndex(0)
      onItineraryUpdate?.()
    } catch (err) {
      setSwipeFeedback(null)
      const code = err.response?.data?.error?.code
      if (code === 'UPGRADE_REQUIRED') {
        setShowUpgradeModal(true)
        setError(null)
      } else {
        setError(getRequestErrorMessage(err, 'Erro ao dar like'))
      }
    }
  }, [currentPlace, tripId, currentDay, likesRemaining, onItineraryUpdate])

  const handleDislike = useCallback(async () => {
    if (!currentPlace || !tripId) return
    const placeId = getPlaceId(currentPlace)
    if (!placeId) {
      setError('Lugar sem ID válido')
      return
    }
    setSwipeFeedback('dislike')
    setTimeout(() => setSwipeFeedback(null), 400)
    try {
      await placeService.dislike(tripId, placeId, currentPlace)
      setPlaces((prev) => prev.filter((x) => getPlaceId(x) !== placeId))
      setCurrentIndex(0)
    } catch (err) {
      setSwipeFeedback(null)
      setError(getRequestErrorMessage(err, 'Erro ao descartar'))
    }
  }, [currentPlace, tripId])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!currentPlace) return
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleDislike()
      }
      if (e.key === 'ArrowRight' && !likeDisabled) {
        e.preventDefault()
        handleLike()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [currentPlace, likeDisabled, handleLike, handleDislike])

  if (loading) return <LoadingSpinner />
  if (error) {
    return (
      <div className="p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm">
        <p>{error}</p>
        <Button
          variant="secondary"
          className="mt-3"
          onClick={() => {
            autoLoadAttemptedRef.current = true
            setError(null)
            loadPlaces(currentDay)
          }}
        >
          Tentar novamente
        </Button>
      </div>
    )
  }

  const firstDest = trip?.destinations?.[0]
  const likesLimit = likesRemaining + likesUsed

  return (
    <div className="flex flex-1 flex-col lg:flex-row overflow-hidden bg-background-light dark:bg-[#23220f]">
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark rounded-2xl shadow-xl max-w-md w-full p-6 border border-border-light dark:border-border-dark">
            <div className="flex justify-end">
              <button type="button" onClick={() => setShowUpgradeModal(false)} className="text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white p-1" aria-label="Fechar">
                <Icon name="close" />
              </button>
            </div>
            <div className="rounded-full bg-primary/20 w-12 h-12 flex items-center justify-center mb-4">
              <Icon name="lock" className="text-2xl text-primary" />
            </div>
            <h2 className="text-xl font-bold text-[#1c1c0d] dark:text-white mb-2">Limite atingido</h2>
            <p className="text-text-secondary text-sm mb-6">
              Só 25% dos dias da viagem são gratuitos. Adquira o planejamento completo para usar o TDV em todos os dias.
            </p>
            <Link to={tripId ? `/pagamento?tripId=${tripId}` : '/pagamento'} className="block w-full">
              <Button className="w-full rounded-full font-bold">Adquirir planejamento completo</Button>
            </Link>
            <button type="button" onClick={() => setShowUpgradeModal(false)} className="w-full mt-3 py-2 text-sm text-text-secondary hover:text-[#1c1c0d] dark:hover:text-white">
              Fechar
            </button>
          </div>
        </div>
      )}

      <aside className="hidden xl:flex w-80 flex-col border-r border-border-light dark:border-border-dark p-6 md:p-8 bg-white dark:bg-card-dark overflow-y-auto">
        <div className="mb-10">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary mb-4">Sua Jornada</h3>
          <h4 className="text-xl font-bold text-[#1c1c0d] dark:text-white">
            {firstDest ? `${firstDest.city}, ${firstDest.country}` : 'Viagem'}
          </h4>
        </div>
        <div className="mb-10 p-5 rounded-xl bg-primary/10 dark:bg-primary/5 border border-primary/20">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-bold text-[#1c1c0d] dark:text-white">Dia {currentDay} — Likes</span>
            <span className="text-sm font-bold text-[#1c1c0d] dark:text-white">{likesUsed}/{likesLimit}</span>
          </div>
          <div className="h-2 w-full bg-surface-light dark:bg-surface-dark rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${likesLimit ? (likesUsed / likesLimit) * 100 : 0}%` }} />
          </div>
          {dayFull && places.length > 0 && !atFreeDayLimit && (
            <Button onClick={handleNextDay} className="w-full mt-3 rounded-full">Próximo dia →</Button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-8 min-h-0">
        <div className="w-full max-w-3xl xl:max-w-4xl flex flex-col items-center">
          {currentPlace ? (
            <>
              <div className="relative w-full flex justify-center items-center" style={{ minHeight: 'min(70vh, 520px)' }}>
                {places[currentIndex + 1] && (
                  <div
                    className="absolute w-[92%] max-w-3xl aspect-[4/5] rounded-2xl overflow-hidden shadow-lg border border-border-light dark:border-border-dark bg-white dark:bg-card-dark transition-transform duration-300"
                    style={{ transform: 'scale(0.92)', opacity: 0.6 }}
                  >
                    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${getDisplayImageUrl(places[currentIndex + 1].image_url || places[currentIndex + 1].imageUrl)})` }} />
                  </div>
                )}
                <div
                  className={`relative w-full max-w-3xl aspect-[3/4] md:aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-border-light dark:border-border-dark transition-transform duration-300 group ${swipeFeedback === 'like' ? 'scale-105 ring-4 ring-primary' : ''} ${swipeFeedback === 'dislike' ? 'scale-95 opacity-80' : ''}`}
                >
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${getDisplayImageUrl(currentPlace.image_url || currentPlace.imageUrl)})` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 text-white">
                    <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
                      {(currentPlace.tags || currentPlace.categories || []).filter(Boolean).map((tag) => {
                        const label = typeof tag === 'string' ? tag : (tag?.name || tag?.label || String(tag))
                        return (
                          <span key={label} className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                            {label}
                          </span>
                        )
                      })}
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-2 leading-tight">{currentPlace.name}</h1>
                    <div className="flex items-center gap-2 text-white/90 mb-3">
                      <Icon name="location_on" className="text-sm shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {currentPlace.location || (currentPlace.city && currentPlace.country ? `${currentPlace.city}, ${currentPlace.country}` : currentPlace.city || currentPlace.country || 'Destino')}
                      </span>
                    </div>
                    <p className="text-base text-white/90 max-w-lg leading-relaxed line-clamp-3">{currentPlace.description || currentPlace.aiReasoning || 'Descubra este lugar.'}</p>
                    {(currentPlace.videoLinks || currentPlace.video_links)?.length > 0 && (
                      <a
                        href={(currentPlace.videoLinks || currentPlace.video_links)[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-sm text-white/90 hover:text-white font-medium"
                      >
                        <Icon name="play_circle" className="text-lg" />
                        Ver Reel no Instagram
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-6 md:gap-8 mt-6 md:mt-8">
                <button
                  type="button"
                  onClick={handleDislike}
                  className="size-14 md:size-20 rounded-full bg-white dark:bg-card-dark flex items-center justify-center text-text-secondary hover:text-red-500 hover:shadow-xl hover:scale-110 active:scale-95 transition-all border border-border-light dark:border-border-dark"
                  aria-label="Descartar"
                >
                  <Icon name="close" className="text-3xl md:text-4xl" />
                </button>
                <button
                  type="button"
                  onClick={handleLike}
                  disabled={likeDisabled}
                  className="size-14 md:size-20 rounded-full bg-primary flex items-center justify-center text-[#1c1c0d] hover:shadow-[0_10px_30px_rgba(249,245,6,0.4)] hover:scale-110 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                  aria-label="Curtir"
                  title={atFreeDayLimit ? 'Limite gratuito (25% dos dias). Faça upgrade.' : undefined}
                >
                  <Icon name="favorite" className="text-3xl md:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }} />
                </button>
              </div>
              <p className="text-xs text-text-secondary mt-3">Setas ← → do teclado: descartar ou curtir.</p>
            </>
          ) : showLimitReached ? (
            <EmptyState
              icon="lock"
              title="Limite atingido"
              description="Só 25% dos dias são gratuitos. Adquira o planejamento completo para continuar."
              action={
                <Link to={tripId ? `/pagamento?tripId=${tripId}` : '/pagamento'} className="block w-full max-w-xs mx-auto">
                  <Button className="w-full rounded-full font-bold py-4">Adquirir planejamento completo</Button>
                </Link>
              }
            />
          ) : dayFull && places.length === 0 ? (
            <EmptyState
              icon="explore"
              title="Dia completo!"
              description="Avance para o próximo dia ou recarregue para ver mais sugestões."
              action={
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button
                    onClick={async () => {
                      if (freeMaxDays != null && currentDay + 1 > freeMaxDays) {
                        setShowUpgradeModal(true)
                        return
                      }
                      await loadPlaces(currentDay + 1)
                      onItineraryUpdate?.()
                    }}
                    className="rounded-full"
                  >
                    Próximo dia
                  </Button>
                  <Button variant="outline" onClick={() => loadPlaces(currentDay)} className="rounded-full">Recarregar</Button>
                </div>
              }
            />
          ) : (
            <EmptyState
              icon="explore"
              title="Sem mais lugares agora"
              description="Avance para o próximo dia ou recarregue."
              action={
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button
                    onClick={async () => {
                      if (freeMaxDays != null && currentDay + 1 > freeMaxDays) {
                        setShowUpgradeModal(true)
                        return
                      }
                      await loadPlaces(currentDay + 1)
                      onItineraryUpdate?.()
                    }}
                    className="rounded-full"
                  >
                    Próximo dia
                  </Button>
                  <Button variant="outline" onClick={() => loadPlaces()} className="rounded-full">Recarregar</Button>
                </div>
              }
            />
          )}
        </div>
      </main>
    </div>
  )
}
