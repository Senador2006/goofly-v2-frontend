import { Icon } from '../common/Icon'
import { Button } from '../common/Button'
import { useT } from '../../i18n'
import { RoteiroModifyStopCard } from './RoteiroModifyStopCard'

/**
 * Caixinha de curtidas no modo substituição do roteiro.
 *
 * @param {'sidebar' | 'dock'} [layout]
 * `sidebar` = painel vertical (desktop). `dock` = faixa inferior (mobile).
 */
export function RoteiroModifyPanel({
  availableLikes,
  selectedLikeId,
  onSelectLike,
  onInsert,
  onConclude,
  onCancel,
  saving = false,
  canInsert = true,
  className = '',
  likeMotion = null,
  registerLikeCardRef = null,
  layout = 'sidebar',
}) {
  const t = useT()
  const isDock = layout === 'dock'

  const renderLikeCard = (like, { compact } = {}) => {
    const pid = String(like.placeId ?? like.place_id ?? like.name)
    const selected = String(selectedLikeId) === pid
    const exiting = Boolean(like._exiting) || likeMotion?.[pid] === 'exit'
    const swapHide = likeMotion?.[pid] === 'swap-hide'
    return (
      <li
        key={pid}
        className={
          compact
            ? `min-w-[11rem] w-[11rem] ${
                exiting
                  ? 'roteiro-modify-like--exit'
                  : swapHide
                    ? 'roteiro-modify-like--swap-hide'
                    : ''
              }`.trim()
            : exiting
              ? 'roteiro-modify-like--exit'
              : swapHide
                ? 'roteiro-modify-like--swap-hide'
                : undefined
        }
      >
        <RoteiroModifyStopCard
          cardRef={(el) => registerLikeCardRef?.(pid, el)}
          title={like.name || like.title || 'Curtida'}
          chipLabel="Curtida"
          chipIcon="favorite"
          selected={selected && !exiting && !swapHide}
          interactive={!exiting && !swapHide}
          disabled={exiting || swapHide}
          onClick={() => onSelectLike?.(pid)}
          role="button"
          tabIndex={exiting || swapHide ? -1 : 0}
          aria-pressed={selected}
          aria-label={like.name || like.title || 'Curtida'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelectLike?.(pid)
            }
          }}
          trailing={
            <Icon
              name={selected ? 'check_circle' : 'radio_button_unchecked'}
              className={`shrink-0 text-base ${selected ? 'text-primary' : 'text-text-secondary'}`}
              aria-hidden
            />
          }
        />
      </li>
    )
  }

  if (isDock) {
    return (
      <aside
        className={`flex shrink-0 flex-col border-t border-amber-200/90 bg-gradient-to-b from-amber-50/95 to-white dark:border-primary/25 dark:from-primary/[0.14] dark:to-card-dark ${className}`}
        aria-label={t('tdv.modify_panel_title')}
      >
        <div className="flex shrink-0 items-center gap-1.5 px-3 pt-2">
          <Icon name="favorite" className="text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
          <h3 className="text-[11px] font-black uppercase tracking-wide text-[#5c4810] dark:text-primary">
            {t('tdv.modify_panel_title')}
          </h3>
        </div>

        <div className="min-h-0 px-3 py-2">
          {availableLikes.length === 0 ? (
            <p className="py-1 text-[11px] text-text-secondary">{t('tdv.modify_panel_empty')}</p>
          ) : (
            <ul className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
              {availableLikes.map((like) => renderLikeCard(like, { compact: true }))}
            </ul>
          )}
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-amber-100 px-3 py-2 dark:border-primary/15 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {selectedLikeId ? (
            <p className="text-[10px] leading-snug text-text-secondary">{t('tdv.modify_swap_hint')}</p>
          ) : null}
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="flex-1 rounded-xl font-bold text-xs px-2"
              disabled={!selectedLikeId || !canInsert || saving}
              onClick={onInsert}
              aria-label={t('tdv.modify_insert')}
              title={t('tdv.modify_insert')}
            >
              <Icon name="add_location_alt" aria-hidden />
              {t('tdv.modify_insert_short')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="flex-1 rounded-xl font-bold text-xs px-2"
              disabled={saving}
              onClick={onCancel}
            >
              {t('tdv.modify_cancel')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="flex-1 rounded-xl font-bold text-xs px-2"
              disabled={saving}
              onClick={onConclude}
            >
              <Icon name="check" aria-hidden />
              {saving ? t('tdv.modify_saving') : t('tdv.modify_conclude')}
            </Button>
          </div>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50/90 to-white shadow-sm dark:border-primary/25 dark:from-primary/[0.12] dark:to-card-dark dark:shadow-none ${className}`}
      aria-label={t('tdv.modify_panel_title')}
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-amber-100 px-3 py-2.5 dark:border-primary/15 sm:px-3.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-[#5c4810] dark:text-primary sm:text-[13px]">
            <Icon name="favorite" className="text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
            {t('tdv.modify_panel_title')}
          </h3>
          <p className="mt-1 text-[11px] leading-snug text-text-secondary sm:text-xs">
            {t('tdv.modify_panel_hint')}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2 sm:px-2.5">
        {availableLikes.length === 0 ? (
          <p className="px-1.5 py-2 text-[11px] text-text-secondary sm:text-xs">{t('tdv.modify_panel_empty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {availableLikes.map((like) => renderLikeCard(like))}
          </ul>
        )}
      </div>

      <div className="shrink-0 space-y-2 border-t border-amber-100 px-3 py-3 dark:border-primary/15 sm:px-3.5">
        {selectedLikeId ? (
          <p className="text-[10px] leading-snug text-text-secondary sm:text-[11px]">{t('tdv.modify_swap_hint')}</p>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="w-full rounded-xl font-bold"
          disabled={!selectedLikeId || !canInsert || saving}
          onClick={onInsert}
        >
          <Icon name="add_location_alt" aria-hidden />
          {t('tdv.modify_insert')}
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1 rounded-xl font-bold"
            disabled={saving}
            onClick={onCancel}
          >
            {t('tdv.modify_cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 rounded-xl font-bold"
            disabled={saving}
            onClick={onConclude}
          >
            <Icon name="check" aria-hidden />
            {saving ? t('tdv.modify_saving') : t('tdv.modify_conclude')}
          </Button>
        </div>
      </div>
    </aside>
  )
}
