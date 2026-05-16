import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const p = path.join(__dirname, '../src/components/itinerary/TinderView.jsx')
let s = fs.readFileSync(p, 'utf8')

const startMarker =
  '            <p className="text-[10px] text-text-secondary text-center max-w-xs leading-snug">'
const endMarker = '        </>          ) : tdvRestriction ? ('
const start = s.indexOf(startMarker)
const end = s.indexOf(endMarker)
if (start === -1 || end === -1) {
  console.error('markers not found', { start, end })
  process.exit(1)
}

const replacement = `              <p className="text-[11px] text-text-secondary -mt-2 text-center max-w-sm">
                Toque nas laterais da foto ou arraste para ver mais imagens · Teclado: ← descartar · → curtir
              </p>
            </>
          ) : tdvRestriction ? (`

s = s.slice(0, start) + replacement + s.slice(end + endMarker.length)

const oldContext = `      <motion className="flex-shrink-0 px-3 sm:px-4 py-2 border-b border-border-light/70 dark:border-border-dark/70 bg-white/50 dark:bg-card-dark/30">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 max-w-3xl mx-auto w-full">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Tinder de Viagens</p>
            <p className="text-base sm:text-lg font-bold text-foreground dark:text-white truncate">{destTitle}</p>
          </div>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark">
              <Icon name="calendar_today" className="text-xs text-primary" />
              Dia {currentDay}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark">
              <Icon name="favorite" className="text-xs text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
              {totalLikes} curtida{totalLikes === 1 ? '' : 's'}
            </span>
            {tdvRestriction?.maxDays != null && tdvRestriction?.tripDays != null && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/25">
                Grátis: {tdvRestriction.maxDays}/{tdvRestriction.tripDays} dias
              </span>
            )}
          </div>
        </div>
      </div>`.replaceAll('motion', 'div')

const newContext = `      <div className="flex-shrink-0 px-4 pt-4 pb-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-3xl mx-auto">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Tinder de Viagens</p>
            <p className="text-lg sm:text-xl font-bold text-foreground dark:text-white truncate">{destTitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
              <Icon name="calendar_today" className="text-sm text-primary" />
              Dia {currentDay}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-sm">
              <Icon name="favorite" className="text-sm text-primary" style={{ fontVariationSettings: "'FILL' 1" }} />
              {totalLikes} curtida{totalLikes === 1 ? '' : 's'}
            </span>
            {tdvRestriction?.maxDays != null && tdvRestriction?.tripDays != null && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/25">
                Grátis: {tdvRestriction.maxDays}/{tdvRestriction.tripDays} dias TDV
              </span>
            )}
          </div>
        </div>
      </div>`.replaceAll('motion', 'div')

if (!s.includes(oldContext.slice(0, 80))) {
  console.warn('context block may already be updated')
} else {
  s = s.replace(oldContext, newContext)
}

fs.writeFileSync(p, s)
console.log('done')
