import { Loader2, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { useCurrentUser, useLogout } from '../api/use-auth'

type AccountMenuProps = {
  // Opens the login dialog over the current page (src/app/login-dialog.tsx)
  onLogin: () => void
}

// Account slot in the top bar on phones (md+ has the account at the bottom of the side menu): "Log in"
// for visitors, the user's name and "Log out" when signed in. Logging out goes home; flushSync commits
// that before the user is cleared.
export function AccountMenu({ onLogin }: AccountMenuProps) {
  const { data: user, isPending } = useCurrentUser()
  const navigate = useNavigate()
  const logout = useLogout(() => navigate('/', { flushSync: true }))

  if (isPending) return <Skeleton className="h-11 w-24 rounded-full md:h-9" />

  // A visitor (or a failed session check) can still browse; they just see "Log in".
  if (!user) {
    return (
      <Button
        aria-haspopup="dialog"
        className="h-11 rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:h-9"
        onClick={onLogin}
      >
        Log in
      </Button>
    )
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <span title={user.name} className="hidden min-w-0 flex-1 truncate text-sm font-medium sm:inline">
        {user.name}
      </span>
      <Button
        variant="outline"
        className="h-11 shrink-0 rounded-full text-foreground focus-visible:ring-ring md:h-9"
        aria-label={`Log out ${user.name}`}
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
      >
        {logout.isPending ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
        Log out
      </Button>
    </div>
  )
}
