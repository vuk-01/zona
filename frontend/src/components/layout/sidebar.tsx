import { cva } from 'class-variance-authority'
import { useId, useState } from 'react'
import { NavLink, useLocation } from 'react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { useActiveIndicator } from '@/lib/use-active-indicator'

import { type NavAccount, type NavBadges, type NavSection, navItems } from './nav-items'
import { SidebarAccount } from './sidebar-account'
import { Wordmark } from './wordmark'

const itemVariants = cva(
  'group flex h-11 items-center gap-3 rounded-lg px-3 text-sm outline-none transition-colors duration-200 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
  {
    variants: {
      active: {
        true: 'bg-sidebar-accent font-semibold text-sidebar-foreground',
        false:
          'font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground',
      },
    },
  },
)

const iconVariants = cva('size-5 shrink-0 transition-colors duration-200', {
  variants: {
    active: {
      true: 'text-sidebar-primary',
      false: 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground',
    },
  },
})

type SidebarProps = {
  sections: NavSection[]
  // While the signed-in user loads, the mode is unknown: show placeholders, not the guest items
  isLoading: boolean
  homePath: string
  isHosting: boolean
  account: NavAccount
  badges: NavBadges
}

// Desktop only (md+): the fixed navy side menu (DESIGN.md "Layout"). The wordmark on top, the items in
// sections with small titles and, at the bottom, the account on its own surface; only the items scroll,
// so the account stays in view on a short window. The active item has a pale row, a blue icon and a blue
// accent line in the gutter, which slides to the item that opens; hover tints the row and nudges the label
// right. Wordmark, section titles and icons all start at 32 px. In dark mode the navy sits between the
// page and the cards, with a border toward the content. A count (the pending reservations) sits at the
// right end of its item as a blue pill.
export function Sidebar({ sections, isLoading, homePath, isHosting, account, badges }: SidebarProps) {
  const { pathname } = useLocation()
  const id = useId()
  const [list, setList] = useState<HTMLDivElement | null>(null)
  const active = useActiveIndicator(list, '[aria-current="page"]', pathname)

  return (
    <div className="fixed inset-y-0 left-0 z-10 hidden w-72 flex-col bg-sidebar text-sidebar-foreground md:flex dark:border-r dark:border-sidebar-border">
      <div className="px-8 pt-8 pb-4">
        <Wordmark to={homePath} isHosting={isHosting} className="text-sidebar-foreground" />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto pr-4 pb-4 pl-2">
        {isLoading ? (
          // As many placeholders as guest items: visitors and every fresh login are in guest mode, so
          // most loads do not jump (a host in host mode goes from 4 to 2)
          <div className="flex flex-col gap-2 pt-4 pl-3">
            <Skeleton className="mx-3 mb-1 h-3 w-20 rounded-full bg-sidebar-accent" />
            {Array.from({ length: navItems.guest.length }, (_, i) => (
              <Skeleton key={i} className="h-11 rounded-lg bg-sidebar-accent" />
            ))}
          </div>
        ) : (
          // pl-3 is the gutter for the accent line; this element is the items' offset parent, which the
          // line is measured against
          <div ref={setList} className="relative flex flex-col gap-6 pt-4 pl-3">
            {active && (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-0 left-0 h-6 w-1 rounded-full bg-sidebar-primary transition-[translate] duration-300 ease-out motion-reduce:transition-none"
                style={{ translate: `0 ${active.y + active.height / 2 - 12}px` }}
              />
            )}
            {sections.map((section, index) => (
              <div key={section.title} className="flex flex-col gap-1">
                <p
                  id={`${id}-${index}`}
                  className="px-3 pb-1 text-xs font-semibold tracking-wider text-sidebar-foreground/70 uppercase"
                >
                  {section.title}
                </p>
                <ul aria-labelledby={`${id}-${index}`} className="grid gap-1">
                  {section.items.map(({ to, label, icon: Icon, end }) => {
                    const badge = badges[to]
                    return (
                      <li key={to}>
                        <NavLink
                          to={to}
                          end={end}
                          className={({ isActive }) => itemVariants({ active: isActive })}
                        >
                          {({ isActive }) => (
                            <>
                              <Icon className={iconVariants({ active: isActive })} aria-hidden="true" />
                              <span className="transition-transform duration-200 motion-safe:group-hover:translate-x-0.5">
                                {label}
                              </span>
                              {badge && badge.count > 0 && (
                                <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-xs font-semibold text-sidebar-primary-foreground">
                                  <span className="sr-only">, </span>
                                  {badge.count}
                                  <span className="sr-only"> {badge.label}</span>
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
            ))}
          </div>
        )}
      </nav>
      <SidebarAccount account={account} />
    </div>
  )
}
