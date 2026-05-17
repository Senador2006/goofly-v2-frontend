/**
 * Placeholder espelha o ItineraryActivityCard atrás do fade (RF04.5 não envia o JSON das paradas seguintes ao cliente).
 *
 * @param {{ hiddenCount: number }} props
 */

import { Icon } from '../common/Icon'

export function ItineraryPremiumNextPeek({ hiddenCount }) {
  const extras = Math.max(1, Math.floor(Number(hiddenCount) || 1))
  return (
    <div className="relative pl-8 pb-0 pointer-events-none select-none" aria-hidden="true">
      <div className="absolute left-[-5px] top-1 size-3 rounded-full bg-primary/55 border-4 border-white dark:border-card-dark ring-2 ring-primary/50 z-10" />

      <article className="relative overflow-hidden rounded-2xl border border-border-light dark:border-white/14 bg-neutral-50/98 dark:bg-[#1f1e17]/93 shadow-[0_16px_44px_-32px_rgba(0,0,0,0.5)] ring-1 ring-black/[0.04] dark:ring-white/[0.06] translate-y-[1px] opacity-[0.98]">
        <div className="relative h-[5.5rem] sm:h-28 w-full overflow-hidden bg-gradient-to-br from-neutral-200/92 via-neutral-100/82 to-neutral-200/93 dark:from-white/[0.075] dark:via-white/[0.045] dark:to-white/[0.075] animate-pulse">
          <div
            className="absolute inset-0 opacity-90 bg-[linear-gradient(105deg,transparent_0%,rgba(255,255,255,0.5)_41%,transparent_72%)] dark:bg-[linear-gradient(105deg,transparent_0%,rgba(255,255,255,0.07)_41%,transparent_72%)]"
            aria-hidden
          />
        </div>
        <div className="p-4 pb-5 relative">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-block h-[1.375rem] w-[5rem] rounded-full bg-neutral-300/78 dark:bg-white/13 animate-pulse" />
            <span className="inline-block h-3 flex-1 min-w-[2.5rem] max-w-[5.75rem] rounded-md bg-neutral-300/62 dark:bg-white/09 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-[1.0625rem] rounded-md bg-neutral-400/60 dark:bg-white/17 w-[91%] animate-pulse" />
            <div className="h-[1.0625rem] rounded-md bg-neutral-300/62 dark:bg-white/13 w-[58%] animate-pulse" />
          </div>
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-amber-400/96 dark:bg-amber-500/95 px-2.5 py-1 shadow-md text-black dark:text-black">
          <Icon name="map" className="text-[16px]" aria-hidden />
          <span className="text-[10px] font-extrabold uppercase tracking-wide leading-none">
            {extras === 1 ? '+ 1 neste dia' : `+ ${extras} neste dia`}
          </span>
        </div>
      </article>
    </div>
  )
}
