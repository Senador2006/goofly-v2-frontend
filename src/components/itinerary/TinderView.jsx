import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { LoadingSpinner } from '../common/LoadingSpinner'
import { EmptyState } from '../common/EmptyState'
import { getPlaceCoverImageUrl, getPlaceVideoUrls } from '../../utils/placeImages'
import { getTdvPlaceId } from '../../utils/tdvLikeEntry'
import { useT } from '../../i18n'
import { PlaceCardGallery } from './PlaceCardGallery'
import { TdvPaywall } from './TdvPaywall'
import { useTdvDeck } from '../../hooks/useTdvDeck'
import { useTdvSwipe } from '../../hooks/useTdvSwipe'

function getPlaceId(p) {
  return getTdvPlaceId(p)
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
  const isPostUnlock = tdvMode === 'postUnlock'
  const [introAcknowledged, setIntroAcknowledged] = useState(() =>
    isPostUnlock ? readModifyIntroAcknowledged(tripId) : readIntroAcknowledged(tripId),
  )
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false)
  const [sheetDragY, setSheetDragY] = useState(0)
  const [sheetDragging, setSheetDragging] = useState(false)
  const [sheetDismissing, setSheetDismissing] = useState(false)
  const sheetDragRef = useRef(null)
  const sheetPanelRef = useRef(null)
  const sheetDismissingRef = useRef(false)
  const sheetDismissTimerRef = useRef(null)
  const [finalizeConfirmOpen, setFinalizeConfirmOpen] = useState(false)
  const [balloonLockWarnOpen, setBalloonLockWarnOpen] = useState(false)
  const [panelLockWarnOpen, setPanelLockWarnOpen] = useState(false)
  const [freeCapLockWarnOpen, setFreeCapLockWarnOpen] = useState(false)
  const finalizeConfirmRef = useRef(null)

  const replaceUndoStackBridgeRef = useRef(null)
  const replaceUndoStackBridge = useCallback((next) => {
    replaceUndoStackBridgeRef.current?.(next)
  }, [])

  const {
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
    error,
    setError,
    placesSource,
    deckUnavailable,
    setDeckUnavailable,
    freeCapReached,
    paidBatchCapReached,
    loadPlaces,
    handleRetryDeck,
    sessionDeckBaselineRef,
    consumedSinceSessionRef,
  } = useTdvDeck({
    tripId,
    trip,
    isActive,
    finalizingTdv,
    replaceUndoStack: replaceUndoStackBridge,
  })

  const currentPlace = places[currentIndex]
  const placeVideoLinks = useMemo(
    () => (currentPlace ? getPlaceVideoUrls(currentPlace) : []),
    [currentPlace]
  )

  const {
    swipeFeedback,
    undoStack,
    undoNotice,
    replaceUndoStack,
    handleLike,
    handleDislike,
    handleUndo,
  } = useTdvSwipe({
    tripId,
    finalizingTdv,
    onItineraryUpdate,
    currentPlace,
    totalLikes,
    placesRef,
    setPlaces,
    setLikedPlaces,
    setDislikedPlaces,
    setTotalLikes,
    setCurrentIndex,
    setError,
    setDeckUnavailable,
    sessionDeckBaselineRef,
    consumedSinceSessionRef,
  })
  replaceUndoStackBridgeRef.current = replaceUndoStack

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

  const lastTripIdRef = useRef(null)
  useEffect(() => {
    if (lastTripIdRef.current !== tripId) {
      lastTripIdRef.current = tripId
      setIntroAcknowledged(
        isPostUnlock ? readModifyIntroAcknowledged(tripId) : readIntroAcknowledged(tripId),
      )
    }
  }, [tripId, isPostUnlock])

  useEffect(() => {
    if (!freeCapReached) setFreeCapLockWarnOpen(false)
  }, [freeCapReached])

  useEffect(() => {
    if (!finalizingTdv) return
    setFinalizeConfirmOpen(false)
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

  const requestGenerateFromTdv = useCallback(() => {
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
        disabled={finalizingTdv || undoStack.length === 0}
        className={undoBtnClass}
        aria-label={t('tdv.undo_action')}
        title={t('tdv.undo_action')}
      >
        <Icon name="undo" className="text-lg lg:text-2xl" />
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
    <div className="relative isolate h-full w-full min-h-0" key={getPlaceId(currentPlace) || currentPlace.name}>
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
              ) : freeCapReached && !isPostUnlock ? (
                <TdvPaywall
                  tripId={tripId}
                  finalizingTdv={finalizingTdv}
                  warnTdvLockOnGenerate={warnTdvLockOnGenerate}
                  freeCapLockWarnOpen={freeCapLockWarnOpen}
                  setFreeCapLockWarnOpen={setFreeCapLockWarnOpen}
                  onGenerate={requestGenerateFromTdv}
                />
              ) : freeCapReached && isPostUnlock ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-3">
                  <EmptyState
                    icon="explore"
                    title={t('tdv.unlock_reload_title')}
                    description={t('tdv.unlock_reload_body')}
                    action={
                      <Button onClick={handleRetryDeck} disabled={finalizingTdv} className="rounded-full">
                        {t('tdv.retry')}
                      </Button>
                    }
                  />
                </div>
              ) : paidBatchCapReached ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-3">
                  <EmptyState
                    icon="explore_off"
                    title={t('tdv.paid_batch_cap_title')}
                    description={t('tdv.paid_batch_cap_body')}
                    action={
                      isPostUnlock && onRequestClose ? (
                        <Button onClick={onRequestClose} className="rounded-full">
                          {t('tdv.paid_batch_cap_back')}
                        </Button>
                      ) : onModifyRoteiro ? (
                        <Button
                          onClick={() => onModifyRoteiro?.(likedPlaces)}
                          className="rounded-full"
                        >
                          {t('tdv.modify_cta')}
                        </Button>
                      ) : null
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
