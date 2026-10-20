import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

import { modeHome } from '@/components/layout/nav-items'

import { useCurrentUser } from '../api/use-auth'
import { useRedirectTarget } from '../hooks/use-redirect-target'

type GuestOnlyProps = {
  children: ReactNode
}

// /login and /signup are for visitors. A signed-in user (also right after logging in, since the
// login and sign-up hooks store the user) goes to ?redirect=, or to the home of their mode.
// While the session check is loading the form is shown, so the page does not flash.
export function GuestOnly({ children }: GuestOnlyProps) {
  const { data: user } = useCurrentUser()
  const { redirect } = useRedirectTarget()

  if (user) return <Navigate to={redirect ?? modeHome[user.mode]} replace />
  return children
}
