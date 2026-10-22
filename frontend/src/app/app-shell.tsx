import { useLocation, useNavigate } from 'react-router'

import { AppLayout } from '@/components/layout/app-layout'
import type { NavAccount } from '@/components/layout/nav-items'
import { useCurrentUser, useLogout } from '@/features/auth/api/use-auth'
import { AccountMenu } from '@/features/auth/components/account-menu'
import { UserAvatar } from '@/features/users/components/user-avatar'

// Wires the signed-in user into the layout: the mode (visitors use guest navigation; while the session
// check loads, the layout shows placeholders so a host does not see the guest items flash), the account
// menu for the top bar on phones, and the account at the bottom of the side menu (md+).
// The guest/host switch lives in Profile (src/app/routes/profile.tsx).
export function AppShell() {
  const { data: user, isPending } = useCurrentUser()
  const location = useLocation()
  const navigate = useNavigate()
  // Logging out goes home; flushSync commits that before the user is cleared (see useLogout)
  const logout = useLogout(() => navigate('/', { flushSync: true }))

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
    />
  )
}
