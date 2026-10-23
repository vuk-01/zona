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
import type { ReactNode } from 'react'

import type { UserMode } from '@/lib/user'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  // Only active on the exact path (Home would otherwise match every page)
  end?: boolean
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
const favorites: NavItem = { to: '/favorites', label: 'Favorites', icon: Heart }
const bookings: NavItem = { to: '/bookings', label: 'Bookings', icon: CalendarDays }
const mySpaces: NavItem = { to: '/host/spaces', label: 'My spaces', icon: Building2 }
const reservations: NavItem = { to: '/host/reservations', label: 'Reservations', icon: CalendarCheck }
const profile: NavItem = { to: '/profile', label: 'Profile', icon: CircleUser }

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

// The account at the bottom of the side menu. src/app/app-shell.tsx fills it from the auth and users
// features, since layout imports no features.
export type NavAccount =
  | { status: 'loading' }
  | { status: 'visitor'; loginHref: string }
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
