import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

export function Layout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-foreground dark:text-white transition-colors duration-200">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 lg:px-12 pb-24 lg:pb-8">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}
