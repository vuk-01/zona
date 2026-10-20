import { useNavigate } from 'react-router'

import { modeHome } from '@/components/layout/nav-items'
import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { ModeSwitch } from '@/features/users/components/mode-switch'

// Wrapped in RequireAuth in the router, so the user is there once the page renders.
export function Profile() {
  const navigate = useNavigate()
  const { data: user } = useCurrentUser()

  return (
    <section>
      <PageTitle>Profile</PageTitle>
      {user && (
        <div className="mt-8 max-w-sm">
          <ModeSwitch user={user} onSwitched={(mode) => navigate(modeHome[mode])} />
        </div>
      )}
    </section>
  )
}
