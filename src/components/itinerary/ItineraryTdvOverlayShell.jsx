import { TinderView } from './TinderView'

export function ItineraryTdvOverlayShell({ modes, tripId, trip, edit, t }) {
  if (!modes.tdvOverlayOpen) return null
  return (
    <div className="tdv-overlay-shell" aria-hidden={!modes.tdvOverlayAnimIn}>
      <div
        ref={modes.tdvOverlayPanelRef}
        className={`tdv-overlay-panel ${modes.tdvOverlayAnimIn ? 'tdv-overlay-panel--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={t('tdv.title')}
      >
        {modes.tdvOverlayContentReady ? (
          <TinderView
            tripId={tripId}
            trip={trip}
            isActive={modes.tdvOverlayAnimIn}
            onModifyRoteiro={edit.handleStartModifyRoteiro}
            onRequestClose={() => modes.closeTdvOverlay('roteiro')}
            finalizingTdv={false}
            tdvMode="postUnlock"
            warnTdvLockOnGenerate={false}
          />
        ) : null}
      </div>
    </div>
  )
}
