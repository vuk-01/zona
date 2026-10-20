import { Loader2, LogOut } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { useCurrentUser, useLogout } from '../api/use-auth'

// Account slot in the top bar (all screens): "Log in" for visitors, the user's name and
// "Log out" when signed in. Logging out goes home; flushSync commits that before the user is cleared.
export function AccountMenu() {
  const location = useLocation()
  const { data: user, isPending } = useCurrentUser()
  const navigate = useNavigate()
  const logout = useLogout(() => navigate('/', { flushSync: true }))

  if (isPending) return <Skeleton className="h-9 w-24 rounded-full" />

  // A visitor (or a failed session check) can still browse; they just see "Log in".
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return (
      <Button
        asChild
        className="rounded-full px-6 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Link to={`/login?redirect=${redirect}`}>Log in</Link>
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
        className="shrink-0 rounded-full text-foreground focus-visible:ring-ring"
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
