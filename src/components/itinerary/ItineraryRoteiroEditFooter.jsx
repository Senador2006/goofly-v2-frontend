import { Icon } from '../common/Icon'
import { Button } from '../common/Button'

export function ItineraryRoteiroEditFooter({ edit, tripId, locked }) {
  if (!edit.roteiroEditOpen || !edit.draftActivities || locked) return null
  return (
    <div className="flex-shrink-0 z-20 px-3 sm:px-6 pt-2 sm:pt-4 pb-2 sm:pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-border-light dark:border-border-dark bg-white dark:bg-card-dark flex flex-row gap-2">
      <Button type="button" size="sm" className="rounded-xl font-bold flex-1 sm:flex-none sm:min-h-[2.65rem] text-xs sm:text-sm" onClick={edit.handleSaveRoteiroDraft} disabled={edit.savingRoteiro || !tripId}>
        <Icon name="save" className="text-base" aria-hidden />
        <span className="sm:hidden">{edit.savingRoteiro ? 'Salvando…' : 'Salvar'}</span>
        <span className="hidden sm:inline">{edit.savingRoteiro ? 'Salvando…' : 'Salvar alterações'}</span>
      </Button>
      <Button type="button" variant="secondary" size="sm" className="rounded-xl font-bold flex-1 sm:flex-none sm:min-h-[2.65rem] text-xs sm:text-sm" onClick={() => {
        if (typeof globalThis.confirm === 'function' && globalThis.confirm('Descartar todas as edições não salvas neste roteiro?')) edit.handleCancelRoteiroEdit()
      }} disabled={edit.savingRoteiro}>
        <span className="sm:hidden">Cancelar</span>
        <span className="hidden sm:inline">Cancelar edição</span>
      </Button>
    </div>
  )
}
