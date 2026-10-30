import {
  Building2,
  CalendarCheck,
  CalendarDays,
  CircleUser,
  Heart,
  House,
  type LucideIcon,
  Search,
} from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'

import type { UserMode } from '@/lib/user'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  // Only active on the exact path (Home would otherwise match every page)
  end?: boolean
  // The page needs a signed-in user (RequireAuth in src/app/router.tsx)
  requiresAuth?: boolean
}

// A count next to an item (the host's pending reservations). `label` says what is counted, for screen
// readers: "Reservations, 2 pending".
export type NavBadge = {
  count: number
  label: string
}

// Badges by item path. src/app/app-shell.tsx fills them, since layout imports no features.
export type NavBadges = Partial<Record<string, NavBadge>>

// A group of items in the side menu, under a small title
export type NavSection = {
  title: string
  items: NavItem[]
}

const home: NavItem = { to: '/', label: 'Home', icon: House, end: true }
const explore: NavItem = { to: '/spaces', label: 'Explore', icon: Search }
const favorites: NavItem = { to: '/favorites', label: 'Favorites', icon: Heart, requiresAuth: true }
const bookings: NavItem = { to: '/bookings', label: 'Bookings', icon: CalendarDays, requiresAuth: true }
const mySpaces: NavItem = { to: '/host/spaces', label: 'My spaces', icon: Building2, requiresAuth: true }
const reservations: NavItem = {
  to: '/host/reservations',
  label: 'Reservations',
  icon: CalendarCheck,
  requiresAuth: true,
}
const profile: NavItem = { to: '/profile', label: 'Profile', icon: CircleUser, requiresAuth: true }

// Guest/host mode changes these items, never the colors (see DESIGN.md). The side menu shows them in
// sections; the tab bar on phones shows the same items in one row (navItems).
export const navSections: Record<UserMode, NavSection[]> = {
  guest: [
    { title: 'Discover', items: [home, explore] },
    { title: 'You', items: [favorites, bookings, profile] },
  ],
  host: [
    { title: 'Hosting', items: [mySpaces, reservations] },
    { title: 'You', items: [profile] },
  ],
}

export const navItems: Record<UserMode, NavItem[]> = {
  guest: navSections.guest.flatMap((section) => section.items),
  host: navSections.host.flatMap((section) => section.items),
}

// For a visitor (onProtectedNav is set), a click on an item that needs a signed-in user opens the login
// dialog over the page instead of following the link; undefined otherwise. A click that opens a new tab or
// window (a modifier key or another button, like React Router's own check) still follows the link, and
// RequireAuth sends that tab to /login.
export function protectedNavClick(item: NavItem, onProtectedNav: ((to: string) => void) | undefined) {
  if (!item.requiresAuth || !onProtectedNav) return undefined
  return (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onProtectedNav(item.to)
  }
}

// The account at the bottom of the side menu. src/app/app-shell.tsx fills it from the auth and users
// features, since layout imports no features.
export type NavAccount =
  | { status: 'loading' }
  // "Log in" opens the login dialog over the current page
  | { status: 'visitor'; onLogin: () => void }
  | {
      status: 'signed-in'
      name: string
      email: string
      // The user's photo or initials (UserAvatar)
      avatar: ReactNode
      onLogout: () => void
      isLoggingOut: boolean
    }

// Where the app goes after switching modes, and where the wordmark links to.
export const modeHome: Record<UserMode, string> = {
  guest: '/',
  host: '/host/spaces',
}
