import { GooflyLogo } from '../branding/GooflyLogo'

export const AUTH_INPUT_CLASS =
  'w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 text-foreground dark:text-white placeholder:text-text-secondary focus:ring-2 focus:ring-primary focus:outline-none'

export function AuthPageLayout({ title, error, children, footer }) {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-foreground dark:text-white flex items-center justify-center p-4 transition-colors duration-200">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-start gap-3 mb-10 w-full -ml-3">
          <GooflyLogo heightClass="h-16 sm:h-20" className="max-w-[min(100%,22rem)] -translate-x-2" />
          <p className="text-xs text-text-secondary uppercase tracking-widest text-left">
            Travel Planner
          </p>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-2xl p-8 shadow-lg border border-border-light dark:border-border-dark">
          <h2 className="text-2xl font-black mb-6">{title}</h2>
          {error ? (
            <div className="mb-4 p-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm">
              {error}
            </div>
          ) : null}
          {children}
          {footer}
        </div>
      </div>
    </div>
  )
}
