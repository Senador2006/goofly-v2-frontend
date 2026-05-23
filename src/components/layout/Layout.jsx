import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-foreground dark:text-white transition-colors duration-200 print:block print:h-auto print:overflow-visible">
      <Sidebar className="print:hidden" />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 lg:px-12 pb-24 lg:pb-8 print:overflow-visible print:p-0 print:pb-0">
        <Outlet />
      </main>
      <MobileNav className="print:hidden" />
    </div>
  )
}
