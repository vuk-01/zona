import { cva } from 'class-variance-authority'
import { NavLink } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'

import type { NavItem } from './nav-items'
import { Wordmark } from './wordmark'

const itemVariants = cva(
  'flex h-12 items-center gap-3 rounded-full px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
  {
    variants: {
      active: {
        true: 'bg-sidebar-primary text-sidebar-primary-foreground',
        false: 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
      },
    },
  },
)

type SidebarProps = {
  items: NavItem[]
  // While the signed-in user loads, the mode is unknown: show placeholders, not the guest items
  isLoading: boolean
  homePath: string
  isHosting: boolean
}

// Desktop only (md+): fixed navy sidebar with the wordmark and icon + label items, nothing else.
// The left edges line up: wordmark text and item icons both start at 32 px.
export function Sidebar({ items, isLoading, homePath, isHosting }: SidebarProps) {
  return (
    <div className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
      <div className="px-8 py-6">
        <Wordmark to={homePath} isHosting={isHosting} className="text-sidebar-foreground" />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-4 pb-6">
        <ul className="grid gap-1">
          {isLoading
            ? Array.from({ length: 2 }, (_, i) => (
                <li key={i}>
                  <Skeleton className="h-12 rounded-full bg-sidebar-accent" />
                </li>
              ))
            : items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink to={to} end={end} className={({ isActive }) => itemVariants({ active: isActive })}>
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </NavLink>
                </li>
              ))}
        </ul>
      </nav>
    </div>
  )
}
