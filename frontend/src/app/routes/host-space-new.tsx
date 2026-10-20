import { useNavigate } from 'react-router'

import { PageTitle } from '@/components/layout/page-title'
import { useCurrentUser } from '@/features/auth/api/use-auth'
import { useCreateSpace } from '@/features/spaces/api/use-spaces'
import { BackToSpacesLink } from '@/features/spaces/components/back-to-spaces-link'
import { SpaceForm } from '@/features/spaces/components/space-form'
import { savedNotice } from '@/features/spaces/hooks/use-saved-notice'

// Wrapped in RequireAuth mode="host", so the user is signed in and (since switching to hosting
// turns hosting on) already a host once the page renders.
export function HostSpaceNew() {
  const navigate = useNavigate()
  const { data: user } = useCurrentUser()
  const createSpace = useCreateSpace()

  return (
    <section>
      <BackToSpacesLink />
      <PageTitle>Add a space</PageTitle>
      <SpaceForm
        isPending={createSpace.isPending}
        error={createSpace.error}
        onSubmit={(input) => {
          if (!user) return
          createSpace.mutate(
            { input, host: user },
            { onSuccess: (space) => navigate('/host/spaces', { state: savedNotice(space, true) }) },
          )
        }}
      />
    </section>
  )
}
