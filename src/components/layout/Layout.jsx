import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

export function Layout() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background-light dark:bg-background-dark text-foreground dark:text-white transition-colors duration-200 print:block print:h-auto print:overflow-visible">
      <Sidebar className="print:hidden" />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto overscroll-x-none p-4 pb-[var(--goofly-mobile-nav-height,4.75rem)] md:p-6 md:pb-[var(--goofly-mobile-nav-height,4.75rem)] lg:overflow-x-visible lg:overflow-y-auto lg:overscroll-auto lg:p-8 lg:px-12 lg:pb-8 print:overflow-visible print:p-0 print:pb-0">
        <Outlet />
      </main>
      <MobileNav className="print:hidden" />
    </div>
  )
}
