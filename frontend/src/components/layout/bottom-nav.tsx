import { cva } from 'class-variance-authority'
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { useActiveIndicator } from '@/lib/use-active-indicator'

import { type NavBadges, type NavItem, navItems } from './nav-items'

const tabVariants = cva(
  'flex h-16 flex-col items-center justify-center gap-1 text-xs outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-inset',
  {
    variants: {
      active: {
        true: 'font-semibold text-sidebar-foreground',
        false: 'font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground',
      },
    },
  },
)

// The active tab's icon is blue; the others take the label's color
const iconVariants = cva('size-5 transition-colors duration-200', {
  variants: {
    active: {
      true: 'text-sidebar-primary',
      false: '',
    },
  },
})

type BottomNavProps = {
  items: NavItem[]
  // While the signed-in user loads, the mode is unknown: show placeholders, not the guest items
  isLoading: boolean
  badges: NavBadges
}

// Phones only: a full-width navy tab bar at the bottom (DESIGN.md "Layout") with every item as icon and
// label. The active tab has a blue icon, a semibold label and a short blue line on top, which slides to
// the tab that opens. It keeps clear of the phone's home indicator (safe area); a border line outlines it.
// A count (the pending reservations) sits on the top right of its icon as a small blue pill.
export function BottomNav({ items, isLoading, badges }: BottomNavProps) {
  const { pathname } = useLocation()
  const [list, setList] = useState<HTMLDivElement | null>(null)
  const active = useActiveIndicator(list, '[aria-current="page"]', pathname)

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] text-sidebar-foreground md:hidden"
    >
      {isLoading ? (
        // As many placeholders as guest items: visitors and every fresh login are in guest mode
        <div className="flex h-16 items-center justify-around">
          {Array.from({ length: navItems.guest.length }, (_, i) => (
            <Skeleton key={i} className="h-10 w-14 rounded-lg bg-sidebar-accent" />
          ))}
        </div>
      ) : (
        // The tabs' offset parent, which the line is measured against
        <div ref={setList} className="relative">
          {active && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0 left-0 h-1 w-8 rounded-b-full bg-sidebar-primary transition-[translate] duration-300 ease-out motion-reduce:transition-none"
              style={{ translate: `${active.x + active.width / 2 - 16}px 0` }}
            />
          )}
          <ul className="grid auto-cols-fr grid-flow-col">
            {items.map(({ to, label, icon: Icon, end }) => {
              const badge = badges[to]
              return (
                <li key={to}>
                  <NavLink to={to} end={end} className={({ isActive }) => tabVariants({ active: isActive })}>
                    {({ isActive }) => (
                      <>
                        <span className="relative">
                          <Icon className={iconVariants({ active: isActive })} aria-hidden="true" />
                          {badge && badge.count > 0 && (
                            <span
                              aria-hidden="true"
                              className="absolute -top-1.5 left-3 h-4 min-w-4 rounded-full bg-sidebar-primary px-1 text-center text-xs leading-4 font-semibold text-sidebar-primary-foreground ring-2 ring-sidebar"
                            >
                              {badge.count}
                            </span>
                          )}
                        </span>
                        {label}
                        {badge && badge.count > 0 && (
                          <span className="sr-only">
                            , {badge.count} {badge.label}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </nav>
  )
}
