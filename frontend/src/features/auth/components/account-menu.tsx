import { Loader2, LogOut } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

import { useCurrentUser, useLogout } from '../api/use-auth'

// Header slot: "Log in" for visitors, the user's name and "Log out" when signed in.
export function AccountMenu() {
  const location = useLocation()
  const { data: user, isPending } = useCurrentUser()
  const logout = useLogout()

  if (isPending) return <Skeleton className="h-9 w-24 rounded-full" />

  // A visitor (or a failed session check) can still browse; they just see "Log in".
  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return (
      <Button asChild className="rounded-full px-6">
        <Link to={`/login?redirect=${redirect}`}>Log in</Link>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <span title={user.name} className="hidden max-w-32 truncate text-sm font-medium sm:inline">
        {user.name}
      </span>
      <Button
        variant="outline"
        className="rounded-full"
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
