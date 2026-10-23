import { useLocation, useNavigate } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import type { NavAccount } from '@/components/layout/nav-items'
import { UserAvatar } from '@/components/user-avatar'
import { useCurrentUser, useLogout } from '@/features/auth/api/use-auth'
import { AccountMenu } from '@/features/auth/components/account-menu'
import { useBookings } from '@/features/bookings/api/use-bookings'

// Wires the signed-in user into the layout: the mode (visitors use guest navigation; while the session
// check loads, the layout shows placeholders so a host does not see the guest items flash), the account
// menu for the top bar on phones, the account at the bottom of the side menu (md+) and, in host mode, the
// number of pending reservations next to Reservations. The guest/host switch lives in Profile
// (src/app/routes/profile.tsx).
export function AppShell() {
  const { data: user, isPending } = useCurrentUser()
  const location = useLocation()
  const navigate = useNavigate()
  // Logging out goes home; flushSync commits that before the user is cleared (see useLogout)
  const logout = useLogout(() => navigate('/', { flushSync: true }))
  // Approving or declining refreshes every bookings query, so the count follows at once
  const isHosting = user?.mode === 'host'
  const { data: pending } = useBookings({ hostId: user?.id, status: 'pending' }, { enabled: isHosting })

  const navAccount: NavAccount = isPending
    ? { status: 'loading' }
    : user
      ? {
          status: 'signed-in',
          name: user.name,
          email: user.email,
          avatar: <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />,
          onLogout: () => logout.mutate(),
          isLoggingOut: logout.isPending,
        }
      : {
          status: 'visitor',
          loginHref: `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`,
        }

  return (
    <AppLayout
      mode={user?.mode ?? 'guest'}
      isLoading={isPending}
      account={<AccountMenu />}
      navAccount={navAccount}
      badges={
        isHosting && pending ? { '/host/reservations': { count: pending.length, label: 'pending' } } : {}
      }
    />
  )
}
