import { cva } from 'class-variance-authority'
import { NavLink } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'

import { type NavItem, navItems } from './nav-items'

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

// Placeholders shaped like the items: the active one is a wide pill, the others are icons
const placeholderVariants = cva('h-12 rounded-full bg-sidebar-accent', {
  variants: {
    active: {
      true: 'w-24',
      false: 'w-12',
    },
  },
})

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
        {/* As many placeholders as guest items: visitors and every fresh login are in guest mode, so
            most loads do not jump (a host in host mode goes from 4 to 2). All four fit at 375 px. */}
        {isLoading
          ? Array.from({ length: navItems.guest.length }, (_, i) => (
              <li key={i}>
                <Skeleton className={placeholderVariants({ active: i === 0 })} />
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
