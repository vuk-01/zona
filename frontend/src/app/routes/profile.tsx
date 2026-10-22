import { useNavigate } from 'react-router'

import { HeroPanel } from '@/components/layout/hero-panel'
import { modeHome } from '@/components/layout/nav-items'
import { PageTitle } from '@/components/layout/page-title'
import { Reveal } from '@/components/motion/reveal'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { ProfileDetails } from '@/features/users/components/profile-details'
import { ProfileHeader } from '@/features/users/components/profile-header'
import { ProfileModeCard } from '@/features/users/components/profile-mode-card'

// Wrapped in RequireAuth in the router, so the user is there once the page renders.
// DESIGN.md "Profile": the title and the header (photo, name, role, city) in the hero panel, then two
// cards that fade in: personal information with inline edit, and the mode.
export function Profile() {
  const navigate = useNavigate()
  const { data: user } = useCurrentUser()

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <HeroPanel>
        <PageTitle>Profile</PageTitle>
        {user && <ProfileHeader user={user} />}
      </HeroPanel>
      {user && (
        <>
          <Reveal>
            <ProfileDetails user={user} />
          </Reveal>
          <Reveal delay={90}>
            <ProfileModeCard user={user} onSwitched={(mode) => navigate(modeHome[mode])} />
          </Reveal>
        </>
      )}
    </section>
  )
}
