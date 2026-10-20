import { Building2, CalendarDays, CircleUser, House, type LucideIcon, Search } from 'lucide-react'

import type { UserMode } from '@/lib/user'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  // Only active on the exact path (Home would otherwise match every page)
  end?: boolean
}

const profile: NavItem = { to: '/profile', label: 'Profile', icon: CircleUser }

// Guest/host mode changes these items, never the colors (see DESIGN.md).
export const navItems: Record<UserMode, NavItem[]> = {
  guest: [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/spaces', label: 'Explore', icon: Search },
    { to: '/bookings', label: 'Bookings', icon: CalendarDays },
    profile,
  ],
  host: [{ to: '/host/spaces', label: 'My spaces', icon: Building2 }, profile],
}

// Where the app goes after switching modes, and where the wordmark links to.
export const modeHome: Record<UserMode, string> = {
  guest: '/',
  host: '/host/spaces',
}
