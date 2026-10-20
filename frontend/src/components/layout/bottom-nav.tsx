import { cva } from 'class-variance-authority'
import { NavLink } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'

import type { NavItem } from './nav-items'

const itemVariants = cva(
  'flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
  {
    variants: {
      active: {
        true: 'bg-sidebar-primary text-sidebar-primary-foreground',
        false: 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
      },
    },
  },
)

type BottomNavProps = {
  items: NavItem[]
  // While the signed-in user loads, the mode is unknown: show placeholders, not the guest items
  isLoading: boolean
}

// Mobile only: floating navy pill; the active item shows its label, the others only an icon.
export function BottomNav({ items, isLoading }: BottomNavProps) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-4 bottom-4 z-10 rounded-full bg-sidebar p-2 shadow-soft md:hidden"
    >
      <ul className="flex items-center justify-around gap-1">
        {isLoading
          ? Array.from({ length: 2 }, (_, i) => (
              <li key={i}>
                <Skeleton className="h-12 w-24 rounded-full bg-sidebar-accent" />
              </li>
            ))
          : items.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  aria-label={label}
                  className={({ isActive }) => itemVariants({ active: isActive })}
                >
                  {({ isActive }) => (
                    <>
                      <Icon className="size-5" aria-hidden="true" />
                      {isActive && <span>{label}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
      </ul>
    </nav>
  )
}
