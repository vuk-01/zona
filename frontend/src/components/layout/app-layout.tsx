import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import type { UserMode } from '@/lib/user'

import { BottomNav } from './bottom-nav'
import { type NavAccount, type NavBadges, modeHome, navItems, navSections } from './nav-items'
import { Sidebar } from './sidebar'
import { ThemeToggle } from './theme-toggle'
import { Wordmark } from './wordmark'

type AppLayoutProps = {
  // Guest or host navigation. The layout must not import features, so src/app/app-shell.tsx
  // reads the signed-in user and passes the mode and the account in.
  mode: UserMode
  // The signed-in user is still loading, so the mode is not known yet
  isLoading: boolean
  // Phones: the account in the top bar
  account?: ReactNode
  // md+: the account at the bottom of the side menu
  navAccount: NavAccount
  // Counts next to nav items, by path (the host's pending reservations)
  badges?: NavBadges
  // Set by src/app/app-shell.tsx for a visitor: Favorites, Bookings and Profile in the side menu and the
  // tab bar open the login dialog over the page, which goes to that page once they are signed in
  onProtectedNav?: (to: string) => void
}

// Mobile: top bar (wordmark, theme toggle + account) on the sky background, content in a white sheet,
// the tab bar at the bottom. Desktop (md+): the navy side menu with the navigation and, at its bottom,
// the account; the theme toggle top right above the content. Toasts come in bottom right, above the tab
// bar on phones (the Toaster is mounted in src/app/providers.tsx, for the auth pages too).
export function AppLayout({
  mode,
  isLoading,
  account,
  navAccount,
  badges = {},
  onProtectedNav,
}: AppLayoutProps) {
  const isHosting = !isLoading && mode === 'host'

  return (
    <div className="min-h-dvh">
      <Sidebar
        sections={navSections[mode]}
        isLoading={isLoading}
        homePath={modeHome[mode]}
        isHosting={isHosting}
        account={navAccount}
        badges={badges}
        onProtectedNav={onProtectedNav}
      />
      <div className="flex min-h-dvh flex-col md:pl-72">
        <header className="flex items-center justify-between gap-4 px-4 py-4 md:justify-end md:px-8 md:pt-6 md:pb-0">
          <div className="md:hidden">
            <Wordmark to={modeHome[mode]} isHosting={isHosting} className="text-primary" />
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <ThemeToggle />
            <div className="min-w-0 md:hidden">{account}</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 rounded-t-xl bg-sheet px-4 pt-8 pb-28 md:rounded-none md:bg-transparent md:px-8 md:pt-6 md:pb-12">
          <Outlet />
        </main>
      </div>
      <BottomNav
        items={navItems[mode]}
        isLoading={isLoading}
        badges={badges}
        onProtectedNav={onProtectedNav}
      />
    </div>
  )
}
