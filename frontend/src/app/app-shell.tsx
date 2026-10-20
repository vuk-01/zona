import { AppLayout } from '@/components/layout/app-layout'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { AccountMenu } from '@/features/auth/components/account-menu'

// Wires the signed-in user's mode into the layout. Visitors use guest navigation; while the session
// check loads, the layout shows placeholders so a host does not see the guest items flash.
// The guest/host switch lives in Profile (src/app/routes/profile.tsx).
export function AppShell() {
  const { data: user, isPending } = useCurrentUser()

  return <AppLayout mode={user?.mode ?? 'guest'} isLoading={isPending} account={<AccountMenu />} />
}
