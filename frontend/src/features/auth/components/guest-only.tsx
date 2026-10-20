import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { useCurrentUser } from '../api/use-auth'
import { useRedirectTarget } from '../hooks/use-redirect-target'

type GuestOnlyProps = {
  children: ReactNode
}

// /login and /signup are for visitors: a signed-in user is sent on to ?redirect= or home.
// While the session check is loading the form is shown, so the page does not flash.
export function GuestOnly({ children }: GuestOnlyProps) {
  const { data: user } = useCurrentUser()
  const { redirectTo } = useRedirectTarget()

  if (user) return <Navigate to={redirectTo} replace />
  return children
}
