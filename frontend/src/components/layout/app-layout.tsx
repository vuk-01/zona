import type { ReactNode } from 'react'
import { Outlet } from 'react-router'

import type { UserMode } from '@/lib/user'

import { BottomNav } from './bottom-nav'
import { modeHome, navItems } from './nav-items'
import { Sidebar } from './sidebar'
import { Wordmark } from './wordmark'

type AppLayoutProps = {
  // Guest or host navigation. The layout must not import features, so src/app/app-shell.tsx
  // reads the signed-in user and passes the mode and the account menu in.
  mode: UserMode
  // The signed-in user is still loading, so the mode is not known yet
  isLoading: boolean
  account?: ReactNode
}

// Mobile: top bar (wordmark + account) on the sky background, content in a white sheet, floating
// bottom nav. Desktop (md+): navy sidebar with navigation only, account top right above the content,
// so nothing important sits at the bottom of the fixed sidebar where a short window can hide it.
export function AppLayout({ mode, isLoading, account }: AppLayoutProps) {
  const items = navItems[mode]
  const isHosting = !isLoading && mode === 'host'

  return (
    <div className="min-h-dvh">
      <Sidebar items={items} isLoading={isLoading} homePath={modeHome[mode]} isHosting={isHosting} />
      <div className="flex min-h-dvh flex-col md:pl-64">
        <header className="flex items-center justify-between gap-4 px-4 py-4 md:justify-end md:px-8 md:pt-6 md:pb-0">
          <div className="md:hidden">
            <Wordmark to={modeHome[mode]} isHosting={isHosting} className="text-primary" />
          </div>
          {account}
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 rounded-t-xl bg-card px-4 pt-8 pb-28 md:rounded-none md:bg-transparent md:px-8 md:pt-6 md:pb-12">
          <Outlet />
        </main>
      </div>
      <BottomNav items={items} isLoading={isLoading} />
    </div>
  )
}
