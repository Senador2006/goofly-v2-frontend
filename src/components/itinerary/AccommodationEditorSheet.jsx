import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { AccommodationDestinationGroup } from '../planning/AccommodationStayForm'
import { AccommodationReplaceConfirmDialog } from './AccommodationReplaceConfirmDialog'
import {
  accommodationHasContent,
  createEmptyAccommodation,
  serializeAccommodation,
  validateAccommodationFields,
} from '../../utils/accommodationForm'
import {
  findChangedAccommodation,
  previewAccommodationReplacements,
  resolveAccommodationDayOverlaps,
  suggestStayWindowAllowingOverlap,
} from '../../utils/accommodationStayContract'
import { hasGoogleMapsApiKey } from '../../services/googleMapsPlacesLoader'

const TRANSITION_MS = 280
const OVERLAY_Z = 'z-[1200]'
const DISMISS_PX = 72

export function AccommodationEditorSheet({
  open,
  onClose,
  trip,
  intent = 'manage',
  focusStayId = null,
  defaultDestinationId,
  defaultCheckIn,
  saving = false,
  error = null,
  onSave,
}) {
  const destinations = trip?.destinations || []
  const [draftAccs, setDraftAccs] = useState([])
  const [localError, setLocalError] = useState(null)
  const [replacementWarnings, setReplacementWarnings] = useState([])
  const [lastEditedId, setLastEditedId] = useState(null)
  const [pendingSave, setPendingSave] = useState(null)
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef({ active: false, startY: 0 })
  const openedForRef = useRef(null)
  const focusCardRef = useRef(null)
  const didInitialScrollRef = useRef(false)

  const refreshWarnings = (list, priorityId) => {
    const warnings = previewAccommodationReplacements(list.filter(accommodationHasContent), {
      priorityId: priorityId || lastEditedId || focusStayId,
    })
    setReplacementWarnings(warnings.map((w) => w.message))
    return warnings
  }

  useEffect(() => {
    if (!open) {
      openedForRef.current = null
      didInitialScrollRef.current = false
      setPendingSave(null)
      return
    }
    const openKey = `${intent}:${focusStayId || ''}:${defaultDestinationId || ''}:${defaultCheckIn || ''}`
    if (openedForRef.current === openKey) return
    openedForRef.current = openKey
    didInitialScrollRef.current = false

    const existing = (trip?.accommodations || []).map((a) => ({ ...a }))
    const dests = trip?.destinations || []
    const dest =
      dests.find((d) => d.id === defaultDestinationId) || dests[0]
    let seededId = focusStayId
    if (intent === 'add' && dest) {
      const window = suggestStayWindowAllowingOverlap(dest, existing, defaultCheckIn)
      if (window) {
        const created = createEmptyAccommodation(dest, window, existing)
        existing.push(created)
        seededId = created.id
        setLastEditedId(created.id)
      }
    } else {
      setLastEditedId(focusStayId)
    }
    setDraftAccs(existing)
    setLocalError(null)
    setPendingSave(null)
    refreshWarnings(existing, seededId)
  }, [open, intent, focusStayId, defaultDestinationId, defaultCheckIn, trip])

  useEffect(() => {
    if (open) {
      setMounted(true)
      setDragY(0)
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(frame)
    }
    setVisible(false)
    const timer = setTimeout(() => setMounted(false), TRANSITION_MS)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!mounted || !visible || !focusStayId || didInitialScrollRef.current) return undefined
    const timer = setTimeout(() => {
      focusCardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
      didInitialScrollRef.current = true
    }, 80)
    return () => clearTimeout(timer)
  }, [mounted, focusStayId, visible])

  useEffect(() => {
    if (!mounted) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !saving && !pendingSave) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prev
    }
  }, [mounted, onClose, saving, pendingSave])

  const onHandlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { active: true, startY: e.clientY }
    setDragging(true)
  }

  const onHandlePointerMove = (e) => {
    if (!dragRef.current.active) return
    setDragY(Math.max(0, e.clientY - dragRef.current.startY))
  }

  const onHandlePointerUp = (e) => {
    if (!dragRef.current.active) return
    dragRef.current.active = false
    e.currentTarget.releasePointerCapture(e.pointerId)
    const dy = Math.max(0, e.clientY - dragRef.current.startY)
    setDragging(false)
    if (dy >= DISMISS_PX && !saving && !pendingSave) {
      setDragY(0)
      onClose()
      return
    }
    setDragY(0)
  }

  const addAccommodation = (destinationId) => {
    const dest = destinations.find((d) => d.id === destinationId)
    if (!dest) return
    const window = suggestStayWindowAllowingOverlap(dest, draftAccs, defaultCheckIn)
    if (!window) {
      setLocalError(`Não foi possível sugerir datas em ${dest.city || 'este destino'}.`)
      return
    }
    setLocalError(null)
    const created = createEmptyAccommodation(dest, window, draftAccs)
    setLastEditedId(created.id)
    setDraftAccs((prev) => {
      const next = [...prev, created]
      refreshWarnings(next, created.id)
      return next
    })
  }

  const updateAccommodation = (accId, updates) => {
    setLastEditedId(accId)
    setDraftAccs((prev) => {
      const next = prev.map((a) => (a.id === accId ? { ...a, ...updates } : a))
      refreshWarnings(next, accId)
      return next
    })
  }

  const removeAccommodation = (accId) => {
    setDraftAccs((prev) => {
      const next = prev.filter((a) => a.id !== accId)
      refreshWarnings(next, lastEditedId)
      return next
    })
  }

  const commitSave = (serialized, changed, warningMessages) => {
    setPendingSave(null)
    onSave(serialized, changed, warningMessages)
  }

  const handleSubmit = () => {
    const toPersist = draftAccs.filter(accommodationHasContent)
    const { accommodations: resolved, warnings } = resolveAccommodationDayOverlaps(toPersist, {
      priorityId: lastEditedId || focusStayId,
    })
    const err = validateAccommodationFields(destinations, resolved, {
      requireCoordinates: hasGoogleMapsApiKey(),
      resolveOverlaps: false,
    })
    if (err) {
      setLocalError(err)
      return
    }
    setLocalError(null)
    const warningMessages = warnings.map((w) => w.message)
    setReplacementWarnings(warningMessages)
    const serialized = resolved.map(serializeAccommodation)
    const changed = findChangedAccommodation(trip?.accommodations || [], serialized)

    if (warningMessages.length > 0) {
      setPendingSave({ serialized, changed, warningMessages })
      return
    }
    commitSave(serialized, changed, warningMessages)
  }

  if (!mounted || typeof document === 'undefined') return null

  const sheetOffset = visible ? dragY : 24
  const displayError = localError || error

  return createPortal(
    <>
      <div
        className={`fixed inset-0 ${OVERLAY_Z} flex items-end justify-center p-0 sm:items-center sm:p-6`}
        role="presentation"
        onClick={() => {
          if (!saving && !pendingSave) onClose()
        }}
      >
        <div
          className={`absolute inset-0 bg-foreground/40 dark:bg-black/65 backdrop-blur-[3px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
            visible ? 'opacity-100' : 'opacity-0'
          }`}
          aria-hidden
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="accommodation-editor-title"
          className={`relative flex max-h-[min(92dvh,44rem)] w-full max-w-[100vw] flex-col overflow-hidden rounded-t-3xl border-x-0 border-b-0 border-t border-border-light bg-white shadow-2xl dark:border-white/10 dark:bg-card-dark dark:shadow-black/50 sm:max-w-lg sm:rounded-2xl sm:border motion-reduce:transition-none ${
            dragging ? '' : 'transition-all duration-300 ease-out'
          } ${visible ? 'opacity-100 sm:scale-100' : 'opacity-0 sm:scale-[0.96]'}`}
          style={{ transform: `translate3d(0, ${sheetOffset}px, 0)` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex cursor-grab touch-none justify-center pt-[max(0.625rem,env(safe-area-inset-top))] pb-1 active:cursor-grabbing sm:hidden sm:pt-2.5"
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
            aria-label="Arraste para fechar"
          >
            <span className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-white/20" />
          </div>

          <div className="flex items-start justify-between gap-3 px-4 pt-2 sm:px-5 sm:pt-5">
            <div className="min-w-0 flex-1 pr-1">
              <h2
                id="accommodation-editor-title"
                className="text-base font-black tracking-tight text-foreground dark:text-white"
              >
                Gerenciar hospedagens
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-text-secondary dark:text-zinc-400">
                Várias estadias são permitidas. Se as datas se cruzarem, a hospedagem mais recente
                substitui a anterior nos dias em comum.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving || Boolean(pendingSave)}
              className="shrink-0 rounded-full p-1.5 text-text-secondary dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Fechar"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 space-y-4 sm:px-5">
            {destinations.map((dest) => (
              <AccommodationDestinationGroup
                key={dest.id}
                dest={dest}
                destAccs={draftAccs.filter(
                  (a) => (a.destinationId || a.destination_id) === dest.id,
                )}
                destinations={destinations}
                disabled={saving || Boolean(pendingSave)}
                fieldIdPrefix="itinerary-acc"
                requirePlaceSuggestion
                onAdd={addAccommodation}
                onChange={updateAccommodation}
                onRemove={removeAccommodation}
                focusStayId={focusStayId}
                focusCardRef={focusCardRef}
              />
            ))}
            {replacementWarnings.length > 0 ? (
              <div className="space-y-1.5" role="status">
                {replacementWarnings.map((msg) => (
                  <p
                    key={msg}
                    className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed bg-amber-500/10 rounded-xl px-3 py-2"
                  >
                    {msg}
                  </p>
                ))}
              </div>
            ) : null}
            {displayError ? (
              <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed" role="alert">
                {displayError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 border-t border-border-light dark:border-border-dark px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
            <Button
              type="button"
              className="rounded-xl font-bold w-full"
              onClick={handleSubmit}
              disabled={saving || Boolean(pendingSave)}
            >
              {saving ? 'Salvando…' : 'Salvar hospedagens'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl font-bold w-full"
              onClick={onClose}
              disabled={saving || Boolean(pendingSave)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </div>

      <AccommodationReplaceConfirmDialog
        open={Boolean(pendingSave)}
        messages={pendingSave?.warningMessages || []}
        confirming={saving}
        onCancel={() => setPendingSave(null)}
        onConfirm={() => {
          if (!pendingSave) return
          commitSave(pendingSave.serialized, pendingSave.changed, pendingSave.warningMessages)
        }}
      />
    </>,
    document.body,
  )
}
