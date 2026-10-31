import { useNavigate } from 'react-router'

import { HeroPanel } from '@/components/layout/hero-panel'
import { PageTitle } from '@/components/layout/page-title'
import { useCreateSpace } from '@/features/spaces/api/use-spaces'
import { BackToSpacesLink } from '@/features/spaces/components/back-to-spaces-link'
import { SpaceForm } from '@/features/spaces/components/space-form'
import { savedNotice } from '@/features/spaces/hooks/use-saved-notice'

// Wrapped in RequireAuth mode="host", so the user is signed in and (since switching to hosting
// turns hosting on) already a host once the page renders. The back link and the title share the hero
// panel; the form's sections are cards below it.
export function HostSpaceNew() {
  const navigate = useNavigate()
  const createSpace = useCreateSpace()

  return (
    <section className="flex flex-col gap-6 md:gap-8">
      <HeroPanel>
        <div className="flex flex-col gap-2">
          <BackToSpacesLink />
          <PageTitle>Add a space</PageTitle>
        </div>
      </HeroPanel>
      <SpaceForm
        isPending={createSpace.isPending}
        error={createSpace.error}
        onSubmit={(input) =>
          // The backend takes the host from the token
          createSpace.mutate(input, {
            onSuccess: (space) => navigate('/host/spaces', { state: savedNotice(space, true) }),
          })
        }
      />
    </section>
  )
}
