import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'

import { modeHome } from '@/components/layout/nav-items'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserMode } from '@/lib/user'

import { useCurrentUser } from '../api/use-auth'

type RequireAuthProps = {
  children: ReactNode
  // Host pages also need host mode.
  mode?: UserMode
}

// Pages that need a signed-in user (bookings, profile, host pages). A visitor goes to
// /login?redirect=<this page> and comes back here after logging in.
export function RequireAuth({ children, mode }: RequireAuthProps) {
  const location = useLocation()
  const { data: user, isPending } = useCurrentUser()

  if (isPending) return <Skeleton className="h-9 w-48 rounded-full" />

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  // Wrong mode: go to the home of the mode the user is in. Switching from host to guest on a host
  // page lands there too, so this redirect and the switch's own navigation agree on the target.
  if (mode && user.mode !== mode) return <Navigate to={modeHome[user.mode]} replace />

  return children
}
