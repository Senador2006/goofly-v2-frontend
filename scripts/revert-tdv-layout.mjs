import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components/itinerary/TinderView.jsx')
let s = fs.readFileSync(file, 'utf8')

const histMarker = '          </section>\n\n          <section className="relative flex-1 min-h-[3.75rem]'
const histIdx = s.indexOf(histMarker)
if (histIdx !== -1) {
  const endMarker = '        </>\n      ) : (\n        <main className="flex-1 overflow-y-auto'
  const endIdx = s.indexOf(endMarker, histIdx)
  if (endIdx !== -1) {
    const before = s.slice(0, histIdx)
    const after = s.slice(endIdx + endMarker.length)
    const mid = `              <p className="text-[11px] text-text-secondary -mt-2 text-center max-w-sm">
                Toque nas laterais da foto ou arraste para ver mais imagens · Teclado: ← descartar · → curtir
              </p>
            </>
          ) : tdvRestriction ? (`
    s = before + mid + after
  }
}

s = s.replace(
  /\s*\) : \(\s*<main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 min-h-0">\s*<div className="w-full max-w-lg sm:max-w-xl mx-auto flex flex-col items-center gap-5">\s*\{tdvRestriction \? \(/,
  '          ) : tdvRestriction ? ('
)

s = s.replace(/\s*<\/motion>\s*<\/main>\s*\)\}/g, '\n        </div>\n      </main>')
s = s.replace(/\s*<\/div>\s*<\/main>\s*\)\}/g, '\n        </div>\n      </main>')

const compactBar = `      <div className="flex-shrink-0 px-3 sm:px-4 py-2 border-b border-border-light/70 dark:border-border-dark/70 bg-white/50 dark:bg-card-dark/30">`
const origBar = `      <div className="flex-shrink-0 px-4 pt-4 pb-3 sm:px-6">`
if (s.includes(compactBar)) {
  const start = s.indexOf(compactBar)
  const end = s.indexOf('      </motion>', start)
  const end2 = s.indexOf('      </div>', start)
  const endPos = end !== -1 && end < end2 + 20 ? end + 13 : end2 + 12
  const origBlock = `${origBar}
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
      </motion>`
  // find closing of compact bar - read between start and start+2000
  const chunk = s.slice(start, start + 2500)
  const closeIdx = chunk.indexOf('\n      </div>\n\n      <main')
  if (closeIdx !== -1) {
    s = s.slice(0, start) + origBlock.replace('</motion>', '</div>') + s.slice(start + closeIdx)
  }
}

s = s.replace('via-black/30', 'via-black/35')
s = s.replace('p-3.5 sm:p-4 text-white z-[18]', 'p-5 sm:p-7 text-white z-[18]')
s = s.replace('gap-1.5 mb-1.5 overflow-x-auto no-scrollbar', 'gap-2 mb-2 overflow-x-auto no-scrollbar pb-1')

fs.writeFileSync(file, s)
console.log('done')
