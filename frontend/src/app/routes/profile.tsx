import { useNavigate } from 'react-router'

import { modeHome } from '@/components/layout/nav-items'
import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { ProfileDetails } from '@/features/users/components/profile-details'
import { ProfileHeader } from '@/features/users/components/profile-header'
import { ProfileModeCard } from '@/features/users/components/profile-mode-card'

// Wrapped in RequireAuth in the router, so the user is there once the page renders.
// Three cards (DESIGN.md "Profile"): header, personal information with inline edit, and the mode.
export function Profile() {
  const navigate = useNavigate()
  const { data: user } = useCurrentUser()

  return (
    <section>
      <PageTitle>Profile</PageTitle>
      {user && (
        <div className="mt-8 flex flex-col gap-6">
          <ProfileHeader user={user} />
          <ProfileDetails user={user} />
          <ProfileModeCard user={user} onSwitched={(mode) => navigate(modeHome[mode])} />
        </div>
      )}
    </section>
  )
}
