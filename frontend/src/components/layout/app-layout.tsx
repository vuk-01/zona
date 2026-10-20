import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

import { cn } from '@/lib/utils'

const links = [
  { to: '/', label: 'Home' },
  { to: '/listings', label: 'Listings' },
]

type AppLayoutProps = {
  // Account area in the header (filled in by src/app/router.tsx, since layout must not import features)
  account?: ReactNode
}

export function AppLayout({ account }: AppLayoutProps) {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-card">
        <nav className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <span className="flex-1 font-heading text-lg font-bold text-primary">Zona</span>
          <ul className="flex gap-4 text-sm sm:gap-6">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end
                  className={({ isActive }) =>
                    cn(
                      'text-muted-foreground hover:text-foreground',
                      isActive && 'font-semibold text-foreground',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
          {/* flex-1 on both sides keeps the links centered while the account area changes width */}
          <div className="flex flex-1 justify-end">{account}</div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
